# PHASE-K — Progressive Overload chips + Deload banner + progression tips

## Task
Enhance `src/pages/WorkoutResultView.tsx` to surface progressive-overload intelligence
(chips, progression tips, deload banner, plateau alert) that the prior engines
(overloadEngine.ts, deloadEngine.ts) already compute and attach to `ProgramExercise`
/ `WorkoutProgram`.

## Context loaded from previous agents (worklog.md)
- PHASE-A1/A2/B/C/ALGO-IMPL shipped ACWR fatigue + RPE overload + MEV/MAV + movement
  pattern balance + novelty scoring + Fisher-Yates + circuit breaker.
- PHASE-G added `learningLoop.ts` + Dexie v10 `exerciseFeedback` store.
- PHASE-H added `deloadEngine.ts` (assessDeloadNeed) + `variationEngine.ts`
  (detectRotationNeeds).
- ALGO-IMPL-2 wired everything into `workoutGenerator.ts`:
  * `ProgramExercise` gained `previousWeight/Reps`, `suggestedWeight/Reps`,
    `progressionTip`, `overloadStrategy`.
  * `WorkoutProgram` gained `deloadRecommendation?` and `variationRecommendations?`.
- So the data is already there on the program object — this task is purely a
  presentation layer on top of it.

## Type verification
- `ProgramExercise` at `src/services/workoutGenerator.ts:37` — confirmed the 5 new
  optional fields exist.
- `overloadStrategy` is typed as `OverloadRecommendation["strategy"]` which resolves
  to `"increase-weight" | "add-reps" | "hold" | "deload" | "new-exercise"` (verified
  in `src/services/overloadEngine.ts:54`). NOTE: `"plateaued"` is a *trend* value,
  not a *strategy* — when trend===plateaued the engine returns strategy="hold".
  Mission item #4 says "when overloadStrategy === plateaued" but that value never
  occurs; implemented the plateau alert by gating on `strategy === "hold"` (which
  is what a plateaued trend produces).
- `DeloadRecommendation` (deloadEngine.ts) has `shouldDeload`, `trigger`,
  `weeksSinceLastDeload`, `volumeMultiplier`, `rpeCap`, `explanation` — all
  consumed by the new banner.
- Color tokens `primary`, `primary-light`, `success`, `warning`, `danger`,
  `text-text-secondary`, `text-text-primary`, `bg-bg-elevated` all verified present
  in `src/app/globals.css`.

## Changes made to `src/pages/WorkoutResultView.tsx`
1. Imports: added `ArrowUp, ArrowDown, Plus, Minus, TrendingUp, AlertCircle` from
   lucide-react (omitted `TrendingDown` and `Clock` from the suggested list because
   they ended up unused — would trigger `no-unused-vars`). Added
   `type ProgramExercise` to the `workoutGenerator` import.
2. New `ProgressiveOverloadChip` component (inline, above the default export):
   - `new-exercise` → primary-tinted "✨ New" chip
   - `deload` → danger-tinted "↓ {delta}kg" chip (negative delta)
   - `hold` → warning-tinted "− Hold" chip
   - `add-reps` → success-tinted "+ +Reps" chip
   - `increase-weight` (with positive delta) → success-tinted "↑ +{delta}kg" chip
   - returns null when no strategy or zero/negative delta on increase-weight
3. Deload Week banner — added between the Warnings block and the Day Selector:
   - gradient `from-warning/15 to-warning/5` panel with AlertCircle icon badge
   - shows `explanation` paragraph + 3 stat pills: Volume −X%, RPE Cap, Trigger
4. Exercise card restructure — wrapped the `<h3>` name in a flex row containing:
   - the existing name
   - `ProgressiveOverloadChip` (only when overloadStrategy is truthy)
   - an extra "⚠ Plateau" indicator (warning/10 tint) when `strategy === "hold"`
     (satisfies mission item #4 — "plateaued" maps to "hold" strategy)
5. Progression tip callout — added below the stats row, above the existing note:
   - `bg-primary/5` panel with `TrendingUp` icon + `progressionTip` text
6. All accesses to new fields use `(item as ProgramExercise)` cast because
   `displayExercises` is a union of `ProgramExercise[] | RoutineExercise[]` and
   the routine shape doesn't have the overload fields.

## Lint result
- `npx eslint src/pages/WorkoutResultView.tsx` → EXIT 0, zero output (clean).
- Full `bun run lint` → 16 problems (15 errors + 1 warning), ALL pre-existing in
  unrelated files (BodyPage.tsx, ExercisesPage.tsx, StatsPage.tsx, RestTimer).
  Baseline count identical to PHASE-H/ALGO-IMPL-2 reports — zero new issues.

## Dev server
- `dev.log` tail shows clean compilation: `✓ Compiled in 65ms`, `GET / 200` responses
  normal. The "Failed to open DB: IndexedDB API missing" is the expected Dexie
  server-side no-op (pre-dates this task).

## Files modified
- `/home/z/my-project/src/pages/WorkoutResultView.tsx` (only file touched)
