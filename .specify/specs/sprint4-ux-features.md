# Feature Specification: Sprint 4 UX Polish & Features

**Feature Branch**: `chore/sprint4-ux-features`

**Created**: 2026-06-20 | **Status**: Draft

## Context

Four UX polish items: (1) Forgot Password flow on AuthPage; (2) Premium empty states on HomePage; (3) Skeleton loaders for AI Generator + Feed; (4) Mobile UX audit (keyboard, notch, touch targets).

## User Stories

### US1 — Forgot Password Flow (P1)
"Forgot Password?" link on login → inline reset view → `sendPasswordResetEmail` → toast → redirect to login. Hidden in signup mode.

### US2 — Empty States Polish (P2)
Wire existing `KineticEmptyState` (5 variants with SVG illustrations) into HomePage Routines + Recent Activity sections when empty.

### US3 — Skeleton Loading States (P2)
Replace bare `Loader2` in GeneratorWizard with skeleton workout preview. Add skeleton post cards to FeedPage when loading.

### US4 — Mobile UX Audit (P2)
Inputs scroll above keyboard. Share card respects `env(safe-area-inset-*)`. Touch targets ≥44×44px.

## Requirements (27 FRs)

### Forgot Password (FR-001..007)
- Link below password field, login-only
- Inline reset view with email input + buttons
- `sendPasswordResetEmail` call with validation
- Success toast + redirect; error handling; loading state

### Empty States (FR-008..010)
- `KineticEmptyState variant="routines"` when `routines.length === 0`
- `KineticEmptyState variant="workouts"` when `recentWorkouts.length === 0`
- Conditional rendering preserves normal lists when non-empty

### Skeleton Loaders (FR-011..013)
- GeneratorWizard: skeleton exercise rows during `isGenerating`
- FeedPage: 3-5 skeleton post cards during `isLoading`
- Use existing `Skeleton` component + `skeleton-shimmer` CSS

### Mobile UX (FR-014..017)
- `scrollIntoView` on input focus
- `env(safe-area-inset-top/bottom)` on share card
- `min-h-[44px]` on icon buttons + text links

## Success Criteria
- SC-001: Forgot Password works end-to-end
- SC-002: Empty states show KineticEmptyState illustrations
- SC-003: Skeletons show during loads
- SC-004: Share card notch-safe
- SC-005: tsc ≤24, lint 0/95
- SC-006: Agent Browser confirms all flows

## Assumptions
All components exist (`KineticEmptyState`, `Skeleton`, `Button`). `sendPasswordResetEmail` available. `viewportFit: "cover"` set. No new deps. Mobile-first.
