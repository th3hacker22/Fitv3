# Implementation Plan — Remaining Work

**Date:** 2026-06-18
**Scope:** AI Generator P2/P3 features + CODE_REVIEW Decision Points
**Approach:** Client-first pure modules + tests (no Prisma changes for workout data)

---

## Architecture Context (confirmed by exploration)

- Workout data lives entirely in **IndexedDB (Dexie)** on the client (offline-first). Prisma/SQLite is for social + challenges only.
- `generateProgram` (workoutGenerator.ts) is the **heuristic fallback**, NOT the primary path. Primary = AI Coach API.
- AI Coach prompt derives "previous performance" server-side from raw sessions. AI returns `previousWeight`/`suggestedWeight` but **client discards them**.
- `rpe` is saved per set in Dexie but **never read back**.
- `getLastExerciseData` returns uncompleted sets too (ghost data pollution).
- Current "auth" = `x-user-uid` header that the client self-reports → fully forgeable. This is what JWT decision fixes.

---

## Phase A — Progressive Overload Engine (P2)

**New pure module:** `src/services/progressiveOverload.ts`
**New tests:** `src/services/__tests__/progressiveOverload.test.ts`

### A.1 Module: `progressiveOverload.ts`

Types:
```ts
interface ExerciseHistoryPoint {
  date: string;
  weight: number;
  reps: number;
  rpe?: number;
  setsCompleted: number;
  setsTargeted: number;
  estimated1RM: number;
}
type ProgressionModel = "linear" | "weekly-undulating" | "block-periodization";
interface OverloadRecommendation {
  exerciseId: string;
  model: ProgressionModel;
  previousWeight: number | null;
  previousReps: number | null;
  suggestedWeight: number;
  suggestedReps: number;
  incrementPct: number;        // e.g. 0.025
  rationale: string;           // human-readable reason
  ready: boolean;              // false = deload/hold/maintain
  readinessSignal: "advance" | "hold" | "deload" | "introduce";
}
```

Functions (pure, deterministic, testable):
1. `pickProgressionModel(trainingYears, fitnessLevel): ProgressionModel`
   - Novice/Beginner (<1.5 yr) → `linear`
   - Intermediate (1.5–5 yr) → `weekly-undulating`
   - Advanced (>5 yr) → `block-periodization`
2. `analyzeExerciseProgress(history: ExerciseHistoryPoint[]): { lastSession, streakBeatTarget, beatCount, avgRpe, completionRatio }`
   - streakBeatTarget = did user exceed top-of-rep-range @ weight for 3 consecutive sessions? (the "15% over 3 sessions" rule from the plan)
3. `recommendOverload(history, model, age): OverloadRecommendation`
   - **linear:** +2.5% if completionRatio === 1.0 AND avgRpe ≤ 8
   - **weekly-undulating:** alternate heavy/moderate/light across the week; +1.25% per microcycle
   - **block:** accumulation → intensification → deload (4-week blocks)
   - **introduce:** if no history → conservative starting weight (estimate from bodyweight + exercise category, capped)
   - **deload:** if avgRpe ≥ 9 over last 2 sessions OR completionRatio < 0.7 → reduce 10–15%
   - **hold:** otherwise
   - Age adjustments: 55+ caps increments at 1.25%; 41–55 caps at 2%
4. `formatOverloadForPrompt(recs: OverloadRecommendation[]): string` — for AI Coach prompt

Edge cases (tested):
- Empty history → introduce
- Single session → hold
- RPE missing → fall back to completionRatio only
- Bodyweight exercises (weight = 0) → track reps instead of weight

### A.2 Analytics helper: `src/db/analytics.ts`
- New export `getExerciseHistory(exerciseId, sessions?): ExerciseHistoryPoint[]` — scans completed sessions, builds sorted history with per-session `setsCompleted/setsTargeted/rpe/e1RM`.
- Reuse existing `estimateOneRepMax`.

### A.3 Wire into AI Coach
- `aiWorkoutService.ts:generateWorkoutAICoach`: build `overload` block from `getExerciseHistory` for each exercise the user has done. Pass in `userData.overload`.
- `route.ts:buildCoachPrompt`: replace the soft "2.5–5% higher" instruction with explicit `recommendOverload` results per exercise (deterministic, not LLM-guessed).
- **Stop discarding `suggestedWeight`** — `generateWorkoutAICoach` must carry it into `WorkoutRoutine.exercises[i].suggestedWeight`.

### A.4 Extend types
- `WorkoutRoutine.exercises[i]`: add optional `previousWeight`, `suggestedWeight`, `readinessSignal`.
- `ProgramExercise`: add optional `suggestedWeightKg`, `previousWeightKg`.

### A.5 Ghost logging enrichment
- `useWorkoutStore.getLastExerciseData`: filter `s.completed === true`, also return `rpe`, `estimated1RM`. (Fixes the pollution bug.)
- `SetRow` / `ExerciseWorkoutCard`: show "Target: {suggestedWeight}kg" badge when present, alongside existing "Prev:".

**Tests (target ~18):** deterministic increments per model, deload triggers, introduce path, age caps, bodyweight branch, empty/single-session, completion-ratio thresholds, prompt formatting.

---

## Phase B — Fatigue Management System (P2)

**New pure module:** `src/services/fatigue.ts`
**New tests:** `src/services/__tests__/fatigue.test.ts`

### B.1 Module: `fatigue.ts`

Types:
```ts
interface FatigueInput {
  weeklyTonnage: Array<{ week: string; tonnage: number }>; // last 4–6 weeks
  recentSessions: WorkoutSession[];                         // last 7–14 days
  age: number;
  daysPerWeek: number;
}
type FatigueLevel = "low" | "moderate" | "high" | "critical";
interface FatigueState {
  score: number;              // 0–100
  level: FatigueLevel;
  trend: "rising" | "stable" | "declining";
  recommendedAction: "normal" | "reduce-volume" | "deload" | "rest";
  volumeMultiplier: number;   // 0.6–1.0 applied to generated volume
  avgRpe: number | null;
  missedSetRatio: number;
  sessionsLast7Days: number;
  rationale: string;
}
```

Functions (pure):
1. `computeFatigueScore(input): number` (0–100):
   - 40% weight: weekly tonnage slope (rising > 0 → +score; 4-week trend)
   - 25% weight: average RPE last 7 days (≥8.5 → high)
   - 20% weight: missed-set ratio last 7 days (>20% → high)
   - 15% weight: sessions in last 7 days vs `daysPerWeek` (overtraining indicator)
   - Age multiplier: 55+ adds +10 to score
2. `classifyFatigue(score): FatigueLevel`
   - <25 low, 25–50 moderate, 51–75 high, >75 critical
3. `computeTrend(weeklyTonnage): "rising" | "stable" | "declining"`
4. `recommendAction(state): FatigueState` — maps level → action + volumeMultiplier:
   - low → normal, 1.0
   - moderate → normal, 0.95
   - high → reduce-volume, 0.7–0.8
   - critical → deload (0.6) or rest if 0 sessions in 48h window with critical
5. `formatFatigueForPrompt(state): string` — explicit fatigue context for AI

Edge cases (tested):
- No history → low/normal
- Tonnage strictly rising for 3 weeks with high RPE → high
- Sudden drop in volume → declining (recovered)
- Deload week detection (volume < 60% of previous)

### B.2 Analytics helper: `src/db/analytics.ts`
- New export `getFatigueInput(age, daysPerWeek, sessions?): FatigueInput` — composes `getWeeklyTonnage(6)` + recent sessions.

### B.3 Wire into generators
- **AI Coach:** `GeneratorWizard.handleGenerate` computes `fatigueState` once, passes via `userData.fatigue`. Prompt instructs: "Apply volumeMultiplier {x} to set counts and reduce intensity. This is a {level} fatigue state."
- **Heuristic `generateProgram`:** multiply per-exercise `sets` by `volumeMultiplier`, round down, min 2. Add `deloadWeek: boolean` flag to `WorkoutProgram` and a `warnings[]` entry when deload triggered.

### B.4 UI surfacing
- `WorkoutResultView`: show a "Fatigue: {level}" chip + brief rationale when level !== low.
- Optional: Settings toggle "Enable fatigue-aware programming" (default on).

**Tests (target ~14):** score boundaries, trend classification, action mapping, age modifier, empty input, deload detection, volume multiplier rounding.

---

## Phase C — Exercise Pairing / Supersets (P3)

**New pure module:** `src/services/exercisePairing.ts`
**New tests:** `src/services/__tests__/exercisePairing.test.ts`

### C.1 Module: `exercisePairing.ts`

Types:
```ts
type MuscleRole = "push" | "pull" | "legs" | "core" | "accessory";
interface PairableExercise { exerciseId: string; name: string; bodyPart: string; target: string; equipment: string; }
interface SupersetGroup { exercises: PairableExercise[]; type: "antagonist" | "compound-accessory" | "same-equipment"; rationale: string; }
```

Functions (pure):
1. `classifyMuscleRole(exercise): MuscleRole` — push/pull/legs/core/accessory from name+target keywords.
2. `findAntagonistPairs(pool): SupersetGroup[]` — push+pull (bench/row, ohp/pulldown), quads/hamstrings (squat/rdl), biceps/triceps.
3. `groupByEquipment(pool): Map<string, PairableExercise[]>`
4. `buildSupersets(dayExercises, sessionMinutes): PairingPlan`
   - If `sessionMinutes < 45` AND `intensityStyle !== "straight sets"` → aggressively pair antagonist groups into supersets (saves ~30% time).
   - If `>= 45` → only pair isolation accessories (curl/skullcrusher, etc.).
   - Never superset two heavy compounds.
   - Keep same-equipment adjacency to minimize transitions.

### C.2 Wire into generators
- `generateProgram`: after picking `dayExList`, run `buildSupersets` and attach `supersetId` to `ProgramExercise` (matches the existing `WorkoutExerciseData.supersetId` field — already supported in the data model and WorkoutSession display).
- AI Coach prompt: add a "PAIRING" instruction — "Where the user's style is supersets/circuits and session < 45min, return `supersetId` fields grouping antagonist pairs."

### C.3 UI
- `WorkoutSessionPage` already renders supersets (per worklog) — verify it consumes `supersetId` correctly; no major UI change expected.

**Tests (target ~12):** classification accuracy, antagonist detection, short-session aggressive pairing, no double-compound supersets, equipment grouping.

---

## Phase D — Learning Loop (P3)

**New Dexie table + pure module.**

### D.1 Schema: `src/db/schema.ts`
Add new table:
```ts
export interface ExerciseFeedback {
  id: string;
  exerciseId: string | number;
  exerciseName: string;
  action: "skipped" | "modified-weight" | "modified-reps" | "replaced" | "completed-as-prescribed";
  // optional deltas when modified
  weightDelta?: number;
  repsDelta?: number;
  replacedWithId?: string | number;
  sessionId: string;
  date: string;            // ISO
  createdAt: string;
}
```
Register `exerciseFeedback!: Table<ExerciseFeedback>` on `PulseDB` + bump version in `migrations.ts`.

### D.2 Pure module: `src/services/learningLoop.ts`
```ts
interface ExerciseAffinity {
  exerciseId: string;
  skipRate: number;          // 0–1
  modifyRate: number;
  replaceRate: number;
  affinityScore: number;     // higher = well-received; can go negative
  sampleSize: number;
  recommendation: "prefer" | "neutral" | "demote";
}
function computeAffinity(feedback: ExerciseFeedback[]): Map<id, ExerciseAffinity>
function formatAffinityForPrompt(affinity, topN): string
function recordFeedback(...) // thin wrapper over db.exerciseFeedback.add
```

### D.3 Wire-in capture points
- `useWorkoutStore.finishWorkout`: for each exercise in the session, compare completed sets vs targeted → record `completed-as-prescribed` / `skipped` (if zero sets completed) / `modified-weight|reps` (if weight/reps differ from program by > threshold).
- `swapExercise` / `replaceExercise`: record `replaced` with `replacedWithId`.

### D.4 Wire into generation
- `generateProgram.scoreEx`: add affinity penalty — `score -= affinity.demote ? 30 : (affinity.prefer ? +5 : 0)` when affinity data exists. Small weight so it nudges, not dominates.
- AI Coach prompt: include "EXERCISE AFFINITY" block — "User has skipped X 40% of the time; demote it."

### D.5 UI
- Optional: Stats page "Exercises you skip most" widget (low priority — can defer if time-constrained).

**Tests (target ~10):** affinity computation, recommendation thresholds, dedup on same exercise, prompt formatting.

---

## Phase E — Decision Points (CODE_REVIEW)

### E.1 JWT Auth (replaces forgeable x-user-uid)
**New:** `src/lib/jwt.ts` (sign/verify using `jose` or HMAC-SHA256 with `process.env.PULSE_JWT_SECRET`), `src/lib/authServer.ts` (`requireUser(req)` helper).

- **Login flow** (`useAuthStore` + AuthPage): on local "sign in", POST `/api/auth/login` with `{ uid, displayName }` → server returns signed JWT (HS256, 7-day exp, `sub: uid`, `name`, `photo`).
- **Client:** store JWT in localStorage `pulse_jwt`, attach as `Authorization: Bearer <jwt>` on all `/api/*` writes (replace `x-user-*` headers gradually — keep backward-compat during rollout).
- **Middleware** (`src/middleware.ts`): verify JWT signature + exp; extract `callerUid` from `sub`. Drop the `x-user-uid` trust. 401 on invalid/missing.
- **Routes:** replace `req.headers.get("x-user-uid")` with `requireUser(req)` which reads from verified JWT.
- **Fallback:** if `PULSE_JWT_SECRET` unset → fall back to header-based (dev convenience) with a console warning.

Secret default: derive from a stable dev value but **warn loudly** if unset in production.

**Tests:** extend `api-integration.test.ts` — 401 without token, 200 with valid token, 401 with expired/tampered token, callerUid correctly extracted.

### E.2 next/image migration
- `next.config.ts`: add `images: { remotePatterns: [{ protocol: "https", hostname: "**" }] }` (exercises load images from GitHub raw).
- Replace `<img>` in `HomePage.tsx`, `AuthPage.tsx`, `ExerciseWorkoutCard.tsx` (image fallback) with `next/image`. Use `fill` + `sizes` for responsive cards, `priority` for above-the-fold hero.
- Keep the existing `hasError` fallback logic.
- Verify no CLS regression (explicit aspect containers).

### E.3 PWA re-enable
- `public/sw.js`: minimal service worker — precache app shell (`/`, manifest, icons), runtime cache for `/_next/static` + exercise images (stale-while-revalidate), network-first for API.
- Register in `src/app/layout.tsx` (client component or inline script guarded by `'serviceWorker' in navigator` + `process.env.NODE_ENV === 'production'`).
- Link manifest in `<head>` via metadata (already has `manifest.json`).
- Verify with Lighthouse PWA audit (note: SW only registers in production build — document this).

### E.4 Arabic removal confirmation
- Confirm `src/i18n/locales/ar.json` already deleted (worklog says yes).
- Grep for any remaining `ar` references in i18n config, settings, tests.
- Delete `public/locales/ar.json` if present.
- Add a one-line note to `worklog.md` confirming final decision.

---

## Phase F — Verification

1. `bun run test` — target: all 138 existing pass + ~54 new tests (PO 18, fatigue 14, pairing 12, learning 10) = **~192 tests**.
2. `bun run lint` — zero new errors.
3. `bun run build` — succeeds (catches next.config issues, type errors ignored at build per current config — verify no runtime-only type issues introduced).
4. Manual smoke (dev server): generate a program as a returning user → confirm `suggestedWeight` flows to SetRow; trigger high-fatigue state in test data → confirm volume reduction; skip an exercise → confirm it's demoted next generation.
5. Update `worklog.md` with a final entry summarizing all phases.

---

## Execution Order & Checkpoints

1. **Phase A** (Progressive Overload) → checkpoint: tests pass, AI prompt carries deterministic overload.
2. **Phase B** (Fatigue) → checkpoint: tests pass, both generators apply volume multiplier.
3. **Phase C** (Supersets) → checkpoint: tests pass, programs carry supersetId.
4. **Phase D** (Learning Loop) → checkpoint: tests pass, finishWorkout records feedback.
5. **Phase E.1** (JWT) → checkpoint: existing tests still pass, new auth tests green.
6. **Phase E.2 + E.3 + E.4** (image, PWA, Arabic) → checkpoint: build green.
7. **Phase F** (verification + worklog).

**Estimated total: ~28–32 hours of work** spread across the phases. Each phase is independently shippable.

---

## Risk Notes

- **JWT secret management:** if `PULSE_JWT_SECRET` is unset in prod, the app must either refuse to start or fall back with a loud warning. I'll implement the warning + fallback to keep dev ergonomic.
- **Migration bump:** adding `exerciseFeedback` table requires a Dexie version bump. Existing user data is preserved (Dexie additive migrations are safe).
- **next/image with GitHub-hosted exercise GIFs:** large GIF lists could hurt perf. Will use `loading="lazy"` (default) + `sizes` to limit decode cost.
- **AI prompt token budget:** adding fatigue + overload + affinity blocks grows the prompt. I'll keep each block concise and the exercise list already capped at 200.
