# Feature Specification: Sprint 3 Test Coverage & CI/CD

**Feature Branch**: `sprint3-test-coverage`

**Created**: 2026-06-20

**Status**: Draft

**Input**: User description: "Sprint 3 Test Coverage & CI/CD — (P1-3) GitHub Actions CI pipeline running lint + tsc + vitest on every PR; (P1-9) API integration tests for all 15 routes using next-test-api-route-handler with mocked firebaseAdmin; (P1-13) Playwright E2E tests for 3 critical user flows; (P1-16) unit tests for 7 algorithm services using fake-indexeddb for Dexie-backed tests."

## Context & Scope

This spec covers exactly four high-priority testing/CI items from `CODE_AUDIT_V5.md`:

- **P1-3 — CI/CD Pipeline**: The project has zero CI. No `.github/workflows/` directory exists (only `.github/copilot-instructions.md`). Anything that compiles ships. We create a GitHub Actions workflow that runs `pnpm install`, `pnpm run lint`, `tsc --noEmit`, and `vitest` on every PR and push to `main`, with pnpm store + `.next/cache` caching for speed.

- **P1-9 — API Integration Tests**: The 15 API routes (migrated to Zod validation in Sprint 2) have zero integration test coverage. The existing `src/services/__tests__/api-integration.test.ts` only tests the social store's header-sending behavior — it does NOT exercise the actual route handlers. We add true integration tests using `next-test-api-route-handler` (not yet installed) to invoke each route's GET/POST/DELETE handler in isolation, with `firebaseAdmin.verifySessionCookie` mocked to simulate authenticated vs unauthenticated requests, and Prisma mocked or stubbed for deterministic assertions.

- **P1-13 — E2E Tests**: Zero end-to-end test coverage. The critical user flows (signup → wizard → workout → share; social feed; challenges) are untested beyond manual browser verification. We add Playwright (not yet installed) E2E tests for 3 critical flows that exercise the full stack: Firebase Auth → Dexie IndexedDB → API routes → Prisma → UI rendering.

- **P1-16 — Algorithm Unit Tests**: The 7 core algorithm services (`fatigueEngine`, `deloadEngine`, `variationEngine`, `learningLoop`, `movementPatterns`, `recoveryTracker`, `smartRest`) have incomplete unit test coverage. Some have partial tests (`progressiveOverload`, `workoutGenerator`); the 7 listed here have none or minimal. The `learningLoop` service is Dexie-backed (reads/writes `db.exerciseFeedback`), so its tests require `fake-indexeddb` (already installed at `^6.2.5`) to provide an in-memory IndexedDB implementation.

This spec is **specification only**. No implementation is performed in this stage.

## Inventory: What Exists vs What's Needed

### Existing test infrastructure
| Component | Status |
|-----------|--------|
| `vitest@^4.1.9` | ✅ Installed |
| `vitest.config.ts` | ✅ Configured (node env, `@` alias, 15s timeout, `src/**/*.{test,spec}.{ts,tsx}`) |
| `fake-indexeddb@^6.2.5` | ✅ Installed |
| `@testing-library/react@^16.3.2` | ✅ Installed |
| `jsdom@^29.1.1` | ✅ Installed |
| `pnpm-lock.yaml` | ✅ Present (pnpm is the package manager) |
| `next-test-api-route-handler` | ❌ NOT installed — must add |
| `@playwright/test` | ❌ NOT installed — must add |
| `playwright` browser binaries | ❌ NOT installed — CI will use `playwright install` |
| `.github/workflows/` | ❌ Does NOT exist — must create |

### Existing test files (15 files, ~170 test cases)
```
src/components/__tests__/AnatomyMap.performance.test.tsx
src/components/__tests__/regression.test.tsx
src/db/__tests__/analytics.test.ts
src/lib/__tests__/syncEngine.test.ts
src/lib/__tests__/validation.test.ts
src/router/__tests__/router.test.ts
src/services/__tests__/aiWorkoutService.test.ts
src/services/__tests__/api-integration.test.ts    ← only tests store headers, NOT route handlers
src/services/__tests__/exerciseService.test.ts
src/services/__tests__/progressiveOverload.test.ts
src/services/__tests__/workoutGenerator.test.ts
src/store/__tests__/useExerciseStore.test.ts
src/store/__tests__/useWorkoutStore.test.ts
src/utils/__tests__/fitnessMath.test.ts
src/utils/__tests__/muscleMapper.test.ts
```

### Algorithm services needing unit tests (7)
| Service | Dexie-backed? | Key exports to test |
|---------|--------------|---------------------|
| `fatigueEngine.ts` | No | `assessFatigueACWR(sessions, profile, exerciseMap)` → `FatigueAssessment` |
| `deloadEngine.ts` | No | `assessDeloadNeed(sessions, profile, fatigue?, exerciseHistory?)` → `DeloadRecommendation` |
| `variationEngine.ts` | No | `buildVariationGroups(exercises)`, `detectRotationNeeds(...)` |
| `learningLoop.ts` | **Yes** (`db.exerciseFeedback`) | `recordCompletion`, `recordSkip`, `recordSwap`, `buildLearningLoopSummary`, `recordFeedbackFromSession` |
| `movementPatterns.ts` | No | `classifyMovementPattern(exercise)`, `areAntagonisticPatterns(a, b)`, `ANTAGONISTIC_PATTERN_PAIRS` |
| `recoveryTracker.ts` | No | `calculateMuscleRecovery(sessions, exercises)`, `getRecoverySummary(map)`, `getRecoveryColor(status)` |
| `smartRest.ts` | No | `suggestRestDuration(input)`, `rpeColorClass(rpe)`, `rpeLabel(rpe)` |

### API routes needing integration tests (15 route files, ~30 handler functions)
| Route | Methods | Auth required? | Body/Query schema |
|-------|---------|----------------|-------------------|
| `/api` | GET | No | — |
| `/api/ai-coach` | POST | Yes | `coachRequestSchema` (large nested) |
| `/api/ai-health` | GET | No | — |
| `/api/ai-workout` | POST | Yes | `structuredRequestBodySchema` (strict, no prompt) |
| `/api/auth/session` | POST, DELETE | No (POST mints cookie) | `sessionPostSchema` ({ idToken }) |
| `/api/challenges` | GET | No | — |
| `/api/challenges/[challengeId]/join` | POST | Yes | `joinBodySchema` + path param |
| `/api/challenges/[challengeId]/leaderboard` | GET | No | path param |
| `/api/challenges/[challengeId]/progress` | GET | Yes | `progressQuerySchema` + path param |
| `/api/challenges/sync-volume` | POST | Yes | `syncVolumeBodySchema` |
| `/api/social/comments` | GET, POST, DELETE | Yes (POST/DELETE) | `commentCreateSchema`, `commentDeleteSchema`, `commentsQuerySchema` |
| `/api/social/feed` | GET, POST | Yes | `feedPostSchema` |
| `/api/social/follow` | POST, DELETE | Yes | `followBodySchema` |
| `/api/social/following` | GET | Yes | `followingQuerySchema` |
| `/api/social/kudos` | POST | Yes | `kudosBodySchema` |
| `/api/social/posts` | DELETE | Yes | `postDeleteSchema` |
| `/api/social/profile` | POST | Yes | `profileBodySchema` |
| `/api/social/search` | GET | No | `searchQuerySchema` |

## User Scenarios & Testing *(mandatory)*

### User Story 1 — CI/CD Pipeline (Priority: P1)

As a developer and code reviewer, I want a GitHub Actions workflow that automatically runs lint, type-check, and unit/integration tests on every pull request and push to `main`, so that broken code is caught before merge, the constitution's quality gates (lint + tsc + tests) are enforced uniformly, and no regression in the 15 API routes or 7 algorithm services can ship undetected.

**Why this priority**: Without CI, the constitution's quality gates ("`bun run lint` before commit", "`npx tsc --noEmit` must pass", "Agent Browser verification") are aspirational, not enforced. Sprint 2 introduced 31 new files (16 schemas + 15 route migrations + rateLimit + middleware rewrite) with zero automated test coverage of the new validation behavior. CI is the backbone that makes every subsequent test added in P1-9, P1-13, and P1-16 actually run on every change. Delivering CI first means every test written afterward is automatically exercised.

**Independent Test**: Can be fully tested by opening a PR that introduces a deliberate lint error or type error and confirming the CI check fails (red X), then fixing it and confirming the check passes (green check). Delivering this story alone gives the team an enforced quality gate before any tests are written.

**Acceptance Scenarios**:

1. **Given** a developer opens a PR against `main`, **When** the PR is created or updated, **Then** the `ci` workflow triggers automatically and runs the `lint`, `typecheck`, and `test` jobs.
2. **Given** the CI workflow runs, **When** the `lint` job executes `pnpm run lint`, **Then** it passes if there are 0 new errors (pre-existing warnings OK) and fails if any new lint error is introduced.
3. **Given** the CI workflow runs, **When** the `typecheck` job executes `pnpm exec tsc --noEmit`, **Then** it passes if there are 0 new TypeScript errors and fails on any new type error. (Pre-existing errors are tolerated via `|| true` until Sprint 4 cleanup — see FR-006.)
4. **Given** the CI workflow runs, **When** the `test` job executes `pnpm test`, **Then** it runs all `*.test.{ts,tsx}` files via vitest and passes if all tests pass, fails if any test fails.
5. **Given** the CI workflow runs for the second time on the same branch, **When** the `pnpm install` step executes, **Then** the pnpm store cache (`~/.local/share/pnpm/store` or `~/Library/pnpm/store` depending on OS) is restored from the previous run, reducing install time from ~60s to ~10s.
6. **Given** the CI workflow runs for the second time, **When** the build/test steps execute, **Then** the `.next/cache` directory is restored, reducing Turbopack compilation warm-up time.
7. **Given** a developer pushes a commit that breaks a unit test, **When** the CI runs, **Then** the `test` job fails, the PR shows a red X, and the merge button is blocked (assuming branch protection rules are configured separately).
8. **Given** the workflow definition, **When** a developer reads `.github/workflows/ci.yml`, **Then** it uses `pnpm/action-setup@v4` for pnpm setup and `actions/setup-node@v4` with `cache: pnpm` for Node.js + pnpm cache integration.
9. **Given** the workflow runs on a PR, **When** all 3 jobs (lint, typecheck, test) pass, **Then** the PR shows a green check and the developer can merge (subject to branch protection).

---

### User Story 2 — API Integration Tests (Priority: P1)

As a backend developer maintaining the 15 API routes, I want integration tests that invoke each route handler via `next-test-api-route-handler` with mocked Firebase auth and Prisma, so that I can verify the Zod validation (Sprint 2), the auth boundary (`requireUser`), the impersonation checks, and the happy-path business logic all behave correctly — without needing a running Firebase project, a running SQLite file, or a running dev server.

**Why this priority**: Sprint 2 added Zod schemas to all 15 routes, but there are zero tests verifying that a malformed body actually returns `400`, that a missing session cookie returns `401`, or that the `.strict()` mode on `ai-workout` actually rejects `prompt`. The existing `api-integration.test.ts` only tests the client-side store's header-sending — it never invokes a route handler. These are the most security-critical code paths in the app (auth, validation, impersonation prevention) and they are completely untested. A regression in any `parseRequestBody` call could silently re-open the vulnerabilities Sprint 1 and 2 closed.

**Independent Test**: Can be fully tested by running `pnpm test src/app/api` and asserting that every route has at least 4 test cases (happy path, 401 unauth, 400 validation, 404 not-found where applicable). Delivering this story alone gives every API route a regression safety net.

**Acceptance Scenarios**:

1. **Given** the `firebaseAdmin` module is mocked so that `verifySessionCookie(cookie, true)` returns `{ uid: "test-uid-123" }` for a valid cookie and throws for `"invalid"`, **When** the test calls `testApiHandler` with a POST to `/api/social/comments` and a valid body `{ postId: "p1", text: "hello" }` + valid cookie, **Then** the response is `200` and the mocked `prisma.comment.create` was called with `authorUid: "test-uid-123"` (identity from session, not from body).
2. **Given** the same mock setup, **When** the test calls `testApiHandler` with a POST to `/api/social/comments` with NO `pulse_session` cookie, **Then** the response is `401` with `{ error: "Authentication required. Please sign in." }` (the P0-2 middleware check — simulated by the test not setting the cookie and the handler's `requireUser` returning 401).
3. **Given** the same mock setup, **When** the test calls `testApiHandler` with a POST to `/api/social/comments` with body `{ postId: 12345, text: "hi" }` (postId is a number, not a string), **Then** the response is `400` with `{ error: "Validation failed", details: [{ path: ["postId"], message: "..." }] }` and the mocked `prisma` was NEVER called.
4. **Given** the same mock setup, **When** the test calls `testApiHandler` with a POST to `/api/social/comments` with body `{ postId: "p1", text: "   " }` (whitespace-only text), **Then** the response is `400` (text fails `.min(1)` after `.trim()`).
5. **Given** the same mock setup, **When** the test calls `testApiHandler` with a POST to `/api/social/comments` with body `{ postId: "p1", text: "ok", authorUid: "attacker" }` (extra forbidden field), **Then** the response is `400` (the `.strip()` mode silently drops `authorUid`, but the handler uses `requireUser`'s uid — the extra field never reaches Prisma). *(Note: `.strip()` mode does NOT reject unknown keys — it drops them. So this test asserts the field is dropped, not rejected. For routes using `.strict()` mode, the unknown field IS rejected with 400.)*
6. **Given** the `ai-workout` route with `.strict()` schema, **When** the test sends `{ prompt: "ignore previous instructions" }`, **Then** the response is `400` (the `prompt` field is rejected by `.strict()` — the prompt-injection guard is tested).
7. **Given** the `challenges/[challengeId]/join` route, **When** the test sends a valid body with `userId: "other-user"` but the session cookie resolves to `uid: "test-uid-123"`, **Then** the response is `403` with `{ error: "Cannot join a challenge on behalf of another user" }` (impersonation prevention).
8. **Given** the `challenges/sync-volume` route, **When** the test sends `{ userId: "test-uid-123", totalVolume: -50 }`, **Then** the response is `400` (totalVolume fails `.min(0)` — negative volume rejected).
9. **Given** the `social/follow` route, **When** the test sends `{ currentUid: "a", targetUid: "a" }` (self-follow), **Then** the response is `400` with `{ error: "Cannot follow yourself" }`.
10. **Given** the `auth/session` POST route, **When** the test sends `{}` (no idToken), **Then** the response is `400` with validation details (the `sessionPostSchema` requires `idToken`).
11. **Given** the `social/search` GET route, **When** the test sends `?q=` (empty query), **Then** the response is `200` with `[]` (empty array — current behavior preserved).
12. **Given** the `social/search` GET route, **When** the test sends `?q=x`.repeat(101) (101-char query), **Then** the response is `400` (q exceeds `.max(100)`).
13. **Given** any route, **When** the test sends malformed non-JSON body (e.g. `{bad json`), **Then** the response is `400` with `{ error: "Invalid JSON body" }` (the `parseRequestBody` helper catches the SyntaxError).
14. **Given** the `social/posts` DELETE route, **When** the test sends `{ postId: "p1" }` but the mocked `prisma.feedPost.findUnique` returns `null`, **Then** the response is `404` with `{ error: "Post not found" }`.
15. **Given** the `social/comments` DELETE route, **When** the test sends `{ postId: "p1", commentId: "c1" }` but the mocked comment's `authorUid` is `"other-user"` while the session is `"test-uid-123"`, **Then** the response is `403` with `{ error: "You can only delete your own comments" }` (ownership check).
16. **Given** the full test suite runs, **When** `pnpm test src/app/api` executes, **Then** all route tests pass, the mocked `prisma` and `firebaseAdmin` are reset between tests (`beforeEach` + `vi.clearAllMocks()`), and no test depends on another test's state.

---

### User Story 3 — E2E Tests with Playwright (Priority: P1)

As a product owner and QA engineer, I want Playwright E2E tests that exercise the 3 most critical user flows end-to-end (signup → wizard → workout → share; social feed; challenges), so that I can verify the full stack (Firebase Auth → Dexie IndexedDB → API routes → Prisma → UI) works together and catch regressions that unit/integration tests miss (e.g. a broken store-to-API wiring, a Dexie schema mismatch, a routing error).

**Why this priority**: Unit tests verify algorithms in isolation; integration tests verify route handlers with mocked deps; but neither verifies that the client-side store actually calls the right API, that Dexie persists data correctly in a real browser, or that the UI renders the data from the store. The 3 flows chosen are the core value proposition of the app: (1) the workout generation flow is the primary user journey, (2) the social feed is the retention loop, (3) challenges drive engagement. A regression in any of these silently breaks the product. Playwright tests in CI catch these before deploy.

**Independent Test**: Can be fully tested by running `pnpm exec playwright test` locally and confirming all 3 flow tests pass against a running dev server. Delivering this story alone verifies the golden paths work end-to-end.

**Acceptance Scenarios**:

1. **Given** a dev server is running on `localhost:3000` and Playwright launches a Chromium browser, **When** the test navigates to `/`, **Then** the splash screen renders within 5 seconds and the "Get Started" button is visible.
2. **Given** the signup flow test, **When** the test clicks "Get Started" → completes the 5-step wizard (selecting goal, schedule, muscles, health, review) → clicks "Generate", **Then** the AI workout generation triggers and a workout program renders with at least 1 exercise.
3. **Given** the workout flow test, **When** the test starts a workout session → completes all sets → clicks "Finish", **Then** the workout result view renders with total volume, duration, and PRs (if any), and the session is persisted to Dexie (verifiable by reloading the page and checking the stats page).
4. **Given** the share flow test, **When** the test clicks "Share to Feed" on the workout result, **Then** the feed page renders with the newly posted workout at the top, showing the workout title, duration, and volume.
5. **Given** the social feed test, **When** the test navigates to the feed → clicks the kudos button on a post, **Then** the kudos count increments by 1 and the button shows the "kudosed" state.
6. **Given** the social feed test, **When** the test clicks "Comment" on a post → types a comment → submits, **Then** the comment appears in the comment list below the post with the author's name and timestamp.
7. **Given** the challenge flow test, **When** the test navigates to the challenges page → clicks "Join" on a challenge, **Then** the challenge shows as "Joined" and the participation appears in the user's active challenges.
8. **Given** the challenge flow test, **When** the test completes a workout (which syncs volume via `/api/challenges/sync-volume`), **Then** the challenge progress bar updates to reflect the new volume.
9. **Given** the challenge flow test, **When** the test navigates to the leaderboard for a joined challenge, **Then** the leaderboard renders with at least the test user's entry, sorted by progress descending.
10. **Given** the E2E test suite runs in CI, **When** the Playwright job executes, **Then** it installs Chromium via `npx playwright install --with-deps chromium`, starts the dev server, runs all 3 flow tests, and uploads the test report (HTML + JUnit XML) as a CI artifact on failure.
11. **Given** a test fails, **When** the Playwright job completes, **Then** a screenshot and video of the failing test is uploaded as a CI artifact for debugging.

---

### User Story 4 — Algorithm Unit Tests (Priority: P1)

As a developer maintaining the 7 science-based algorithm services, I want comprehensive unit tests that verify the ACWR fatigue math, the deload triggers, the exercise variation rotation, the learning loop feedback scoring, the movement pattern classification, the muscle recovery tracking, and the smart rest duration recommendations — so that a change to one service's logic doesn't silently break the training science the app is built on.

**Why this priority**: These 7 services encode the app's differentiation (sports-science-based training). The `fatigueEngine` implements Gabbett's ACWR research; `deloadEngine` detects performance regression; `learningLoop` tracks which exercises the user skips/swaps. A bug in any of these silently degrades workout quality — the user gets worse workouts but nothing crashes. Unit tests with known inputs/outputs are the only way to verify the math stays correct across refactors. The `learningLoop` service additionally requires `fake-indexeddb` because it reads/writes `db.exerciseFeedback` in Dexie.

**Independent Test**: Can be fully tested by running `pnpm test src/services/__tests__` and asserting each of the 7 services has a test file with at least 5 test cases covering edge cases (empty input, boundary values, typical scenarios). Delivering this story alone gives the algorithm layer a regression safety net.

**Acceptance Scenarios**:

1. **Given** `fatigueEngine.assessFatigueACWR`, **When** called with 0 completed sessions, **Then** it returns `acuteLoad: 0, chronicLoad: 0, acwr: 0, fatigueScore: 5` (fully recovered) and `recommendation` indicating "no data".
2. **Given** `fatigueEngine.assessFatigueACWR`, **When** called with 7 sessions of equal volume in the last week and 0 sessions before that, **Then** `acwr > 1.5` (high injury risk — acute spike with no chronic base) and `fatigueScore < 3`.
3. **Given** `fatigueEngine.assessFatigueACWR`, **When** called with 28 days of consistent volume (acute ≈ chronic), **Then** `0.8 <= acwr <= 1.3` (optimal zone) and `fatigueScore >= 4`.
4. **Given** `deloadEngine.assessDeloadNeed`, **When** called with sessions where the last deload was > 8 weeks ago, **Then** `shouldDeload: true` and `trigger: "time-based"`.
5. **Given** `deloadEngine.assessDeloadNeed`, **When** called with a fatigue assessment where `acwr > 1.5`, **Then** `shouldDeload: true` and `trigger: "acwr-based"`.
6. **Given** `deloadEngine.assessDeloadNeed`, **When** called with exercise history showing a 3-session performance regression (declining estimated 1RM), **Then** `shouldDeload: true` and `trigger: "performance-based"`.
7. **Given** `variationEngine.buildVariationGroups`, **When** called with a list of exercises including "Barbell Bench Press", "Dumbbell Bench Press", "Incline DB Press", **Then** they are grouped into one variation group (same movement pattern + target muscle).
8. **Given** `variationEngine.detectRotationNeeds`, **When** called with a history showing the user has done "Barbell Bench Press" for 4 consecutive weeks, **Then** it recommends rotation to an alternative from the same variation group.
9. **Given** `movementPatterns.classifyMovementPattern`, **When** called with `{ name: "Barbell Bench Press", target: "chest", equipment: "barbell" }`, **Then** it returns `"horizontal-push"`.
10. **Given** `movementPatterns.classifyMovementPattern`, **When** called with `{ name: "Romanian Deadlift", target: "hamstrings", equipment: "barbell" }`, **Then** it returns `"hip-hinge"`.
11. **Given** `movementPatterns.areAntagonisticPatterns`, **When** called with `("horizontal-push", "horizontal-pull")`, **Then** it returns `true` (they are an antagonistic pair).
12. **Given** `recoveryTracker.calculateMuscleRecovery`, **When** called with a session that trained "chest" today, **Then** the chest muscle status is `"just-trained"` with `hoursRemaining: 48` (or the configured recovery window).
13. **Given** `recoveryTracker.calculateMuscleRecovery`, **When** called with a session that trained "chest" 72 hours ago and no other chest session since, **Then** the chest status is `"recovered"` with `hoursRemaining: 0`.
14. **Given** `smartRest.suggestRestDuration`, **When** called with `{ role: "compound", lastSetRPE: 9, goal: "Strength" }`, **Then** it returns a rest duration ≥ 180 seconds (heavy compound + high RPE + strength goal → long rest).
15. **Given** `smartRest.suggestRestDuration`, **When** called with `{ role: "isolation", lastSetRPE: 6, goal: "Hypertrophy" }`, **Then** it returns a rest duration ≤ 90 seconds (light isolation + low RPE + hypertrophy → short rest).
16. **Given** `fake-indexeddb` is loaded via `beforeEach(() => { globalThis.indexedDB = new IDBFactory(); })`, **When** `learningLoop.recordCompletion("ex1", "Bench Press", true)` is called, **Then** a feedback entry is written to `db.exerciseFeedback` with `action: "completed"` and `allSetsCompleted: true`.
17. **Given** the fake-indexeddb setup, **When** `buildLearningLoopSummary(90)` is called after recording 3 completions and 1 skip for "ex1", **Then** the summary shows `preferenceScore` reflecting the skip penalty (lower than if all 4 were completions).
18. **Given** the fake-indexeddb setup, **When** `recordFeedbackFromSession(session)` is called with a session containing 5 exercises where 2 were skipped, **Then** 5 feedback entries are written (3 "completed" + 2 "skipped").
19. **Given** the full algorithm test suite runs, **When** `pnpm test src/services/__tests__` executes, **Then** all 7 service test files pass, `fake-indexeddb` is properly isolated between tests (no test leaks data into another), and no test makes a real network call or touches the real IndexedDB.

---

### Edge Cases

- **CI: pre-existing tsc/lint errors** — The codebase has 27 pre-existing tsc errors and 8 pre-existing lint errors (all in unrelated files, documented in worklog). CI cannot fail on these or no PR will ever pass. Solution: the `typecheck` job uses `pnpm exec tsc --noEmit || true` temporarily (Sprint 3), with a comment that Sprint 4 cleanup will remove the `|| true` once the 27 errors are fixed. The `lint` job uses `pnpm run lint` with `continue-on-error: true` on the pre-existing error files, OR the lint script itself is adjusted to not fail on warnings (only errors). The `test` job runs cleanly (all existing tests pass).
- **CI: pnpm version mismatch** — The workflow must pin the pnpm version to match `package.json`'s `packageManager` field (if present) or the lockfile's version. Using `pnpm/action-setup@v4` with `version: 9` (or reading from `packageManager` field) avoids "unexpected lockfile" errors.
- **API tests: Next.js App Router route handler signature** — Next.js 16 route handlers receive `(req: NextRequest, { params }: { params: Promise<{...}> })`. The `next-test-api-route-handler` package must support the App Router's `params: Promise<...>` pattern (params are async in Next 15+). If the package doesn't support this, tests must manually await params or mock them.
- **API tests: Prisma mock strategy** — Mocking `@/lib/db` (which exports `prisma`) via `vi.mock("@/lib/db", ...)` with a factory returning an object with all Prisma model methods (`findUnique`, `findMany`, `create`, `update`, `delete`, `$transaction`, `$queryRaw`) is the cleanest approach. Each test configures the mock's return values. `$transaction` must support both callback and array forms (the codebase uses both).
- **API tests: `$queryRaw` in search route** — The search route now uses `prisma.$queryRaw\`...\`` (tagged template). The mock must handle the tagged template invocation pattern. Vi's `vi.fn()` can mock tagged templates if it returns a function that accepts the template strings array.
- **E2E: Firebase Auth in test environment** — E2E tests need real Firebase Auth (or a mocked auth provider). Options: (a) use a dedicated Firebase test project with test user accounts, (b) mock the Firebase client SDK via Playwright's `page.addInitScript` to inject a fake auth state, (c) use Firebase Auth Emulator. Option (b) is fastest for CI; option (c) is most realistic. The spec recommends (b) for the signup flow test and (c) for the social/challenge flows if a test project is available. Flagged as NEEDS CLARIFICATION in the plan stage.
- **E2E: Dexie in headless Chromium** — Playwright runs real Chromium, so Dexie/IndexedDB works natively (no fake-indexeddb needed for E2E). Each test should clear Dexie in `beforeEach` to avoid state leakage between test runs.
- **E2E: dev server lifecycle** — Playwright's `webServer` config can start the dev server automatically before tests and kill it after. This is preferred over a separate CI step.
- **Algorithm tests: Dexie singleton** — `src/db/schema.ts` creates `export const db = new PulseDB()` at module load. Tests that import `learningLoop` (which imports `db`) will trigger this singleton creation. With `fake-indexeddb`, the singleton opens against the in-memory DB. Tests must either (a) reset the DB between tests via `db.delete()` + re-import, or (b) use `vi.resetModules()` in `beforeEach` to get a fresh `db` instance. Approach (b) is cleaner.
- **Algorithm tests: `db.open().catch(...)` side effect** — The `db` singleton calls `db.open()` at module load and logs errors. With fake-indexeddb, this should succeed silently. If it logs warnings, tests can suppress console.warn in `beforeEach`.
- **Algorithm tests: time-based logic** — `fatigueEngine`, `deloadEngine`, and `recoveryTracker` all use `Date.now()` and `new Date()`. Tests must use `vi.useFakeTimers()` + `vi.setSystemTime()` to make assertions deterministic (e.g. "28 days ago").
- **CI: Playwright browser cache** — Installing Chromium on every CI run is slow (~60s). Cache the `~/.cache/ms-playwright` directory across runs using `actions/cache@v4`.
- **Test file naming** — New test files must match the existing vitest include pattern `src/**/*.{test,spec}.{ts,tsx}`. API tests go in `src/app/api/**/__tests__/route.test.ts` (co-located with the route). Algorithm tests go in `src/services/__tests__/<service>.test.ts` (alongside existing tests). E2E tests go in `e2e/` (outside `src/` so vitest doesn't pick them up — Playwright has its own config).

## Requirements *(mandatory)*

### Functional Requirements

#### P1-3 — CI/CD Pipeline

- **FR-001**: A GitHub Actions workflow file MUST be created at `.github/workflows/ci.yml` that triggers on `pull_request` (to `main`) and `push` (to `main`).
- **FR-002**: The workflow MUST define 3 jobs: `lint`, `typecheck`, `test` — running in parallel (they have no dependencies on each other). A 4th job `e2e` (Playwright) MAY run after `test` succeeds (`needs: test`) due to its longer runtime.
- **FR-003**: Each job MUST run on `ubuntu-latest`, use `actions/checkout@v4`, set up Node.js 20 via `actions/setup-node@v4` with `cache: pnpm`, and set up pnpm via `pnpm/action-setup@v4` (version read from `package.json` `packageManager` field or pinned to v9).
- **FR-004**: Each job MUST run `pnpm install --frozen-lockfile` to ensure deterministic installs matching `pnpm-lock.yaml`.
- **FR-005**: The `lint` job MUST run `pnpm run lint`. It MUST fail the job if lint exits non-zero. (Pre-existing lint errors in `AnatomyMap.tsx` are handled by adjusting the eslint config to `continue-on-error` for that file OR by fixing those 8 errors as part of Sprint 3 — flagged as a plan-stage decision.)
- **FR-006**: The `typecheck` job MUST run `pnpm exec tsc --noEmit`. Because the codebase has 27 pre-existing tsc errors, the job MUST use `pnpm exec tsc --noEmit || true` temporarily, with an inline comment: `# TODO(Sprint4): remove || true after fixing pre-existing tsc errors`. The job MUST additionally run a check that fails if NEW errors are introduced — this is achieved by counting errors and comparing to a baseline (e.g. `ERROR_COUNT=$(pnpm exec tsc --noEmit 2>&1 | grep -c "^src/"); if [ "$ERROR_COUNT" -gt 27 ]; then exit 1; fi`). This ensures no regression while tolerating pre-existing errors.
- **FR-007**: The `test` job MUST run `pnpm test` (which executes `vitest run`). It MUST fail if any test fails. The vitest config's `testTimeout: 15000` is sufficient for unit/integration tests.
- **FR-008**: The `e2e` job (if included) MUST: (a) install Playwright browsers via `npx playwright install --with-deps chromium`, (b) start the dev server via `pnpm run dev` (Playwright's `webServer` config handles lifecycle), (c) run `npx playwright test`, (d) upload `playwright-report/` and `test-results/` as artifacts on failure via `actions/upload-artifact@v4`.
- **FR-009**: The workflow MUST cache the pnpm store using `actions/setup-node@v4`'s built-in `cache: pnpm` option (which caches `~/.local/share/pnpm/store` based on `pnpm-lock.yaml` hash).
- **FR-010**: The workflow MUST cache `.next/cache` using `actions/cache@v4` with `path: .next/cache` and `key: next-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}`.
- **FR-011**: The `e2e` job MUST cache Playwright browsers using `actions/cache@v4` with `path: ~/.cache/ms-playwright` and `key: playwright-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}`.
- **FR-012**: The workflow YAML MUST be valid and pass `actionlint` (if available). No deprecated actions (e.g. `actions/checkout@v3`).

#### P1-9 — API Integration Tests

- **FR-013**: `next-test-api-route-handler` MUST be installed as a dev dependency (`pnpm add -D next-test-api-route-handler`).
- **FR-014**: A test file MUST be created for each of the 15 API routes at `src/app/api/<route>/__tests__/route.test.ts` (co-located with the route). For routes with sub-paths (e.g. `challenges/[challengeId]/join`), the test file is at `src/app/api/challenges/[challengeId]/join/__tests__/route.test.ts`.
- **FR-015**: Each test file MUST mock `@/lib/firebaseAdmin` so that `getAdminAuth()` returns an object with `verifySessionCookie(cookie, checkRevoked)` that: returns `{ uid: "test-uid-123", email: "test@test.com" }` for cookie value `"valid-session"`, and throws an error for any other cookie value. The mock MUST be set up in `beforeEach` and cleared in `afterEach`.
- **FR-016**: Each test file MUST mock `@/lib/db` so that `prisma` is a deeply-mocked object with all model methods (`findUnique`, `findMany`, `create`, `update`, `delete`, `deleteMany`, `upsert`, `count`, `$transaction`, `$queryRaw`) as `vi.fn()` spies. The `$transaction` mock MUST support both callback form (`async (tx) => {...}`) and array form (`[promise1, promise2]`). Tests configure return values per-test.
- **FR-017**: Each test file MUST cover at minimum: (a) happy path (valid input + valid auth → expected 2xx response + correct Prisma calls), (b) 401 unauthenticated (no cookie or invalid cookie → 401), (c) 400 validation (malformed body → 400 with `details` array), (d) 404 not-found (where applicable — when a referenced entity doesn't exist). Routes with impersonation checks (join, follow, sync-volume, profile, feed, posts-delete, comments-delete) MUST additionally test the 403 impersonation case.
- **FR-018**: The test for `ai-workout` MUST include a case verifying that `{ prompt: "..." }` returns 400 (the `.strict()` prompt-injection guard from Sprint 2).
- **FR-019**: The test for `social/search` MUST mock `prisma.$queryRaw` (tagged template) to return an array of profiles, and verify the happy path returns 200 + the mocked profiles.
- **FR-020**: All API tests MUST use `vi.clearAllMocks()` in `beforeEach` to ensure no state leaks between tests. No test may depend on another test's mock state.
- **FR-021**: The API tests MUST NOT start a real dev server, MUST NOT connect to a real database, and MUST NOT make real Firebase API calls. All external dependencies are mocked.
- **FR-022**: Running `pnpm test src/app/api` MUST execute all API integration tests and pass with 0 failures.

#### P1-13 — E2E Tests with Playwright

- **FR-023**: `@playwright/test` MUST be installed as a dev dependency (`pnpm add -D @playwright/test`). Playwright browser binaries are installed via `npx playwright install chromium` (CI handles this; local devs run it once).
- **FR-024**: A `playwright.config.ts` MUST be created at the repository root with: `testDir: "./e2e"`, `timeout: 30000`, `expect: { timeout: 5000 }`, `use: { baseURL: "http://localhost:3000", trace: "on-first-retry", screenshot: "only-on-failure", video: "retain-on-failure" }`, and a `webServer` config that runs `pnpm run dev` on port 3000 with a 60-second startup timeout and `reuseExistingServer: true` (for local dev).
- **FR-025**: E2E test files MUST be placed in the `e2e/` directory (outside `src/` so vitest does not pick them up). Three test files: `e2e/workout-flow.spec.ts`, `e2e/social-feed.spec.ts`, `e2e/challenge-flow.spec.ts`.
- **FR-026**: The `workout-flow.spec.ts` test MUST cover: splash screen → onboarding/wizard (5 steps) → generate workout → start session → complete all sets → finish → view result → share to feed. Each step MUST have an assertion (not just navigation).
- **FR-027**: The `social-feed.spec.ts` test MUST cover: navigate to feed → give kudos (verify count increments) → post a comment (verify it appears). The test MAY use a pre-seeded feed post (via a setup script or API call) rather than requiring the full workout flow to create one.
- **FR-028**: The `challenge-flow.spec.ts` test MUST cover: navigate to challenges → join a challenge → complete a workout (triggering sync-volume) → verify progress updated → view leaderboard (verify user appears).
- **FR-029**: Each E2E test MUST clear Dexie (via `page.evaluate(() => indexedDB.deleteDatabase("PulseDB"))`) in `beforeEach` to ensure no state leaks between test runs.
- **FR-030**: Firebase Auth in E2E tests MUST be handled via `page.addInitScript` that injects a fake auth state into the Firebase client SDK (mocking `onAuthStateChanged` to return a test user), OR via Firebase Auth Emulator. The chosen approach MUST be documented in `e2e/README.md`. (Flagged as NEEDS CLARIFICATION — see Edge Cases.)
- **FR-031**: E2E tests MUST NOT run as part of `pnpm test` (vitest). They have a separate script `pnpm run test:e2e` which runs `npx playwright test`. The `package.json` MUST have this script added.
- **FR-032**: Running `pnpm run test:e2e` locally (with dev server running) MUST pass all 3 flow tests. In CI, the `e2e` job handles server lifecycle via Playwright's `webServer` config.

#### P1-16 — Algorithm Unit Tests

- **FR-033**: A test file MUST be created for each of the 7 algorithm services at `src/services/__tests__/<service>.test.ts`:
  - `fatigueEngine.test.ts`
  - `deloadEngine.test.ts`
  - `variationEngine.test.ts`
  - `learningLoop.test.ts`
  - `movementPatterns.test.ts`
  - `recoveryTracker.test.ts`
  - `smartRest.test.ts`
- **FR-034**: Each test file MUST use `// @vitest-environment node` (or the default node env from vitest.config.ts) for non-Dexie services. The `learningLoop.test.ts` file MUST use `// @vitest-environment jsdom` (because Dexie checks for `window`) AND import `fake-indexeddb` in `beforeEach` to replace `globalThis.indexedDB`.
- **FR-035**: The `learningLoop.test.ts` MUST set up fake-indexeddb in `beforeEach` via:
  ```typescript
  import "fake-indexeddb/auto";
  // OR per-test:
  import { IDBFactory } from "fake-indexeddb";
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
  });
  ```
  AND use `vi.resetModules()` + dynamic `await import("@/services/learningLoop")` in each test to get a fresh `db` singleton backed by the new in-memory IndexedDB.
- **FR-036**: Time-based tests (fatigueEngine, deloadEngine, recoveryTracker) MUST use `vi.useFakeTimers()` + `vi.setSystemTime(new Date("2026-06-20T12:00:00Z"))` for deterministic assertions, and `vi.useRealTimers()` in `afterEach`.
- **FR-037**: Each test file MUST have at minimum 5 test cases covering: (a) empty/zero input, (b) typical happy path, (c) boundary/edge case, (d) an assertion on the specific return-type fields (not just truthiness), (e) at least one negative/invalid scenario (e.g. self-follow, negative volume, recovery just-trained vs recovered).
- **FR-038**: The `fatigueEngine.test.ts` MUST verify: ACWR = 0 for no sessions, ACWR > 1.5 for acute spike, 0.8 ≤ ACWR ≤ 1.3 for optimal, `fatigueScore` in [1,5], `volumeAdjustment` correlates with ACWR, `shouldDeload` flag set when ACWR high.
- **FR-039**: The `deloadEngine.test.ts` MUST verify all 4 `DeloadTrigger` values: `"time-based"` (>8 weeks since last deload), `"acwr-based"` (ACWR > 1.5), `"performance-based"` (3-session regression), `"none"` (no triggers). MUST verify `volumeMultiplier` and `rpeCap` on a positive deload recommendation.
- **FR-040**: The `movementPatterns.test.ts` MUST verify classification for at least: horizontal-push (bench press), horizontal-pull (barbell row), vertical-push (overhead press), vertical-pull (pull-up), hip-hinge (deadlift), squat (back squat), and verify `areAntagonisticPatterns` for at least 2 antagonistic pairs and 1 non-antagonistic pair.
- **FR-041**: The `smartRest.test.ts` MUST verify rest duration increases with: higher RPE, compound vs isolation role, strength vs hypertrophy goal. MUST verify `rpeColorClass` and `rpeLabel` for RPE values 5, 7, 8, 9, 10 and undefined.
- **FR-042**: Running `pnpm test src/services/__tests__` MUST execute all algorithm tests (existing + new 7 files) and pass with 0 failures.

### Key Entities

- **CI Workflow**: The `.github/workflows/ci.yml` file defining the `lint`, `typecheck`, `test`, and `e2e` jobs.
- **testApiHandler**: The function from `next-test-api-route-handler` that invokes a Next.js App Router route handler in isolation, given a request object and optionally params/cookies.
- **Prisma Mock**: A `vi.mock("@/lib/db", ...)` factory returning an object mimicking the Prisma client's shape, with all methods as `vi.fn()` spies.
- **FirebaseAdmin Mock**: A `vi.mock("@/lib/firebaseAdmin", ...)` factory returning `{ getAdminAuth: () => ({ verifySessionCookie: vi.fn(...), verifyIdToken: vi.fn(...), createSessionCookie: vi.fn(...) }) }`.
- **Playwright webServer**: The config in `playwright.config.ts` that auto-starts `pnpm run dev` before tests and kills it after.
- **fake-indexeddb**: An npm package (`^6.2.5`, installed) providing an in-memory IndexedDB implementation (`IDBFactory`) for Node.js/jsdom environments. Used by `learningLoop.test.ts` to test Dexie-backed code without a real browser.
- **vitest fake timers**: `vi.useFakeTimers()` + `vi.setSystemTime()` for deterministic time-based algorithm tests.
- **Baseline error count**: 27 tsc errors + 8 lint errors (pre-existing, documented). CI's `typecheck` job tolerates these via a baseline-comparison check (FR-006).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `.github/workflows/ci.yml` exists and is valid YAML. A PR that introduces a lint error fails the `lint` job; a PR that introduces a new tsc error fails the `typecheck` job (via baseline comparison); a PR that breaks a test fails the `test` job.

- **SC-002**: The CI workflow's pnpm install step completes in <15 seconds on the second run (cache hit), vs ~60 seconds on the first run (cache miss). Verifiable by checking the GitHub Actions run timings.

- **SC-003**: All 15 API routes have a co-located `__tests__/route.test.ts` file. Verifiable by: `find src/app/api -path "*__tests__/route.test.ts" | wc -l` ≥ 15.

- **SC-004**: Each API route test file has at least 4 test cases (happy path, 401, 400, 404-or-403). Verifiable by: `grep -r "it(" src/app/api/**/__tests__/ | wc -l` ≥ 60 (15 routes × 4 cases minimum).

- **SC-005**: Running `pnpm test src/app/api` passes with 0 failures. The tests mock `firebaseAdmin` and `prisma` — no real Firebase or DB calls are made (verifiable by no network calls in the test output).

- **SC-006**: Sending a malformed body to any route in the test suite returns 400 with `{ error: "Validation failed", details: [...] }`. The `ai-workout` route's `.strict()` prompt-injection guard is explicitly tested.

- **SC-007**: The 3 Playwright E2E test files exist in `e2e/`. Running `pnpm run test:e2e` (with dev server running) passes all 3 flows: workout-flow, social-feed, challenge-flow.

- **SC-008**: Playwright E2E tests clear Dexie between runs (no state leakage). Verifiable by running the suite twice and confirming the second run passes identically.

- **SC-009**: All 7 algorithm services have a co-located test file in `src/services/__tests__/`. Verifiable by: `ls src/services/__tests__/{fatigueEngine,deloadEngine,variationEngine,learningLoop,movementPatterns,recoveryTracker,smartRest}.test.ts` — all 7 files exist.

- **SC-010**: Each algorithm test file has at least 5 test cases. Verifiable by: `for f in src/services/__tests__/{fatigueEngine,deloadEngine,variationEngine,learningLoop,movementPatterns,recoveryTracker,smartRest}.test.ts; do echo "$f: $(grep -c 'it(' $f)"; done` — each shows ≥ 5.

- **SC-011**: The `learningLoop.test.ts` uses `fake-indexeddb` and passes. No test leaks data into another (verifiable by running with `--retry=2` and confirming no flakiness).

- **SC-012**: `pnpm test` (all vitest tests including existing + new API + algorithm tests) passes with 0 failures. Total test count increases by at least 100 (60 API + 35 algorithm + existing).

- **SC-013**: `bun run lint` passes with 0 new errors (pre-existing 8 errors in AnatomyMap.tsx tolerated). `npx tsc --noEmit` introduces 0 new errors (pre-existing 27 tolerated).

- **SC-014**: The CI workflow runs successfully on a PR — all jobs pass (or `e2e` is optional/skipped on first merge if Firebase test setup isn't ready). The green check appears on the PR.

## Assumptions

- **pnpm is the package manager** — the project has `pnpm-lock.yaml`. The CI workflow uses `pnpm/action-setup@v4`. All install commands use `pnpm install --frozen-lockfile`.
- **Node.js 20 LTS** — the workflow uses `actions/setup-node@v4` with `node-version: 20`. Next.js 16 requires Node 18.18+; Node 20 is the current LTS.
- **GitHub-hosted runners (ubuntu-latest)** — no self-hosted runners. The free tier minutes are sufficient for a small project.
- **Pre-existing errors are tolerated in CI** — the `typecheck` job uses a baseline-error-count comparison (FR-006) so that the 27 pre-existing tsc errors don't block PRs. Sprint 4 cleanup will fix these and remove the baseline tolerance. The `lint` job tolerates the 8 pre-existing `AnatomyMap.tsx` memoization errors (either via eslint config `continue-on-error` or by fixing them — plan-stage decision).
- **`next-test-api-route-handler` supports Next.js 16 App Router** — the package is maintained and supports the App Router's route handler signature `(req, { params: Promise<...> })`. If it doesn't support async params, tests will await params manually before passing to the handler.
- **Prisma mock via `vi.mock` is sufficient** — the codebase imports `prisma` from `@/lib/db`. Mocking that module with a factory returning vi.fn spies for all model methods covers all route handlers. The `$transaction` mock supports both callback and array forms. `$queryRaw` (tagged template) is mocked as a function accepting the strings array + interpolated values.
- **Firebase Auth in E2E can be mocked via `page.addInitScript`** — injecting a script that overrides `onAuthStateChanged` before the app's Firebase init runs. This avoids needing a real Firebase test project for the signup flow. For social/challenge flows that call API routes requiring `verifySessionCookie`, the test additionally sets a `pulse_session` cookie with a value the (mocked or real) Firebase Admin accepts. Flagged as NEEDS CLARIFICATION — the plan stage decides between (a) fully mocked Firebase client + real API with mocked admin, or (b) Firebase Auth Emulator.
- **`fake-indexeddb` works with Dexie in jsdom** — Dexie checks for `window.indexedDB` or `self.indexedDB`. In jsdom, `globalThis.indexedDB` must be set to a `fake-indexeddb` `IDBFactory` instance before Dexie opens. The `import "fake-indexeddb/auto"` auto-import approach is the simplest; per-test `new IDBFactory()` with `vi.resetModules()` gives isolation.
- **Playwright Chromium is the only browser tested** — Firefox and WebKit E2E tests are out of scope for Sprint 3 (Chromium covers the majority of desktop + all Android mobile). Sprint 4 can add cross-browser if needed.
- **E2E tests are NOT required to pass in CI on the first Sprint 3 merge** — if the Firebase Auth mocking proves too complex, the `e2e` job may be added as `continue-on-error: true` initially and flipped to required after the auth mocking is validated. The `lint`, `typecheck`, and `test` jobs ARE required from day one.
- **No test files are deleted** — the 15 existing test files remain untouched. New tests are additive. If any existing test breaks due to Sprint 2 changes (e.g. the `api-integration.test.ts` tests x-user headers that Sprint 1 removed), those tests are updated in Sprint 3 to reflect the new behavior.
- **Test coverage thresholds are NOT enforced in Sprint 3** — adding `c8`/`istanbul` coverage with thresholds (e.g. "80% of routes") is a Sprint 4 task. Sprint 3 focuses on test existence and correctness, not coverage percentages.
