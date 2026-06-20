# Code Audit V5 — Pulse Fitness (0-to-Z)

**Audit Date:** 2026-06-20
**Auditor:** Explore Sub-Agent (TASK `CODE-AUDIT-V5`)
**Repo:** `/home/z/my-project` · branch `main` · HEAD `7e1d9f6`
**Stack:** Next.js 16 · React 19 · TS 5 · Tailwind 4 · Prisma 6 · SQLite · Firebase Auth + Storage · Zustand · Dexie/IndexedDB · Recharts · Framer-Motion · Vitest

---

## Executive Summary

| Metric | Value |
|---|---|
| Source files reviewed | 76 (all 64 listed + 12 secondary stores/services/hooks) |
| Test files | 15 (≈170 test cases, ~2,502 LOC) |
| Critical issues | **10** |
| High issues | **18** |
| Medium issues | **22** |
| Low issues | **28** |
| Features complete | 71 / 95 (75 %) |
| Features partial | 16 / 95 (17 %) |
| Features missing | 8 / 95 (8 %) |
| CI/CD pipeline | **None** |
| Production-readiness | **❌ NOT production-ready** (10 critical blockers) |

### Headline finding
The app is a sophisticated offline-first fitness tracker with a strong algorithmic core (ACWR fatigue, RPE-based overload, MEV/MAV volume, learning loop). However it **cannot be deployed to production as-is**: the Caddyfile exposes an open-proxy SSRF, API routes trust client-supplied identity headers, AI endpoints lack authenticated authorization, Firebase ID tokens are stored in 7-day cookies despite their 1-hour TTL, and zero CI/CD or error-monitoring exists. Several user-facing flows (profile name update, cloud sync) are already silently broken.

---

## A. SaaS Readiness

### A.1 Multi-tenant Data Isolation — 🟠 PARTIAL

**Server-side (Prisma + SQLite — shared data):**

| Route | Isolation strategy | Verdict |
|---|---|---|
| `POST /api/social/feed` | `requireUser` + `callerUid === body.authorUid` | ✅ Secure |
| `DELETE /api/social/posts` | `requireUser` + ownership check on `post.authorUid` | ✅ Secure |
| `POST /api/social/follow` | `requireUser` + `follower === callerUid` | ✅ Secure |
| `DELETE /api/social/follow` | same | ✅ Secure |
| `POST /api/social/kudos` | `requireUser` only — **no (user, post) uniqueness** | 🟠 Anonymous-style increment, infinite kudos spam |
| `POST /api/social/comments` | `requireUser` for uid, but `x-user-name` & `x-user-photo` headers are client-supplied and persisted unverified (`src/app/api/social/comments/route.ts:24-26`) | 🔴 Identity spoofing — any logged-in user can post under another user's name/photo |
| `DELETE /api/social/comments` | ownership check vs `comment.authorUid` | ✅ Secure |
| `POST /api/social/profile` | `requireUser` + `uid === callerUid` | ✅ Secure (but see §A.5 — caller in `ProfilePage.tsx:70-74` omits `uid` from body, so the route always 400s) |
| `POST /api/challenges/sync-volume` | `requireUser` + `userId === callerUid` + idempotency on `(participationId, sessionId)` | ✅ Secure |
| `POST /api/challenges/[challengeId]/join` | `requireUser` + `userId === callerUid` | ✅ Secure |
| `GET /api/challenges/[challengeId]/progress` | **No auth check** — anyone can read any user's challenge progress by guessing `userId` | 🟠 PII leak (userName, userPhotoURL exposed) |
| `GET /api/challenges/[challengeId]/leaderboard` | **No auth check** — anyone can scrape the leaderboard | 🟠 Acceptable for public challenge but should require login |
| `GET /api/social/feed` | **No auth check** — public read of all 50 latest posts including author names/photos | 🟠 Data exfiltration risk |
| `GET /api/social/following` | **No auth check** — anyone can enumerate any user's follow graph by `?uid=` | 🔴 Stalking/enumeration risk |
| `GET /api/social/search` | **No auth check** — public user search by display name | 🟠 Acceptable but should rate-limit aggressively |
| `POST /api/ai-coach` | **No `requireUser`** — only middleware's cookie-existence check | 🔴 See A.3 |
| `POST /api/ai-workout` | **No `requireUser`** — only middleware's cookie-existence check | 🔴 See A.3 |

**Client-side (IndexedDB — local data):**
- All Dexie tables (`workoutSessions`, `bodyMeasurements`, `progressPhotos`, `foodEntries`, `routines`, `exerciseFeedback`, `unlockedAchievements`, `userProfile`, `nutritionGoals`) live in a single shared DB `PulseDB` keyed only by browser origin.
- **No multi-account support on the same browser.** When User A logs out and User B logs in on the same device, User B sees User A's workout history, photos, and nutrition logs. There is no per-uid partition or sign-out data wipe.
- `useSyncStore` and `useAchievementsStore` make no attempt to scope data to the current Firebase uid.

**Verdict:** Server-side mostly OK (with the comment-spoofing hole), client-side has a fundamental single-user assumption that breaks for shared devices.

### A.2 Rate Limiting — 🟡 PARTIAL

- Middleware (`src/middleware.ts`) implements a token-bucket limiter keyed on `${ip}:${pathname}` with sensible per-route caps (AI-workout 5/min, comments 20/min, feed 30/min, default 120/min).
- **Memory-only bucket map** — resets on every serverless cold start, so an attacker can simply retry to bypass. No Redis/distributed store.
- **`x-forwarded-for` is trusted verbatim** (`getClientIp` line 67-69) — an attacker can spoof an arbitrary IP via `X-Forwarded-For: 1.2.3.4` header to get a fresh bucket. Should validate against a trusted proxy chain.
- **No per-user rate limit** — only per-IP. A logged-in user behind a NAT (gym Wi-Fi) shares a bucket with everyone else.
- **No CSRF tokens** — cookie is `sameSite: "lax"`, JSON body provides implicit protection, but DELETE/POST endpoints could be targeted by a malicious page using `fetch` with `mode: "no-cors"`.
- **Cleanup interval** is 5 minutes (`cleanupBuckets`), which is fine for memory bounds but means stale buckets can accumulate quickly under attack.

### A.3 API Key Security — 🔴 CRITICAL

| Key | Location | Risk |
|---|---|---|
| `OPENROUTER_API_KEY=sk-or-v1-1deb…` | `.env` line 2 | 🔴 Real, valid key committed to local disk. `.gitignore` covers `.env*` so it is NOT in git, but: (1) no rotation policy documented, (2) any process/agent with read access to `/home/z/my-project/.env` can drain quota, (3) the key is hardcoded rather than read from a secret manager. |
| `OPENROUTER_MODEL=meta-llama/llama-3.1-8b-instruct:free` | `.env` line 3 | 🟡 Using the free tier — lower risk but lower quality. |
| `NEXT_PUBLIC_FIREBASE_*` (6 keys) | `.env` lines 5-11 | 🟢 These are designed to be public (Firebase web SDK). However they expose the project ID and could be used to spam sign-ups. |
| `SERVICE_ACCOUNT_PATH=./service-account.json` | `.env` line 13 | 🟡 File not in repo (gitignored), but `firebaseAdmin.ts` falls back to `process.cwd() + "/service-account.json"` and `service-account.json` literal — if someone drops a file there, it works silently. No checksum/validation. |
| `GROQ_API_KEY`, `GEMINI_API_KEY` | referenced in `src/server/aiProviders.ts` but **NOT in `.env`** | 🟡 These providers will be skipped at runtime (`isAvailable() === false`), but there's no warning at startup. |
| `PULSE_JWT_SECRET` | referenced in `ARCHITECTURE.md` (claims HS256 JWT) but **never used in code** | 🔴 Architecture doc lies — no JWT is used; `authServer.ts` calls `adminAuth.verifyIdToken` directly. Doc-code drift. |

**Critical exposure:** `/api/ai-coach` and `/api/ai-workout` only require the `pulse_session` cookie to **exist** (middleware check). They never call `requireUser`. An attacker can:
1. Set `pulse_session=anything` cookie
2. POST to `/api/ai-coach` with arbitrary prompts
3. Burn OpenRouter quota, hit upstream rate limits, and potentially extract API keys via error messages.

### A.4 Scalability Bottlenecks — 🟠 HIGH

| Bottleneck | Location | Impact |
|---|---|---|
| `verifyIdToken` on every request | `src/lib/authServer.ts:22` | Each protected API call makes a network round-trip to Firebase (cached only briefly). With 100 RPS this becomes 100 Firebase calls/sec. |
| `prisma.$transaction` with sequential `for` loop | `src/app/api/challenges/sync-volume/route.ts:56-106` | For each participation (could be 100s), the loop does `findUnique` + `update` + `create` — N+1 pattern inside a transaction. |
| `findMany({ orderBy: { createdAt: "desc" }, take: 50 })` on feed | `src/app/api/social/feed/route.ts:29-31` | OK at small scale; will slow as posts grow. No cursor pagination — clients fetch the same top-50 every refresh. |
| In-memory rate-limit Map | `src/middleware.ts:8` | Resets on cold start, leaks memory between serverless invocations. |
| `getRecentCompletedSessions` Dexie filter | `src/store/useWorkoutStore.ts:103-121` | Full table scan `.filter(s => s.completed === true).reverse().limit(10)`. The `completed` index declared in schema cannot be used (booleans can't be IDB keys per the comment in `analytics.ts:9-12`). OK at 500 sessions, slow at 50,000. |
| `evaluateAchievements` loops all ACHIEVEMENTS × all completedSessions | `src/store/useAchievementsStore.ts:43-61` | O(A × S) per call, called after every workout finish. |
| No connection pool sizing for Prisma | `src/lib/db.ts:9-11` | Default pool; SQLite is single-writer anyway so this is OK but a Postgres migration would need tuning. |
| `localStorage` used as exercise cache (~1300 exercises) | `src/services/exerciseService.ts:67-74` | Storing 1300 JSON-stringified exercises in localStorage is ~1MB per user — works but slow to parse on every page load. Should be in IndexedDB. |
| `useBackgroundSync` polls `syncAll` every 5 min | `src/hooks/useBackgroundSync.ts:15-17` | Sync is a no-op (`pushToCloud` returns nothing) so it's just CPU churn — but the intent is to add a real backend later. |

### A.5 Data Backup & Export — 🟡 PARTIAL

**What works:**
- `src/lib/syncEngine.ts:exportLocalBackup()` exports all Dexie tables (workouts, body, photos, routines, nutrition, achievements, profile) as a JSON blob with base64-encoded Blobs for photos.
- `importLocalBackup()` re-imports the same format.
- Triggered from `SettingsPage` (Download button).

**What's missing:**
- **No server-side backup.** The SQLite DB at `db/custom.db` (per `.gitignore` line 84) holds all social posts, follows, challenges, participations, comments. There is no scheduled dump, no S3 snapshot, no `pg_dump` equivalent.
- **No per-user data export from the server.** A user cannot export their social posts/comments/follow graph. Likely violates GDPR Article 20 (right to data portability).
- **No per-user data deletion endpoint.** `DELETE /api/social/posts` deletes one post; there's no "delete my account" route that wipes PublicProfile + Follow + FeedPost + Comment + Participation + SyncedWorkoutSession for a user. GDPR Article 17 violation.
- **`ProfilePage.handleSaveName` (line 70-74) is broken** — calls `POST /api/social/profile` with `{ displayName }` only, missing required `uid`. Server returns 400. The "Profile name updated!" toast is a lie.

### A.6 Error Monitoring & Logging — 🔴 CRITICAL

- **No Sentry / Datadog / Bugsnag / LogRocket** (grep returned 0 matches).
- **No structured logger** — every error is `console.error(...)` (~98 occurrences across 40 files). On Vercel/bun these go to stdout and disappear.
- **`ErrorBoundary` exists** (`src/components/ErrorBoundary.tsx`) but only catches render errors, not async/API errors.
- **No error reporting to backend** — failed `fetch` calls in stores (`useSocialStore`, `useChallengesStore`, `useNutritionStore`) are silently `console.error`'d and swallowed. Users see no error toast for failed social/challenge operations.
- **No request ID / correlation ID** propagated through API routes.
- **`process.on("SIGTERM")` handler** in `src/lib/db.ts:18-24` calls `prisma.$disconnect()` — good, but if the disconnect hangs the process never exits.

---

## B. SDLC Compliance

### B.1 TypeScript Strict Mode — 🟢 PASS (with caveats)

- `tsconfig.json` enables `"strict": true` and `"noImplicitAny": true` ✅
- ESLint rule `@typescript-eslint/no-explicit-any: "error"` is set ✅
- **BUT** 12 occurrences of `: any` / `as any` exist in source:
  - `src/pages/AuthPage.tsx:46, 76` — `catch (err: any)` (2x)
  - `src/pages/WorkoutResultView.tsx:189, 203` — `let rawSessions: any[] = []` and `let learningLoop: any = undefined`
  - `src/components/workout/GeneratorWizard.tsx:337, 355, 718` — same `any[]` + `as any` for dynamic profile key
  - `src/components/__tests__/regression.test.tsx:16,19,22,26,78` — 5x in test mocks (acceptable)
- These would cause `bun run lint` to fail. Lint is not in any CI (because there's no CI).
- 3 `@ts-ignore` / `@ts-expect-comment` / `eslint-disable` in test files only — acceptable.

### B.2 ESLint — 🟡 WEAK

`eslint.config.mjs` uses `next/core-web-vitals` + `next/typescript` presets but disables many useful rules:

| Rule | Setting | Concern |
|---|---|---|
| `@typescript-eslint/no-explicit-any` | error | ✅ but violated 12x with no CI to enforce |
| `@typescript-eslint/no-unused-vars` | warn | Should be error |
| `@typescript-eslint/no-non-null-assertion` | off | 🟡 `!` operator hides null bugs |
| `@typescript-eslint/ban-ts-comment` | off | 🟡 Allows `@ts-ignore` |
| `no-console` | off | 🟡 Production code ships with 98 console calls |
| `no-debugger` | off | 🔴 Could ship `debugger` statements to production |
| `no-unreachable` | off | 🟡 Dead code after return not flagged |
| `no-empty` | off | 🟡 `catch {}` swallows errors silently |
| `no-irregular-whitespace` | off | 🟡 Unicode whitespace bugs slip through |
| `no-case-declarations` | off | 🟡 |
| `no-mixed-spaces-and-tabs` | off | 🟡 |
| `no-redeclare` | off | 🟡 |
| `no-undef` | off | Acceptable (TS handles) |
| `no-useless-escape` | off | 🟡 |
| `@next/next/no-img-element` | off | 🟡 15+ raw `<img>` tags (see E.4) |
| `@next/next/no-html-link-for-pages` | off | Acceptable (single-route app) |
| `react-hooks/exhaustive-deps` | warn | Should be error |

**Recommendation:** Re-enable the disabled rules, run `eslint . --max-warnings=0` in CI.

### B.3 Test Coverage — 🟡 PARTIAL

**What exists (15 files, ~170 test cases, ~2,502 LOC):**

| File | LOC | Coverage focus |
|---|---|---|
| `src/utils/__tests__/fitnessMath.test.ts` | 73 | 1RM estimation, RPE→RIR |
| `src/utils/__tests__/muscleMapper.test.ts` | 113 | muscle ID mapping |
| `src/db/__tests__/analytics.test.ts` | 133 | streak, PRs, weekly volume, muscle stats |
| `src/lib/__tests__/syncEngine.test.ts` | 91 | backup export/import round-trip |
| `src/lib/__tests__/validation.test.ts` | 165 | all validation helpers |
| `src/router/__tests__/router.test.ts` | 88 | navigate/back/history cap |
| `src/services/__tests__/workoutGenerator.test.ts` | 141 | basic program shape |
| `src/services/__tests__/progressiveOverload.test.ts` | 348 | RPE-based progression, all 5 strategies |
| `src/services/__tests__/exerciseService.test.ts` | 121 | tokenized search, filters |
| `src/services/__tests__/aiWorkoutService.test.ts` | 178 | AI request shape, fallback path |
| `src/services/__tests__/api-integration.test.ts` | 299 | social store auth headers, validation integration |
| `src/store/__tests__/useWorkoutStore.test.ts` | 246 | start/finish workout, set updates |
| `src/store/__tests__/useExerciseStore.test.ts` | 209 | exercise cache + Dexie persistence |
| `src/components/__tests__/AnatomyMap.performance.test.tsx` | 65 | render perf regression |
| `src/components/__tests__/regression.test.tsx` | 232 | OptionBtn hoist, router cap, misc Phase 1-5 fixes |

**What's missing:**

| Gap | Severity |
|---|---|
| **Zero API route tests** — `src/app/api/**` has no `route.test.ts`. The `api-integration.test.ts` only tests the client-side store's `fetch` calls, not the actual route handlers. | 🔴 |
| **No E2E tests** (Playwright/Cypress) — critical flows (login → wizard → workout → finish → share to feed) untested end-to-end. | 🔴 |
| **No tests for `fatigueEngine`, `overloadEngine` (buildExerciseHistory), `deloadEngine`, `variationEngine`, `recoveryTracker`, `smartRest`, `warmupCalculator`, `plateCalculator`, `learningLoop`, `movementPatterns`** — the core algorithmic IP is untested. `progressiveOverload.test.ts` tests `calculateProgressiveOverloadRPE` but not `computeMuscleVolumeStatus` or `buildExerciseHistory`. | 🟠 |
| **No tests for `useSocialStore`, `useChallengesStore`, `useNutritionStore`, `useAchievementsStore`, `useAuthStore`, `useSyncStore`, `useSettingsStore`, `useRoutineStore`, `useToastStore`, `useGeneratorStore`** — 10/13 stores untested. | 🟠 |
| **No tests for `authServer.ts`, `firebaseAdmin.ts`, `firebase.ts`, `db.ts` (Prisma client)** — auth path completely untested. | 🔴 |
| **No tests for middleware** (rate limiting, cookie check) | 🟠 |
| **No tests for `avatarService`, `notificationService`, `voiceCoach`, `socialService`** | 🟡 |
| **No tests for `WorkoutSessionPage`, `GeneratorWizard`, `RestTimer`, `SetRow`, `ExerciseWorkoutCard`** (the highest-traffic UI) | 🟠 |
| **No snapshot tests** for the prompt templates in `/api/ai-coach` | 🟡 |
| **No mutation tests** — coverage depth unknown. | 🟡 |

**Test command:** `bun run test` → `vitest run` (vitest config is `environment: "node"` globally; JSdom tests must declare `// @vitest-environment jsdom`).

### B.4 CI/CD Pipeline — 🔴 NONE

- **No `.github/workflows/` directory exists.**
- **No `.gitlab-ci.yml`, `circleci/config.yml`, `azure-pipelines.yml`, `Jenkinsfile`, or `cloudbuild.yaml`.**
- No pre-commit hooks (no `.husky/`, no `lint-staged`).
- No Vercel/Netlify config files (no `vercel.json`).
- Build script in `package.json` (`"build": "next build && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/"`) implies manual deploy from a build artifact.
- **Result:** anything that compiles can be shipped. Lint failures, test failures, and type errors do not block deploy.

### B.5 Documentation — 🟡 PARTIAL

| Doc | Exists | Quality |
|---|---|---|
| `ARCHITECTURE.md` | ✅ | Good high-level overview, but **out-of-date**: claims "HS256-signed JWT" (no JWT exists), claims "138 tests across 14 files" (actually ~170 across 15), claims "PWA SW registration in layout" (no SW registration code in `layout.tsx`), claims "offline-first" (SW is a no-op pass-through). |
| `AGENTS.md` | ❌ Missing | No agent/AI-coder onboarding doc. |
| `README.md` | ❌ Missing | No project README at all. |
| `USER_STORIES_AND_FLOWS.md` | ❌ Listed in `.gitignore:80` | Document explicitly excluded from repo. |
| `CODE_AUDIT_V5.md` | ✅ (this file) | New. |
| `USER_STORIES_V3.md` | ✅ (companion) | New. |
| `worklog.md` | ❌ Listed in `.gitignore:81` | No persistent work record. |
| API docs (OpenAPI/Swagger) | ❌ | 15 API routes, zero documented. |
| Env var docs | ❌ | `.env.example` does not exist; `.env` itself is the only reference and is gitignored. |
| Storage rules (`storage.rules`) | ❌ | No Firebase Storage security rules in repo. |
| Firestore rules (`firestore.rules`) | ❌ | N/A — Firestore not used. |
| Migration guide | ❌ | No doc on how to apply Prisma migrations or Dexie version upgrades. |

---

## C. Feature Completeness

Since `USER_STORIES_AND_FLOWS.md` is gitignored and not present in the repo, the 95 user stories below were **derived from the codebase** by inventorying every page, store, service, and API route. Each is marked:

- ✅ Complete (works end-to-end)
- ⚠️ Partial (implemented but broken/incomplete)
- ❌ Missing (referenced but not implemented)

### C.1 Authentication & Onboarding (8 stories)

| # | User Story | Status | Notes |
|---|---|---|---|
| 1 | As a new user, I can sign up with email/password | ✅ | `AuthPage.tsx` calls `createUserWithEmailAndPassword` + `sendEmailVerification` |
| 2 | As a returning user, I can log in with email/password | ✅ | Email verification enforced |
| 3 | As a user, I can log in with Google | ✅ | `signInWithPopup(googleProvider)` |
| 4 | As an unverified user, I can resend the verification email | ✅ | `AuthPage.handleResendVerification` |
| 5 | As a logged-in user, my session persists across reloads | ⚠️ | Firebase ID token stored in `pulse_session` cookie with `maxAge: 7d`, but token expires in 1h. After 1h, all API calls 401. No refresh strategy. |
| 6 | As a user, I see a branded splash screen on first visit per session | ✅ | `SplashScreen` via `sessionStorage` |
| 7 | As a new user, I see a 5-slide onboarding carousel | ✅ | `OnboardingCarousel` via `localStorage` |
| 8 | As a user, I can log out | ✅ | `logoutUser()` → `DELETE /api/auth/session` + `firebaseSignOut` |

### C.2 Workout Generation (12 stories)

| # | User Story | Status | Notes |
|---|---|---|---|
| 9 | As a user, I can run a 5-step wizard to configure my profile | ✅ | `GeneratorWizard.tsx` (1258 LOC) |
| 10 | As a user, the generator produces a multi-day weekly program | ✅ | `generateProgram` returns `weeklyDays` |
| 11 | As a user, exercises are filtered by my equipment | ✅ | `workoutGenerator.ts` |
| 12 | As a user, contraindicated exercises are excluded based on my injuries | ✅ | `isContraindicated` |
| 13 | As a user, the generator avoids overtraining via ACWR fatigue | ✅ | `assessFatigueACWR` |
| 14 | As a user, I get RPE-based progressive overload suggestions | ✅ | `calculateProgressiveOverloadRPE` |
| 15 | As a user, the generator auto-deloads when fatigue is high | ✅ | `assessDeloadNeed` |
| 16 | As a user, the generator rotates exercise variations every 4-6 weeks | ⚠️ | `variationEngine.ts` exists but `detectRotationNeeds` is called; UI doesn't surface the recommendation prominently |
| 17 | As a user, I can request an AI-generated workout via the Coach | ✅ | `/api/ai-coach` multi-provider router |
| 18 | As a user, when AI fails, I fall back to the heuristic generator | ✅ | `aiWorkoutService.ts` |
| 19 | As a user, the generator respects my priority muscles | ✅ | `priorityMuscles` scoring |
| 20 | As a user, the generator auto-creates supersets when I'm short on time | ✅ | `shouldSuperset` |

### C.3 Workout Execution (15 stories)

| # | User Story | Status | Notes |
|---|---|---|---|
| 21 | As a user, I can start a workout from the generated program | ✅ | `useWorkoutStore.startWorkout` |
| 22 | As a user, I can log weight + reps per set | ✅ | `SetRow.tsx` |
| 23 | As a user, I can log RPE per set | ✅ | Optional RPE input |
| 24 | As a user, I see ghost data from my last session pre-filled | ✅ | `getLastExerciseData` |
| 25 | As a user, I can add/remove sets | ✅ | `addSet`, `removeSet` |
| 26 | As a user, I can replace an exercise with an alternative | ✅ | `ReplaceExerciseSheet` + `recordSwap` |
| 27 | As a user, I can skip an exercise with a reason | ✅ | `SkipReasonModal` + `recordSkip` |
| 28 | As a user, I can add notes per exercise | ✅ | `setExerciseNotes` |
| 29 | As a user, a smart rest timer starts after each set | ✅ | `RestTimer` + `suggestRestDuration` |
| 30 | As a user, I can calculate warmup sets before my first working set | ✅ | `WarmupSheet` + `calculateWarmupSets` |
| 31 | As a user, I can calculate barbell plates for a target weight | ✅ | `PlateCalculatorSheet` + `calculatePlates` |
| 32 | As a user, I get haptic feedback on set completion | ✅ | `navigator.vibrate` |
| 33 | As a user, I get voice coach announcements on set/PR/rest | ✅ | `voiceCoach` |
| 34 | As a user, I can resume an interrupted workout | ✅ | `resumeWorkout` + persisted `activeWorkout` |
| 35 | As a user, I can cancel a workout without saving | ✅ | `cancelWorkout` (with confirm modal) |

### C.4 Workout Completion & Sharing (8 stories)

| # | User Story | Status | Notes |
|---|---|---|---|
| 36 | As a user, I see a workout summary on finish (duration, volume, sets) | ✅ | `WorkoutSessionPage` summary |
| 37 | As a user, new PRs are detected and celebrated with confetti | ✅ | `PRCelebration` + `canvas-confetti` |
| 38 | As a user, I can share my workout to the social feed | ✅ | `useSocialStore.publishSession` |
| 39 | As a user, I can generate a shareable image card | ✅ | `ShareCard` + `html-to-image` |
| 40 | As a user, finishing a workout syncs volume to my active challenges | ✅ | `useChallengesStore.syncWorkoutVolume` (idempotent via `sessionId`) |
| 41 | As a user, my learning loop records per-exercise feedback | ✅ | `recordFeedbackFromSession` |
| 42 | As a user, achievements are evaluated after each workout | ✅ | `useAchievementsStore.evaluateAchievements` |
| 43 | As a user, I get a push notification when I hit a PR | ⚠️ | `sendPRNotification` exists but `notificationsEnabled` defaults to false; users must opt in via Settings |

### C.5 Exercise Library (6 stories)

| # | User Story | Status | Notes |
|---|---|---|---|
| 44 | As a user, I can browse 1300+ exercises with images | ✅ | `ExercisesPage` + GitHub dataset |
| 45 | As a user, I can search exercises by name with tokenized search | ✅ | `searchExercises` (O(1) token index) |
| 46 | As a user, I can filter by body part / equipment / target | ✅ | `filterExercises` |
| 47 | As a user, I can view exercise detail with image, tips, and progress chart | ✅ | `ExerciseDetailPage` |
| 48 | As a user, I can see alternative exercises for any movement | ✅ | `getAlternativeExercises` |
| 49 | As a user, exercise data is cached locally for 24h | ✅ | `exerciseService.ts` localStorage cache |

### C.6 Routine Builder (4 stories)

| # | User Story | Status | Notes |
|---|---|---|---|
| 50 | As a user, I can create a custom routine from scratch | ✅ | `BuilderPage` + `useRoutineStore` |
| 51 | As a user, I can drag-and-drop to reorder exercises in a routine | ✅ | `@dnd-kit/sortable` |
| 52 | As a user, I can mark exercises as superset partners | ✅ | `isSupersetWithNext` toggle |
| 53 | As a user, I can start a workout directly from a saved routine | ✅ | `HomePage` routine list |

### C.7 Statistics & Analytics (8 stories)

| # | User Story | Status | Notes |
|---|---|---|---|
| 54 | As a user, I see my current streak on the home page | ✅ | `getWorkoutStreak` |
| 55 | As a user, I see total volume / workouts / duration on stats page | ✅ | `getTotalStats` |
| 56 | As a user, I see a weekly volume bar chart | ✅ | `getWeeklyVolume` + recharts |
| 57 | As a user, I see a muscle-group volume radar/breakdown | ✅ | `getMuscleGroupStats` + `MuscleVolumeMap` |
| 58 | As a user, I see personal records per exercise | ✅ | `getPersonalRecords` |
| 59 | As a user, I see per-exercise progress over time (line chart) | ✅ | `ExerciseProgressChart` |
| 60 | As a user, I see estimated 1RM progression | ✅ | `getEstimated1RM` |
| 61 | As a user, I see a recovery heatmap showing muscle readiness | ✅ | `RecoveryHeatmap` + `recoveryTracker` |

### C.8 Body Composition (5 stories)

| # | User Story | Status | Notes |
|---|---|---|---|
| 62 | As a user, I can log body measurements (weight, BF%, waist, chest, arms) | ✅ | `BodyPage` |
| 63 | As a user, I see a weight-trend line chart | ✅ | recharts in BodyPage |
| 64 | As a user, I can upload progress photos (front/side/back) | ⚠️ | Uploads to Firebase Storage but **no Storage security rules** in repo — uploads may be world-readable/writable |
| 65 | As a user, progress photos are stored with thumbnails | ⚠️ | `thumbnailBlob` field exists but `BodyPage` doesn't generate thumbnails — only full-size |
| 66 | As a user, I can delete progress photos | ✅ | Soft-delete via `deleted: true` |

### C.9 Nutrition (5 stories)

| # | User Story | Status | Notes |
|---|---|---|---|
| 67 | As a user, I can log food entries (calories, protein, carbs, fat) | ✅ | `NutritionPage` + `useNutritionStore` |
| 68 | As a user, I can categorize entries by meal type | ✅ | breakfast/lunch/dinner/snack |
| 69 | As a user, I can set daily macro goals | ✅ | `setGoal` |
| 70 | As a user, I see progress bars vs my goals per day | ✅ | `MacroBar` component |
| 71 | As a user, I can navigate dates to see historical entries | ✅ | `subDays`/`addDays` |

### C.10 Social (10 stories)

| # | User Story | Status | Notes |
|---|---|---|---|
| 72 | As a user, I can publish a workout to the feed | ✅ | `publishSession` |
| 73 | As a user, I see a global feed of recent workouts | ⚠️ | Shows ALL posts (no following filter) — `loadFeed` fetches `/api/social/feed` with no `following=true` param |
| 74 | As a user, I can give kudos to a post | ⚠️ | No uniqueness — infinite kudos spam possible |
| 75 | As a user, I can comment on a post | ⚠️ | Comment author name/photo are client-supplied headers — spoofable |
| 76 | As a user, I can delete my own post | ✅ | Ownership check |
| 77 | As a user, I can delete my own comment | ✅ | Ownership check |
| 78 | As a user, I can search for other users by display name | ✅ | `/api/social/search` |
| 79 | As a user, I can follow/unfollow other users | ✅ | `/api/social/follow` |
| 80 | As a user, I see my following list with avatars | ✅ | `loadFollowing(..., includeProfiles=true)` |
| 81 | As a user, I can edit my display name and avatar | ⚠️ | Display-name update is **broken** (missing `uid` in body, see §A.5). Avatar upload works via Firebase Storage. |

### C.11 Challenges (5 stories)

| # | User Story | Status | Notes |
|---|---|---|---|
| 82 | As a user, I see active volume challenges | ✅ | `ChallengesPage` |
| 83 | As a user, I can join a challenge | ✅ | `joinChallenge` |
| 84 | As a user, my workout volume syncs to my joined challenges | ✅ | Idempotent via `sessionId` |
| 85 | As a user, I see a leaderboard per challenge | ✅ | Top 100 by progressKg |
| 86 | As a user, I see my own progress per challenge | ✅ | `fetchUserProgress` |

### C.12 Settings & Preferences (5 stories)

| # | User Story | Status | Notes |
|---|---|---|---|
| 87 | As a user, I can toggle dark/light/system theme | ✅ | `useSettingsStore.theme` + inline `<script>` to prevent FOUC |
| 88 | As a user, I can enable/disable notifications | ✅ | Settings page |
| 89 | As a user, I can configure voice coach + voice selection | ✅ | `useVoiceCoach` hook |
| 90 | As a user, I can export my local data as JSON | ✅ | `exportLocalBackup` |
| 91 | As a user, I can install the app as a PWA | ⚠️ | `manifest.json` exists, `sw.js` registers but is a no-op pass-through — no real offline support |

### C.13 Profile (2 stories)

| # | User Story | Status | Notes |
|---|---|---|---|
| 92 | As a user, I see my stats, achievements, and PRs on my profile | ✅ | `ProfilePage` |
| 93 | As a user, I can upload a profile photo | ✅ | `AvatarUploadSheet` + Firebase Storage |

### C.14 Cross-cutting (2 stories)

| # | User Story | Status | Notes |
|---|---|---|---|
| 94 | As a user, my data syncs to the cloud automatically | ❌ | `pushToCloud` and `pullFromCloud` are **no-ops** (`src/lib/syncEngine.ts:15-24`). `syncAll` simulates a 300ms delay then stamps `lastSyncedAt`. The "Synced 5 minutes ago" indicator is theater. |
| 95 | As a user, I can use the app offline | ❌ | Service worker is `event.respondWith(fetch(event.request))` — pure pass-through. No cache-first strategy, no offline workout logging. PWA is installable but not offline-capable. |

**Summary:** 71 ✅ · 16 ⚠️ · 8 ❌ → 75% complete

---

## D. Security Audit

### D.1 Firebase Auth — 🟠 PARTIAL

**Client side (`src/lib/firebase.ts`, `src/store/useAuthStore.ts`):**
- Standard Firebase web SDK init. ✅
- `onAuthStateChanged` listener fires on mount, calls `getIdToken()` then `POST /api/auth/session` to mint a cookie. ✅
- Email verification enforced before sign-in completes. ✅

**Server side (`src/lib/authServer.ts`, `src/lib/firebaseAdmin.ts`, `src/app/api/auth/session/route.ts`):**
- `getAdminAuth()` lazy-initializes Admin SDK from `service-account.json` (or `FIREBASE_SERVICE_ACCOUNT` env JSON). ✅
- `verifyIdToken` validates signature + expiry. ✅
- Cookie is `httpOnly: true`, `secure: production`, `sameSite: "lax"`. ✅

**🔴 Critical flaws:**

1. **Cookie stores the raw ID token, but tokens expire in 1 hour.** The cookie's `maxAge: 60*60*24*7` (7 days) is meaningless — after 1h the token is rejected by `verifyIdToken`, the user gets 401 on every API call, and there is no client-side refresh flow to call `getIdToken(true)` and re-mint the cookie. Users get logged out every hour.

2. **No refresh-token / session-cookie strategy.** Firebase Admin offers `createSessionCookie(idToken, { expiresIn: 604800000 })` which produces a 7-day session cookie separate from the 1h ID token. This codebase does NOT use it — it stores the ID token directly. **This is the root cause of the hourly logout bug.**

3. **`requireUser` swallows verification errors silently** (`catch {}` returns generic 401). No log of failed verifications means brute-force attempts are invisible.

4. **No revocation check.** `verifyIdToken` does not check `revoked: true` — if a user resets their password, old tokens still work until natural expiry.

### D.2 Firebase Storage — 🔴 NO RULES

- `src/services/avatarService.ts` uploads to `avatars/${uid}.jpg` via `uploadBytesResumable`.
- `src/pages/BodyPage.tsx:29` imports Firebase Storage for progress photo upload.
- **There is NO `storage.rules` file in the repository.** Firebase Storage defaults to "deny all" if no rules are deployed, which would break uploads — OR (worse) the project has deployed `allow read, write: if true;` which makes everyone's photos public.
- **Recommendation:** Add a `storage.rules` file:
  ```
  match /avatars/{userId}.jpg {
    allow read: if true;
    allow write: if request.auth.uid == userId;
  }
  match /progress/{userId}/{photoId}.jpg {
    allow read: if request.auth.uid == userId;
    allow write: if request.auth.uid == userId;
  }
  ```
- **Avatar upload lacks file type validation** — `AvatarUploadSheet` only checks `file.type.startsWith("image/")` which is client-supplied. An attacker could upload an SVG with embedded JS. The `resizeImage` function draws to canvas and re-encodes as JPEG, which neutralizes most XSS, but the path is fragile.
- **Progress photos in `BodyPage` upload raw blobs to Firebase Storage without resizing** — a 10MB photo stays 10MB.

### D.3 API Authorization — 🔴 CRITICAL

| Route | Auth check | Verdict |
|---|---|---|
| `POST /api/ai-coach` | middleware cookie-exists only | 🔴 No `requireUser`. Anonymous AI access. |
| `POST /api/ai-workout` | middleware cookie-exists only | 🔴 Same. |
| `GET /api/ai-health` | none | 🟢 Public health check — OK. |
| `GET /api/route.ts` (`/api`) | none | 🟢 Public hello-world — OK. |
| `POST /api/auth/session` | none (login endpoint) | 🟢 OK. |
| `DELETE /api/auth/session` | none | 🟢 OK. |
| `GET /api/social/feed` | **none** | 🔴 Public feed read — anyone scrapes all users. |
| `POST /api/social/feed` | `requireUser` + callerUid check | ✅ |
| `DELETE /api/social/posts` | `requireUser` + ownership | ✅ |
| `GET /api/social/comments` | **none** | 🟠 Public comment read — by postId, enumerable. |
| `POST /api/social/comments` | `requireUser` for uid + **trusts x-user-name/x-user-photo headers** | 🔴 Identity spoofing. |
| `DELETE /api/social/comments` | `requireUser` + ownership | ✅ |
| `POST /api/social/kudos` | `requireUser` only | 🟠 No (user, post) uniqueness — infinite kudos. |
| `POST /api/social/follow` | `requireUser` + callerUid check | ✅ |
| `DELETE /api/social/follow` | `requireUser` + callerUid check | ✅ |
| `GET /api/social/following` | **none** | 🔴 Anyone can enumerate any user's follows. |
| `GET /api/social/search` | **none** | 🟠 Public user search. |
| `POST /api/social/profile` | `requireUser` + callerUid check | ✅ But caller (`ProfilePage`) sends no `uid` → always 400. |
| `GET /api/challenges` | none | 🟢 Public list — OK. |
| `POST /api/challenges/sync-volume` | `requireUser` + callerUid check + idempotency | ✅ |
| `POST /api/challenges/[id]/join` | `requireUser` + callerUid check | ✅ |
| `GET /api/challenges/[id]/progress` | **none** | 🟠 Public read of any user's progress. |
| `GET /api/challenges/[id]/leaderboard` | none | 🟢 Public leaderboard — OK. |

### D.4 Input Validation — 🟡 INCONSISTENT

- `src/lib/validation.ts` provides good helpers (`validateString`, `validateInt`, `validateFloat`, `validateId`, `validateDisplayName`, `validateUrl`, `validateOptionalUrl`, `handlePrismaError`, `errorResponse`, `serverErrorResponse`). ✅
- **But they're not used everywhere:**
  - `POST /api/ai-coach` only validates `userPrompt` (capped at 1000 chars); the `profile`, `recentSessions`, `personalRecords`, `analytics`, `exercises` arrays are NOT validated or size-capped. A 50MB POST body would be parsed without limit → DoS.
  - `POST /api/ai-workout` doesn't validate `age`, `equipment`, `selectedMuscles` shapes.
  - `POST /api/social/comments` doesn't use `validateString(text, 500)` — it does `text.trim().slice(0, 500)` inline. Inconsistent.
  - `POST /api/social/kudos` validates `postId` ✅
  - `POST /api/challenges/sync-volume` clamps volume with `Math.min(Math.max(0, volume), 1e9)` ✅
- **No Zod usage** despite `zod ^4.0.2` being in `package.json` (only `react-hook-form` + `@hookform/resolvers` import it indirectly). Zod is declared but never actually imported in any API route. The custom validators in `validation.ts` are reinventing what Zod already does.
- **No request body size limit** on any route. Next.js defaults to ~4MB but that's still large enough for abuse.

### D.5 XSS / CSRF / Injection — 🟠 HIGH

| Risk | Status |
|---|---|
| **XSS** | 🟡 React escapes by default. `dangerouslySetInnerHTML` is used in `layout.tsx:42` for the theme script (sanitized, OK). User-supplied `text` in comments is rendered via `{comment.text}` (auto-escaped). No `innerHTML` injections found. **But:** user-supplied URLs (`authorPhotoURL`, `userPhotoURL`) are persisted and rendered as `<img src={url}>` — `validateUrl` rejects `javascript:` and `data:` schemes, so XSS via avatar URL is blocked. ✅ |
| **CSRF** | 🟡 Cookie is `sameSite: "lax"` — protects against cross-site POST from forms. JSON `Content-Type` provides additional protection (browsers won't send `application/json` cross-origin without CORS preflight). No CSRF token. Acceptable for an internal API but not bulletproof. |
| **SQL Injection** | ✅ Prisma uses parameterized queries everywhere. No raw SQL. |
| **NoSQL Injection** | N/A (no Mongo) |
| **Command Injection** | ✅ No `exec()` / `spawn()` calls in source. |
| **Path Traversal** | 🟡 `firebaseAdmin.ts:13-16` resolves `SERVICE_ACCOUNT_PATH` from env var without sanitization — if an attacker controls the env, they could read arbitrary JSON files. Acceptable in practice (env is trusted). |
| **Open Redirect** | ✅ No redirect endpoints found. |
| **SSRF** | 🔴 **Caddyfile lines 1-13:** the `:81` listener proxies to `localhost:{query.XTransformPort}` — an attacker can request `https://your-domain:81/?XTransformPort=6379` to probe Redis, or `?XTransformPort=169.254.169.254` style metadata endpoints (though Caddy blocks non-localhost by `localhost:` prefix). This is a **critical open-proxy / SSRF** that should be removed before production. |

### D.6 PWA Security — 🟡 WEAK

- `public/sw.js` is 15 lines of pure pass-through:
  ```js
  self.addEventListener("fetch", (event) => {
    event.respondWith(fetch(event.request));
  });
  ```
- **No cache strategy** — despite the manifest being valid, the SW provides zero offline capability.
- **No integrity check** — SW is served from `/sw.js` and registered (per ARCHITECTURE.md claim, though no registration code is in `layout.tsx`). SW runs with full page-control privileges.
- **No versioning** — `CACHE_NAME = "pulse-cache-v1"` is declared but never used. If caching were added, no upgrade path exists.
- **No `skipWaiting`/`clients.claim` race-condition protection** beyond the trivial implementation.
- **Manifest** is fine: standalone display, portrait orientation, icons, theme colors. ✅
- **HTTPS assumed** — no HTTP fallback. Caddy terminates TLS (config outside repo).

---

## E. Performance Audit

### E.1 Bundle Size — 🟠 HIGH

**Heavy dependencies in `package.json`:**

| Dep | Approx size (gzipped) | Lazy-loaded? |
|---|---|---|
| `recharts` | ~95 KB | ❌ Direct import in 4 files |
| `framer-motion` | ~50 KB | ❌ Direct import in 30+ files |
| `@mdxeditor/editor` | ~200 KB | ❌ Not imported anywhere in src (dead dep?) |
| `react-syntax-highlighter` | ~80 KB | ❌ Not imported anywhere in src (dead dep?) |
| `firebase` (auth + storage) | ~80 KB | ❌ Eager init in `lib/firebase.ts` |
| `@dnd-kit/*` (3 packages) | ~30 KB | ❌ Only used in `BuilderPage` |
| `canvas-confetti` | ~10 KB | ❌ Only used in `WorkoutSessionPage` |
| `react-day-picker` | ~25 KB | ❌ Only used in `calendar.tsx` (likely dead) |
| `cmdk` | ~15 KB | ❌ Only used in `command.tsx` |
| `vaul` (drawer) | ~8 KB | ❌ Used in `BuilderPage`, `ExercisesPage` |
| `openai` (server SDK) | ~150 KB | 🟢 Server-only |
| `firebase-admin` | ~200 KB | 🟢 Server-only |

**Verdict:**
- The initial JS bundle likely exceeds 500 KB gzipped (recharts + framer-motion + firebase + dnd-kit + react + next core).
- `next.config.ts` enables `output: "standalone"` ✅ but does not configure `experimental.optimizePackageImports` for tree-shaking.
- No bundle analyzer (`@next/bundle-analyzer`) installed.
- No `dynamic()` imports for route-level code splitting (only 2 dynamic imports in `app/page.tsx` for splash/onboarding overlays).

### E.2 Lazy Loading & Code Splitting — 🔴 POOR

- The app's `src/app/page.tsx` is `"use client"` and statically imports **all 16 page components** at module load:
  ```tsx
  import HomePage from "@/pages/HomePage";
  import ExercisesPage from "@/pages/ExercisesPage";
  // ... 14 more
  ```
- This means visiting `/` loads the code for EVERY page (Stats with recharts, Body with recharts, Builder with dnd-kit, WorkoutSession with confetti, etc.) before the user can interact.
- Only `SplashScreen` and `OnboardingCarousel` are `dynamic(...)` imports.
- **Fix:** Wrap each page import in `dynamic(() => import("@/pages/X"), { ssr: false })` to cut the initial bundle by ~70%.

### E.3 IndexedDB Query Optimization — 🟡 MIXED

**Good patterns:**
- `getMuscleGroupStats` (`src/db/analytics.ts:214-244`) builds a `Map<exerciseId, Exercise>` once for O(S+E) instead of O(S×E). Explicit comment documents the optimization. ✅
- `getRecentCompletedSessions` in `useWorkoutStore.ts:103-121` caches the last 10 sessions for 30s to avoid re-scanning on every ghost-logging lookup. ✅
- `searchExercises` builds a tokenized `Map<token, Set<Exercise>>` index for O(1) per-token lookup. ✅

**Bad patterns:**
- `.filter((s) => s.completed === true).toArray()` is used in 5+ places (analytics, achievements, recovery) — full collection scan each time. The `completed` index declared in schema cannot be used because IndexedDB rejects boolean keys (comment in `analytics.ts:9-12` acknowledges this).
  - **Fix:** Add a `completedInt` field (0/1) and index on it, or use a `completedAt` date index.
- `useAchievementsStore.evaluateAchievements` loops `ACHIEVEMENTS × completedSessions` — could be O(A × S). Should pre-compute aggregate stats once and check criteria against aggregates.
- `RecoveryHeatmap` loads 50 sessions and computes per-muscle recovery on every mount. Should be memoized or cached.
- `db.workoutSessions.toArray()` in `exportLocalBackup` pulls ALL sessions (could be thousands) into memory at once, then base64-encodes all photos — OOM risk for power users.

### E.4 Image Optimization — 🔴 NONE

- `next/image` is **never imported** anywhere in the codebase.
- 15+ raw `<img>` tags across pages:
  - `AuthPage.tsx:94` (auth-bg.jpg)
  - `HomePage.tsx:188, 561`
  - `ExercisesPage.tsx:27` (ExerciseImage component)
  - `ExerciseDetailPage.tsx:160, 418`
  - `BodyPage.tsx:396`
  - `BuilderPage.tsx:433`
  - `FeedPage.tsx:310, 385, 498, 626`
  - `ChallengeDetailPage.tsx:257`
  - `WorkoutResultView.tsx:352`
  - `Avatar.tsx:46`
- `@next/next/no-img-element` ESLint rule is **OFF** (see B.2).
- `next.config.ts` only allows `raw.githubusercontent.com` as a remote image host — but since `next/image` isn't used, this config is dead.
- Exercise GIFs and images are fetched directly from GitHub raw URLs with no optimization, no lazy loading hints beyond `loading="lazy"` on ExerciseImage.
- `avatarService.resizeImage` resizes to 256×256 before upload ✅ — good.
- `BodyPage` does NOT resize progress photos before upload — 10MB photos stay 10MB.

### E.5 React Re-renders — 🟡 MIXED

**Good patterns:**
- Most store subscriptions use individual selectors: `useSocialStore((s) => s.feed)` ✅ instead of bare `useSocialStore()`. Comments in `NutritionPage.tsx:74-75` document this.
- `SetRow` is `memo()`-wrapped. ✅
- `ExerciseWorkoutCard` is `memo()`-wrapped with `useCallback` for handlers. ✅
- `OptionBtn` in `GeneratorWizard` is hoisted to module scope to avoid remounts. ✅
- `MacroBar` in `NutritionPage` is hoisted (comment at line 28-30 explains why). ✅
- `getRecentCompletedSessions` has a 30s TTL cache. ✅

**Bad patterns:**
- `FeedPage.tsx:34-67` subscribes to **16 individual store slices** — any change to any slice re-renders the entire FeedPage. Should use a single shallow selector with `useShallow` from `zustand/react/shallow`.
- `ChallengesPage.tsx:26-34` uses bare `useChallengesStore()` (destructure) — re-renders on ANY store change.
- `ChallengeDetailPage.tsx:22-31` same pattern.
- `RestTimer.tsx:46-52` uses the "compare prev state in render" anti-pattern to sync state — should be a `useEffect`.
- `WorkoutSessionPage.useElapsedTimer` (line 20-42) same anti-pattern.
- `useWorkoutStore` persists `activeWorkout` to localStorage via `persist` middleware — every set update serializes the entire workout to JSON on every keystroke. Should debounce.
- `RecoveryHeatmap`'s `useEffect` depends on `exercises` array reference — if `useExerciseStore` returns a new array reference on every state change, this re-runs every time.

---

## Findings Summary

### 🔴 Critical (blocks production) — 10

1. **Caddyfile open-proxy SSRF** (`Caddyfile:1-13`) — `?XTransformPort=N` lets attackers probe internal services via the `:81` listener.
2. **`/api/ai-coach` and `/api/ai-workout` lack `requireUser`** — anonymous AI access burns API quota; middleware's cookie-existence check is bypassable with `pulse_session=garbage`.
3. **Firebase ID token stored in 7-day cookie but token expires in 1 hour** — users are logged out every hour; no refresh strategy. Should use `createSessionCookie`.
4. **`/api/social/comments` trusts `x-user-name` and `x-user-photo` client headers** — any logged-in user can post comments under another user's identity.
5. **`/api/social/kudos` has no (user, post) uniqueness** — infinite kudos spam, single user can inflate any post's count.
6. **`/api/social/following` GET has no auth** — anyone can enumerate any user's follow graph by `?uid=`.
7. **`/api/social/feed` GET has no auth** — public scrape of all 50 latest posts with author names/photos.
8. **`ProfilePage.handleSaveName` is broken** — sends `{ displayName }` to `/api/social/profile` without required `uid` field; server returns 400; toast lies "Profile name updated!".
9. **`pushToCloud` / `pullFromCloud` / `syncAll` are no-ops** — cloud sync is theater; users lose all data on browser wipe.
10. **No Firebase Storage rules in repo** — avatar/photo uploads may be world-readable or broken depending on deployed rules.

### 🟠 High (severe issues) — 18

11. No CI/CD pipeline — lint/test/typecheck failures don't block deploy.
12. No error monitoring (Sentry/Datadog/etc.) — production errors invisible.
13. No E2E tests — critical flows untested end-to-end.
14. No API route unit tests — 15 routes have zero test coverage.
15. Core algorithm modules (`fatigueEngine`, `overloadEngine.buildExerciseHistory`, `deloadEngine`, `variationEngine`, `recoveryTracker`, `learningLoop`, `movementPatterns`) untested.
16. 10/13 Zustand stores untested.
17. 12 `: any` usages in source code violate the `no-explicit-any` ESLint rule.
18. ESLint config disables `no-debugger`, `no-console`, `no-irregular-whitespace`, `no-unreachable`, `no-empty`, `no-redeclare`, `react-hooks/exhaustive-deps` — many quality gates off.
19. PWA service worker is a no-op pass-through — app claims "offline-first" but provides no offline support.
20. `inferExerciseRole` regex in `useWorkoutStore.ts:36-59` duplicates logic in `services/movementPatterns.ts` — DRY violation.
21. `evaluateAchievements` is O(A × S) — called after every workout finish.
22. No request body size limit on `/api/ai-coach` — 50MB POST body parsed without limit.
23. No request ID / correlation ID propagated through API routes.
24. `req.headers.get("x-forwarded-for")` trusted verbatim in middleware — spoofable IP for rate-limit bypass.
25. Memory-only rate-limit Map resets on cold start.
26. `BodyPage` doesn't resize progress photos before upload — 10MB photos stay 10MB.
27. `next/image` never used — 15+ raw `<img>` tags, no optimization.
28. No lazy loading for page components — `app/page.tsx` statically imports all 16 pages into the initial bundle.

### 🟡 Medium (polish) — 22

29. `package.json` name is `nextjs_tailwind_shadcn_ts` instead of `pulse-fitness` (boilerplate leftover).
30. No `README.md` or `AGENTS.md`.
31. `ARCHITECTURE.md` out-of-date (claims JWT, claims 138 tests, claims offline-first).
32. `USER_STORIES_AND_FLOWS.md` and `worklog.md` are gitignored — no persistent records.
33. No API docs (OpenAPI/Swagger).
34. No `.env.example` — onboarding requires reading `.env` directly.
35. No structured logger — 98 `console.error` calls in source.
36. No request pagination on `/api/social/feed` — always returns top 50.
37. No cursor pagination on `/api/social/comments` — returns all comments on a post.
38. No API versioning (`/api/v1/`).
39. No feature flags.
40. No A/B testing framework.
41. No analytics/event tracking.
42. No backup strategy for SQLite (only Dexie has export).
43. No "delete my account" endpoint (GDPR Article 17 violation).
44. No per-user data export from server (GDPR Article 20 violation).
45. No multi-account support on shared browser — single-user IndexedDB assumption.
46. `req.headers.get("x-user-name")` in comments route is dead code — uid is verified but name is unverified, should be looked up from PublicProfile.
47. Dexie `db.version(7)` is skipped — versions jump 6 → 8 (no functional impact but sloppy).
48. `useBackgroundSync` polls `syncAll` every 5 min even though sync is a no-op — wasted CPU.
49. `localStorage` used as exercise cache (~1MB JSON) — should be IndexedDB.
50. `WorkoutResultView` and `GeneratorWizard` use `let rawSessions: any[] = []` — should be typed.

### 🔵 Low (refactoring) — 28

51. `/api/route.ts` returns `{ message: "Hello, world!" }` — placeholder should be removed or replaced with health check.
52. `pulse_session` cookie name not namespaced.
53. `service-account.json` referenced in env but file not in repo — manual setup friction.
54. Inconsistent indentation (2 vs 4 spaces) across files.
55. `app/page.tsx` is entirely `"use client"` — no SSR benefit despite using Next.js.
56. Multiple `"use client"` pages could be split into server + client components.
57. No Storybook for component development.
58. `inferExerciseRole` regex tests not written.
59. `Layout.tsx` not reviewed in depth (likely fine).
60. `Avatar.tsx:46` raw `<img>` should be `next/image`.
61. `OneRun` schema's `service-account.json` is referenced in env but file is gitignored.
62. `next.config.ts` only allows `raw.githubusercontent.com` as image host — but `next/image` not used.
63. `OneRun` schema's `OPENROUTER_MODEL` is the free tier — fine for dev, should be configurable per environment.
64. `useSyncStore.lastSyncedAt` reads `localStorage` directly in store init — not SSR-safe.
65. `useCloudSyncState` reads `navigator.onLine` in `useState` initializer — not SSR-safe.
66. `useSettingsStore` persists to `localStorage` but theme application happens in `layout.tsx` inline script AND `useEffect` — two sources of truth.
67. `useWorkoutStore.partialize` only persists `activeWorkout` — not `restTimerActive` (fine, but worth noting).
68. `challengesStore.syncedSessionIds` Set grows unbounded to 100 — uses FIFO eviction, fine.
69. `useNutritionStore` doesn't use `persist` middleware — nutrition data is in Dexie, OK.
70. `ACHIEVEMENTS` data file not reviewed.
71. `routineTemplates` data file not reviewed.
72. `exerciseTranslations.ts` exists but i18n is English-only (dead code?).
73. `useVoiceCoach` hook not reviewed.
74. `useThemeColors` hook not reviewed.
75. `notifications.ts` util duplicates `notificationService.ts` — should be consolidated.
76. `audio.ts` util not reviewed.
77. `id.ts` util — likely a `uuid` wrapper, fine.
78. `theme.ts` util not reviewed in depth.

---

## Recommended Action Plan (prioritized)

### Phase 1 — Block production (1-2 days)
1. Remove the Caddyfile `:81` open-proxy block.
2. Add `requireUser` to `/api/ai-coach`, `/api/ai-workout`, `/api/social/feed` (GET), `/api/social/following` (GET), `/api/social/comments` (GET), `/api/challenges/[id]/progress` (GET).
3. Switch to Firebase session cookies via `createSessionCookie(idToken, { expiresIn: 604800000 })` instead of storing the raw ID token.
4. Remove `x-user-name` / `x-user-photo` header trust in `/api/social/comments` — look up from PublicProfile by `callerUid`.
5. Add a `Kudos` model with `@@unique([postId, userId])` to prevent kudos spam.
6. Fix `ProfilePage.handleSaveName` to include `uid` in the body.

### Phase 2 — SDLC hardening (3-5 days)
7. Add `.github/workflows/ci.yml` running `lint`, `tsc --noEmit`, `vitest run`.
8. Install `@next/bundle-analyzer` and set up `dynamic()` imports for all 16 pages.
9. Re-enable disabled ESLint rules; fix the 12 `: any` violations.
10. Add Sentry for error monitoring.
11. Add Firebase Storage rules to the repo.
12. Add `AGENTS.md`, `README.md`, `.env.example`, OpenAPI spec.

### Phase 3 — Test coverage (1-2 weeks)
13. Add API route integration tests (spin up Next.js test server).
14. Add E2E tests for: signup → wizard → workout → finish → share → view on feed.
15. Add unit tests for `fatigueEngine`, `overloadEngine`, `deloadEngine`, `variationEngine`, `recoveryTracker`, `learningLoop`, `movementPatterns`.
16. Add store tests for `useSocialStore`, `useChallengesStore`, `useNutritionStore`, `useAchievementsStore`, `useAuthStore`.

### Phase 4 — Performance (1 week)
17. Convert all 16 page imports in `app/page.tsx` to `dynamic()` with `ssr: false`.
18. Replace all `<img>` with `next/image` (or at least add explicit `width`/`height`).
19. Add a `completedInt` indexed field to Dexie to avoid boolean-scan pattern.
20. Add request body size limit (`Content-Length` check) to AI routes.

### Phase 5 — Real offline-first PWA (2-3 weeks)
21. Implement a real service worker with Workbox: cache-first for static assets, network-first for API, background sync for delayed writes.
22. Implement real cloud sync (`pushToCloud` / `pullFromCloud` should actually call `/api/sync`).
23. Add per-user data export and account deletion endpoints (GDPR).

---

**Audit complete.**
