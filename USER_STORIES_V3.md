# Pulse Fitness — User Stories V3

**Derived:** 2026-06-20 (CODE-AUDIT-V5)
**Source:** Reverse-engineered from the codebase because `USER_STORIES_AND_FLOWS.md` (V1/V2) is gitignored and not present in the repo.
**Purpose:** Define the user stories needed to fill the gaps surfaced by the V5 audit. Stories are grouped by the audit section that surfaced them.

> Convention: Each story has a stable ID (`US-V3-XXX`), a priority (🔴 Critical / 🟠 High / 🟡 Medium / 🔵 Low), and a clear acceptance criteria. Stories marked `[AUDIT-GAP]` exist to close a specific finding from `CODE_AUDIT_V5.md`.

---

## Section 1 — Authentication & Session Security (closes §D.1)

### US-V3-001 — Survive a 1-hour Firebase ID token expiry 🔴
**As a** logged-in user
**I want** my session to remain valid for 7 days without re-login prompts
**So that** I don't get logged out every hour.

**Acceptance criteria:**
- `POST /api/auth/session` calls `adminAuth.createSessionCookie(idToken, { expiresIn: 604800000 })` and stores the **session cookie** (not the raw ID token) in `pulse_session`.
- `requireUser` calls `adminAuth.verifySessionCookie(cookie, true)` (the `true` enables revocation check).
- After 1 hour, the user can still call any API route without re-authentication.
- After 7 days, the cookie expires naturally and the user is redirected to `/auth`.

**Audit ref:** §D.1 critical flaw #1, #2.

---

### US-V3-002 — Refresh session cookie on near-expiry 🟠
**As a** long-running user
**I want** my session cookie to be transparently refreshed when it's about to expire
**So that** I'm never interrupted mid-workout.

**Acceptance criteria:**
- `useAuthStore` periodically (every 30 min) calls `firebaseUser.getIdToken(true)` to force-refresh the ID token.
- If successful, posts the new token to `/api/auth/session` to mint a new session cookie.
- If the underlying Firebase user is revoked, the user is signed out gracefully with a toast.

---

### US-V3-003 — Revoke sessions on password reset 🔴
**As a** user who just reset my password
**I want** all my previous sessions invalidated immediately
**So that** an attacker who stole my old token can't keep using it.

**Acceptance criteria:**
- `requireUser` calls `verifySessionCookie(cookie, /** checkRevoked */ true)`.
- If the Firebase user's `tokensValidAfterTime` is newer than the cookie's `iat`, return 401.
- Test: reset password → all existing `pulse_session` cookies return 401.

---

### US-V3-004 — Detect and log failed verification attempts 🟠
**As a** security admin
**I want** failed session verifications logged with IP + UA
**So that** I can detect brute-force or token-theft attacks.

**Acceptance criteria:**
- `requireUser` catches `verifySessionCookie` errors and logs `{ ip, ua, error: error.code, ts }` to a structured logger (Sentry breadcrumb).
- Repeated failures from the same IP within 5 minutes trigger a rate-limit block.

---

## Section 2 — API Authorization (closes §D.3)

### US-V3-005 — Authenticate AI Coach endpoint 🔴
**As a** product owner
**I want** `/api/ai-coach` to require a valid session
**So that** anonymous attackers can't burn OpenRouter quota.

**Acceptance criteria:**
- `POST /api/ai-coach` calls `requireUser(req)` and returns 401 if no valid session.
- Per-user rate limit: 20 requests/hour in addition to the per-IP limit.
- Logged-in user's `uid` is included in AI provider error logs for debugging.

**Audit ref:** §D.3, §A.3.

---

### US-V3-006 — Authenticate AI Workout endpoint 🔴
**As a** product owner
**I want** `/api/ai-workout` to require a valid session
**So that** the free OpenRouter quota is reserved for logged-in users.

**Acceptance criteria:** Same as US-V3-005 for `/api/ai-workout`.

---

### US-V3-007 — Authenticate social feed read 🔴
**As a** user
**I want** the social feed visible only to authenticated users
**So that** my workout history isn't scraped by anonymous crawlers.

**Acceptance criteria:**
- `GET /api/social/feed` calls `requireUser(req)`.
- Returns 401 if no valid session.
- Public scrapers (curl without cookie) get 401, not the feed JSON.

**Audit ref:** §D.3.

---

### US-V3-008 — Authenticate following list read 🔴
**As a** user
**I want** my follow graph visible only to authenticated users
**So that** I'm not enumerable by stalkers.

**Acceptance criteria:**
- `GET /api/social/following?uid=X` calls `requireUser(req)`.
- Optionally: only the user themselves or their mutuals can read their following list.

---

### US-V3-009 — Authenticate challenge progress read 🟠
**As a** user
**I want** my challenge progress visible only to authenticated users
**So that** my training data isn't publicly scrapable.

**Acceptance criteria:**
- `GET /api/challenges/[challengeId]/progress?userId=X` calls `requireUser(req)`.
- Returns 401 without a valid session.

---

## Section 3 — Identity Spoofing Fixes (closes §D.3, §A.1)

### US-V3-010 — Look up comment author from PublicProfile, not headers 🔴
**As a** comment author
**I want** my name and photo on comments to come from my verified PublicProfile
**So that** another user can't post comments under my name.

**Acceptance criteria:**
- `POST /api/social/comments` removes `x-user-name` / `x-user-photo` header reads from `readAuthor`.
- After `requireUser` returns `callerUid`, fetch `prisma.publicProfile.findUnique({ where: { uid: callerUid } })`.
- If no profile exists, use `email local-part` as fallback name and `null` photo.
- `useSocialStore.authHeaders()` no longer sends `x-user-name` / `x-user-photo`.

**Audit ref:** §A.1, §D.3.

---

### US-V3-011 — Prevent infinite kudos spam 🔴
**As a** post author
**I want** each user to be able to kudos my post at most once
**So that** the kudos count is meaningful.

**Acceptance criteria:**
- New Prisma model `Kudos` with fields `postId`, `userId`, `createdAt` and `@@unique([postId, userId])`.
- `POST /api/social/kudos` does `upsert` on `(postId, userId)`:
  - On create → `feedPost.kudosCount: { increment: 1 }`.
  - On update (already kudos'd) → return current count without increment.
- `DELETE /api/social/kudos` (new endpoint) removes the kudos and decrements.
- Client `useSocialStore.giveKudos` tracks local "kudos'd" state via a `kudosedPostIds: Set<string>`.

---

## Section 4 — Caddyfile / SSRF (closes §D.5)

### US-V3-012 — Remove open-proxy Caddyfile block 🔴
**As a** security admin
**I want** the `:81` listener with `XTransformPort` query-param proxy removed
**So that** attackers can't probe internal services through my reverse proxy.

**Acceptance criteria:**
- `Caddyfile` is rewritten to a single `:443` (or `:80` → redirect) block proxying to `localhost:3000`.
- No `XTransformPort` handler.
- No query-param-driven reverse proxy.
- If the transform-port feature is needed for dev, move it behind a separate dev-only Caddyfile (e.g. `Caddyfile.dev`) that's never deployed.

**Audit ref:** §D.5 SSRF finding.

---

## Section 5 — Broken Flows (closes §A.5)

### US-V3-013 — Fix profile name update 🔴
**As a** user
**I want** the "Save name" button in ProfilePage to actually update my server-side profile
**So that** the success toast isn't a lie.

**Acceptance criteria:**
- `ProfilePage.handleSaveName` sends `{ uid: user.uid, displayName: newName.trim() }` (not just `{ displayName }`).
- On 200 OK, the local `useAuthStore.user` is updated and `localStorage.pulse_user_name` is set.
- On 4xx, the toast shows the error message, not "Profile name updated!".
- E2E test covers this flow.

**Audit ref:** §A.5.

---

### US-V3-014 — Implement real cloud sync 🟠
**As a** user
**I want** my workout data backed up to the server
**So that** I don't lose 6 months of training history if my browser wipes IndexedDB.

**Acceptance criteria:**
- New Prisma models: `UserWorkoutSession`, `UserBodyMeasurement`, `UserFoodEntry`, `UserRoutine`, `UserProgressPhoto` (all with `uid` FK).
- `pushToCloud(uid)` POSTs local Dexie data to `/api/sync/push` (since last `lastSyncedAt`).
- `pullFromCloud(uid)` GETs server data newer than local `updatedAt` and merges into Dexie.
- `syncAll` runs both, with conflict resolution: server wins on conflict (last-write-wins by `updatedAt`).
- `useSyncStore.lastSyncedAt` actually means something.
- Settings page shows real sync errors, not just "Synced 5 minutes ago" theater.

**Audit ref:** §A.5, critical #9.

---

### US-V3-015 — Add per-user data export (GDPR Article 20) 🟡
**As a** user
**I want** to export all my server-side data (social posts, comments, follows, challenges) as JSON
**So that** I can move my data to another app.

**Acceptance criteria:**
- New endpoint `GET /api/account/export` (requires `requireUser`).
- Returns a JSON blob containing: PublicProfile, FeedPosts, Comments, Follows (as both follower and following), Participations, SyncedWorkoutSessions.
- Combined with `exportLocalBackup()` (which already exists for Dexie data), gives a full export.
- Settings page has a "Download all my data" button that triggers both.

---

### US-V3-016 — Add account deletion (GDPR Article 17) 🟡
**As a** user
**I want** to delete my account and all associated server-side data
**So that** I can exercise my right to erasure.

**Acceptance criteria:**
- New endpoint `DELETE /api/account` (requires `requireUser`).
- Cascading delete: PublicProfile → FeedPosts → Comments → Follows → Participations → SyncedWorkoutSessions → Kudos.
- Firebase Auth user is deleted via `adminAuth.deleteUser(uid)`.
- `pulse_session` cookie is cleared.
- Client clears all Dexie tables for the current uid.
- Settings page has a red "Delete my account" button with double-confirm modal.

---

## Section 6 — Multi-tenant Safety (closes §A.1)

### US-V3-017 — Partition IndexedDB per user 🟠
**As a** user sharing a device with another Pulse user
**I want** my data isolated from the other user
**So that** they don't see my workouts, photos, and nutrition logs.

**Acceptance criteria:**
- On login, Dexie is opened with a per-uid database name: `PulseDB_${uid}` (instead of shared `PulseDB`).
- On logout, the current Dexie instance is closed and the in-memory stores are reset.
- Optional "remember me on this device" mode keeps a default DB for guests.
- Migration: on first login after deploy, copy `PulseDB` → `PulseDB_${uid}` and rename old DB.

---

### US-V3-018 — Wipe local stores on logout 🟠
**As a** user
**I want** all in-memory Zustand stores cleared when I log out
**So that** the next user to open the app on this browser doesn't see my feed/searches.

**Acceptance criteria:**
- `logoutUser` calls `useSocialStore.getState().clearState()`, `useWorkoutStore.getState().cancelWorkout()`, `useChallengesStore.getState().clearState()` (new method), etc.
- All `useXStore.persist` middlewares are rehydrated to `null`/`[]`/`{}`.
- `sessionStorage.pulse_splash_seen` is cleared so the next user sees the splash.

---

## Section 7 — Rate Limiting Hardening (closes §A.2)

### US-V3-019 — Per-user rate limiting in addition to per-IP 🟠
**As a** product owner
**I want** API rate limits enforced per logged-in user
**So that** one user behind a NAT (gym Wi-Fi) doesn't share a bucket with everyone else.

**Acceptance criteria:**
- Middleware reads `callerUid` from the verified session cookie (when present) and uses `${uid}:${pathname}` as the bucket key.
- Falls back to `${ip}:${pathname}` for unauthenticated routes.
- Per-UID limits: AI 20/hr, social writes 100/hr, sync 60/hr.

---

### US-V3-020 — Validate X-Forwarded-For against trusted proxy 🟡
**As a** security admin
**I want** the rate limiter to use the real client IP, not a spoofed one
**So that** attackers can't bypass rate limits by lying about their IP.

**Acceptance criteria:**
- `getClientIp` only trusts `x-forwarded-for` if the request came from a known proxy IP (Caddy's IP, configured via `TRUSTED_PROXY_IPS` env var).
- Otherwise, uses the direct socket IP.
- Logs suspicious `X-Forwarded-For` headers from non-proxy sources.

---

### US-V3-021 — Move rate-limit buckets to Redis (or Upstash) 🟡
**As a** backend engineer
**I want** rate-limit state shared across serverless invocations
**So that** cold starts don't reset attacker buckets.

**Acceptance criteria:**
- `src/middleware.ts` reads/writes buckets from a Redis-compatible store (Upstash REST API for serverless).
- Falls back to in-memory if Redis is unavailable.
- Cleanup cron moves expired buckets to a cold archive.

---

## Section 8 — Service Worker / PWA (closes §D.6, critical #9)

### US-V3-022 — Implement real offline-first service worker 🟠
**As a** user at the gym with bad Wi-Fi
**I want** to log my workout offline and have it sync when I'm back online
**So that** I never lose a set due to network issues.

**Acceptance criteria:**
- `public/sw.js` uses Workbox strategies:
  - **App shell:** cache-first (HTML, JS, CSS).
  - **Exercise images:** stale-while-revalidate (so they show offline).
  - **API GET:** network-first, fallback to cache.
  - **API POST/DELETE:** background sync queue (replays when online).
- `POST /api/sync/batch` accepts multiple deferred operations.
- `useBackgroundSync` hook already exists — wire it to the SW queue.
- Install prompt works (manifest is already valid).
- Lighthouse PWA score ≥ 90.

---

### US-V3-023 — Add service worker versioning and update flow 🟡
**As a** user
**I want** to be notified when a new version of the app is available
**So that** I'm not running stale code.

**Acceptance criteria:**
- SW `CACHE_NAME` is bumped on every deploy.
- `controllerchange` event triggers a toast: "New version available — reload".
- User can dismiss or reload.

---

## Section 9 — Test Coverage (closes §B.3)

### US-V3-024 — Add API route integration tests 🟠
**As a** backend engineer
**I want** every API route covered by integration tests
**So that** regressions are caught before deploy.

**Acceptance criteria:**
- New `src/app/api/__tests__/*.test.ts` for each route.
- Uses `next-test-api-route-handler` (or spin up Next.js test server).
- Mocks `firebaseAdmin.verifySessionCookie` to simulate authed/unauthed requests.
- Tests: happy path, 401, 400 (invalid input), 403 (impersonation), 404, 500, rate limit.

---

### US-V3-025 — Add E2E tests for critical flows 🟠
**As a** QA engineer
**I want** Playwright E2E tests for the 3 critical user journeys
**So that** I catch UI regressions before users do.

**Acceptance criteria:**
- `e2e/signup-wizard-workout.spec.ts`: signup → email verify → wizard → generate → start workout → log sets → finish → see summary.
- `e2e/social-feed.spec.ts`: login → finish workout → share to feed → see on feed → give kudos → comment → delete comment.
- `e2e/challenge.spec.ts`: login → join challenge → finish workout → see progress on challenge detail → see self on leaderboard.
- CI runs E2E on every PR.

---

### US-V3-026 — Add unit tests for algorithmic services 🟠
**As a** algorithm author
**I want** unit tests for every pure service module
**So that** I can refactor without fear.

**Acceptance criteria:**
- New tests: `fatigueEngine.test.ts`, `deloadEngine.test.ts`, `variationEngine.test.ts`, `recoveryTracker.test.ts`, `learningLoop.test.ts`, `movementPatterns.test.ts`, `smartRest.test.ts`, `warmupCalculator.test.ts`, `plateCalculator.test.ts`.
- Coverage ≥ 90% per module.
- Edge cases: empty history, single session, future-dated sessions, DST transitions, very-large volumes.

---

### US-V3-027 — Add store tests for all Zustand stores 🟡
**As a** frontend engineer
**I want** every Zustand store covered by tests
**So that** state transitions are predictable.

**Acceptance criteria:**
- New tests: `useSocialStore.test.ts`, `useChallengesStore.test.ts`, `useNutritionStore.test.ts`, `useAchievementsStore.test.ts`, `useAuthStore.test.ts`, `useSyncStore.test.ts`, `useSettingsStore.test.ts`, `useRoutineStore.test.ts`, `useToastStore.test.ts`, `useGeneratorStore.test.ts`.
- Uses `fake-indexeddb` for Dexie-backed stores.

---

## Section 10 — CI/CD & SDLC (closes §B.4)

### US-V3-028 — Add GitHub Actions CI pipeline 🟠
**As a** team lead
**I want** every PR to pass lint + typecheck + tests before merge
**So that** broken code never reaches `main`.

**Acceptance criteria:**
- New `.github/workflows/ci.yml`:
  - `bun install`
  - `bun run lint` (with `--max-warnings=0`)
  - `bunx tsc --noEmit`
  - `bun run test` (vitest)
- Required status check before merge to `main`.
- Caches `node_modules` and `.next/cache` for speed.

---

### US-V3-029 — Add deploy workflow 🟡
**As a** devops engineer
**I want** `main` merges to auto-deploy to staging and (manually) to production
**So that** deploys are reproducible.

**Acceptance criteria:**
- `.github/workflows/deploy.yml`:
  - On `main` push: build → push to staging server via SSH.
  - On manual dispatch with `environment=production`: build → push to prod.
- Uses `next build` standalone output.
- Runs DB migrations (`prisma migrate deploy`) before switching the symlink.

---

### US-V3-030 — Add pre-commit hooks 🟡
**As a** developer
**I want** lint + typecheck to run on every commit
**So that** I catch mistakes before pushing.

**Acceptance criteria:**
- `husky` + `lint-staged` installed.
- Pre-commit runs `eslint --fix` + `tsc --noEmit` on staged files.
- Optional `--no-verify` escape hatch documented.

---

## Section 11 — Performance (closes §E)

### US-V3-031 — Lazy-load all 16 page components 🟠
**As a** user on a slow connection
**I want** the initial bundle to be small
**So that** the app loads fast on first visit.

**Acceptance criteria:**
- `src/app/page.tsx` converts all 16 static `import HomePage from "@/pages/HomePage"` to `const HomePage = dynamic(() => import("@/pages/HomePage"), { ssr: false })`.
- Initial JS bundle gzipped ≤ 200 KB (down from ~500 KB).
- Lighthouse Performance score ≥ 90 on mobile.

---

### US-V3-032 — Lazy-load recharts and framer-motion in non-critical pages 🟠
**As a** user
**I want** chart/animation libraries loaded only when needed
**So that** the home page doesn't pay for StatsPage's recharts.

**Acceptance criteria:**
- `recharts` imported via `dynamic` in `StatsPage`, `BodyPage`, `ExerciseDetailPage`, `ExerciseProgressChart`, `MuscleVolumeMap`.
- `framer-motion` already in the main bundle (acceptable for the splash screen), but `AnimatePresence` usages in rarely-visited pages are lazy-loaded.

---

### US-V3-033 — Replace raw `<img>` with `next/image` 🟡
**As a** user
**I want** images optimized (WebP, responsive, lazy)
**So that** page loads are faster and data usage is lower.

**Acceptance criteria:**
- All 15+ `<img>` tags in source replaced with `next/image`'s `<Image>` component.
- `next.config.ts` `images.remotePatterns` extended to include `firebasestorage.googleapis.com` (for user avatars) and any other remote image hosts.
- Explicit `width`/`height` (or `fill`) on every `<Image>`.
- LCP image gets `priority` prop.

---

### US-V3-034 — Add request body size limits 🟠
**As a** backend engineer
**I want** API routes to reject oversized request bodies
**So that** a 50MB POST doesn't OOM the server.

**Acceptance criteria:**
- Middleware checks `Content-Length` and rejects > 1MB with 413 for all `/api/` routes.
- `/api/sync/push` allows up to 10MB (legitimate use case).
- `/api/ai-coach` caps `exercises` array at 200 entries (already done) and `recentSessions` at 20.

---

### US-V3-035 — Optimize Dexie schema to avoid boolean-scan pattern 🟡
**As a** backend engineer
**I want** an index on `completed` for `workoutSessions`
**So that** `getCompletedSessions` doesn't do a full-table scan.

**Acceptance criteria:**
- New schema field `completedInt: 0 | 1` on WorkoutSession (and similar for other boolean-indexed tables).
- Migration adds `completedInt` based on existing `completed` value.
- All `.filter((s) => s.completed === true)` replaced with `.where("completedInt").equals(1)`.
- Benchmark: 50,000 sessions, query time < 50ms (vs current ~500ms).

---

## Section 12 — Error Monitoring (closes §A.6)

### US-V3-036 — Add Sentry for error monitoring 🟠
**As a** on-call engineer
**I want** all unhandled errors reported to Sentry
**So that** I can detect production incidents.

**Acceptance criteria:**
- `@sentry/nextjs` installed and configured.
- Client-side: captures React render errors (via `ErrorBoundary`) and unhandled promise rejections.
- Server-side: captures API route errors with request context (URL, method, user uid).
- Source maps uploaded on every deploy.
- Sentry DSN in `.env` as `SENTRY_DSN`.

---

### US-V3-037 — Replace `console.error` with structured logger 🟡
**As a** backend engineer
**I want** a structured logger (pino or winston)
**So that** logs are queryable in production.

**Acceptance criteria:**
- New `src/lib/logger.ts` wraps pino with sensible defaults (JSON format, request ID, user uid).
- All `console.error` in API routes replaced with `logger.error({ err, req, uid })`.
- All `console.log` in API routes replaced with `logger.info`.
- Client-side keeps `console.*` (acceptable).

---

### US-V3-038 — Add request ID middleware 🟡
**As a** on-call engineer
**I want** every API request to have a unique ID
**So that** I can trace a request through logs.

**Acceptance criteria:**
- Middleware generates `reqId = crypto.randomUUID()` and sets `X-Request-ID` response header.
- `requireUser` includes `reqId` in error logs.
- Client-side `useSocialStore` etc. log `X-Request-ID` from response headers on error.

---

## Section 13 — Documentation (closes §B.5)

### US-V3-039 — Write `README.md` 🟡
**As a** new developer
**I want** a README explaining how to run the project
**So that** I can contribute quickly.

**Acceptance criteria:**
- Project overview, stack, screenshots.
- Prerequisites (Node 20+, bun, Firebase project).
- Setup steps: clone → `bun install` → copy `.env.example` → `bun run db:push` → `bun run dev`.
- Scripts documented (`dev`, `build`, `start`, `test`, `lint`, `db:*`).
- Link to `ARCHITECTURE.md`, `CODE_AUDIT_V5.md`, `USER_STORIES_V3.md`.

---

### US-V3-040 — Write `AGENTS.md` 🟡
**As a** AI coding agent
**I want** an AGENTS.md explaining project conventions
**So that** I generate code that fits the codebase.

**Acceptance criteria:**
- Architecture summary (offline-first, single-route, Zustand stores, pure services).
- Coding conventions: TypeScript strict, no `any`, individual Zustand selectors, `memo()` for heavy components, hoist subcomponents to module scope.
- File layout map.
- Testing conventions (vitest, fake-indexeddb, `// @vitest-environment jsdom` directive).
- Common pitfalls (Dexie boolean index, hydration mismatch, service worker no-op).

---

### US-V3-041 — Write `.env.example` 🟡
**As a** new developer
**I want** a template env file
**So that** I know which env vars are required.

**Acceptance criteria:**
- `.env.example` lists every env var with a placeholder value and a comment explaining each.
- Includes: `DATABASE_URL`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `NEXT_PUBLIC_FIREBASE_*`, `SERVICE_ACCOUNT_PATH`, `FIREBASE_SERVICE_ACCOUNT`, `SENTRY_DSN`, `TRUSTED_PROXY_IPS`, `APP_URL`.

---

### US-V3-042 — Write OpenAPI spec for all API routes 🟡
**As a** API consumer
**I want** a machine-readable spec of all 15+ API routes
**So that** I can generate client SDKs.

**Acceptance criteria:**
- `openapi.yaml` at repo root.
- Each route documented with: method, path, request schema, response schema (success + error), auth requirement, rate limit.
- Validated with `spectral` in CI.

---

### US-V3-043 — Update `ARCHITECTURE.md` to match reality 🟡
**As a** reader
**I want** the architecture doc to reflect the actual implementation
**So that** I'm not misled.

**Acceptance criteria:**
- Remove the "HS256 JWT" claim — replace with "Firebase session cookie" (after US-V3-001 lands) or "Firebase ID token in cookie" (current state).
- Update test count from "138 tests across 14 files" to current count.
- Remove "PWA SW registration in layout" claim (no registration code exists).
- Add "Cloud sync is currently a no-op" disclaimer (until US-V3-014 lands).

---

## Section 14 — Firebase Storage (closes §D.2)

### US-V3-044 — Add Firebase Storage security rules 🟠
**As a** security admin
**I want** Storage rules in the repo and deployed
**So that** users can only read/write their own files.

**Acceptance criteria:**
- New `storage.rules` file:
  ```
  rules_version = '2';
  service firebase.storage {
    match /b/{bucket}/o {
      match /avatars/{userId}.jpg {
        allow read: if true;  // public read for feed
        allow write: if request.auth.uid == userId
                     && request.resource.size < 1 * 1024 * 1024
                     && request.resource.contentType.matches('image/.*');
      }
      match /progress/{userId}/{photoId} {
        allow read: if request.auth.uid == userId;
        allow write: if request.auth.uid == userId
                     && request.resource.size < 10 * 1024 * 1024
                     && request.resource.contentType.matches('image/.*');
      }
      match /{allPaths=**} {
        allow read, write: if false;  // deny everything else
      }
    }
  }
  ```
- Deployed via `firebase deploy --only storage`.
- Documented in README.

---

### US-V3-045 — Resize progress photos before upload 🟡
**As a** user
**I want** my 10MB progress photo compressed before upload
**So that** uploads are fast and Storage quota is preserved.

**Acceptance criteria:**
- `BodyPage` uses `avatarService.resizeImage(file, 1024)` (reuse existing function) before upload.
- Original `imageBlob` field stores the resized version.
- `thumbnailBlob` field generates a 128×128 thumbnail.
- Migration: existing photos are left as-is (lazy resize on next view).

---

## Section 15 — Lint & Code Quality (closes §B.1, §B.2)

### US-V3-046 — Fix all 12 `: any` violations 🟠
**As a** code reviewer
**I want** zero `any` in the codebase
**So that** ESLint's `no-explicit-any` rule is meaningful.

**Acceptance criteria:**
- `AuthPage.tsx:46, 76` — replace `catch (err: any)` with `catch (err)` and use `err instanceof FirebaseError` for typed handling.
- `WorkoutResultView.tsx:189, 203` — type `rawSessions` as `WorkoutSession[]` and `learningLoop` as `LearningLoopSummary | undefined`.
- `GeneratorWizard.tsx:337, 355` — same as above.
- `GeneratorWizard.tsx:718` — replace `as any` with a proper typed key lookup: `updateProfile({ [k]: !active } as Partial<GeneratorProfile>)`.
- `regression.test.tsx` (5 occurrences) — acceptable in test mocks; suppress with file-level `/* eslint-disable @typescript-eslint/no-explicit-any */` if needed.
- `bun run lint` exits 0.

---

### US-V3-047 — Re-enable disabled ESLint rules 🟡
**As a** code reviewer
**I want** quality rules enforced
**So that** sloppy code is caught.

**Acceptance criteria:**
- Set `no-debugger: "error"`, `no-console: ["error", { allow: ["warn", "error"] }]` (allow `console.warn/error` for prod diagnostics).
- `no-irregular-whitespace: "error"`, `no-unreachable: "error"`, `no-empty: "error"`, `no-redeclare: "error"`.
- `react-hooks/exhaustive-deps: "error"`.
- `@next/next/no-img-element: "warn"` (until US-V3-033 lands).
- Fix all new violations.

---

### US-V3-048 — Remove dead dependencies 🟡
**As a** bundle-size-conscious engineer
**I want** unused npm packages removed
**So that** `node_modules` and `bun install` are faster.

**Acceptance criteria:**
- `@mdxeditor/editor` — not imported anywhere; remove.
- `react-syntax-highlighter` — not imported anywhere; remove.
- `react-day-picker` — only in `calendar.tsx` (shadcn boilerplate); remove if `calendar.tsx` is unused.
- `cmdk` — only in `command.tsx`; remove if unused.
- `@reactuses/core` — check usage; remove if unused.
- `next-intl` — not used (i18next is used instead); remove.
- `lightningcss-win32-x64-msvc` — Windows-only devDep on Linux dev boxes; remove.

---

## Section 16 — Accessibility (NEW — not in V5 audit but recommended)

### US-V3-049 — WCAG 2.2 AA compliance audit 🔵
**As a** user with a screen reader
**I want** all interactive elements labeled
**So that** I can navigate the app.

**Acceptance criteria:**
- Run `@axe-core/playwright` in E2E tests; fail on serious violations.
- All `<button>` have `aria-label` or visible text.
- All `<input>` have associated `<label>` (via `htmlFor`/`id`).
- Color contrast ≥ 4.5:1 for normal text (the design system already targets AAA, verify).
- Focus visible on all interactive elements.
- Touch targets ≥ 44×44px.

---

## Section 17 — Feature Flags & Analytics (NEW)

### US-V3-050 — Add feature flag system 🔵
**As a** product manager
**I want** to gate new features behind flags
**So that** I can roll out gradually.

**Acceptance criteria:**
- Lightweight `useFeatureFlag(name)` hook reading from `localStorage` (for dev) or `/api/flags` (for prod).
- Initial flags: `cloud_sync_v2`, `real_offline_sw`, `deload_ui`, `variation_rotation_ui`.

---

### US-V3-051 — Add privacy-preserving analytics 🔵
**As a** product manager
**I want** to know which features are used
**So that** I can prioritize improvements.

**Acceptance criteria:**
- Self-hosted Posthog (or Plausible) — no Google Analytics.
- Events: workout_started, workout_finished, ai_coach_called, social_post_published, challenge_joined.
- All events are anonymous (no user PII).
- Opt-out toggle in Settings → Privacy.

---

## Summary

| Section | Stories | Critical | High | Medium | Low |
|---|---|---|---|---|---|
| 1. Auth & Session | 4 | 2 | 2 | 0 | 0 |
| 2. API Authorization | 5 | 4 | 1 | 0 | 0 |
| 3. Identity Spoofing | 2 | 2 | 0 | 0 | 0 |
| 4. Caddyfile/SSRF | 1 | 1 | 0 | 0 | 0 |
| 5. Broken Flows | 4 | 1 | 1 | 2 | 0 |
| 6. Multi-tenant | 2 | 0 | 2 | 0 | 0 |
| 7. Rate Limiting | 3 | 0 | 1 | 2 | 0 |
| 8. PWA / SW | 2 | 0 | 1 | 1 | 0 |
| 9. Test Coverage | 4 | 0 | 3 | 1 | 0 |
| 10. CI/CD & SDLC | 3 | 0 | 1 | 2 | 0 |
| 11. Performance | 5 | 0 | 3 | 2 | 0 |
| 12. Error Monitoring | 3 | 0 | 1 | 2 | 0 |
| 13. Documentation | 5 | 0 | 0 | 5 | 0 |
| 14. Firebase Storage | 2 | 0 | 1 | 1 | 0 |
| 15. Lint & Quality | 3 | 0 | 1 | 2 | 0 |
| 16. Accessibility | 1 | 0 | 0 | 0 | 1 |
| 17. Feature Flags | 2 | 0 | 0 | 0 | 2 |
| **Total** | **51** | **10** | **18** | **22** | **3** |

### Sequencing

**Sprint 1 (week 1):** US-V3-001, 002, 003, 005, 006, 007, 008, 010, 011, 012, 013 (all critical blockers).
**Sprint 2 (week 2):** US-V3-004, 009, 014, 017, 018, 019, 022, 028, 034, 036 (high-priority hardening).
**Sprint 3 (week 3):** US-V3-015, 016, 020, 024, 025, 026, 031, 032, 044, 046 (medium-priority cleanup).
**Sprint 4 (week 4):** Everything else.

After Sprint 1, the app is no longer blocked from production.
After Sprint 2, the app is production-grade.
After Sprint 3, the app is well-tested.
After Sprint 4, the app is polished.
