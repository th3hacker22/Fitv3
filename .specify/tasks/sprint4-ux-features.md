# Tasks: Sprint 4 UX Polish & Features

**Input**: Plan from `.specify/plans/sprint4-ux-features.md`

## S4-T01: Forgot Password Flow on AuthPage
**File**: `src/pages/AuthPage.tsx`
- Import `sendPasswordResetEmail` from `firebase/auth`
- Add `showResetPassword` state + `resetLoading` state
- Add `handleSendResetEmail` function
- Render reset form when `showResetPassword` is true
- Add "Forgot Password?" link below password field (login mode only)

## S4-T02: Empty States on HomePage
**File**: `src/pages/HomePage.tsx`
- Import `KineticEmptyState`
- Replace routines empty `: (false branch)` with `<KineticEmptyState variant="routines" ...>`
- Replace recentWorkouts empty `: (false branch)` with `<KineticEmptyState variant="workouts" ...>`

## S4-T03: Skeleton Loaders
**Files**: `src/components/workout/GeneratorWizard.tsx`, `src/pages/FeedPage.tsx`
- GeneratorWizard: skeleton exercise rows when `isGenerating`
- FeedPage: skeleton post cards when `isLoading && feed.length === 0`

## S4-T04: Mobile UX Fixes
**Files**: `src/pages/AuthPage.tsx`, `src/pages/WorkoutResultView.tsx`
- AuthPage: `scrollIntoView` on input focus + min-h-[44px] on text links
- WorkoutResultView: safe-area insets on share card

## S4-T05: Verify + Commit
- `npx tsc --noEmit` (≤ 24 errors)
- `npx eslint .` (0 errors / 95 warnings)
- Commit on `chore/sprint4-ux-features`
