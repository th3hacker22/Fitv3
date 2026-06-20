# Implementation Plan: Sprint 3 Test Coverage & CI/CD

**Branch**: `sprint3-test-coverage` | **Date**: 2026-06-20 | **Spec**: [sprint3-test-coverage.md](../specs/sprint3-test-coverage.md)

**Input**: Feature specification from `.specify/specs/sprint3-test-coverage.md`

**E2E Auth Decision**: Firebase Auth Emulator (user-confirmed) — free, local, allows Playwright to create test users and sign in without hitting real Google.

## Summary

Implement four testing/CI items: **(P1-3)** GitHub Actions CI pipeline (lint + tsc + vitest + Playwright) with pnpm/`.next`/Playwright caching; **(P1-9)** API integration tests for all 15 routes using `next-test-api-route-handler` with mocked `firebaseAdmin` + `prisma`; **(P1-13)** Playwright E2E tests for 3 critical flows (workout, social feed, challenges) using the Firebase Auth Emulator; **(P1-16)** unit tests for 7 algorithm services using `fake-indexeddb` for the Dexie-backed `learningLoop`.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Next.js 16.1 (Turbopack, App Router), Node.js 24 (local), Node 20 (CI)

**Primary Dependencies**:
- Already installed: `vitest@^4.1.9`, `fake-indexeddb@^6.2.5`, `@testing-library/react@^16.3.2`, `jsdom@^29.1.1`, `@testing-library/jest-dom@^6.9.1`, `@testing-library/dom@^10.4.1`
- To install: `next-test-api-route-handler` (API integration tests), `@playwright/test` (E2E)

**Package Manager**: pnpm (has `pnpm-lock.yaml`). All CI install commands use `pnpm install --frozen-lockfile`.

**Storage**: N/A (no schema changes — tests mock Prisma and Dexie)

**Testing**:
- Unit/Integration: `pnpm test` → `vitest run` (node env, `src/**/*.{test,spec}.{ts,tsx}`, 15s timeout)
- E2E: `pnpm run test:e2e` → `npx playwright test` (separate config, `e2e/` dir)
- CI: `pnpm run lint` + `pnpm exec tsc --noEmit` + `pnpm test` + `pnpm run test:e2e`

**Target Platform**: GitHub Actions (ubuntu-latest), local dev (Linux)

**Performance Goals**: CI pnpm install <15s on cache hit (vs ~60s cold). Vitest suite <30s. Playwright E2E <120s.

**Constraints**:
- Must not break the 160 passing existing tests.
- Must fix the 9 pre-existing failing tests (3 in `api-integration.test.ts` from Sprint 1 header removal, 6 in another file — to be diagnosed).
- No `any` types (constitution rule 1).
- Pre-existing 27 tsc errors + 8 lint errors tolerated via baseline comparison (FR-006).
- E2E uses Firebase Auth Emulator (user-confirmed decision).

**Scale/Scope**: 2 packages installed, 1 CI workflow created, 1 Playwright config created, 7 algorithm test files created, 15 API test files created, 3 E2E test files created, 1 existing test file fixed, 2 package.json scripts added. 42 functional requirements decomposed into 6 implementation phases.

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Type Safety | ✅ Pass | All test code strictly typed. Mocks use `vi.fn<...>()` with explicit signatures. No `any`. |
| II. Offline-First | ✅ Pass | Tests mock Dexie via fake-indexeddb (learningLoop) or don't touch Dexie (other 6 algorithms). E2E uses real Dexie in Chromium. |
| III. Firebase Auth Only | ✅ Pass | API tests mock `firebaseAdmin.verifySessionCookie`. E2E uses Firebase Auth Emulator (still Firebase, not a custom auth system). No next-auth. |
| IV. Security-First API | ✅ Pass | API integration tests verify the Sprint 1+2 security work (auth boundary, Zod validation, impersonation prevention). |
| V. Progressive Enhancement | ✅ Pass | No UI changes. Tests are additive. |
| Rule: No `any` | ✅ Pass | All mocks and test helpers use explicit types. |
| Rule: No `ignoreBuildErrors` | ✅ Pass | Not touched. |
| Rule: `bun run lint` before commit | ✅ Pass | CI enforces lint on every PR. |
| Rule: Verify Firebase Admin before `requireUser` | ✅ Pass | API tests mock `getAdminAuth()` to return a mock auth instance; no real Firebase init needed. |

## Project Structure

### Files to Create

```text
.github/workflows/ci.yml                              # P1-3: CI pipeline (lint, typecheck, test, e2e)
playwright.config.ts                                  # P1-13: Playwright config (webServer, trace, screenshots)
e2e/firebase-emulator.setup.ts                        # P1-13: Emulator startup/teardown helper
e2e/test-helpers.ts                                   # P1-13: Auth helpers (createTestUser, signInTestUser)
e2e/workout-flow.spec.ts                              # P1-13: Signup → Wizard → Workout → Finish → Share
e2e/social-feed.spec.ts                               # P1-13: Feed kudos + comment
e2e/challenge-flow.spec.ts                            # P1-13: Join → sync-volume → leaderboard
e2e/README.md                                         # P1-13: How to run E2E locally + emulator setup
src/services/__tests__/fatigueEngine.test.ts          # P1-16: ACWR fatigue math
src/services/__tests__/deloadEngine.test.ts           # P1-16: 4 deload triggers
src/services/__tests__/variationEngine.test.ts        # P1-16: Variation groups + rotation
src/services/__tests__/learningLoop.test.ts           # P1-16: Dexie-backed feedback (fake-indexeddb)
src/services/__tests__/movementPatterns.test.ts       # P1-16: 7 movement patterns + antagonistic pairs
src/services/__tests__/recoveryTracker.test.ts        # P1-16: Muscle recovery tracking
src/services/__tests__/smartRest.test.ts              # P1-16: Rest duration + RPE helpers
src/app/api/ai-coach/__tests__/route.test.ts          # P1-9: AI coach integration tests
src/app/api/ai-workout/__tests__/route.test.ts        # P1-9: AI workout + prompt-injection guard
src/app/api/auth/session/__tests__/route.test.ts      # P1-9: Session cookie mint/delete
src/app/api/challenges/__tests__/route.test.ts        # P1-9: Challenges list
src/app/api/challenges/[challengeId]/join/__tests__/route.test.ts        # P1-9: Join + impersonation
src/app/api/challenges/[challengeId]/leaderboard/__tests__/route.test.ts # P1-9: Leaderboard
src/app/api/challenges/[challengeId]/progress/__tests__/route.test.ts    # P1-9: Progress query
src/app/api/challenges/sync-volume/__tests__/route.test.ts               # P1-9: Sync + impersonation
src/app/api/social/comments/__tests__/route.test.ts   # P1-9: GET/POST/DELETE + ownership
src/app/api/social/feed/__tests__/route.test.ts       # P1-9: GET/POST + impersonation
src/app/api/social/follow/__tests__/route.test.ts     # P1-9: POST/DELETE + self-follow + impersonation
src/app/api/social/following/__tests__/route.test.ts  # P1-9: GET following
src/app/api/social/kudos/__tests__/route.test.ts      # P1-9: POST toggle
src/app/api/social/posts/__tests__/route.test.ts      # P1-9: DELETE + ownership
src/app/api/social/profile/__tests__/route.test.ts    # P1-9: POST + impersonation
src/app/api/social/search/__tests__/route.test.ts     # P1-9: GET search ($queryRaw mock)
src/lib/__tests__/test-helpers.ts                     # P1-9: Shared mock factories (mockPrisma, mockFirebaseAdmin, mockRequest)
```

### Files to Modify

```text
package.json                                          # Add test:e2e script + new dev deps
src/services/__tests__/api-integration.test.ts        # Fix 3 failing tests (x-user headers removed in Sprint 1)
src/services/__tests__/aiWorkoutService.test.ts       # Fix 6 failing tests (to be diagnosed in Phase 1)
```

### Files NOT Modified

```text
vitest.config.ts          # Already correct (node env, @ alias, 15s timeout, src/** include)
src/ (all source code)    # No source changes — tests are additive
prisma/schema.prisma      # No schema changes
Caddyfile                 # No gateway changes
```

**Structure Decision**: Single-project layout (existing). New test files co-located with source (Next.js convention for API routes, existing convention for services). E2E tests in separate `e2e/` directory (outside `src/` so vitest ignores them). CI workflow in standard `.github/workflows/`.

---

## Implementation Phases

### Phase 1: Fix Pre-Existing Test Failures (prerequisite for CI)

**Why first**: CI's `test` job (Phase 3) runs `pnpm test` which currently has 9 failing tests. CI cannot pass with red tests. This phase diagnoses and fixes the 9 failures so the baseline is green before adding new tests.

**File**: `src/services/__tests__/api-integration.test.ts` (MODIFY — fix 3 tests)

**Diagnosis**: Sprint 1 removed `x-user-name`/`x-user-photo`/`x-user-uid` headers from `useSocialStore` (identity now comes from the session cookie at the API route). The existing tests at lines 31, 54, 92 assert `expect.objectContaining({ headers: { "x-user-name": "Test Athlete" } })` — which fails because the store no longer sends those headers.

**Fix**: Update the 3 failing assertions to check the new behavior. The store now sends:
- Method: POST/DELETE
- Body: JSON with the payload (e.g. `{ postId, text }` for comments)
- Credentials: `"include"` (so the `pulse_session` cookie is sent automatically)
- NO `x-user-*` headers

Replace assertions like:
```typescript
// OLD (broken):
expect(mockFetch).toHaveBeenCalledWith(
  "/api/social/kudos",
  expect.objectContaining({
    method: "POST",
    headers: expect.objectContaining({
      "x-user-name": "Test Athlete",
    }),
  })
);
```
With:
```typescript
// NEW (correct):
expect(mockFetch).toHaveBeenCalledWith(
  "/api/social/kudos",
  expect.objectContaining({
    method: "POST",
    credentials: "include",
    body: JSON.stringify({ postId: "post1" }),
  })
);
```

Apply this pattern to all 3 failing tests (kudos, addComment, and the third one). Remove the `mockUser` / `vi.mock("@/store/useAuthStore")` setup if it's no longer needed (the store doesn't read auth for headers anymore — it relies on the cookie).

**File**: `src/services/__tests__/aiWorkoutService.test.ts` (MODIFY — fix 6 tests)

**Diagnosis**: Run `npx vitest run src/services/__tests__/aiWorkoutService.test.ts` and read the failure output. Likely causes: Sprint 2 changes to `ai-workout/route.ts` (removed `StructuredRequestBody` interface, now uses Zod schema), or changes to `aiWorkoutService.ts` itself. Diagnose and fix in this phase — the fix depends on the actual error output.

**Verification**:
```bash
npx vitest run src/services/__tests__/api-integration.test.ts   # 0 failures
npx vitest run src/services/__tests__/aiWorkoutService.test.ts  # 0 failures
npx vitest run                                                    # 169 passed, 0 failed
```

---

### Phase 2: Install Test Dependencies + E2E Infrastructure

**Why second**: All subsequent phases depend on `next-test-api-route-handler` (API tests) and `@playwright/test` (E2E). Installing first ensures the imports resolve.

**Step 2a — Install packages**:
```bash
pnpm add -D next-test-api-route-handler @playwright/test
npx playwright install chromium
```

**Step 2b — Add package.json scripts** (MODIFY `package.json`):
```json
{
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "npx playwright test",
    "test:e2e:ui": "npx playwright test --ui"
  }
}
```

**Step 2c — Create Playwright config** (NEW `playwright.config.ts`):
```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // E2E tests share a Dexie DB + emulator — run sequentially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // Single worker — Firebase Emulator + Dexie don't like parallel
  reporter: process.env.CI
    ? [["html"], ["junit", { outputFile: "test-results/junit.xml" }]]
    : "list",
  timeout: 30000,
  expect: { timeout: 5000 },
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm run dev",
    url: "http://localhost:3000",
    timeout: 60_000,
    reuseExistingServer: !process.env.CI, // CI starts fresh; local reuses running dev server
  },
});
```

**Step 2d — Create E2E helpers** (NEW `e2e/test-helpers.ts`):
```typescript
import { test as base, expect } from "@playwright/test";

// Firebase Auth Emulator is expected at localhost:9099.
// Start it before E2E: `firebase emulators:start --only auth`
// In CI, the e2e job starts it (see Phase 3 ci.yml).

const EMULATOR_HOST = "127.0.0.1:9099";

/**
 * Create a test user in the Firebase Auth Emulator via the REST API.
 * Returns the uid + idToken.
 */
export async function createTestUser(
  email: string,
  password: string
): Promise<{ uid: string; idToken: string }> {
  const res = await fetch(
    `http://${EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=any`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  const data = await res.json();
  return { uid: data.localId, idToken: data.idToken };
}

/**
 * Mint a session cookie from the emulator's idToken by calling our own
 * /api/auth/session endpoint (which calls firebase-admin createSessionCookie).
 * The firebase-admin SDK must be pointed at the emulator via FIREBASE_AUTH_EMULATOR_HOST.
 */
export async function mintSessionCookie(
  page: import("@playwright/test").Page,
  idToken: string
): Promise<string> {
  const res = await page.request.post("/api/auth/session", {
    data: { idToken },
  });
  expect(res.ok()).toBeTruthy();
  // The Set-Cookie header contains pulse_session=...; we extract it.
  const setCookie = res.headers()["set-cookie"] || "";
  const match = setCookie.match(/pulse_session=([^;]+)/);
  return match ? match[1] : "";
}

/**
 * Set the pulse_session cookie on the page context so authenticated
 * API calls + requireUser work.
 */
export async function setSessionCookie(
  page: import("@playwright/test").Page,
  cookieValue: string
): Promise<void> {
  await page.context().addCookies([
    {
      name: "pulse_session",
      value: cookieValue,
      domain: "localhost",
      path: "/",
    },
  ]);
}

/**
 * Clear Dexie (PulseDB) to ensure no state leaks between tests.
 */
export async function clearDexie(
  page: import("@playwright/test").Page
): Promise<void> {
  await page.evaluate(() => {
    return new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase("PulseDB");
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  });
}

// Extend the test fixture with a pre-authenticated page
export const test = base.extend<{
  authedPage: import("@playwright/test").Page;
}>({
  authedPage: async ({ page }, use) => {
    const { uid, idToken } = await createTestUser(
      `test-${Date.now()}@example.com`,
      "testpass123"
    );
    const cookie = await mintSessionCookie(page, idToken);
    await setSessionCookie(page, cookie);
    await use(page);
  },
});

export { expect };
```

**Step 2e — Create E2E README** (NEW `e2e/README.md`):
```markdown
# E2E Tests (Playwright)

## Prerequisites

1. Firebase Auth Emulator running on port 9099:
   ```bash
   firebase emulators:start --only auth
   ```
2. Dev server running on port 3000:
   ```bash
   pnpm run dev
   ```
3. Environment variable `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099` set
   in `.env.local` so firebase-admin points at the emulator.

## Running

```bash
pnpm run test:e2e         # headless
pnpm run test:e2e:ui      # interactive Playwright UI
```

## CI

The CI workflow (`.github/workflows/ci.yml`) starts the emulator and dev
server automatically before running E2E tests.

## Test Isolation

Each test clears Dexie (`PulseDB`) in `beforeEach` to prevent state leakage.
Firebase Auth Emulator users persist across runs but are identified by unique
emails (test-{timestamp}@example.com).
```

**Verification**:
```bash
npx playwright --version    # confirms @playwright/test installed
npx tsc --noEmit            # playwright.config.ts + e2e/ helpers compile
ls e2e/                     # README + test-helpers exist
```

---

### Phase 3: CI Pipeline (P1-3, FR-001 to FR-012)

**Why third**: With existing tests green (Phase 1) and deps installed (Phase 2), CI can now be created. CI runs immediately on PR creation, enforcing quality gates before any new tests are added.

**File**: `.github/workflows/ci.yml` (NEW)

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

# Cancel in-progress runs for the same PR/branch
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm run lint

  typecheck:
    name: Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      # Tolerate pre-existing tsc errors (27) via baseline comparison.
      # TODO(Sprint4): remove the baseline check once 27 errors are fixed.
      - name: Type check (baseline-aware)
        run: |
          OUTPUT=$(pnpm exec tsc --noEmit 2>&1 || true)
          echo "$OUTPUT"
          ERROR_COUNT=$(echo "$OUTPUT" | grep -c "^src/" || true)
          echo "TypeScript error count: $ERROR_COUNT (baseline: 27)"
          if [ "$ERROR_COUNT" -gt 27 ]; then
            echo "FAIL: New TypeScript errors introduced ($ERROR_COUNT > 27 baseline)"
            exit 1
          fi

  test:
    name: Unit & Integration Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: Cache .next
        uses: actions/cache@v4
        with:
          path: .next/cache
          key: next-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}
          restore-keys: next-${{ runner.os }}-
      - run: pnpm test

  e2e:
    name: E2E Tests (Playwright)
    runs-on: ubuntu-latest
    needs: test # E2E runs after unit tests pass (it's slower)
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: Cache Playwright browsers
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}
      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium
      - name: Install Firebase CLI
        run: npm install -g firebase-tools
      - name: Start Firebase Auth Emulator
        run: firebase emulators:start --only auth &
        env:
          FIREBASE_AUTH_EMULATOR_HOST: 127.0.0.1:9099
      - name: Wait for emulator
        run: npx wait-on http://127.0.0.1:9099
      - name: Run E2E tests
        run: pnpm run test:e2e
        env:
          FIREBASE_AUTH_EMULATOR_HOST: 127.0.0.1:9099
          CI: true
      - name: Upload Playwright report
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
      - name: Upload Playwright test results
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: test-results/
          retention-days: 7
```

**Key design points**:
- **3 parallel jobs** (lint, typecheck, test) + 1 sequential (e2e, `needs: test`).
- **pnpm/action-setup@v4** before setup-node so the `cache: pnpm` option works.
- **`--frozen-lockfile`** ensures deterministic installs.
- **typecheck baseline**: `ERROR_COUNT > 27` fails. Tolerates the 27 pre-existing errors (SC-013). TODO comment for Sprint 4.
- **`.next/cache`** cached for faster Turbopack warmup.
- **Playwright browser cache** (`~/.cache/ms-playwright`) avoids re-downloading Chromium.
- **Firebase Emulator** started in background, `wait-on` waits for it to be ready.
- **Artifacts uploaded only on failure** (report + test-results with screenshots/videos).
- **`concurrency`** cancels stale runs on the same PR.

**Verification**:
```bash
# Validate YAML syntax
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" && echo "YAML valid"

# (Full verification happens when a PR is opened — the workflow runs automatically)
```

---

### Phase 4: Algorithm Unit Tests (P1-16, FR-033 to FR-042)

**Why fourth**: Algorithm tests have no external dependencies (no Firebase, no Prisma, no Next.js) — they're the fastest to write and verify. The only complexity is `learningLoop` (Dexie/fake-indexeddb). Getting these 7 files done first builds momentum and gives the algorithm layer a safety net before the more complex API/E2E tests.

**Shared helper**: `src/services/__tests__/test-helpers.ts` (NEW — NOT created; each algorithm test is self-contained with its own factories, following the existing `progressiveOverload.test.ts` pattern).

#### 4.1 — `fatigueEngine.test.ts`

**File**: `src/services/__tests__/fatigueEngine.test.ts` (NEW)

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { assessFatigueACWR } from "../fatigueEngine";
import type { WorkoutSession } from "@/db/schema";
import type { GeneratorProfile } from "@/store/useGeneratorStore";

// ── Fixtures ──
const FIXED_NOW = new Date("2026-06-20T12:00:00Z").getTime();

const baseProfile: GeneratorProfile = {
  age: 30,
  medicalCautions: [],
  daysPerWeek: 4,
} as GeneratorProfile;

function makeSession(daysAgo: number, volumeKg: number, completed = true): WorkoutSession {
  const date = new Date(FIXED_NOW - daysAgo * 86400000).toISOString();
  return {
    id: `s-${daysAgo}`,
    date,
    name: "Test",
    completed,
    isFreeze: false,
    duration: 60,
    exercises: [
      {
        exerciseId: "ex1",
        exerciseName: "Squat",
        sets: [{ weight: volumeKg / 10, reps: 10, completed: true }],
      },
    ],
  } as unknown as WorkoutSession;
}

// ── Tests ──
describe("assessFatigueACWR", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("returns fully-recovered state for zero sessions", () => {
    const result = assessFatigueACWR([], baseProfile, new Map());
    expect(result.acuteLoad).toBe(0);
    expect(result.chronicLoad).toBe(0);
    expect(result.acwr).toBe(0);
    expect(result.fatigueScore).toBe(5);
  });

  it("flags acute spike (ACWR > 1.5) when 7 days of volume with no prior base", () => {
    const sessions = Array.from({ length: 7 }, (_, i) => makeSession(i, 1000));
    const result = assessFatigueACWR(sessions, baseProfile, new Map());
    expect(result.acwr).toBeGreaterThan(1.5);
    expect(result.fatigueScore).toBeLessThan(3);
  });

  it("reports optimal zone (0.8 ≤ ACWR ≤ 1.3) for 28 days of consistent volume", () => {
    const sessions = Array.from({ length: 28 }, (_, i) => makeSession(i, 1000));
    const result = assessFatigueACWR(sessions, baseProfile, new Map());
    expect(result.acwr).toBeGreaterThanOrEqual(0.8);
    expect(result.acwr).toBeLessThanOrEqual(1.3);
    expect(result.fatigueScore).toBeGreaterThanOrEqual(4);
  });

  it("ignores incomplete and freeze sessions", () => {
    const sessions = [
      makeSession(1, 1000, false), // incomplete
      { ...makeSession(2, 1000), isFreeze: true }, // freeze
    ];
    const result = assessFatigueACWR(sessions, baseProfile, new Map());
    expect(result.acuteLoad).toBe(0);
  });

  it("sets shouldDeload flag when ACWR is high", () => {
    const sessions = Array.from({ length: 7 }, (_, i) => makeSession(i, 2000));
    const result = assessFatigueACWR(sessions, baseProfile, new Map());
    expect(result.shouldDeload).toBe(true);
  });

  it("volumeAdjustment correlates inversely with ACWR", () => {
    const spike = assessFatigueACWR(
      Array.from({ length: 7 }, (_, i) => makeSession(i, 2000)),
      baseProfile,
      new Map()
    );
    const optimal = assessFatigueACWR(
      Array.from({ length: 28 }, (_, i) => makeSession(i, 1000)),
      baseProfile,
      new Map()
    );
    expect(spike.volumeAdjustment).toBeLessThan(optimal.volumeAdjustment);
  });
});
```

#### 4.2 — `deloadEngine.test.ts`

**File**: `src/services/__tests__/deloadEngine.test.ts` (NEW) — tests all 4 `DeloadTrigger` values + `volumeMultiplier` + `rpeCap`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { assessDeloadNeed } from "../deloadEngine";
import type { FatigueAssessment } from "../fatigueEngine";

// Tests:
// 1. trigger="time-based" when last deload > 8 weeks ago
// 2. trigger="acwr-based" when fatigue.acwr > 1.5
// 3. trigger="performance-based" when 3-session regression in exerciseHistory
// 4. trigger="none" when no triggers fire
// 5. volumeMultiplier < 1 and rpeCap set when shouldDeload=true
// (Full code follows the fatigueEngine pattern — omitted for brevity in this plan)
```

#### 4.3 — `variationEngine.test.ts` (NEW)
Tests: `buildVariationGroups` groups bench/incline/DB press together; `detectRotationNeeds` flags 4-week same-exercise streak.

#### 4.4 — `movementPatterns.test.ts` (NEW)
Tests: classify 7 patterns (horizontal-push/pull, vertical-push/pull, hip-hinge, squat, +1); `areAntagonisticPatterns` for 2 antagonistic pairs + 1 non-antagonistic.

#### 4.5 — `recoveryTracker.test.ts` (NEW)
Tests: `calculateMuscleRecovery` — just-trained (0h) → 48h remaining; recovered (72h) → 0h remaining; `getRecoverySummary` counts; `getRecoveryColor` returns hex for each status.

#### 4.6 — `smartRest.test.ts` (NEW)
Tests: `suggestRestDuration` — compound+RPE9+strength ≥180s; isolation+RPE6+hypertrophy ≤90s; `rpeColorClass` for RPE 5/7/8/9/10/undefined; `rpeLabel` for same.

#### 4.7 — `learningLoop.test.ts` (NEW — Dexie-backed with fake-indexeddb)

**File**: `src/services/__tests__/learningLoop.test.ts` (NEW)

```typescript
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import "fake-indexeddb/auto";

describe("learningLoop", () => {
  beforeEach(() => {
    vi.resetModules();
    // Clear the fake IndexedDB between tests
    indexedDB.deleteDatabase("PulseDB");
  });

  it("recordCompletion writes a feedback entry with action=completed", async () => {
    const { recordCompletion } = await import("../learningLoop");
    const { db } = await import("@/db");
    await recordCompletion("ex1", "Bench Press", true);
    const entries = await db.exerciseFeedback.toArray();
    expect(entries).toHaveLength(1);
    expect(entries[0].action).toBe("completed");
    expect(entries[0].exerciseId).toBe("ex1");
  });

  it("buildLearningLoopSummary penalizes skips in preferenceScore", async () => {
    const { recordCompletion, recordSkip, buildLearningLoopSummary } = await import("../learningLoop");
    await recordCompletion("ex1", "Bench", true);
    await recordCompletion("ex1", "Bench", true);
    await recordCompletion("ex1", "Bench", true);
    await recordSkip("ex1", "Bench");

    const summary = await buildLearningLoopSummary(90);
    const pref = summary.preferences.get("ex1");
    expect(pref).toBeDefined();
    expect(pref!.samples).toBe(4);
    expect(pref!.skipped).toBe(1);
    expect(pref!.completionRate).toBeCloseTo(0.75);
  });

  it("recordFeedbackFromSession writes entries for each exercise", async () => {
    const { recordFeedbackFromSession } = await import("../learningLoop");
    const { db } = await import("@/db");
    const session = {
      // ... mock WorkoutSession with 5 exercises, 2 skipped
    };
    await recordFeedbackFromSession(session as never);
    const entries = await db.exerciseFeedback.toArray();
    expect(entries).toHaveLength(5);
    expect(entries.filter((e) => e.action === "skipped")).toHaveLength(2);
  });

  it("marks disliked (score < -20) and loved (score > 20) with confidence", async () => {
    // Record 5 skips for ex1 (disliked), 5 completions for ex2 (loved)
    // Assert summary.disliked contains ex1, summary.loved contains ex2
  });

  it("handles empty feedback gracefully", async () => {
    const { buildLearningLoopSummary } = await import("../learningLoop");
    const summary = await buildLearningLoopSummary(90);
    expect(summary.preferences.size).toBe(0);
    expect(summary.avgCompletionRate).toBe(0);
  });
});
```

**Key Dexie test pattern**:
- `// @vitest-environment jsdom` directive (Dexie checks for `window`)
- `import "fake-indexeddb/auto"` replaces `globalThis.indexedDB`
- `vi.resetModules()` in `beforeEach` forces a fresh `db` singleton per test
- `indexedDB.deleteDatabase("PulseDB")` clears state between tests
- Dynamic `await import("@/services/learningLoop")` re-evaluates the module against the fresh DB

**Verification after Phase 4**:
```bash
npx vitest run src/services/__tests__/fatigueEngine.test.ts    # 6 passed
npx vitest run src/services/__tests__/deloadEngine.test.ts     # 5+ passed
npx vitest run src/services/__tests__/variationEngine.test.ts  # 5+ passed
npx vitest run src/services/__tests__/learningLoop.test.ts     # 5 passed (Dexie)
npx vitest run src/services/__tests__/movementPatterns.test.ts # 5+ passed
npx vitest run src/services/__tests__/recoveryTracker.test.ts  # 5+ passed
npx vitest run src/services/__tests__/smartRest.test.ts        # 5+ passed
npx tsc --noEmit  # 0 new errors (still 27 baseline)
```

---

### Phase 5: API Integration Tests (P1-9, FR-013 to FR-022)

**Why fifth**: API tests are more complex (mocking `firebaseAdmin` + `prisma` + Next.js route handler invocation) than algorithm tests. The shared mock factories are built first, then each route uses them.

**Shared helper**: `src/lib/__tests__/test-helpers.ts` (NEW)

```typescript
import { vi } from "vitest";

// ── Firebase Admin Mock ──
// Mock @/lib/firebaseAdmin so getAdminAuth() returns a mock whose
// verifySessionCookie returns a valid uid for "valid-session" and throws otherwise.
export function mockFirebaseAdmin(uid = "test-uid-123") {
  const verifySessionCookie = vi.fn(async (cookie: string, _checkRevoked: boolean) => {
    if (cookie === "valid-session") {
      return { uid, email: "test@test.com", email_verified: true };
    }
    throw new Error("Invalid session cookie");
  });
  const verifyIdToken = vi.fn(async (token: string) => {
    if (token === "valid-id-token") return { uid, email: "test@test.com", email_verified: true };
    throw new Error("Invalid ID token");
  });
  const createSessionCookie = vi.fn(async (_token: string, _opts: unknown) => "mock-session-cookie");

  vi.mock("@/lib/firebaseAdmin", () => ({
    getAdminAuth: () => ({
      verifySessionCookie,
      verifyIdToken,
      createSessionCookie,
    }),
  }));

  return { verifySessionCookie, verifyIdToken, createSessionCookie };
}

// ── Prisma Mock ──
// Mock @/lib/db so prisma is a spy object. Each test configures return values.
export function mockPrisma() {
  const prismaMock = {
    publicProfile: { findUnique: vi.fn(), upsert: vi.fn(), findMany: vi.fn() },
    feedPost: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    comment: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), delete: vi.fn() },
    kudos: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
    follow: { findMany: vi.fn(), deleteMany: vi.fn(), upsert: vi.fn() },
    challenge: { findUnique: vi.fn(), count: vi.fn(), findMany: vi.fn(), upsert: vi.fn() },
    participation: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    syncedWorkoutSession: { findUnique: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(async (fnOrArray: unknown) => {
      if (typeof fnOrArray === "function") return fnOrArray(prismaMock);
      return Promise.all(fnOrArray as unknown[]);
    }),
    $queryRaw: vi.fn(async () => []),
  };

  vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
  return prismaMock;
}

// ── Request helpers ──
export function makeAuthedRequest(body: unknown, cookie = "valid-session") {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: `pulse_session=${cookie}`,
    },
    body: JSON.stringify(body),
  });
}

export function makeUnauthedRequest(body: unknown) {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
```

**Example route test**: `src/app/api/social/kudos/__tests__/route.test.ts` (NEW)

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { testApiHandler } from "next-test-api-route-handler";
import { mockFirebaseAdmin, mockPrisma } from "@/lib/__tests__/test-helpers";

// Mocks must be set up before importing the route
mockFirebaseAdmin("test-uid-123");
const prisma = mockPrisma();

// Import the route AFTER mocks are in place
import { POST } from "../route";

describe("POST /api/social/kudos", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 — toggles kudos on (creates kudos, increments count)", async () => {
    prisma.kudos.findUnique.mockResolvedValue(null); // not yet kudosed
    prisma.kudos.create.mockResolvedValue({ postId: "p1", userId: "test-uid-123" });
    prisma.feedPost.update.mockResolvedValue({ kudosCount: 1 });
    prisma.feedPost.findUnique.mockResolvedValue({ kudosCount: 1 });

    await testApiHandler({
      appHandler: { POST },
      request: new Request("http://localhost/api/social/kudos", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: "pulse_session=valid-session" },
        body: JSON.stringify({ postId: "p1" }),
      }),
      test: async ({ result }) => {
        expect(result.status).toBe(200);
        const json = await result.json();
        expect(json.kudosed).toBe(true);
        expect(json.kudosCount).toBe(1);
        expect(prisma.kudos.create).toHaveBeenCalledWith({
          data: { postId: "p1", userId: "test-uid-123" },
        });
      },
    });
  });

  it("401 — rejects request without session cookie", async () => {
    await testApiHandler({
      appHandler: { POST },
      request: new Request("http://localhost/api/social/kudos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: "p1" }),
      }),
      test: async ({ result }) => {
        expect(result.status).toBe(401);
        const json = await result.json();
        expect(json.error).toContain("Authentication required");
        expect(prisma.kudos.create).not.toHaveBeenCalled();
      },
    });
  });

  it("400 — rejects invalid postId (number instead of string)", async () => {
    await testApiHandler({
      appHandler: { POST },
      request: new Request("http://localhost/api/social/kudos", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: "pulse_session=valid-session" },
        body: JSON.stringify({ postId: 12345 }),
      }),
      test: async ({ result }) => {
        expect(result.status).toBe(400);
        const json = await result.json();
        expect(json.error).toBe("Validation failed");
        expect(json.details[0].path).toEqual(["postId"]);
        expect(prisma.kudos.create).not.toHaveBeenCalled();
      },
    });
  });

  it("200 — toggles kudos off (deletes existing, decrements count)", async () => {
    prisma.kudos.findUnique.mockResolvedValue({ postId: "p1", userId: "test-uid-123" });
    prisma.kudos.delete.mockResolvedValue({});
    prisma.feedPost.update.mockResolvedValue({ kudosCount: 0 });
    prisma.feedPost.findUnique.mockResolvedValue({ kudosCount: 0 });

    await testApiHandler({
      appHandler: { POST },
      request: new Request("http://localhost/api/social/kudos", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: "pulse_session=valid-session" },
        body: JSON.stringify({ postId: "p1" }),
      }),
      test: async ({ result }) => {
        expect(result.status).toBe(200);
        const json = await result.json();
        expect(json.kudosed).toBe(false);
        expect(prisma.kudos.delete).toHaveBeenCalled();
      },
    });
  });
});
```

**Route test files to create (15)**:
Each follows the kudos pattern above, adapted per route:

| File | Test cases |
|------|-----------|
| `ai-coach/__tests__/route.test.ts` | 200 happy, 401 unauth, 400 missing profile, 400 missing exercises, 503 AI unavailable (mock aiRouter) |
| `ai-workout/__tests__/route.test.ts` | 200 happy, 400 prompt injection (`.strict()` rejects), 400 missing fields, 401 unauth, 500 OpenRouter error |
| `auth/session/__tests__/route.test.ts` | 200 mints cookie (POST valid idToken), 400 missing idToken, 200 deletes cookie (DELETE) |
| `challenges/__tests__/route.test.ts` | 200 returns active challenges, 200 seeds defaults if none |
| `challenges/[challengeId]/join/__tests__/route.test.ts` | 200 join, 401 unauth, 400 invalid userId, 403 impersonation, 404 challenge not found |
| `challenges/[challengeId]/leaderboard/__tests__/route.test.ts` | 200 returns sorted leaderboard, 404 challenge not found, 400 invalid challengeId path |
| `challenges/[challengeId]/progress/__tests__/route.test.ts` | 200 returns participation, 401 unauth, 400 missing userId, 404 challenge not found |
| `challenges/sync-volume/__tests__/route.test.ts` | 200 syncs volume, 401 unauth, 400 negative volume, 403 impersonation |
| `social/comments/__tests__/route.test.ts` | 200 GET list, 200 POST create, 400 invalid text, 401 unauth POST, 200 DELETE, 403 delete others' comment |
| `social/feed/__tests__/route.test.ts` | 200 GET list, 200 POST create, 400 invalid duration, 403 impersonation |
| `social/follow/__tests__/route.test.ts` | 200 follow, 400 self-follow, 403 impersonation, 200 unfollow |
| `social/following/__tests__/route.test.ts` | 200 returns uids, 200 includeProfiles=true returns profiles, 400 missing uid |
| `social/kudos/__tests__/route.test.ts` | (full example above) 4 tests |
| `social/posts/__tests__/route.test.ts` | 200 delete own post, 403 delete others', 404 not found, 401 unauth |
| `social/profile/__tests__/route.test.ts` | 200 upsert, 403 impersonation, 400 invalid displayName |
| `social/search/__tests__/route.test.ts` | 200 returns profiles (mock `$queryRaw`), 200 empty q returns [], 400 q > 100 chars |

**Verification after Phase 5**:
```bash
npx vitest run src/app/api/  # All 15 route test files pass (60+ test cases)
npx tsc --noEmit             # 0 new errors
```

---

### Phase 6: E2E Tests (P1-13, FR-023 to FR-032)

**Why last**: E2E tests are the most complex (real browser + Firebase Emulator + dev server + Dexie). They depend on the app being fully functional (which Phases 1-5 don't change, but verifying first is safer). E2E runs in CI via the workflow from Phase 3.

#### 6.1 — `e2e/workout-flow.spec.ts` (NEW)

Tests the golden path: splash → onboarding/wizard → generate → workout → finish → share.

```typescript
import { test, expect } from "./test-helpers";

test.describe("Workout flow: signup → wizard → workout → finish → share", () => {
  test.beforeEach(async ({ page }) => {
    // Clear Dexie for test isolation
    await page.goto("/");
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase("PulseDB");
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
    });
  });

  test("complete workout and share to feed", async ({ authedPage: page }) => {
    // 1. Navigate to home (splash)
    await page.goto("/");
    await expect(page).toHaveTitle(/Pulse/i);

    // 2. Start onboarding/wizard
    await page.click("text=Get Started");
    // Complete 5 wizard steps (select goal, schedule, muscles, health, review)
    // ... step-by-step clicks and selections ...

    // 3. Generate workout
    await page.click("text=Generate");
    await expect(page.locator("[data-testid=workout-exercise]")).toHaveCount({ atLeast: 1 });

    // 4. Start session
    await page.click("text=Start Workout");
    // Complete all sets
    // ... iterate over set checkboxes ...

    // 5. Finish
    await page.click("text=Finish");
    await expect(page.locator("[data-testid=workout-result]")).toBeVisible();

    // 6. Share to feed
    await page.click("text=Share to Feed");
    await expect(page).toHaveURL(/.*feed/);
    await expect(page.locator("[data-testid=feed-post]").first()).toBeVisible();
  });
});
```

#### 6.2 — `e2e/social-feed.spec.ts` (NEW)

Tests: navigate to feed → give kudos (count increments) → comment (appears in list).

```typescript
import { test, expect } from "./test-helpers";

test.describe("Social feed: kudos + comment", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Clear Dexie
  });

  test("give kudos increments count", async ({ authedPage: page }) => {
    // Pre-seed a feed post via API (POST /api/social/feed)
    await page.request.post("/api/social/feed", {
      data: {
        authorUid: "test-uid-123",
        authorName: "Test Athlete",
        workoutTitle: "Test Workout",
        duration: 60,
        totalVolume: 1000,
        exercisesCount: 5,
      },
    });

    await page.goto("/feed");
    const kudosButton = page.locator("[data-testid=kudos-button]").first();
    const initialCount = await kudosButton.textContent();

    await kudosButton.click();

    const newCount = await kudosButton.textContent();
    expect(Number(newCount)).toBe(Number(initialCount) + 1);
  });

  test("post a comment appears in list", async ({ authedPage: page }) => {
    // Pre-seed post, click comment, type, submit, assert visible
  });
});
```

#### 6.3 — `e2e/challenge-flow.spec.ts` (NEW)

Tests: join challenge → complete workout (sync-volume) → verify progress → view leaderboard.

```typescript
import { test, expect } from "./test-helpers";

test.describe("Challenge flow: join → sync → leaderboard", () => {
  test("join challenge, workout, see progress + leaderboard", async ({ authedPage: page }) => {
    // 1. Navigate to challenges
    await page.goto("/challenges");
    const joinButton = page.locator("text=Join").first();
    await joinButton.click();
    await expect(page.locator("text=Joined")).toBeVisible();

    // 2. Complete a workout (triggers sync-volume)
    // ... start session, complete sets, finish ...
    // The workout completion calls /api/challenges/sync-volume

    // 3. Verify progress updated
    await page.goto("/challenges");
    const progressBar = page.locator("[data-testid=challenge-progress]").first();
    await expect(progressBar).toBeVisible();
    // Progress should be > 0

    // 4. View leaderboard
    await page.click("text=Leaderboard");
    await expect(page.locator("[data-testid=leaderboard-entry]")).toHaveCount({ atLeast: 1 });
    // Test user should appear
    await expect(page.locator("text=Test Athlete")).toBeVisible();
  });
});
```

**Verification after Phase 6**:
```bash
# Start emulator + dev server first:
firebase emulators:start --only auth &
pnpm run dev &

# Run E2E:
pnpm run test:e2e
# Expected: 3 test files, all pass

# Check for screenshots/videos on failure:
ls test-results/ playwright-report/
```

---

## Execution Sequence

```
Phase 1: Fix pre-existing test failures
  ├── Fix api-integration.test.ts (3 broken x-user-header assertions)
  ├── Diagnose + fix aiWorkoutService.test.ts (6 failures)
  └── Verify: npx vitest run → 169 passed, 0 failed
        ↓ GATE: all existing tests green

Phase 2: Install deps + E2E infrastructure
  ├── pnpm add -D next-test-api-route-handler @playwright/test
  ├── npx playwright install chromium
  ├── Add test:e2e + test:e2e:ui scripts to package.json
  ├── Create playwright.config.ts
  ├── Create e2e/test-helpers.ts (Firebase Emulator auth helpers)
  └── Create e2e/README.md
        ↓ GATE: npx tsc --noEmit (0 new errors)

Phase 3: CI pipeline
  └── Create .github/workflows/ci.yml (lint, typecheck, test, e2e jobs)
        ↓ GATE: YAML valid; (full verification on first PR)

Phase 4: Algorithm unit tests (7 files)
  ├── fatigueEngine.test.ts (6 tests, fake timers)
  ├── deloadEngine.test.ts (5+ tests, 4 triggers)
  ├── variationEngine.test.ts (5+ tests)
  ├── movementPatterns.test.ts (5+ tests, 7 patterns)
  ├── recoveryTracker.test.ts (5+ tests)
  ├── smartRest.test.ts (5+ tests)
  └── learningLoop.test.ts (5 tests, fake-indexeddb + vi.resetModules)
        ↓ GATE: npx vitest run src/services/__tests__/ → all pass

Phase 5: API integration tests (15 files + shared helpers)
  ├── Create src/lib/__tests__/test-helpers.ts (mockPrisma, mockFirebaseAdmin)
  └── 15 route test files (4+ tests each, 60+ total)
        ↓ GATE: npx vitest run src/app/api/ → all pass

Phase 6: E2E tests (3 files)
  ├── e2e/workout-flow.spec.ts
  ├── e2e/social-feed.spec.ts
  └── e2e/challenge-flow.spec.ts
        ↓ GATE: pnpm run test:e2e → all 3 pass (with emulator running)
```

## Verification Steps

| Step | Command | Expected Result | SC ref |
|------|---------|-----------------|--------|
| 1 | `npx vitest run` (after Phase 1) | 169 passed, 0 failed | (prerequisite) |
| 2 | `npx tsc --noEmit 2>&1 \| grep -c "^src/"` | 27 (baseline, no new errors) | SC-013 |
| 3 | `bun run lint 2>&1 \| grep -c "error "` | 8 (baseline, no new errors) | SC-013 |
| 4 | `npx playwright --version` | Prints version (installed) | — |
| 5 | `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` | No error (valid YAML) | SC-001 |
| 6 | `find src/services/__tests__ -name "*.test.ts" \| wc -l` | ≥ 12 (7 new + 5 existing) | SC-009 |
| 7 | `for f in src/services/__tests__/{fatigueEngine,deloadEngine,variationEngine,learningLoop,movementPatterns,recoveryTracker,smartRest}.test.ts; do echo "$f: $(grep -c 'it(' $f)"; done` | Each ≥ 5 | SC-010 |
| 8 | `npx vitest run src/services/__tests__/` | All algorithm tests pass | SC-011 |
| 9 | `find src/app/api -path "*__tests__/route.test.ts" \| wc -l` | ≥ 15 | SC-003 |
| 10 | `grep -r "it(" src/app/api/**/__tests__/ \| wc -l` | ≥ 60 | SC-004 |
| 11 | `npx vitest run src/app/api/` | All API tests pass, no real Firebase/DB calls | SC-005 |
| 12 | `ls e2e/*.spec.ts` | 3 files (workout-flow, social-feed, challenge-flow) | SC-007 |
| 13 | `pnpm run test:e2e` (with emulator + dev running) | 3 test files pass | SC-007 |
| 14 | `pnpm test` (full suite) | 169 existing + 35 algorithm + 60 API = ~264 tests, 0 failed | SC-012 |
| 15 | Open a PR → check GitHub Actions tab | All 4 jobs pass (lint, typecheck, test, e2e) | SC-014 |
| 16 | Check CI install timing (2nd run) | pnpm install <15s (cache hit) | SC-002 |

## Complexity Tracking

No constitution violations. All changes are additive (tests + CI config). Justified decisions:

- **`next-test-api-route-handler`** is the standard library for testing Next.js App Router route handlers in isolation. Alternatives (spinning up a real Next.js server, or manually calling the handler function) are either too slow or miss middleware/cookie behavior. This is the simplest approach that actually tests the route.
- **Firebase Auth Emulator for E2E** (user-confirmed) avoids hitting real Google, is free, and lets tests create users programmatically via REST API. Simpler than mocking the Firebase client SDK in the browser.
- **`vi.resetModules()` for learningLoop tests** is necessary because `db` is a module-level singleton. The alternative (refactoring `db` to be injectable) would change source code for test purposes — rejected.
- **Baseline error count in CI** (27 tsc, 8 lint) is a temporary tolerance for pre-existing errors. The alternative (fixing all 27 before any CI) would block Sprint 3 entirely. Sprint 4 cleanup removes the tolerance. Justified by the "complexity must be justified" constitution rule — the baseline is documented with a TODO.

## Notes for the `/tasks` Stage

The 6 phases above will be decomposed into atomic tasks in `.specify/tasks/sprint3-test-coverage.md`. Suggested task granularity:

- **S3-T01**: Fix pre-existing test failures (Phase 1)
- **S3-T02**: Install deps + E2E infrastructure (Phase 2)
- **S3-T03**: Create CI workflow (Phase 3)
- **S3-T04**: Create 7 algorithm test files (Phase 4) — parallelizable by service
- **S3-T05**: Create shared API test helpers + 15 route test files (Phase 5) — parallelizable by route group
- **S3-T06**: Create 3 E2E test files (Phase 6) — parallelizable by flow

Parallelism opportunities: Phase 4's 7 test files are independent (can be written in parallel). Phase 5's 15 route test files are independent after the shared helpers exist. Phase 6's 3 E2E files are independent but share the emulator + dev server (run sequentially, not parallel).
