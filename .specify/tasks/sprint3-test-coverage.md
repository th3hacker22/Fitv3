---

description: "Atomic task list for Sprint 3 Test Coverage & CI/CD implementation"
---

# Tasks: Sprint 3 Test Coverage & CI/CD

**Input**: Implementation plan from `.specify/plans/sprint3-test-coverage.md`

**Prerequisites**: `plan.md` (required), `spec.md` (required for user stories)

**Organization**: Tasks are grouped into 4 phases: Phase 1 (Fix existing failures — prerequisite for CI), Phase 2 (Infrastructure — install deps + E2E scaffolding + CI workflow), Phase 3 (Tests — algorithm + API + E2E, parallelizable by group), and Phase 4 (Verification). The E2E Firebase Auth Emulator decision is confirmed (free, local, programmatic user creation).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with sibling tasks (different files, no cross-dependencies within the group)
- **[Story]**: `US1` = CI/CD Pipeline (P1-3), `US2` = API Integration Tests (P1-9), `US3` = E2E Tests (P1-13), `US4` = Algorithm Unit Tests (P1-16), `SHARED` = foundational/fix/verification
- Include exact file paths in descriptions

## Path Conventions

- Single project: `src/` at repository root
- E2E tests: `e2e/` directory (outside `src/` so vitest ignores them)
- CI: `.github/workflows/`
- All paths below are relative to `/home/z/my-project/`

---

## Phase 1: Fix Pre-Existing Test Failures (Blocking Prerequisite)

**Purpose**: CI's `test` job runs `pnpm test` which currently has 9 failing tests (3 in `api-integration.test.ts`, 6 in `aiWorkoutService.test.ts`). CI cannot pass with red tests. This phase MUST complete before Phase 2.

**⚠️ CRITICAL**: No other work can begin until this phase is complete — CI can't validate any new tests if the baseline is red.

---

- [ ] **S3-T01** [SHARED] Fix 3 failing tests in `src/services/__tests__/api-integration.test.ts` — Sprint 1 removed `x-user-name`/`x-user-photo`/`x-user-uid` headers from `useSocialStore` (identity now comes from the session cookie at the API route), but these tests still assert those headers are sent.

**File to modify**: `src/services/__tests__/api-integration.test.ts`

**Diagnosis**: The store now sends:
- Method: POST/DELETE
- Body: JSON payload
- Credentials: `"include"` (so `pulse_session` cookie is sent automatically)
- NO `x-user-*` headers (confirmed: `src/store/useSocialStore.ts` line 7 comment: "do NOT send x-user-name")

**Fix pattern** — replace each broken assertion. For the kudos test (around line 31):

```typescript
// BEFORE (broken — asserts x-user-name header that's no longer sent):
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

```typescript
// AFTER (correct — asserts the new credentials + body behavior):
expect(mockFetch).toHaveBeenCalledWith(
  "/api/social/kudos",
  expect.objectContaining({
    method: "POST",
    credentials: "include",
    body: JSON.stringify({ postId: "post1" }),
  })
);
```

Apply the same pattern to the other 2 failing tests:
- **addComment test** (~line 92): remove `headers: { "x-user-name": ... }`, assert `credentials: "include"` + `body: JSON.stringify({ postId: "post1", text: "Great workout!" })`
- **deleteComment test**: similar — remove header assertion, assert `credentials: "include"` + DELETE method + body

Also: review the `mockUser` + `vi.mock("@/store/useAuthStore")` setup at the top of the file. The store no longer reads auth state for headers (it relies on the cookie). If the mock is only used for the header assertions, it can be removed. If it's used elsewhere in the file, keep it.

**Verification**:
```bash
npx vitest run src/services/__tests__/api-integration.test.ts
# Expected: 7 passed, 0 failed (was 4 passed, 3 failed)
```

**Depends on**: None

---

- [ ] **S3-T02** [SHARED] Diagnose and fix 6 failing tests in `src/services/__tests__/aiWorkoutService.test.ts`

**File to modify**: `src/services/__tests__/aiWorkoutService.test.ts`

**Diagnosis steps** (run first to identify root cause):
```bash
npx vitest run src/services/__tests__/aiWorkoutService.test.ts 2>&1 | tail -40
```
Read the failure output. Likely causes:
1. Sprint 2 changed `ai-workout/route.ts` (removed local `StructuredRequestBody` interface, now uses Zod schema `structuredRequestBodySchema`) — if the test imports the old interface, it breaks.
2. `aiWorkoutService.ts` itself may have changed its function signatures or return types.
3. The test may mock `fetch` with outdated response shapes.

**Fix approach** (depends on actual error output):
- If the test imports a removed interface → update the import to use the Zod schema's inferred type: `import type { StructuredRequestBody } from "@/app/api/ai-workout/schema"`
- If the test mocks `fetch` with an old response shape → update the mock to match the current `aiWorkoutService` return type.
- If the test calls a function with an old signature → update the call to match the current signature.
- If the assertions check old field names → update to current field names.

**Do NOT change source code** (`aiWorkoutService.ts` or the route) — only update the test to match the current source behavior. If the source is genuinely broken, flag it for a separate fix (out of scope for this task).

**Verification**:
```bash
npx vitest run src/services/__tests__/aiWorkoutService.test.ts
# Expected: all pass, 0 failed (was 6 failed)

# Then verify the full suite is green:
npx vitest run
# Expected: 169 passed, 0 failed (was 160 passed, 9 failed)
```

**Depends on**: S3-T01 (both must be green for the full-suite check)

**Checkpoint**: At this point, the full existing test suite passes (169 tests, 0 failures). CI's `test` job can now pass. All subsequent phases are additive.

---

## Phase 2: Infrastructure (Install Deps + E2E Scaffolding + CI Workflow)

**Purpose**: Install the two missing test dependencies (`next-test-api-route-handler`, `@playwright/test`), create the Playwright config + E2E auth helpers, add the `test:e2e` script, and create the CI workflow. These are prerequisites for all test-writing tasks in Phase 3.

---

- [ ] **S3-T03** [SHARED] Install test dependencies + add E2E scripts to `package.json`

**Commands**:
```bash
pnpm add -D next-test-api-route-handler @playwright/test
npx playwright install chromium
```

**File to modify**: `package.json` — add these scripts (alongside existing `test` and `test:watch`):

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

**Verification**:
```bash
npx playwright --version          # confirms @playwright/test installed
node -e "require('next-test-api-route-handler')"  # confirms install
grep "test:e2e" package.json      # confirms script added
```

**Depends on**: S3-T02 (baseline green before adding deps)

---

- [ ] **S3-T04** [SHARED] Create `playwright.config.ts` + `e2e/test-helpers.ts` + `e2e/README.md`

**Files to create**:

1. `playwright.config.ts` (NEW):

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

2. `e2e/test-helpers.ts` (NEW) — Firebase Auth Emulator helpers:

```typescript
import { test as base, expect } from "@playwright/test";

// Firebase Auth Emulator is expected at localhost:9099.
// Start it before E2E: `firebase emulators:start --only auth`
// In CI, the e2e job starts it (see S3-T05 ci.yml).
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

3. `e2e/README.md` (NEW):

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
npx tsc --noEmit  # playwright.config.ts + e2e/test-helpers.ts compile (0 new errors)
ls e2e/           # README.md + test-helpers.ts exist
```

**Depends on**: S3-T03 (needs @playwright/test installed)

---

- [ ] **S3-T05** [US1] Create `.github/workflows/ci.yml` — CI pipeline with 4 jobs (lint, typecheck, test, e2e)

**File to create**: `.github/workflows/ci.yml` (NEW)

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
- 3 parallel jobs (lint, typecheck, test) + 1 sequential (e2e, `needs: test`)
- `pnpm/action-setup@v4` before `setup-node` so `cache: pnpm` works
- `--frozen-lockfile` for deterministic installs
- typecheck baseline: `ERROR_COUNT > 27` fails (tolerates 27 pre-existing errors, TODO Sprint 4)
- `.next/cache` cached for Turbopack warmup
- Playwright browser cache (`~/.cache/ms-playwright`)
- Firebase Emulator started in background + `wait-on` waits for readiness
- Artifacts (report + test-results) uploaded only on failure

**Verification**:
```bash
# Validate YAML syntax
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" && echo "YAML valid"

# (Full verification happens when a PR is opened — the workflow runs automatically)
```

**Depends on**: S3-T03 (needs test:e2e script in package.json), S3-T04 (needs playwright.config.ts)

**Checkpoint**: CI infrastructure is ready. The workflow will run on the next PR. All subsequent test-writing tasks (Phase 3) can now proceed in parallel.

---

## Phase 3: Write Tests (Algorithm + API + E2E — parallelizable by group)

**Purpose**: Write all the new test files. Three groups can run in parallel:
- **Group A** (US4 — Algorithm tests): 7 files, independent of each other
- **Group B** (US2 — API tests): 1 shared helper + 15 route test files, independent after helper exists
- **Group C** (US3 — E2E tests): 3 files, independent after S3-T04 helpers exist

---

### Group A: Algorithm Unit Tests (US4)

---

- [ ] **S3-T06** [P] [US4] Create `src/services/__tests__/fatigueEngine.test.ts` — ACWR fatigue math tests with fake timers

**File to create**: `src/services/__tests__/fatigueEngine.test.ts` (NEW)

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

**Test cases** (6): zero sessions → recovered; 7-day spike → ACWR>1.5; 28-day consistent → optimal; incomplete/freeze ignored; shouldDeload on high ACWR; volumeAdjustment inverse correlation.

**Verification**:
```bash
npx vitest run src/services/__tests__/fatigueEngine.test.ts
# Expected: 6 passed
```

**Depends on**: S3-T02 (baseline green)

---

- [ ] **S3-T07** [P] [US4] Create `src/services/__tests__/deloadEngine.test.ts` — all 4 deload triggers

**File to create**: `src/services/__tests__/deloadEngine.test.ts` (NEW)

**Test cases** (5 minimum):
1. `trigger: "time-based"` when last deload > 8 weeks ago (build sessions with a deload marker 9 weeks back)
2. `trigger: "acwr-based"` when passed a `FatigueAssessment` with `acwr > 1.5`
3. `trigger: "performance-based"` when `exerciseHistory` Map shows 3-session declining estimated 1RM
4. `trigger: "none"` when no triggers fire (recent deload, normal ACWR, no regression)
5. When `shouldDeload: true` — assert `volumeMultiplier < 1` (e.g. 0.6) and `rpeCap` is set (e.g. 6)

**Implementation notes**:
- Use `vi.useFakeTimers()` + `vi.setSystemTime(new Date("2026-06-20"))` for deterministic "8 weeks ago" calculations.
- Build `FatigueAssessment` fixture with controlled `acwr` value.
- Build `exerciseHistory: Map<string, ExerciseHistoryEntry>` with declining `estimated1RM` values over 3 sessions.
- Import `assessDeloadNeed` from `../deloadEngine` and `type FatigueAssessment` from `../fatigueEngine`.

**Verification**:
```bash
npx vitest run src/services/__tests__/deloadEngine.test.ts
# Expected: 5+ passed
```

**Depends on**: S3-T02

---

- [ ] **S3-T08** [P] [US4] Create `src/services/__tests__/variationEngine.test.ts` — variation groups + rotation

**File to create**: `src/services/__tests__/variationEngine.test.ts` (NEW)

**Test cases** (5 minimum):
1. `buildVariationGroups` groups "Barbell Bench Press", "Dumbbell Bench Press", "Incline DB Press" into one variation group (same movement pattern + target)
2. `buildVariationGroups` separates "Squat" and "Deadlift" into different groups (different patterns)
3. `detectRotationNeeds` flags 4-week same-exercise streak → recommends rotation
4. `detectRotationNeeds` returns no rotation needed when exercise varied within 4 weeks
5. Empty exercises array → empty groups map (no crash)

**Verification**:
```bash
npx vitest run src/services/__tests__/variationEngine.test.ts
# Expected: 5+ passed
```

**Depends on**: S3-T02

---

- [ ] **S3-T09** [P] [US4] Create `src/services/__tests__/movementPatterns.test.ts` — 7 patterns + antagonistic pairs

**File to create**: `src/services/__tests__/movementPatterns.test.ts` (NEW)

**Test cases** (5 minimum):
1. `classifyMovementPattern({ name: "Barbell Bench Press", target: "chest", equipment: "barbell" })` → `"horizontal-push"`
2. `classifyMovementPattern({ name: "Barbell Row", target: "back", equipment: "barbell" })` → `"horizontal-pull"`
3. `classifyMovementPattern({ name: "Overhead Press", target: "shoulders", equipment: "barbell" })` → `"vertical-push"`
4. `classifyMovementPattern({ name: "Pull-up", target: "back", equipment: "bodyweight" })` → `"vertical-pull"`
5. `classifyMovementPattern({ name: "Romanian Deadlift", target: "hamstrings", equipment: "barbell" })` → `"hip-hinge"`
6. `classifyMovementPattern({ name: "Back Squat", target: "quads", equipment: "barbell" })` → `"squat"`
7. `areAntagonisticPatterns("horizontal-push", "horizontal-pull")` → `true`
8. `areAntagonisticPatterns("vertical-push", "vertical-pull")` → `true`
9. `areAntagonisticPatterns("horizontal-push", "vertical-push")` → `false` (not antagonistic)

**Verification**:
```bash
npx vitest run src/services/__tests__/movementPatterns.test.ts
# Expected: 5+ passed
```

**Depends on**: S3-T02

---

- [ ] **S3-T10** [P] [US4] Create `src/services/__tests__/recoveryTracker.test.ts` — muscle recovery tracking

**File to create**: `src/services/__tests__/recoveryTracker.test.ts` (NEW)

**Test cases** (5 minimum):
1. `calculateMuscleRecovery` with a session that trained "chest" today → chest status `"just-trained"`, `hoursRemaining` ≈ 48
2. `calculateMuscleRecovery` with a session that trained "chest" 72h ago, no session since → chest status `"recovered"`, `hoursRemaining: 0`
3. `calculateMuscleRecovery` with a session 24h ago → chest status `"recovering"`, `hoursRemaining` between 1 and 47
4. `getRecoverySummary` with a map of 3 recovered + 2 recovering + 1 just-trained → returns correct counts
5. `getRecoveryColor("just-trained")` → red hex (`"#FF4444"`); `getRecoveryColor("recovered")` → green hex; `getRecoveryColor(undefined)` → `"transparent"`

**Implementation notes**:
- Use `vi.useFakeTimers()` + `vi.setSystemTime()` for deterministic "72 hours ago" calculations.
- Build `WorkoutSession[]` + `Exercise[]` fixtures where exercises map to muscle groups.
- Import `calculateMuscleRecovery`, `getRecoverySummary`, `getRecoveryColor` from `../recoveryTracker`.

**Verification**:
```bash
npx vitest run src/services/__tests__/recoveryTracker.test.ts
# Expected: 5+ passed
```

**Depends on**: S3-T02

---

- [ ] **S3-T11** [P] [US4] Create `src/services/__tests__/smartRest.test.ts` — rest duration + RPE helpers

**File to create**: `src/services/__tests__/smartRest.test.ts` (NEW)

**Test cases** (5 minimum):
1. `suggestRestDuration({ role: "compound", lastSetRPE: 9, goal: "Strength" })` → rest ≥ 180 seconds (heavy compound + high RPE + strength)
2. `suggestRestDuration({ role: "isolation", lastSetRPE: 6, goal: "Hypertrophy" })` → rest ≤ 90 seconds (light isolation + low RPE + hypertrophy)
3. `suggestRestDuration({ role: "compound", lastSetRPE: 7, goal: "Hypertrophy" })` → rest between 90 and 180 (moderate)
4. `suggestRestDuration({})` (all defaults) → returns a valid number (uses defaults: role=isolation, RPE=0, goal=Hypertrophy, defaultRest=90)
5. `rpeColorClass(5)` → green-ish class; `rpeColorClass(9)` → red-ish class; `rpeColorClass(undefined)` → `""` (empty)
6. `rpeLabel(5)` → "Very easy"; `rpeLabel(7)` → "Easy"; `rpeLabel(9)` → "Very hard"; `rpeLabel(undefined)` → `""`

**Verification**:
```bash
npx vitest run src/services/__tests__/smartRest.test.ts
# Expected: 5+ passed
```

**Depends on**: S3-T02

---

- [ ] **S3-T12** [P] [US4] Create `src/services/__tests__/learningLoop.test.ts` — Dexie-backed feedback with fake-indexeddb

**File to create**: `src/services/__tests__/learningLoop.test.ts` (NEW)

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
    // Build a mock session with 5 exercises, 2 skipped (3 completed)
    const session = {
      id: "session-1",
      date: new Date().toISOString(),
      name: "Test Session",
      completed: true,
      isFreeze: false,
      duration: 60,
      exercises: [
        { exerciseId: "ex1", exerciseName: "Squat", sets: [{ weight: 100, reps: 5, completed: true }] },
        { exerciseId: "ex2", exerciseName: "Bench", sets: [{ weight: 80, reps: 8, completed: true }] },
        { exerciseId: "ex3", exerciseName: "Row", sets: [{ weight: 70, reps: 8, completed: true }] },
        { exerciseId: "ex4", exerciseName: "Curl", sets: [] }, // skipped (no completed sets)
        { exerciseId: "ex5", exerciseName: "Crunch", sets: [] }, // skipped
      ],
    };
    await recordFeedbackFromSession(session as never);
    const entries = await db.exerciseFeedback.toArray();
    expect(entries).toHaveLength(5);
    expect(entries.filter((e) => e.action === "completed")).toHaveLength(3);
    expect(entries.filter((e) => e.action === "skipped")).toHaveLength(2);
  });

  it("marks disliked (score < -20) and loved (score > 20) with confidence", async () => {
    const { recordCompletion, recordSkip, buildLearningLoopSummary } = await import("../learningLoop");
    // 5 skips for ex1 → disliked
    for (let i = 0; i < 5; i++) await recordSkip("ex1", "Hated Ex");
    // 5 completions for ex2 → loved
    for (let i = 0; i < 5; i++) await recordCompletion("ex2", "Loved Ex", true);

    const summary = await buildLearningLoopSummary(90);
    expect(summary.disliked.some((d) => d.exerciseId === "ex1")).toBe(true);
    expect(summary.loved.some((l) => l.exerciseId === "ex2")).toBe(true);
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

**Verification**:
```bash
npx vitest run src/services/__tests__/learningLoop.test.ts
# Expected: 5 passed (Dexie-backed, isolated via fake-indexeddb + vi.resetModules)
```

**Depends on**: S3-T02

**Checkpoint**: All 7 algorithm test files created. Run the full algorithm suite:
```bash
npx vitest run src/services/__tests__/
# Expected: all pass (existing 5 files + new 7 files)
```

---

### Group B: API Integration Tests (US2)

---

- [ ] **S3-T13** [US2] Create shared API test helpers in `src/lib/__tests__/test-helpers.ts` — `mockFirebaseAdmin`, `mockPrisma`, request factories

**File to create**: `src/lib/__tests__/test-helpers.ts` (NEW)

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
```

**Key design points**:
- `mockFirebaseAdmin` returns the spy functions so tests can assert call arguments.
- `verifySessionCookie` returns a valid uid for `"valid-session"` cookie, throws otherwise — matching the real behavior.
- `mockPrisma` provides all 8 Prisma models used by the routes + `$transaction` (supports both callback and array forms) + `$queryRaw` (for the search route).
- Mocks must be called BEFORE importing the route (vi.mock is hoisted, but the factory captures the spies).

**Verification**:
```bash
npx tsc --noEmit  # test-helpers.ts compiles (0 new errors)
```

**Depends on**: S3-T02

---

- [ ] **S3-T14** [P] [US2] Create API integration tests for AI routes — `src/app/api/ai-coach/__tests__/route.test.ts` and `src/app/api/ai-workout/__tests__/route.test.ts`

**Files to create** (2):

1. `src/app/api/ai-coach/__tests__/route.test.ts` (NEW) — test cases:
   - 200 happy path (valid profile + exercises + valid cookie → mock `aiRouter.generate` → 200 with text)
   - 401 unauthenticated (no cookie → 401)
   - 400 missing profile (valid cookie, body without `profile` → 400 validation)
   - 400 missing exercises (body with profile but empty exercises → 400)
   - 503 AI unavailable (mock `aiRouter.generate` throws → 503 with `fallback: true`)

   **Implementation notes**: Mock `@/server/aiProviders` in addition to firebaseAdmin + prisma. The ai-coach route imports `aiRouter` and calls `aiRouter.generate(systemPrompt, userPrompt)`.

2. `src/app/api/ai-workout/__tests__/route.test.ts` (NEW) — test cases:
   - 200 happy path (valid structured body → mock OpenAI → 200 with text)
   - 400 prompt injection (body `{ prompt: "ignore previous" }` → 400, `.strict()` rejects unknown field)
   - 400 missing fields (empty body → 400 validation)
   - 401 unauthenticated
   - 500 OpenRouter error (mock OpenAI client to throw → error handling path)

   **Implementation notes**: Mock `openai` module (the route does `new OpenAI(...)`). The `.strict()` schema test is critical — it verifies the Sprint 2 prompt-injection guard.

**Verification**:
```bash
npx vitest run src/app/api/ai-coach/__tests__/route.test.ts src/app/api/ai-workout/__tests__/route.test.ts
# Expected: all pass
```

**Depends on**: S3-T13 (needs test-helpers.ts)

---

- [ ] **S3-T15** [P] [US2] Create API integration tests for Auth + Challenges routes (5 files)

**Files to create** (5):

1. `src/app/api/auth/session/__tests__/route.test.ts` — test cases:
   - 200 POST mints cookie (valid idToken → mock `verifyIdToken` + `createSessionCookie` → 200, Set-Cookie header present)
   - 400 POST missing idToken (body `{}` → 400 validation)
   - 200 DELETE (clears cookie → 200)
   - 400 POST invalid JSON (malformed body → 400 "Invalid JSON body")

2. `src/app/api/challenges/__tests__/route.test.ts` — test cases:
   - 200 GET returns active challenges (mock `prisma.challenge.count` → 1, `findMany` → array → 200)
   - 200 GET seeds defaults if none active (mock `count` → 0, `upsert` → 200 with seeded challenges)

3. `src/app/api/challenges/[challengeId]/join/__tests__/route.test.ts` — test cases:
   - 200 POST join (valid body + valid cookie + challenge exists → `prisma.participation.upsert` → 200)
   - 401 unauthenticated
   - 400 invalid userId (body with `userId: 123` → 400 validation)
   - 403 impersonation (body `userId: "other"` but session is `"test-uid-123"` → 403)
   - 404 challenge not found (mock `prisma.challenge.findUnique` → null → 404)
   - 400 invalid challengeId path param (path `challengeId: "   "` → 400)

   **Implementation notes**: Use `testApiHandler` with `params: { challengeId: "centurion_volume" }` to pass the dynamic path segment.

4. `src/app/api/challenges/[challengeId]/leaderboard/__tests__/route.test.ts` — test cases:
   - 200 GET returns sorted leaderboard (mock `prisma.participation.findMany` → array → 200)
   - 404 challenge not found (mock `prisma.challenge.findUnique` → null → 404)
   - 400 invalid challengeId path param

5. `src/app/api/challenges/[challengeId]/progress/__tests__/route.test.ts` — test cases:
   - 200 GET returns participation (valid cookie + userId query → mock `findUnique` → 200)
   - 401 unauthenticated
   - 400 missing userId query (`?` with no userId → 400 validation)
   - 404 challenge not found

   *(Note: sync-volume has its own test file below in S3-T16.)*

**Verification**:
```bash
npx vitest run src/app/api/auth/session/__tests__/ src/app/api/challenges/
# Expected: all pass
```

**Depends on**: S3-T13

---

- [ ] **S3-T16** [P] [US2] Create API integration test for sync-volume + Social routes (9 files)

**Files to create** (9):

1. `src/app/api/challenges/sync-volume/__tests__/route.test.ts` — test cases:
   - 200 syncs volume (valid body + cookie + participations exist → `prisma.$transaction` → 200 with `updated` count)
   - 401 unauthenticated
   - 400 negative volume (body `totalVolume: -50` → 400 validation, `.min(0)`)
   - 403 impersonation (body `userId: "other"` ≠ session uid → 403)
   - 200 zero volume no-op (body `totalVolume: 0` → 200 `{ ok: true, updated: 0 }`)

2. `src/app/api/social/comments/__tests__/route.test.ts` — test cases:
   - 200 GET list (valid cookie + `?postId=p1` → mock `findMany` → 200)
   - 200 POST create (valid body + cookie → mock `$transaction` → 200)
   - 400 invalid text (body `text: "   "` → 400, `.min(1)` after trim)
   - 401 unauthed POST
   - 200 DELETE own comment (valid body + cookie + ownership verified → 200)
   - 403 delete others' comment (mock comment `authorUid: "other"` ≠ session → 403)
   - 400 missing postId (DELETE body `{}` → 400 validation)

3. `src/app/api/social/feed/__tests__/route.test.ts` — test cases:
   - 200 GET list (valid cookie → mock `findMany` → 200)
   - 200 POST create (valid body + cookie + `authorUid` matches session → mock `$transaction` → 200)
   - 400 invalid duration (body `duration: 100000` → 400, `.max(86400)`)
   - 403 impersonation (body `authorUid: "other"` ≠ session → 403)

4. `src/app/api/social/follow/__tests__/route.test.ts` — test cases:
   - 200 POST follow (valid body + cookie + `currentUid` matches session → 200)
   - 400 self-follow (body `currentUid: "a", targetUid: "a"` → 400 "Cannot follow yourself")
   - 403 impersonation (body `currentUid: "other"` ≠ session → 403)
   - 200 DELETE unfollow (valid body + cookie → 200)

5. `src/app/api/social/following/__tests__/route.test.ts` — test cases:
   - 200 GET returns uids (valid cookie + `?uid=u1` → mock `follow.findMany` → 200 array of uids)
   - 200 GET includeProfiles=true (→ mock with `include: { following: true }` → 200 array of profile objects)
   - 400 missing uid query (no `uid` param → 400 validation)
   - 401 unauthenticated

6. `src/app/api/social/kudos/__tests__/route.test.ts` (use the full example from the plan):

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

7. `src/app/api/social/posts/__tests__/route.test.ts` — test cases:
   - 200 DELETE own post (valid body + cookie + ownership verified → 200)
   - 403 delete others' post (mock post `authorUid: "other"` → 403)
   - 404 post not found (mock `findUnique` → null → 404)
   - 401 unauthenticated

8. `src/app/api/social/profile/__tests__/route.test.ts` — test cases:
   - 200 POST upsert (valid body + cookie + `uid` matches session → 200)
   - 403 impersonation (body `uid: "other"` → 403)
   - 400 invalid displayName (body `displayName: ""` → 400 validation)

9. `src/app/api/social/search/__tests__/route.test.ts` — test cases:
   - 200 GET returns profiles (mock `prisma.$queryRaw` → array → 200)
   - 200 GET empty q returns `[]` (no `q` param → 200 `[]`)
   - 400 GET q > 100 chars (101-char q → 400 validation, `.max(100)`)

   **Implementation notes for search**: The route uses `prisma.$queryRaw\`SELECT...\`` (tagged template). The mock `prisma.$queryRaw` is a `vi.fn()` — it receives the template strings array + interpolated values. Mock it to return an array of profile objects: `prisma.$queryRaw.mockResolvedValue([{ uid: "u1", displayName: "Test", photoURL: null }])`.

**Verification**:
```bash
npx vitest run src/app/api/challenges/sync-volume/__tests__/ src/app/api/social/
# Expected: all pass (9 files, 30+ test cases)
```

**Depends on**: S3-T13

**Checkpoint**: All 15 API route test files + shared helpers created. Run the full API suite:
```bash
npx vitest run src/app/api/
# Expected: 15 files, 60+ test cases, all pass
```

---

### Group C: E2E Tests (US3)

---

- [ ] **S3-T17** [P] [US3] Create `e2e/workout-flow.spec.ts` — signup → wizard → workout → finish → share

**File to create**: `e2e/workout-flow.spec.ts` (NEW)

**Test cases** (1 comprehensive flow):
1. Navigate to `/` (splash renders, "Get Started" button visible)
2. Click "Get Started" → complete 5-step wizard (goal, schedule, muscles, health, review)
3. Click "Generate" → workout program renders with ≥1 exercise
4. Click "Start Workout" → complete all sets
5. Click "Finish" → workout result view visible
6. Click "Share to Feed" → navigate to feed, new post visible at top

**Implementation skeleton**:
```typescript
import { test, expect } from "./test-helpers";

test.describe("Workout flow: signup → wizard → workout → finish → share", () => {
  test.beforeEach(async ({ page }) => {
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
    // 1. Splash
    await page.goto("/");
    await expect(page.locator("text=Get Started")).toBeVisible();

    // 2. Wizard
    await page.click("text=Get Started");
    // Step 1: Goal & Experience
    // ... click goal option, experience level, click "Next"
    // Step 2: Schedule & Equipment
    // ... select days/week, session length, equipment checkboxes, "Next"
    // Step 3: Muscles & Style
    // ... select priority muscles, intensity style, "Next"
    // Step 4: Health & Safety
    // ... injuries, medical cautions, "Next"
    // Step 5: Review
    // ... click "Generate"

    // 3. Workout generated
    await expect(page.locator("[data-testid=workout-exercise]")).toHaveCount({ atLeast: 1 });

    // 4. Start + complete session
    await page.click("text=Start Workout");
    // Complete all sets (click each set checkbox)
    const setCheckboxes = page.locator("[data-testid=set-checkbox]");
    const count = await setCheckboxes.count();
    for (let i = 0; i < count; i++) {
      await setCheckboxes.nth(i).click();
    }

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

**Implementation notes**:
- The wizard step selectors need to be filled in during implementation (inspect the actual UI for button text / data-testid attributes).
- Uses the `authedPage` fixture from `test-helpers.ts` (creates emulator user, mints cookie, sets cookie).
- Clears Dexie in `beforeEach` to ensure no state leak.
- If `data-testid` attributes don't exist in the UI, add them OR use text-based selectors.

**Verification**:
```bash
# Prerequisites: Firebase Auth Emulator running + dev server running
firebase emulators:start --only auth &
pnpm run dev &
pnpm run test:e2e e2e/workout-flow.spec.ts
# Expected: 1 test passed
```

**Depends on**: S3-T04 (needs test-helpers.ts + playwright.config.ts), S3-T05 (CI runs it)

---

- [ ] **S3-T18** [P] [US3] Create `e2e/social-feed.spec.ts` — kudos + comment

**File to create**: `e2e/social-feed.spec.ts` (NEW)

**Test cases** (2):
1. **Give kudos increments count**:
   - Pre-seed a feed post via API: `page.request.post("/api/social/feed", { data: {...} })`
   - Navigate to `/feed`
   - Read initial kudos count from the first post's kudos button
   - Click the kudos button
   - Read new count → assert `newCount === initialCount + 1`

2. **Post a comment appears in list**:
   - Pre-seed a feed post (same as above)
   - Navigate to `/feed`
   - Click "Comment" on the first post
   - Type a comment in the input
   - Submit
   - Assert the comment text appears in the comment list below the post

**Implementation skeleton**:
```typescript
import { test, expect } from "./test-helpers";

test.describe("Social feed: kudos + comment", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase("PulseDB");
        req.onsuccess = () => resolve();
      });
    });
  });

  test("give kudos increments count", async ({ authedPage: page }) => {
    // Pre-seed a feed post
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
    const initialCount = Number(await kudosButton.textContent());

    await kudosButton.click();

    const newCount = Number(await kudosButton.textContent());
    expect(newCount).toBe(initialCount + 1);
  });

  test("post a comment appears in list", async ({ authedPage: page }) => {
    // Pre-seed post, click comment, type, submit, assert visible
    // ... (similar pattern)
  });
});
```

**Verification**:
```bash
pnpm run test:e2e e2e/social-feed.spec.ts
# Expected: 2 tests passed
```

**Depends on**: S3-T04, S3-T05

---

- [ ] **S3-T19** [P] [US3] Create `e2e/challenge-flow.spec.ts` — join → sync → leaderboard

**File to create**: `e2e/challenge-flow.spec.ts` (NEW)

**Test cases** (1 comprehensive flow):
1. Navigate to `/challenges`
2. Click "Join" on the first challenge → assert "Joined" visible
3. Complete a workout (triggers `/api/challenges/sync-volume`)
4. Navigate back to `/challenges` → assert progress bar visible + progress > 0
5. Click "Leaderboard" → assert leaderboard entries visible + test user "Test Athlete" appears

**Implementation skeleton**:
```typescript
import { test, expect } from "./test-helpers";

test.describe("Challenge flow: join → sync → leaderboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase("PulseDB");
        req.onsuccess = () => resolve();
      });
    });
  });

  test("join challenge, workout, see progress + leaderboard", async ({ authedPage: page }) => {
    // 1. Join
    await page.goto("/challenges");
    await page.locator("text=Join").first().click();
    await expect(page.locator("text=Joined")).toBeVisible();

    // 2. Complete a workout (triggers sync-volume)
    // ... start session, complete sets, finish ...
    // The workout completion calls /api/challenges/sync-volume automatically

    // 3. Verify progress
    await page.goto("/challenges");
    const progressBar = page.locator("[data-testid=challenge-progress]").first();
    await expect(progressBar).toBeVisible();

    // 4. Leaderboard
    await page.click("text=Leaderboard");
    await expect(page.locator("[data-testid=leaderboard-entry]")).toHaveCount({ atLeast: 1 });
    await expect(page.locator("text=Test Athlete")).toBeVisible();
  });
});
```

**Verification**:
```bash
pnpm run test:e2e e2e/challenge-flow.spec.ts
# Expected: 1 test passed
```

**Depends on**: S3-T04, S3-T05

**Checkpoint**: All 3 E2E test files created. Run the full E2E suite:
```bash
pnpm run test:e2e
# Expected: 3 files, all pass (with Firebase Emulator + dev server running)
```

---

## Phase 4: Final Verification

**Purpose**: Verify the full system against all 14 Success Criteria from the spec. No code changes here unless a criterion fails (in which case, return to the relevant task).

---

- [ ] **S3-T20** [SHARED] Final verification — run full test suite, verify CI passes, confirm all SCs

**No files to create/modify** — this is a verification-only task.

**Verification steps** (execute in order):

1. **Full vitest suite** (SC-012):
   ```bash
   npx vitest run
   # Expected: 169 existing + 35 algorithm + 60 API = ~264 tests, 0 failed
   ```

2. **Algorithm test coverage** (SC-009, SC-010):
   ```bash
   ls src/services/__tests__/{fatigueEngine,deloadEngine,variationEngine,learningLoop,movementPatterns,recoveryTracker,smartRest}.test.ts
   # Expected: all 7 files exist
   for f in src/services/__tests__/{fatigueEngine,deloadEngine,variationEngine,learningLoop,movementPatterns,recoveryTracker,smartRest}.test.ts; do echo "$f: $(grep -c 'it(' $f)"; done
   # Expected: each ≥ 5
   ```

3. **API test coverage** (SC-003, SC-004):
   ```bash
   find src/app/api -path "*__tests__/route.test.ts" | wc -l
   # Expected: ≥ 15
   grep -r "it(" src/app/api/**/__tests__/ | wc -l
   # Expected: ≥ 60
   ```

4. **E2E test coverage** (SC-007):
   ```bash
   ls e2e/*.spec.ts
   # Expected: 3 files (workout-flow, social-feed, challenge-flow)
   pnpm run test:e2e  # with emulator + dev running
   # Expected: all pass
   ```

5. **No new tsc errors** (SC-013):
   ```bash
   npx tsc --noEmit 2>&1 | grep -c "^src/"
   # Expected: 27 (baseline, no new errors)
   ```

6. **No new lint errors** (SC-013):
   ```bash
   bun run lint 2>&1 | grep -c "error "
   # Expected: 8 (baseline, no new errors)
   ```

7. **learningLoop fake-indexeddb isolation** (SC-011):
   ```bash
   npx vitest run src/services/__tests__/learningLoop.test.ts --retry=2
   # Expected: no flakiness (all pass on retry)
   ```

8. **CI workflow valid** (SC-001):
   ```bash
   python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" && echo "YAML valid"
   ```

9. **Open a PR + check GitHub Actions** (SC-014):
   - Push the `sprint3-test-coverage` branch
   - Open a PR against `main`
   - Check the GitHub Actions tab → all 4 jobs should run:
     - `lint` ✅
     - `typecheck` ✅ (error count ≤ 27)
     - `test` ✅ (~264 tests pass)
     - `e2e` ✅ (3 E2E flows pass)
   - If any job fails, return to the relevant task, fix, and re-push

10. **CI install timing** (SC-002):
    - On the 2nd CI run (push another commit), check the `pnpm install` step time
    - Expected: <15s on cache hit (vs ~60s cold)

**Depends on**: All prior tasks (S3-T01 through S3-T19)

**If any criterion fails**: Return to the relevant task, fix the root cause, and re-run the full verification. Do not mark S3-T20 complete until all 14 success criteria pass.

---

## Dependencies & Execution Order

### Task Dependency Graph

```
S3-T01 (fix api-integration)  ──┐
                                 ├──> S3-T02 (fix aiWorkoutService) ──> CHECKPOINT: 169 green
                                 │                                          │
S3-T03 (install deps)  <─────────┴──────────────────────────────────────────┤
                                                                            │
S3-T04 (playwright config + helpers)  ─────> S3-T05 (ci.yml)  ──────────────┤
                                      │                                     │
                                      ├──> S3-T17 (workout-flow E2E)  ──────┤
                                      ├──> S3-T18 (social-feed E2E)   ──────┤
                                      └──> S3-T19 (challenge-flow E2E) ─────┤
                                                                            │
S3-T06 (fatigueEngine)  ────────────────────────────────────────────────────┤
S3-T07 (deloadEngine)   ────────────────────────────────────────────────────┤
S3-T08 (variationEngine) ─────────── [all parallel] ────────────────────────┤
S3-T09 (movementPatterns) ──────────────────────────────────────────────────┤
S3-T10 (recoveryTracker) ───────────────────────────────────────────────────┤
S3-T11 (smartRest)       ───────────────────────────────────────────────────┤
S3-T12 (learningLoop)    ───────────────────────────────────────────────────┤
                                                                            │
S3-T13 (API test helpers) ──> S3-T14 (AI route tests)  ─────────────────────┤
                       │   ──> S3-T15 (Auth+Challenges tests)  ─────────────┤
                       └── ──> S3-T16 (sync-volume + Social tests) ─────────┤
                                                                            │
                                                            S3-T20 (verify) ┘
```

### Parallel Opportunities

| Parallel Group | Tasks | Condition |
|----------------|-------|-----------|
| **A** (algorithm tests) | S3-T06, S3-T07, S3-T08, S3-T09, S3-T10, S3-T11, S3-T12 | After S3-T02 — all 7 can run in parallel (different files, no cross-deps) |
| **B** (API tests) | S3-T14, S3-T15, S3-T16 | After S3-T13 (shared helper) — all 3 can run in parallel (different route groups) |
| **C** (E2E tests) | S3-T17, S3-T18, S3-T19 | After S3-T04 (helpers) + S3-T05 (CI) — all 3 can run in parallel (different flows, but Playwright runs them sequentially due to `workers: 1`) |

### Strict Sequential (if single-developer)

```
S3-T01 → S3-T02 → S3-T03 → S3-T04 → S3-T05
  → S3-T06 → S3-T07 → S3-T08 → S3-T09 → S3-T10 → S3-T11 → S3-T12
  → S3-T13 → S3-T14 → S3-T15 → S3-T16
  → S3-T17 → S3-T18 → S3-T19
  → S3-T20
```

### Recommended Parallel Execution (if multi-developer or sub-agent)

```
Developer/Agent 1: S3-T01 → S3-T02 → S3-T03 → S3-T04 → S3-T05
                                                              [CHECKPOINT: infra ready]
Developer/Agent 2:                                    S3-T06..S3-T12 (algorithm tests, parallel)
Developer/Agent 3:                                    S3-T13 → (S3-T14, S3-T15, S3-T16 parallel)
Developer/Agent 4:                                    (S3-T17, S3-T18, S3-T19 parallel E2E)
Merge:                                                                                          → S3-T20
```

---

## Within-Task Rules

- **One file at a time**: Each task touches a defined set of files. Do not modify files outside the task's scope.
- **Verify after each task**: Run the verification step (vitest/playwright/tsc) before marking the task complete.
- **Commit after each task**: Use a descriptive commit message referencing the task ID (e.g., `test(sprint3): S3-T06 add fatigueEngine unit tests`).
- **No `any` types**: All test code uses explicit types or vi-inferred types (constitution rule 1).
- **Mocks must be hoisted**: `vi.mock(...)` calls are hoisted to the top of the file by vitest. Place them before route imports. The `mockFirebaseAdmin`/`mockPrisma` helpers call `vi.mock` internally.
- **`vi.clearAllMocks()` in `beforeEach`**: Ensures no mock state leaks between tests in the same file.
- **Do NOT change source code** unless a test reveals a genuine source bug (flag it separately — out of scope for test tasks).

---

## Implementation Strategy

### MVP First (CI + Algorithm Tests)

1. Complete S3-T01, S3-T02 (fix existing failures → 169 green).
2. Complete S3-T03, S3-T04, S3-T05 (install + infra + CI).
3. Complete S3-T06 through S3-T12 (7 algorithm tests).
4. **STOP and VALIDATE**: Open a PR. CI runs lint + typecheck + test. All algorithm tests pass. The app now has a CI backbone + algorithm regression safety net.
5. Deploy/demo if ready — the algorithm layer is protected.

### Incremental Delivery

1. S3-T01..S3-T05 → infrastructure ready → CI runs on every PR.
2. S3-T06..S3-T12 → algorithm tests → test independently → merge.
3. S3-T13..S3-T16 → API integration tests → test independently → merge.
4. S3-T17..S3-T19 → E2E tests → test independently → merge (e2e job may be `continue-on-error` initially if Firebase Emulator setup is flaky in CI).
5. S3-T20 → full verification → all 14 SCs pass.

---

## Notes

- **[P] tasks** = different files, no dependencies within the group.
- **[Story] label** maps each task to `US1` (CI), `US2` (API tests), `US3` (E2E), `US4` (algorithm tests), or `SHARED`.
- Each user story is independently completable: US1 (CI) ships without any tests (just the workflow); US4 (algorithm tests) ships without CI (run manually); US2 (API tests) ships without E2E; US3 (E2E) ships without unit tests.
- **Verify after each task** — do not batch multiple tasks before running vitest.
- **Commit after each task** — enables clean rollback.
- **The `aiWorkoutService.test.ts` fix (S3-T02) is diagnostic** — the exact fix depends on the failure output. Run the test first, read the errors, then fix. Do NOT change source code to make the test pass — fix the test to match current source behavior.
- **E2E tests need `data-testid` attributes** in the UI. If they don't exist, either add them (minimal source change, acceptable in a test sprint) or use text-based selectors. The plan prefers `data-testid` for stability.
- **Firebase Auth Emulator must be running** for E2E tests locally. The CI workflow (S3-T05) starts it automatically; locally run `firebase emulators:start --only auth &` before `pnpm run test:e2e`.
- **The `service-account.json` is now present** (added in the prior session) — Firebase Admin SDK initializes correctly for both API tests (mocked) and E2E tests (real emulator).
