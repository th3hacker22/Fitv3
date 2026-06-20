# PHASE-L — Plate Calculator

## Task
Build a Plate Calculator — barbell plate breakdown visual. Given a target weight + available plates, calculate exactly which plates to load on each side of the barbell.

## Files Touched
1. **Created** `/home/z/my-project/src/services/plateCalculator.ts` (~165 lines, verbatim from spec)
   - `PlateConfig`, `PlateLoad` interfaces
   - `calculatePlates(targetWeight, config)` — greedy algorithm with float-safe rounding
   - `formatPlateStack(plates)` — "25kg + 10kg + 2.5kg"
   - `plateColor(weight)` — Tailwind class mapper (red/blue/yellow/green/white/gray/purple)
   - `GYM_PRESETS` — 4 presets (commercial / home / powerlifting / womensBar)

2. **Created** `/home/z/my-project/src/components/workout/PlateCalculatorSheet.tsx` (~190 lines, verbatim from spec)
   - Bottom-sheet modal (AnimatePresence + spring slide-up) — same architecture as WarmupSheet
   - Barbell SVG visualization: left plates → left collar → bar → right collar → right plates
   - Preset selector (4 chips, horizontal scroll)
   - "Not exact" warning banner when target can't be achieved
   - Plate chip list with color-coded backgrounds

3. **Modified** `/home/z/my-project/src/components/workout/ExerciseWorkoutCard.tsx` (+15 lines)
   - Added `PlateCalculatorSheet` import
   - Added `showPlates` useState(false)
   - Added `isBarbellExercise` + `showPlatesButton` derived values (equipment includes "barbell" AND firstSetWeight > 0)
   - Added "Plates" button in header action row between Warmup button and ReplaceExerciseSheet — primary color (green/lime) to distinguish from warning-themed Warmup button. Uses existing `Dumbbell` icon (already imported).
   - Rendered `<PlateCalculatorSheet>` at component end (after `<WarmupSheet>`)

## Lint Result
- `bun run lint` → 17 problems (16 errors, 1 warning)
- ZERO of the 3 new/modified files appear in the lint error list (verified via grep — no matches)
- All errors are pre-existing in unrelated untouched files: AnatomyMap.tsx, ExerciseProgressChart.tsx, RestTimer.tsx (set-state-in-effect, pre-existing per PHASE-J), useVoiceCoach.ts (set-state-in-effect), BodyPage.tsx, ExercisesPage.tsx, StatsPage.tsx, regression.test.tsx
- Count discrepancy 16→17 is from useVoiceCoach.ts (pre-existing pattern, not introduced by this task)

## Dev Server
- Compiling cleanly (`✓ Compiled in 172ms`, etc.)
- GET / 200 responses normal
- "Failed to open DB: IndexedDB API missing" messages are the expected Dexie server-side no-op (pre-dates this task)

## UX Flow
1. User enters a weight on a barbell exercise's first set (e.g. 100kg on Bench Press)
2. "Plates" button (green/primary) appears next to the orange "Warmup" button in the exercise card header
3. Tap → bottom sheet slides up showing:
   - Total weight big number
   - Barbell visualization with colored plates stacked on each side of a gray bar
   - "Bar: 20kg · Per side: 40kg" label
   - Plate chip list: [25kg] [10kg] [5kg] (color-coded backgrounds)
   - "25kg + 10kg + 5kg per side" summary line
4. User can switch between 4 presets (Commercial Gym / Home Gym / Powerlifting / Women's Bar) — breakdown recomputes instantly
5. If target can't be hit exactly (e.g. 102.5kg on Home Gym preset with only 2.5kg plates), warning banner surfaces actual achievable weight + kg shortfall

## Visual Decisions
- Primary color (green/lime) for the Plates button vs Warning color (orange) for the Warmup button — clear visual distinction between two related-but-different actions
- Barbell visualization uses 3px-wide colored bars (h-10) — small enough to fit ~10 plates per side within the max-w-md sheet, large enough to be readable
- Plate chips use plateColor() as background — matches the visualization so users can visually correlate the chip with the barbell stack
- 5kg plate chip uses text-gray-800 (dark text on white background) — all other chips use text-white on saturated backgrounds
