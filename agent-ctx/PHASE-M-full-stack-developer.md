# PHASE-M — Voice Coach (TTS via Web Speech API)

## Task
Build a Voice Coach that uses the browser's SpeechSynthesis API to announce:
1. Rest timer completion → "Rest complete! Let's go!"
2. New PR detected → "New personal record! Amazing!"
3. Set completion → "Nice work! Set complete."
4. Workout midpoint → "Halfway there! Keep pushing!"
5. Workout completion → "Workout complete! Amazing session!"

Plus a toggle + voice picker in Settings, all client-side and offline.

## Context loaded from previous agents
- PHASE-K (worklog.md) shipped progressive-overload chips + deload banner. Lint baseline
  at that point: 16 problems (15 errors + 1 warning), all pre-existing.
- The existing `src/utils/audio.ts` shows the project pattern for client-side audio:
  a singleton AudioContext + `playTone()` helper gated on `useSettingsStore.soundEnabled`.
- `src/components/workout/RestTimer.tsx` already had a seconds===0 completion effect
  playing `playTimerCompleteSound()` + sending a notification. Cleanly extended.
- `src/store/useWorkoutStore.ts` had the `newPrCount++` block inside `finishWorkout`
  (with haptic + toast already wired) — natural place to drop `voiceCoach.speak("new_pr")`.
- `src/pages/WorkoutSessionPage.tsx` had a `confirmFinish` handler that fires confetti
  then `await finishWorkout(...)` — placed the closing announcement right after that.
- `src/pages/SettingsPage.tsx` already used the same icon-badge + toggle pattern for
  Sounds/Notifications/Ramadan — the new Voice Coach section follows that exact shape.

## Files created
1. `src/services/voiceCoach.ts` — singleton `VoiceCoach` class.
   - 8 phrase buckets, each with 2-3 random variations for freshness.
   - `speak(phrase)` is throttled to one call per 2s (no overlap).
   - `speakText(text)` bypasses the throttle for one-off dynamic phrases.
   - `setEnabled(false)` cancels any in-flight speech.
   - Auto-picks a voice: Google US English → en-US → any en → first available.
   - `getAvailableVoices()` filters to English voices only.
   - All window access guarded by `typeof window !== "undefined"` (SSR-safe).

2. `src/hooks/useVoiceCoach.ts` — React hook.
   - Lazy `useState(() => readFromLocalStorage())` initializers — no setState-in-effect.
   - Subscribes to `speechSynthesis.addEventListener("voiceschanged", ...)` for Chrome's
     late-loading voices, plus a 5s polling fallback.
   - Returns `{ enabled, toggle, voices, selectedVoiceURI, selectVoice, isSupported }`.
   - Persists preferences to `pulse_voice_coach_enabled` + `pulse_voice_coach_voice`
     localStorage keys.

## Files modified
3. `src/components/workout/RestTimer.tsx`
   - Added `import { voiceCoach } from "@/services/voiceCoach"`.
   - In the seconds===0 effect: `voiceCoach.speak("rest_complete")` after
     `playTimerCompleteSound()`, before the notification dispatch.
   - New effect: fires `voiceCoach.speak("rest_15s_left")` when
     `restTimerActive && seconds === 15 && suggestedSeconds > 30`. The `> 30`
     guard prevents the 15s warning from overlapping the final countdown of
     a short 30s rest (where 15s is right at the midpoint).

4. `src/store/useWorkoutStore.ts`
   - Added `import { voiceCoach } from "@/services/voiceCoach"`.
   - In `toggleSetComplete`, after `set({...})`, when `willActivate` is true:
     `voiceCoach.speak("set_complete")`. Skipped on un-complete.
   - In `finishWorkout`, inside the `if (sessionMax1RM > prior)` block (where
     `newPrCount++` lives), next to the haptic + toast: `voiceCoach.speak("new_pr")`.

5. `src/pages/WorkoutSessionPage.tsx`
   - Added `useRef` to the existing React import + `import { voiceCoach }`.
   - Added `halfwayAnnouncedRef = useRef(false)` + a useEffect that fires
     `voiceCoach.speak("halfway")` exactly once when `completed >= ceil(totalSets / 2)`.
     Skipped for workouts with <4 sets (no meaningful "halfway" in a 3-set session).
     Hook is declared BEFORE the early returns so it obeys rules-of-hooks.
   - In `confirmFinish`, after `await finishWorkout(shareToFeed)` + sound:
     `voiceCoach.speakText("Workout complete! Amazing session!")`. Uses `speakText`
     (not `speak`) to bypass the 2s throttle — otherwise the closing message would
     be silently dropped right after a new-PR announcement.

6. `src/pages/SettingsPage.tsx`
   - Imported `Mic`, `Play` from lucide-react; `useVoiceCoach` + `voiceCoach` singleton.
   - New "Voice Coach 🎙️" section between Sounds and Cloud Sync (same card pattern):
     * Mic icon badge + title + description + toggle switch.
     * Toggle disabled + greyed when `!isSupported`, with a danger-tinted notice
       telling the user to try Chrome/Edge/Safari.
     * When enabled, an animated `<motion.div>` panel expands containing:
       - Voice `<select>` dropdown (filtered to English voices, "Loading voices…"
         placeholder while the browser populates them async).
       - "Test Voice" outline button → `voiceCoach.speakText("That's how I sound. Let's get to work!")`.
       - "Stop" ghost button → `voiceCoach.stop()` + toast.
       - Info-icon note: "Uses your device's built-in speech engine. Works offline.
         Cues fire on rest completion, new PRs, set completion, the halfway mark,
         and workout completion."

## Lint iteration
- First pass introduced `react-hooks/set-state-in-effect` errors in
  `useVoiceCoach.ts` (calling `setEnabled/setSelectedVoiceURI/setVoices` directly
  inside the mount useEffect).
- Refactored to lazy `useState(() => readFromLocalStorage())` initializers — the
  initial React state now reads from localStorage on first render, so the effect
  body only needs to push that state into the singleton (no setState).
- For voices, subscribed to `speechSynthesis.addEventListener("voiceschanged", ...)`
  instead of polling-with-setState. setState now happens only in async event
  handler callbacks, which the React Compiler accepts.
- Removed an unused `eslint-disable-next-line react-hooks/exhaustive-deps` that lint
  flagged as a warning.

## Lint result
- `bun run lint` final: 16 problems (15 errors + 1 warning) — IDENTICAL to the
  PHASE-K baseline. Zero new issues introduced by PHASE-M.
- All remaining issues are in files I didn't author or touch the relevant lines of:
  - `AnatomyMap.tsx` (preserve-manual-memoization ×9 — pre-existing)
  - `__tests__/regression.test.tsx` (no-require-imports ×2 — pre-existing)
  - `stats/ExerciseProgressChart.tsx` (set-state-in-effect — pre-existing)
  - `RestTimer.tsx:48` (set-state-in-effect — the existing reset-on-activate
    effect, not my new lines)
  - `BodyPage.tsx` (access-before-declared — pre-existing)
  - `ExercisesPage.tsx` (set-state-in-effect ×2 — pre-existing)
  - `StatsPage.tsx:146` (unused eslint-disable — pre-existing)
  - `WorkoutSessionPage.tsx:127,150,159` (rules-of-hooks + unused-disable —
    these come from the PHASE-L "PR Celebration" feature that another agent
    shipped after PHASE-K, NOT from my changes. My new useEffect is at line 82,
    BEFORE the early return on line 102.)

## Dev server
- `dev.log` tail: clean compilation (`✓ Compiled in 136ms`), GET / 200 responses
  normal. The "Failed to open DB: IndexedDB API missing" message is the expected
  Dexie server-side no-op that pre-dates this task. No warnings or errors about
  the new files.

## Files modified
- `/home/z/my-project/src/services/voiceCoach.ts` (created)
- `/home/z/my-project/src/hooks/useVoiceCoach.ts` (created)
- `/home/z/my-project/src/components/workout/RestTimer.tsx` (modified)
- `/home/z/my-project/src/store/useWorkoutStore.ts` (modified)
- `/home/z/my-project/src/pages/WorkoutSessionPage.tsx` (modified)
- `/home/z/my-project/src/pages/SettingsPage.tsx` (modified)
