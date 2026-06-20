# Code Review V3 — Pulse Fitness

**Reviewer:** Explore subagent
**Scope:** 12 pages, 11 components, 5 services, 4 stores, 1 entry file (33 files total)
**Method:** Static read-through of every file with focus on bugs, UX flows, incomplete features, accessibility, and performance.

---

## Critical Bugs (P0)

| # | File | Issue | Fix |
|---|------|-------|-----|
| P0-1 | `useSocialStore.ts:260-278` + `FeedPage.tsx:349-354` | `deletePost()` calls `DELETE /api/social/posts` — **route does not exist** in `src/app/api/social/` (only `comments/feed/follow/following/kudos/profile/search`). Always returns 404 → `throw new Error("Delete failed: 404")` → user sees "Failed to delete post." alert. Delete post feature is 100% broken. | Create `src/app/api/social/posts/route.ts` with DELETE handler that verifies `authorUid === callerUid` then deletes the FeedPost (and cascade comments via `comment.deleteMany`). |
| P0-2 | `notificationService.ts:132-133` | Icon path `/icons/icon-192.png` — **file does not exist**. Only `/pwa-192x192.png` exists in `public/`. Every notification shows a broken/missing icon. This is a regression of the previously-fixed bug from Task `PHASE-DEEPEN` (worklog line 102). | Change both `icon` and `badge` to `/pwa-192x192.png`. |
| P0-3 | `AuthPage.tsx:34-44, 162-169` | "Continue as Guest" calls `signInLocal("google.user@example.com")` — every guest user gets the **same UID** `local-user-googleuserexamplecom`. All guests share the same local data, social feed posts, and challenges. Also uses Google's trademarked "G" logo for a non-Guest button labeled "Continue as Guest" — brand/IP issue. | Generate a random UID per guest click (e.g. `local-guest-${uid()}`), remove the Google logo SVG, replace with a generic User icon. |
| P0-4 | `NutritionPage.tsx:429-458` | Water tracker droplet buttons (8 of them) have **no `onClick` handler**. Water count is auto-derived from calories via `Math.floor(totalCalories / 200)` — meaningless metric. The entire "Hydration" section is decorative — user cannot log water. | Add `waterIntake` state + `setWaterIntake(i+1)` onClick on each droplet. Persist to localStorage or Dexie. Decouple from calories. |
| P0-5 | `notificationService.ts:177-219` | `scheduleWorkoutReminders(daysPerWeek)` stores `daysPerWeek` in localStorage but **never uses it**. `checkWorkoutReminder()` has comment "we don't want to hit IndexedDB in an interval, for now, just send the reminder" — sends reminders regardless of whether user already worked out today. Whole feature is incomplete. | In `checkWorkoutReminder`, do a lightweight `db.workoutSessions.where('date').equals(todayKey).count()` check before sending. Apply `daysPerWeek` schedule (e.g. only send on planned workout days). |
| P0-6 | `FeedPage.tsx:258-268` | "Find" button in the Followed Users horizontal scroll is styled as `cursor-pointer` with hover state but **has no `onClick` handler**. Tapping it does nothing — dead-end for users trying to discover athletes. | Add `onClick={() => document.querySelector('input[type="text"]')?.focus()}` to scroll/focus the search bar. |
| P0-7 | `BodyPage.tsx:51-78` | `URL.createObjectURL(photo.imageBlob)` is called per photo, and the cleanup function returned from `loadData()` (line 72-74) is **never returned from the useEffect** (line 51-53 — `useEffect(() => { loadData(); }, [])`). Object URLs leak on every reload and every photo add/delete. Long-term users accumulate hundreds of leaked blob URLs. | Change to `useEffect(() => { return loadData(); }, [])` so cleanup runs on unmount. Also revoke previous URLs before creating new ones when `loadData()` re-runs after photo add/delete. |
| P0-8 | `useGeneratorStore.ts:118-124` | `swapExercise(index, newExercise)` does `newExercises[index] = newExercise` — replaces the **entire ProgramExercise** (with `sets`, `reps`, `restSeconds`, `tempo`, `role`, etc.) with a plain `Exercise` object. All progression data is destroyed. (Currently masked because `setRoutine` is never called — see I-2 — but the bug exists and will bite when the routine path is re-enabled.) | Mirror `swapProgramExercise` pattern: `newExercises[index] = { ...newExercises[index], exercise: newExercise }`. |

---

## High Priority Issues (P1)

| # | File | Issue | Fix |
|---|------|-------|-----|
| P1-1 | `OnboardingCarousel.tsx:309-315` | Enter-key handler on name input uses `document.querySelector("button:not([disabled])")` then `textContent?.includes("Start")` — fragile DOM lookup that could click the Skip button (also non-disabled, also visible in header). Anti-pattern. | Lift the start-button handler to a ref or pass `onSubmit` prop down to `NameStep` and call it directly. |
| P1-2 | `OnboardingCarousel.tsx:96-98, 105-111` | `handleSkip` calls `onComplete()` without first saving `userName` to localStorage. If user typed their name then hit Skip, the name is lost — they'll see "ATHLETE" until they re-onboard. | In `handleSkip`, if `userName.trim()` exists, save it before calling `onComplete`. |
| P1-3 | `GeneratorWizard.tsx:519-565` | Commitment Psychology section ("How long can you commit? 🎯" with 1 Month / 3 Months / 1 Year options) is **purely visual**. The buttons call `profile.updateProfile({ generatorSeed: profile.generatorSeed })` — a no-op. The selection is lost immediately. The comparison chart implies the user's choice matters. | Add a `commitmentMonths: 1 \| 3 \| 12` field to `GeneratorProfile`, store the selection, and use it in `generateProgram` (e.g. to ramp volume across weeks). |
| P1-4 | `GeneratorWizard.tsx:988`, `FeedPage.tsx:285` | `navigate({ to: "/#home" })` — `/#home` is not a valid route in `PATH_TO_ROUTE`. Falls back to `"home"` route silently (works by accident). URL/href is malformed. | Use `to: "/"` instead. |
| P1-5 | `GeneratorWizard.tsx:1057-1063` | Back button contains only an `<ArrowLeft>` icon via `icon` prop, with no text or `aria-label`. Screen readers announce nothing meaningful. | Add `aria-label="Back"` to the Button. |
| P1-6 | `ProfilePage.tsx:481-495` | "Progress Photos" menu item (label "Visual transformation") links to `/body`. There is no dedicated progress-photos route — BodyPage is a body-measurements page that happens to also have photos. Misleading navigation. | Either route to a hash like `/body#photos` and add scroll-into-view, or rename the menu item to "Body Metrics & Photos". |
| P1-7 | `ProfilePage.tsx:421-453` | `ACHIEVEMENTS.slice(0, 4)` renders only 4 of 15 achievements. Progress calculation only handles 5 specific IDs (`first_workout`, `100_workouts`, `3_day_streak`, `7_day_streak`, `10k_tonnage`). The other 10 badges always show `0/1` progress (even when unlocked) and aren't visible. | Render all 15 achievements in a 2-col grid with a "View All" expansion. Extend the `currentValue` switch to handle all 15 achievement IDs (`fortnight`, `iron_will`, `quarterback`, `powerlifter`, `legend`, `record_breaker`, `weekend_warrior`, etc.). |
| P1-8 | `WorkoutResultView.tsx:113-114` | `const profile = useGeneratorStore();` subscribes to the **entire** store (causes re-render on every state change including `generatorSeed` updates). Same issue line 114 with `useExerciseStore()` — subscribes to all 1324 exercises. | Use individual selectors: `useGeneratorStore((s) => s.program)`, `useGeneratorStore((s) => s.swapProgramExercise)`, etc. Use `useExerciseStore((s) => s.exercises)`. |
| P1-9 | `BuilderPage.tsx:323-326, 422-451` | `filteredExercises` doesn't slice/paginate — renders ALL matches (potentially 1324) inside the drawer's scrollable list. Initial open is janky on mobile. | Apply `filteredExercises.slice(0, 50)` and add infinite scroll, OR virtualize with `react-window`. |
| P1-10 | `ExercisesPage.tsx:239-242` | `visibleCount` resets only when `deferredQuery` changes — NOT when `filters.bodyPart` or `filters.equipment` change. After applying a filter that returns fewer results than current `visibleCount`, the page tries to render empty slots. After clearing a filter, the user sees only 30 results when there should be more. | Add `filters.bodyPart` and `filters.equipment` to the effect deps that reset `visibleCount`. |
| P1-11 | `BodyPage.tsx:102-122` | `handlePhotoUpload` accepts any `image/*` file with no size cap. Comment says "Create thumbnail" but stores the raw `file` blob directly. A 5MB phone photo bloats IndexedDB by 5MB per upload. No try/catch — upload errors hang the UI. | Add size cap (e.g. 10MB), create a downscaled thumbnail (256×256 JPEG) via canvas (mirror `avatarService.resizeImage`), wrap in try/catch with toast. |
| P1-12 | `BodyPage.tsx:81-99` | `handleSubmit` does `await db.bodyMeasurements.add(measurement)` with no try/catch. If Dexie fails (quota exceeded, etc.), the form modal stays open and the user has no feedback. | Wrap in try/catch, show toast on error, close modal only on success. |
| P1-13 | `StatsPage.tsx:14-20` | Imports `RadarChart`, `PolarGrid`, `PolarAngleAxis`, `PolarRadiusAxis`, `Radar`, `Cell` from recharts — **none are used** (radar was replaced by `MuscleVolumeMap`). Also `ChevronRight` (line 30) imported but unused. Bundle bloat. | Remove the unused imports. Also remove the dead `radarData` and `imbalanceMuscle` useMemo (lines 148-163) — computed but never rendered. |
| P1-14 | `SettingsPage.tsx:258-270, 372-386, 410-422, 448-466` | Toggle buttons (Ramadan, Notifications, Sound, Voice Coach) lack `role="switch"` and `aria-checked`. Screen readers won't announce the toggle state. | Add `role="switch"`, `aria-checked={isEnabled}`, and `aria-label="..."` to each toggle button. |
| P1-15 | `SettingsPage.tsx:664-684` | "About" card is styled as `cursor-pointer` with hover ring but has **no `onClick` handler** — dead-end. | Either remove the pointer/hover styling or wire to an About modal/route. |
| P1-16 | `useSocialStore.ts:166-182` | `giveKudos(postId)` always increments `kudosCount + 1` and POSTs to `/api/social/kudos`. No toggle — user can spam-click and inflate kudos infinitely. Backend (per Task API-1) just does an atomic increment with no per-user tracking. | Track `kudosByMe: Set<string>` in the store, gate the increment on `!kudosByMe.has(postId)`, add a `DELETE /api/social/kudos` route to decrement. |
| P1-17 | `WorkoutResultView.tsx:351-357` | Exercise card image: `<img src={item.exercise.gifUrl}>` with `mix-blend-multiply` on white bg. No `onError` fallback. If `gifUrl` is empty or 404, broken-image icon shows. `mix-blend-multiply` also produces wrong colors for non-white-background GIFs. | Add `onError` handler that hides the img and shows a Dumbbell fallback (mirror `ExerciseImage` in `ExercisesPage.tsx`). Drop `mix-blend-multiply` or wrap in conditional. |
| P1-18 | `ProfilePage.tsx:131-134` | `handleLogout` manually does `localStorage.removeItem("local_user")` and `useAuthStore.getState().setUser(null)`. Doesn't clear `pulse_user_name`, `pulse_user_avatar`, social feed state, or challenges participation. Next login by a different user inherits the previous user's name/avatar. | Add a `logout()` action to `useAuthStore` that clears all user-specific localStorage keys + calls `useSocialStore.getState().clearState()` + resets generator profile. |
| P1-19 | `ProfilePage.tsx:93-115` | `handleFreezeStreak` doesn't check if a freeze was already used today. User can spam-click "Freeze" and add N dummy sessions, polluting streak history and Recent Activity. | Check `db.workoutSessions.where('date').equals(todayKey).filter(s => s.isFreeze).count() > 0` before adding. |
| P1-20 | `WorkoutSessionPage.tsx:337-339` | `aria-valuenow={(totalCompleted / totalSets) * 100}` — when `totalSets === 0` (empty workout), this evaluates to `NaN`, which is invalid ARIA. | Default to `0`: `aria-valuenow={totalSets > 0 ? (totalCompleted / totalSets) * 100 : 0}`. |
| P1-21 | `WorkoutSessionPage.tsx:405-412, 463-465` | Uses a local `cn_` function (defined at file bottom) instead of `cn` from `@/utils/cn`. Inconsistent with rest of codebase; doesn't handle Tailwind merge conflicts. | Replace `cn_` calls with `cn` from `@/utils/cn` and delete the local function. |
| P1-22 | `WorkoutResultView.tsx:39-41`, `GeneratorWizard.tsx:32-34` | Both files define local `cn` functions (`classes.filter(Boolean).join(" ")`) instead of importing `@/utils/cn`. Doesn't handle Tailwind class conflicts. | Replace with `import { cn } from "@/utils/cn"`. |
| P1-23 | `OnboardingCarousel.tsx:90` | `localStorage.setItem("pulse_user_name", trimmed)` has no try/catch. If localStorage is full (quota exceeded — possible because `useGeneratorStore` persists entire programs), throws uncaught and onboarding never completes. | Wrap in try/catch; fall back to in-memory state. |
| P1-24 | `useGeneratorStore.ts:90-147` | `persist` middleware (Zustand) serializes the **entire** store — including `program` (full multi-week program with all exercises, instructions, image URLs) — to localStorage under key `pulse-generator`. Long-term users will exceed the 5MB localStorage quota, causing `setItem` to throw. | Use `partialize` to persist only the profile fields (not `program` / `routine`): `partialize: (s) => ({ ...s, program: null, routine: null })`. |

---

## Medium Priority Issues (P2)

| # | File | Issue | Fix |
|---|------|-------|-----|
| P2-1 | `HomePage.tsx:158-165` | `handleStartQuickWorkout` is defined but **never called** anywhere in the JSX. Dead code. | Remove the function or wire it to a "Quick Start" button. |
| P2-2 | `HomePage.tsx:178-183` | Hero card uses hardcoded `from-[#050505]` and `via-[#050505]/80` — pure black. In light mode the gradient looks broken (black overlay on light theme). | Use theme tokens: `from-bg`, `via-bg/80`. |
| P2-3 | `HomePage.tsx:150-156` | `userName` is wrapped in `useMemo([user])` but reads `localStorage.getItem("pulse_user_name")`. If user updates their name in Settings (which doesn't exist — see U-2), the memo won't recompute. Stale name displayed. | Subscribe to a `pulse-user-name-updated` custom event (mirror the Avatar pattern). |
| P2-4 | `HomePage.tsx:560-573` | "Add to My Routines" button calls `saveRoutine(...)` but provides **no toast feedback**. User has no idea if it worked. | Wrap in try/catch and `useToastStore.getState().addToast("success", "Added to your routines!")`. |
| P2-5 | `ExercisesPage.tsx:122` | `const { t, i18n } = useTranslation();` — `i18n` is destructured but never used. | Remove `i18n` from destructure. |
| P2-6 | `BuilderPage.tsx:64, 283` | `i18n` destructured but unused in both `SortableExerciseItem` and `BuilderPage`. | Remove from destructure. |
| P2-7 | `SettingsPage.tsx:50` | `const { t, i18n } = useTranslation();` — `i18n` unused. | Remove `i18n`. |
| P2-8 | `WorkoutResultView.tsx:175` | `profile.swapExercise(idx, { ...profile.routine!.exercises[idx], exercise: nextEx })` — passes a ProgramExercise-shaped object where the store expects an `Exercise`. Type unsafe. (Dead code path — see I-2.) | When re-enabling the routine path, fix the store signature (see P0-8). |
| P2-9 | `WorkoutResultView.tsx:189-199, 337-348` | Uses `any[]` for `rawSessions` and dynamic `import("@/db")` inside `handleRegenerate`. Should be a static top-level import (db is already used elsewhere). | `import { db } from "@/db"` at top of file; type as `WorkoutSession[]`. |
| P2-10 | `WorkoutResultView.tsx:411-416, 428-432` | Uses `(item as Record<string, unknown>).tempo as string` and `.note as string` — type-unsafe casting. The `ProgramExercise` type already has `tempo?` and `note?`. | Use direct property access: `item.tempo`, `item.note`. |
| P2-11 | `RestTimer.tsx:83-87` | 15-second warning effect fires whenever `seconds === 15`. If user manually adds time via presets (e.g. +30s while at 14), the timer crosses 15 again → voice coach fires twice. No ref guard. | Add a `fifteenSecAnnouncedRef` that's reset on `restTimerActive` change. |
| P2-12 | `RestTimer.tsx:67-78` | Completion effect (sound + voice + notification + dismiss) fires when `seconds === 0`. If `dismissRestTimer()` doesn't synchronously set `restTimerActive=false` before the next render, the effect could re-fire (sound plays twice). | Add a `completionFiredRef` guard. |
| P2-13 | `StatsPage.tsx:139-145` | `weeklyChange` returns `0` when previous week volume was 0 but current is non-zero. Misleading — user sees "0%" when it should be "new" or "+∞". | Return `null` when `prev === 0` and `last > 0`, render as "NEW" badge. |
| P2-14 | `FeedPage.tsx:97-100` | `formatVolume` returns raw integer for values < 1000. For "0" returns `"0"` (no unit). Inconsistent with `HomePage.formatVolume` which uses different rounding. | Unify into a shared util `formatVolume` in `@/utils/format.ts`. |
| P2-15 | `ExerciseWorkoutCard.tsx:174-181` | `<img onError={(e) => (e.target as HTMLImageElement).style.display = "none"}>` permanently hides the image on error. If the URL is temporarily unavailable (network blip), the user is stuck with only the fallback dumbbell icon for the rest of the session. No retry. | Add an `imgError` state, render fallback conditionally, allow retry on re-focus. |
| P2-16 | `SetRow.tsx:9-20` | `exerciseIndex` prop is declared but **never used** in the component (only `setIndex` is). | Remove `exerciseIndex` from props. |
| P2-17 | `KineticEmptyState.tsx:400-411` | CTA button only renders when `actionLabel && onAction` are BOTH truthy. If only `actionLabel` is passed (no onAction), no button — silent. Either accept that or warn. | Either render a disabled button or `console.warn` when `actionLabel` exists without `onAction`. |
| P2-18 | `Avatar.tsx:51-56` | `<img src={avatarUrl}>` has no `onError` fallback. If the data URL is malformed or image fails to decode, broken-image icon shows (instead of falling back to User icon). | Add `onError` that sets `avatarUrl=null` to trigger the User-icon fallback. |
| P2-19 | `RecoveryHeatmap.tsx:16` | `const { exercises } = useExerciseStore();` subscribes to the entire store (all 1324 exercises) — re-renders on any store change. | Use `useExerciseStore((s) => s.exercises)`. |
| P2-20 | `useWorkoutStore.ts:233-257` | `startWorkout` iterates `exercisesOrIds` and `await`s `buildExerciseItem` **sequentially** — for a 6-exercise workout with 6 IndexedDB lookups, takes ~600ms. Noticeable lag on "Start Workout". | `Promise.all(exercisesOrIds.map(...))` for parallel builds. |
| P2-21 | `GeneratorWizard.tsx:160` | `const profile = useGeneratorStore();` subscribes to the entire store. Re-renders on every `updateProfile` and `generatorSeed` change. | Use individual selectors for each field used. |
| P2-22 | `useWorkoutStore.ts:460-462` | `recordFeedbackFromSession(session).catch(...)` is fire-and-forget. If it fails (Dexie error, schema mismatch), learning-loop data is silently lost. | Log to analytics, retry once, or surface a non-blocking warning. |
| P2-23 | `notificationService.ts:182-191` | `setInterval(checkWorkoutReminder, 60 * 60 * 1000)` runs forever once started. No cleanup when user disables notifications or logs out. The `__pulseNotifInterval` window global is the only handle — never cleared on logout. | Export a `stopNotificationService()` that clears the interval, call it from `useAuthStore` logout. |
| P2-24 | `WorkoutSessionPage.tsx:107-111` | Redirect effect fires when `!activeWorkout && !showShareCard`. After `finishWorkout` completes, `activeWorkout` becomes null and `showShareCard` is true → no redirect. But the timer between `setShowShareCard(true)` and the share-card render (1500ms delay on line 260-263) is a window where `activeWorkout` is null AND `showShareCard` is still false → redirect fires → share card never shows. | Set `showShareCard=true` BEFORE `finishWorkout()` clears `activeWorkout`, or gate the redirect effect to also check `isFinishing`. |
| P2-25 | `WorkoutResultView.tsx:164-180` | `handleShuffle` — if `alts.find(...)` returns undefined (all alternatives already in routine), the function silently does nothing. No toast, no visual feedback. User thinks the button is broken. | Show a toast: "No alternatives available — try removing an exercise first." |

---

## UX Issues

| # | File | Issue |
|---|------|-------|
| U-1 | `HomePage.tsx:158-165` | `handleStartQuickWorkout` would create an empty workout (no exercises) with no UI to add exercises mid-session. Dead-end. (Function is dead code — see P2-1.) |
| U-2 | `SettingsPage.tsx` | No "Edit Name" option. User can only set name during onboarding. To change name, must clear localStorage and re-onboard. |
| U-3 | `NutritionPage.tsx:213-232` | Date picker has prev/next arrows but no "Today" button. User who navigates back several days has to click next repeatedly to return. |
| U-4 | `NutritionPage.tsx:147-148` | User can navigate to future days (tomorrow, next week) where no entries exist. No "future" indicator. Confusing — should be disabled or show "Future date" badge. |
| U-5 | `ProfilePage.tsx:481-495` | "Progress Photos" menu item routes to `/body` — misleading. Implies a dedicated photos page. |
| U-6 | `ProfilePage.tsx:421` | Only 4 of 15 achievements visible. No "View All" expansion. User can never see 11 of their badges. |
| U-7 | `FeedPage.tsx:183-191` | Search input has no clear (X) button. User must manually delete text to clear results. |
| U-8 | `RestTimer.tsx:189-195` | Dismiss button is `h-11 w-11` (44px) — adequate, but visually small relative to the timer text. Could be larger for touch. |
| U-9 | `WorkoutSessionPage.tsx:400-432` | Finish button is disabled when `totalCompleted === 0` but no tooltip explains why. User might think the app is broken. |
| U-10 | `GeneratorWizard.tsx:519-565` | Commitment psychology chart (Weeks vs 3 Months) implies the user's choice matters — but the buttons are no-ops (see P1-3). Misleading. |
| U-11 | `useWorkoutStore.ts:366-368, 484-486` | Haptics only on set completion and new PR. No haptics on workout start/finish, achievement unlock, navigation. Inconsistent. |
| U-12 | `BodyPage.tsx:412-508` | Add-measurement modal has no focus trap. Tab key moves focus to elements behind the modal. |
| U-13 | `AvatarUploadSheet.tsx:57-177` | Sheet doesn't disable background scroll. Body behind can still scroll while sheet is open. |
| U-14 | `OnboardingCarousel.tsx:309-315` | Enter-key on name input uses `querySelector` to find a button — brittle. (See P1-1.) |
| U-15 | `FeedPage.tsx:296-304` | Initial feed load shows 3 skeleton cards but no spinner or "Loading feed..." text. Looks broken if API is slow. |
| U-16 | `ExercisesPage.tsx:359-404` | Filter chips don't show active count. When multiple body parts + equipment are selected, no aggregate "3 filters active" indicator. |
| U-17 | `StatsPage.tsx:389-396` | Weekly change indicator shows only "+25%" — no absolute value (e.g. "+1,250kg"). User can't tell if it's a small or large absolute change. |
| U-18 | `FeedPage.tsx:240-271` | "Following" horizontal scroll shows ONLY the "Find" button — none of the actually-followed users! The `following.map(...)` is missing. The section is essentially decorative. |
| U-19 | `WorkoutResultView.tsx:498-544` | "Save" button only shows a toast — no visual confirmation on the button itself (e.g. "Saved ✓"). |
| U-20 | `BodyPage.tsx:132-139` | Weight chart only shows last 30 measurements. Long-term users can't see full history. No "View All" option. |
| U-21 | `NutritionPage.tsx:460-470` | Floating "Quick Add" button is `fixed bottom-24` — on mobile it may overlap the bottom nav (also at `bottom-0` / `bottom-16`). Z-index conflicts. |
| U-22 | `HomePage.tsx:225-258` | "Newly Unlocked" achievement toast only shows `slice(0, 2)` — if 3+ achievements unlock at once, the user misses the rest. No "view all" link. |
| U-23 | `ProfilePage.tsx:204-212` | Email display shows `user?.email || "guest@pulse.fitness"` — for guest users (P0-3), this is misleading (they're not really at pulse.fitness). |
| U-24 | `AuthPage.tsx:106-108` | "Offline-first mode" banner text is technical and confusing for non-technical users. Doesn't explain what "syncs to the cloud feed" means. |

---

## Incomplete Features

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| I-1 | **Push Notification System** (`notificationService.ts`) | 🟡 Partial | `scheduleWorkoutReminders` stores `daysPerWeek` but ignores it. `checkWorkoutReminder` doesn't check if user worked out today (admits in comment). `deload_reminder` and `streak_warning` templates exist but are never triggered. No cleanup on logout. |
| I-2 | **`WorkoutRoutine` type + `routine` store state + `setRoutine` action** | 🔴 Dead | `setRoutine` is defined in `useGeneratorStore` (line 115) but **never called** from anywhere in the codebase. `WorkoutResultView` has a `hasRoutine` branch (lines 127, 133, 175) that is unreachable. `swapExercise` (P0-8) is similarly dead. Should be deleted or wired up. |
| I-3 | **Learning Loop integration** (`learningLoop.ts`) | 🟡 Partial | Recording works (`recordSkip`, `recordSwap`, `recordCompletion` via `recordFeedbackFromSession`). But `recordFeedbackFromSession` is fire-and-forget with `.catch(console.warn)` — silent data loss on failure. No UI to view preferences or loved/disliked exercises. |
| I-4 | **Commitment Duration** (`GeneratorWizard.tsx:519-565`) | 🔴 Visual-only | UI exists for "1 Month / 3 Months / 1 Year" selection, but no `commitmentMonths` field in `GeneratorProfile` and no effect on `generateProgram`. |
| I-5 | **Edit Profile / Name** | 🔴 Missing | User can set name only during onboarding. Settings page has no edit-name option. |
| I-6 | **Edit Bio / Email / Display Picture URL** | 🔴 Missing | `AvatarUploadSheet` handles photo, but no UI to edit displayName/email. ProfilePage shows these as read-only. |
| I-7 | **Rest Timer "Add Time" Buttons** | 🟡 Works but unguarded | `handlePreset(delta)` works, but `+30s`/`+60s` buttons have no upper cap. User could inflate rest to hours. |
| I-8 | **Achievement detail view** | 🔴 Missing | ProfilePage shows badge icons but no detail modal. Tapping a badge does nothing. |
| I-9 | **`followed users` horizontal scroll in FeedPage** | 🔴 Broken | Section shows only the "Find" button — the `following.map(...)` to render followed-user avatars is **missing entirely**. Users see an empty horizontal scroll with one Find button. |
| I-10 | **Voice Coach test phrase** | 🟡 Limited | Settings has "Test Voice" button but only plays one hard-coded phrase. No way to test specific cues (set_complete, new_pr, rest_complete, etc.). |
| I-11 | **Challenges leaderboard view** | 🟡 Untested | API exists (`/api/challenges/[id]/leaderboard`) but I didn't see it consumed in the reviewed files. May exist in `ChallengesPage` (not in review scope). |
| I-12 | **Workout session resume after refresh** | 🔴 Missing | `activeWorkout` is in-memory only (no persist middleware on `useWorkoutStore`). Refreshing the page mid-workout loses all progress. The redirect effect at `WorkoutSessionPage.tsx:107-111` immediately navigates home. |
| I-13 | **`deletePost` server route** | 🔴 Missing | Client calls `DELETE /api/social/posts` but no such route exists (see P0-1). |
| I-14 | **Kudos toggle (unlike)** | 🔴 Missing | `giveKudos` only increments. No way to unlike. |
| I-15 | **Search exercises by muscle/equipment in BuilderPage drawer** | 🔴 Missing | Drawer search only filters by name (line 323-326). No filter chips like ExercisesPage has. |
| I-16 | **PR history / progression chart per exercise** | 🟡 Partial | `ExerciseProgressChart` exists but I didn't see it deep-link from PR cards on StatsPage. Tapping a PR does nothing. |

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| **Total files reviewed** | 33 (12 pages + 11 components + 5 services + 4 stores + 1 entry) |
| **Critical bugs (P0)** | 8 |
| **High priority (P1)** | 24 |
| **Medium priority (P2)** | 25 |
| **UX issues** | 24 |
| **Incomplete features** | 16 |
| **Total findings** | **97** |

---

## Top 5 Critical Issues (Must-Fix Before Production)

1. **P0-1: `deletePost` calls non-existent API route** — `DELETE /api/social/posts` returns 404 every time. Feature is 100% broken.
2. **P0-3: All "Continue as Guest" users share the same UID** — massive data collision risk; any guest can see/modify another guest's data.
3. **P0-4: Water tracker is non-functional** — 8 droplet buttons have no onClick; water intake is faked from calories.
4. **P0-7: BodyPage leaks object URLs** — every progress photo upload creates a blob URL that's never revoked. Long-term memory leak.
5. **P0-2: Notification icon path 404** — regression of a previously-fixed bug. Every notification shows a broken icon.

## Features That Are Incomplete

1. **Push notification system** (`notificationService.ts`) — `daysPerWeek` ignored, "already worked out today" check skipped, `deload_reminder`/`streak_warning` templates never used.
2. **WorkoutRoutine / setRoutine / swapExercise** — entire code path is dead. Either wire it up or delete it.
3. **Commitment Duration in wizard** — UI exists but selection is discarded.
4. **Followed Users horizontal scroll** (FeedPage) — only renders the "Find" button; the actual user avatars are missing.
5. **Achievement system** — only 4 of 15 badges visible on ProfilePage; progress calculation only handles 5 IDs.
6. **Edit Profile** — no UI to change name/email/displayName post-onboarding.
7. **Kudos toggle** — can only like, never unlike.
8. **Resume workout after refresh** — `activeWorkout` not persisted; refresh = lost progress.
9. **Notification interval cleanup** — `setInterval` runs forever; not cleared on logout.

---

## Recommended Fix Order

1. **P0-1, P0-3, P0-7** — data-loss / data-collision bugs (highest user impact).
2. **P0-2, P0-4, P0-5, P0-6** — broken UI features users will encounter immediately.
3. **P0-8, P1-8, P1-21, P1-22** — code-quality fixes that unblock future work.
4. **P1-1, P1-2, P1-3, P1-7** — onboarding/wizard/profile UX bugs.
5. **P1-13, P1-15, P1-18, P1-19, P1-20** — accessibility + state-cleanup.
6. **P1-9, P1-10, P1-11, P1-12** — performance + data-validation on Body/Builder.
7. **P1-16, P1-17** — social feed bugs (kudos spam, broken images).
8. **P2-* and U-*** — incremental polish.
9. **I-*** — wire up incomplete features in priority order.
