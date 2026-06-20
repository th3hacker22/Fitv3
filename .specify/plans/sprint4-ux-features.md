# Implementation Plan: Sprint 4 UX Polish & Features

**Branch**: `chore/sprint4-ux-features` | **Date**: 2026-06-20 | **Spec**: [sprint4-ux-features.md](../specs/sprint4-ux-features.md)

## Summary

4 phases: (1) Forgot Password on AuthPage; (2) Empty states on HomePage; (3) Skeleton loaders; (4) Mobile UX fixes. All use existing components — no new dependencies.

## Technical Context
- **Language**: TypeScript 5 (strict), Next.js 16, React 19
- **Existing components**: `KineticEmptyState`, `Skeleton`, `Button`, `skeleton-shimmer` CSS
- **Firebase**: `sendPasswordResetEmail` from `firebase/auth`
- **CSS**: `env(safe-area-inset-*)` + `viewportFit: "cover"` already set
- **Constraints**: No `any`, no `ignoreBuildErrors`, tsc ≤24, lint 0/95

## Files to Modify

```
src/pages/AuthPage.tsx                    # Forgot Password flow + input scrollIntoView
src/pages/HomePage.tsx                    # Wire KineticEmptyState into 2 sections
src/components/workout/GeneratorWizard.tsx # Skeleton during isGenerating
src/pages/FeedPage.tsx                    # Skeleton post cards during isLoading
src/pages/WorkoutResultView.tsx           # Safe-area insets on share card
```

## Phases

### Phase 1: Forgot Password (FR-001..007)
**File**: `src/pages/AuthPage.tsx`
- Import `sendPasswordResetEmail` from `firebase/auth`
- Add `showResetPassword` state (boolean)
- Add `handleSendResetEmail` function: validate email, call `sendPasswordResetEmail`, toast on success/error
- When `showResetPassword === true`: render reset form (email input + "Send Reset Link" button + "Back to Login" link) instead of login form
- Add "Forgot Password?" link below password field (only when `isLogin && !showResetPassword`)
- Success: set toast "Password reset email sent!" + `setTimeout(() => setShowResetPassword(false), 2000)`

### Phase 2: Empty States (FR-008..010)
**File**: `src/pages/HomePage.tsx`
- Import `KineticEmptyState` from `@/components/ui-custom/KineticEmptyState`
- Routines section: replace the `: (false branch)` content with `<KineticEmptyState variant="routines" actionLabel="Create Routine" onAction={() => navigate({ to: "/builder" })} />`
- Recent Activity section: replace the `: (false branch)` content with `<KineticEmptyState variant="workouts" actionLabel="Start Workout" onAction={handleStartQuickWorkout} />`

### Phase 3: Skeleton Loaders (FR-011..013)
**File**: `src/components/workout/GeneratorWizard.tsx`
- Import `Skeleton` from `@/components/ui-custom/Skeleton`
- When `isGenerating`: render a skeleton workout card (skeleton title + 4-6 skeleton exercise rows + skeleton button) instead of bare spinner

**File**: `src/pages/FeedPage.tsx`
- When `isLoading && feed.length === 0`: render 3-5 skeleton post cards (skeleton avatar circle + skeleton text bars + skeleton action bar)

### Phase 4: Mobile UX (FR-014..017)
**File**: `src/pages/AuthPage.tsx`
- Add `onFocus={(e) => e.target.scrollIntoView({ block: "center", behavior: "smooth" })}` to email + password inputs

**File**: `src/pages/WorkoutResultView.tsx`
- Add `pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]` to the sticky share card (line ~456)

**File**: `src/pages/AuthPage.tsx` (touch targets)
- Add `min-h-[44px] py-2` to "Forgot Password?" link and "Sign up"/"Login" toggle

## Execution Sequence
```
Phase 1 (AuthPage) → Phase 2 (HomePage) → Phase 3 (Skeletons) → Phase 4 (Mobile UX) → Verify (tsc + lint) → Commit
```

## Verification
| Step | Command | Expected |
|------|---------|----------|
| 1 | `npx tsc --noEmit` | ≤ 24 errors |
| 2 | `npx eslint .` | 0 errors / 95 warnings |
| 3 | Agent Browser | All 4 flows work |
