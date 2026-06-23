# Feature Specification: Sprint 4 UX Polish & Forgot Password

**Feature Branch**: `sprint4-ux-polish`

**Created**: 2026-06-20

**Status**: Draft

**Input**: User description: "Sprint 4 UX Polish & Forgot Password — (1) Forgot Password flow with Firebase sendPasswordResetEmail; (2) Empty states polish for Home/Routines/Recent Activity; (3) Skeleton loaders for AI Generator + Social Feed; (4) Mobile UX audit (44px touch targets, keyboard-safe inputs, notch-safe confetti/share card)."

## Context & Scope

This spec covers four UX polish items that improve the new-user experience and mobile usability:

- **Forgot Password Flow**: The AuthPage (`src/pages/AuthPage.tsx`, 275 lines) currently has no password-reset mechanism. Users who forget their password have no recovery path. We add a "Forgot Password?" link that calls Firebase's `sendPasswordResetEmail` (available from `firebase/auth`, already imported in the file).

- **Empty States Polish**: The HomePage (`src/pages/HomePage.tsx`, 737 lines) has sections for Routines (line ~435) and Recent Activity (line ~601) that use `length > 0 ?` conditionals. When empty, they render either nothing or a minimal text fallback. A `KineticEmptyState` component already exists (`src/components/ui-custom/KineticEmptyState.tsx`) with 5 pre-built variants (workouts, routines, prs, measurements, photos) — but it's not used on the HomePage. We wire it in.

- **Loading States**: The `Skeleton` component exists (`src/components/ui-custom/Skeleton.tsx`) with a `SkeletonExerciseGrid` variant. The FeedPage already uses skeleton loaders for the "following" avatars (lines 355-360). However, the AI Generator (`GeneratorWizard.tsx`) uses only a bare `Loader2` spinner (line 1084) with no skeleton preview, and the FeedPage's post list shows a blank spinner while loading (line 456). We add skeleton loaders to both.

- **Mobile UX Audit**: The `Button` component (`src/components/ui-custom/Button.tsx`) already has `h-11` (44px) on mobile for the `sm` size, but the `md` and `lg` sizes use fixed heights that may shrink on some viewports. The `viewportFit: "cover"` is set in `layout.tsx` (good for notch), but the WorkoutResultView's share card (`sticky top-6`) doesn't account for safe-area insets. The `canvas-confetti` package is installed but confetti origin may overlap the notch. We audit and fix all three.

This spec is **specification only**. No implementation is performed in this stage.

## Inventory: What Exists vs What's Needed

### Existing components (reuse, don't rebuild)
| Component | File | Status |
|-----------|------|--------|
| `KineticEmptyState` | `src/components/ui-custom/KineticEmptyState.tsx` | ✅ 5 variants (workouts, routines, prs, measurements, photos) + custom — NOT wired into HomePage |
| `DataEmptyState` | `src/components/ui-custom/DataEmptyState.tsx` | ✅ Re-export of KineticEmptyState |
| `Skeleton` | `src/components/ui-custom/Skeleton.tsx` | ✅ Base skeleton + `SkeletonExerciseGrid` |
| `skeleton-shimmer` CSS | `src/app/globals.css` line 283 | ✅ Shimmer animation defined |
| `Button` | `src/components/ui-custom/Button.tsx` | ✅ `sm` = h-11 (44px) on mobile; `md` = h-12; `lg` = h-14 |
| `viewportFit: "cover"` | `src/app/layout.tsx` line 25 | ✅ Notch-aware viewport set |
| `canvas-confetti` | `package.json` | ✅ Installed (^1.9.4) + types |
| Firebase `sendPasswordResetEmail` | `firebase/auth` | ✅ Available (not yet imported in AuthPage) |

### What's missing (to be built)
| Item | File(s) | Details |
|------|---------|---------|
| Forgot Password link + handler | `src/pages/AuthPage.tsx` | Add link below password field, modal/inline form, `sendPasswordResetEmail` call, toast, redirect |
| HomePage empty states | `src/pages/HomePage.tsx` | Wire `KineticEmptyState` into Routines section (when `routines.length === 0`) and Recent Activity section (when `recentWorkouts.length === 0`) |
| AI Generator skeleton | `src/components/workout/GeneratorWizard.tsx` | Replace bare `Loader2` spinner (line 1084) with a skeleton preview of the workout result |
| Social Feed post skeleton | `src/pages/FeedPage.tsx` | Add skeleton post cards (line 456 area) while `isLoading` is true |
| Mobile touch target audit | Multiple files | Audit all `<button>` and clickable elements for min 44×44px; fix undersized ones |
| Keyboard-safe inputs | `src/pages/AuthPage.tsx` + others | Ensure inputs aren't hidden by mobile keyboard (scrollIntoView on focus, or proper viewport handling) |
| Notch-safe confetti/share | `src/pages/WorkoutResultView.tsx` | Add `env(safe-area-inset-*)` padding to the sticky share card + confetti origin |

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Forgot Password Flow (Priority: P1)

As a user who has forgotten my password, I want a "Forgot Password?" link on the login page that sends a password reset email to my inbox, so I can recover access to my account without needing to contact support or create a new account.

**Why this priority**: Without a password recovery path, users who forget their password are permanently locked out (the only alternative is Google sign-in, which not all users have configured). This is a standard auth UX expectation — every production app has it. It's a small, self-contained change (one Firebase API call + UI) with high user impact.

**Independent Test**: Can be fully tested by navigating to `/auth`, clicking "Forgot Password?", entering an email, and verifying a Firebase password reset email arrives in the inbox. The toast confirmation and redirect back to login can be verified without checking email (the Firebase API resolves successfully even if the email doesn't exist, for security).

**Acceptance Scenarios**:

1. **Given** the user is on the AuthPage in login mode (`isLogin === true`), **When** they look below the password input field, **Then** they see a "Forgot Password?" link (right-aligned, small text, `text-text-secondary` color, hover → `text-[#ccff00]`).
2. **Given** the user clicks "Forgot Password?", **When** the click is registered, **Then** the login form transitions to a "Reset Password" view (either inline or modal) showing: a title "RESET PASSWORD", a description "Enter your email and we'll send you a reset link", an email input (pre-filled with the current email value if the user typed one), a "Send Reset Link" button, and a "Back to Login" link.
3. **Given** the user is in the Reset Password view, **When** they click "Back to Login", **Then** they return to the standard login form without losing their email input.
4. **Given** the user enters a valid email in the Reset Password view and clicks "Send Reset Link", **When** the Firebase `sendPasswordResetEmail(auth, email)` call resolves, **Then** a success toast appears ("Password reset email sent! Check your inbox.") and the view redirects back to the login form after 2 seconds.
5. **Given** the user enters an invalid email (e.g. "not-an-email"), **When** they click "Send Reset Link", **Then** the email input shows a validation error ("Please enter a valid email") and the Firebase call is NOT made.
6. **Given** the user enters an empty email, **When** they click "Send Reset Link", **Then** an error message appears ("Please enter your email address") and the Firebase call is NOT made.
7. **Given** the `sendPasswordResetEmail` call fails (e.g. network error, or Firebase returns an error), **When** the promise rejects, **Then** an error message appears ("Failed to send reset email. Please try again.") and the user stays on the Reset Password view (no redirect).
8. **Given** the "Forgot Password?" link is visible, **When** the user is in signup mode (`isLogin === false`), **Then** the "Forgot Password?" link is NOT visible (it only makes sense on the login form).
9. **Given** the "Send Reset Link" button is clicked, **When** the Firebase call is in progress, **Then** the button shows a `Loader2` spinner and is disabled (no double-submit).
10. **Given** the Reset Password view is shown, **When** the user presses the Escape key, **Then** they return to the login form (if modal) or the email field retains focus (if inline).

---

### User Story 2 — Empty States Polish (Priority: P2)

As a new user who has just signed up and has no workouts, routines, or activity history, I want to see encouraging empty states with icons and CTA buttons instead of blank sections, so I understand what the app does and know exactly what to do next to get started.

**Why this priority**: The first-run experience determines whether a new user engages or churns. Blank sections make the app feel broken or empty. The `KineticEmptyState` component already exists with premium SVG illustrations and animations — it just needs to be wired into the HomePage sections that currently render nothing when empty. This is a low-effort, high-impact polish.

**Independent Test**: Can be tested by creating a new Firebase Auth user (via emulator or real signup), signing in, and verifying the HomePage shows the empty state illustrations + CTA buttons in the Routines and Recent Activity sections.

**Acceptance Scenarios**:

1. **Given** a new user with 0 routines, **When** they view the HomePage Routines section, **Then** they see the `KineticEmptyState` with `variant="routines"` — an SVG illustration of a clipboard/dumbbell, the title "No Routines Yet", the description "Create your first workout routine to get started", and a CTA button "Create Routine" that navigates to `/builder`.
2. **Given** a new user with 0 completed workouts, **When** they view the HomePage Recent Activity section, **Then** they see the `KineticEmptyState` with `variant="workouts"` — an SVG illustration, the title "No Workouts Yet", the description "Your recent workouts will appear here once you start training", and a CTA button "Start Workout" that navigates to `/` (home/generator).
3. **Given** a user with 1+ routines, **When** they view the Routines section, **Then** the normal routine list renders (the empty state is hidden).
4. **Given** a user with 1+ completed workouts, **When** they view the Recent Activity section, **Then** the normal workout list renders (the empty state is hidden).
5. **Given** the empty state CTA button is clicked, **When** the navigation occurs, **Then** the target page loads (e.g. `/builder` for "Create Routine").
6. **Given** the empty state renders, **When** it animates in, **Then** the Framer Motion entrance animation plays (the existing `KineticEmptyState` already has this — the illustration scales in with a spring, the text fades up).
7. **Given** the HomePage renders for a new user, **When** all sections are empty, **Then** the page still looks premium and intentional (not broken or sparse) — the empty states fill the visual space with illustrations and CTAs.

---

### User Story 3 — Skeleton Loading States (Priority: P2)

As a user waiting for the AI workout generator or the social feed to load, I want to see skeleton loaders that preview the content shape (not just a blank spinner), so the app feels responsive and I know what to expect when the data arrives.

**Why this priority**: A bare `Loader2` spinner gives no indication of what's loading or how long it will take. Skeleton loaders reduce perceived wait time and make the app feel faster. The `Skeleton` component + `skeleton-shimmer` CSS already exist — the work is wiring them into the GeneratorWizard and FeedPage.

**Independent Test**: Can be tested by throttling the network (or adding artificial delay) and verifying the skeleton loaders render in the AI Generator result area and the FeedPage post list before data arrives.

**Acceptance Scenarios**:

1. **Given** the user clicks "Generate" in the GeneratorWizard, **When** the AI generation is in progress (`isGenerating === true`), **Then** the result area shows a skeleton preview: a skeleton workout card with 4-6 skeleton exercise rows (each row = skeleton exercise name + skeleton sets/reps/rest), instead of a bare spinner.
2. **Given** the skeleton is showing in the GeneratorWizard, **When** the generation completes, **Then** the skeleton transitions smoothly to the real workout content (fade or slide).
3. **Given** the skeleton is showing, **When** the generation fails, **Then** the skeleton is replaced by an error state (not a stuck skeleton).
4. **Given** the user navigates to the FeedPage, **When** the feed posts are loading (`isLoading === true` and `feed.length === 0`), **Then** the post list area shows 3-5 skeleton post cards (each = skeleton avatar + skeleton title + skeleton workout stats + skeleton kudos/comment bar).
5. **Given** the skeleton posts are showing, **When** the feed loads, **Then** the skeleton transitions to the real post list.
6. **Given** the skeleton posts are showing, **When** the feed fails to load, **Then** the skeleton is replaced by an error state or empty state (not a stuck skeleton).
7. **Given** the skeleton renders, **When** the `skeleton-shimmer` CSS animation runs, **Then** the shimmer effect sweeps left-to-right continuously (the existing `@keyframes shimmer` in globals.css).

---

### User Story 4 — Mobile UX Audit (Priority: P2)

As a mobile user, I want all buttons to be easily tappable (min 44×44px), inputs to not be hidden by the keyboard, and the workout completion confetti/share card to not overlap with my phone's notch, so the app is usable on a phone without frustration.

**Why this priority**: The app is mobile-first (max-w-md). Undersized touch targets cause mis-taps. Inputs hidden by the keyboard prevent form completion. Notch overlap looks broken on modern iPhones. These are basic mobile UX requirements that affect every mobile user.

**Independent Test**: Can be tested by opening the app in a mobile viewport (Chrome DevTools iPhone 14 Pro, which has a notch), checking all buttons are ≥44px, focusing inputs to verify they scroll above the keyboard, and completing a workout to verify the share card doesn't overlap the notch.

**Acceptance Scenarios**:

1. **Given** any `<button>` or clickable element in the app, **When** measured on a mobile viewport (≤768px), **Then** its touch target is at least 44×44px (CSS pixels). This includes: icon-only buttons (delete, close, settings), text links that function as buttons ("Forgot Password?", "Sign up" toggle), and the kudos/comment buttons on feed posts.
2. **Given** a button is smaller than 44×44px, **When** the audit identifies it, **Then** it's fixed by adding `min-h-[44px] min-w-[44px]` or increasing the padding/size — WITHOUT changing the visual design (the visible button can stay the same size, but the touch area extends via padding).
3. **Given** the user focuses an input field (email, password, comment text) on a mobile device, **When** the on-screen keyboard appears, **Then** the focused input scrolls into view above the keyboard (via `scrollIntoView({ block: 'center' })` on focus, or the browser's native behavior is verified to work).
4. **Given** the user completes a workout and the WorkoutResultView renders, **When** the confetti fires, **Then** the confetti origin is positioned below the safe-area inset (not behind the notch) — use `env(safe-area-inset-top)` for the confetti y origin.
5. **Given** the WorkoutResultView's sticky share card is visible, **When** viewed on a notched phone, **Then** the card respects `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` — it doesn't overlap the notch (top) or the home indicator (bottom).
6. **Given** the AuthPage form is viewed on a mobile device, **When** the keyboard is open, **Then** the "Login"/"Sign Up" button is still visible and tappable (not hidden behind the keyboard).
7. **Given** any bottom-fixed or sticky element (e.g. the workout session bottom bar), **When** viewed on a notched phone, **Then** it respects `env(safe-area-inset-bottom)` — content doesn't overlap the home indicator.

---

### Edge Cases

- **Forgot Password with unregistered email**: Firebase's `sendPasswordResetEmail` resolves successfully even if the email doesn't exist (security best practice — don't reveal which emails are registered). The success toast should show regardless. Document this in the code comment.
- **Forgot Password with email verification pending**: If the user hasn't verified their email yet, the password reset email still sends (Firebase doesn't require email verification for password reset). This is correct behavior.
- **Empty state for a user who deleted all routines**: The `KineticEmptyState` should render the same as for a new user (no special "you deleted everything" state needed).
- **Skeleton loader for very fast loads**: If the AI generation or feed load completes in <200ms, the skeleton may flash briefly. This is acceptable (better than no skeleton). Optionally, add a 300ms minimum display time for the skeleton to avoid flash, but this is a nice-to-have, not a requirement.
- **Touch target audit for icon buttons in lists**: The delete button on routine cards (Trash2 icon, `h-4 w-4`) is smaller than 44px. The fix: wrap it in a button with `min-h-[44px] min-w-[44px]` and center the icon — the visible icon stays `h-4 w-4` but the touch area is 44px.
- **Keyboard-safe inputs on iOS Safari**: iOS Safari's keyboard behavior is inconsistent. The `scrollIntoView({ block: 'center' })` on focus works on most browsers, but iOS Safari may need `behavior: 'smooth'` or a slight delay. Test on real iOS if possible; if not, the native behavior should be acceptable with `viewportFit: "cover"` already set.
- **Confetti origin on landscape mode**: The notch is on the side in landscape. The confetti origin should account for orientation, but this is a nice-to-have — the primary fix is portrait mode (where 95% of workout completion happens).
- **Dark mode**: The app is dark-mode-first. The skeleton shimmer colors (`--skeleton-base: rgba(255,255,255,0.03)`, `--skeleton-highlight: rgba(255,255,255,0.06)`) are already dark-mode appropriate. No changes needed.
- **Reduced motion**: The `KineticEmptyState` uses Framer Motion animations. If `prefers-reduced-motion` is set, the animations should respect it (Framer Motion handles this automatically if `useReducedMotion` is checked — verify the component does this).

## Requirements *(mandatory)*

### Functional Requirements

#### Forgot Password Flow

- **FR-001**: A "Forgot Password?" link MUST be rendered on the AuthPage below the password input field, right-aligned, with `text-text-secondary` color and `hover:text-[#ccff00]` transition.
- **FR-002**: The "Forgot Password?" link MUST only be visible when `isLogin === true` (login mode). It MUST be hidden in signup mode.
- **FR-003**: Clicking "Forgot Password?" MUST transition the AuthPage to a "Reset Password" view. The view can be inline (replacing the login form) or a modal overlay — the plan stage decides. Either way, it MUST show: a title "RESET PASSWORD", a description, an email input (pre-filled with the current `email` state), a "Send Reset Link" button, and a "Back to Login" link.
- **FR-004**: The "Send Reset Link" button MUST call `sendPasswordResetEmail(auth, email)` from `firebase/auth` (import it alongside the existing `signInWithEmailAndPassword` etc.).
- **FR-005**: Before calling `sendPasswordResetEmail`, the handler MUST validate the email is non-empty and looks like a valid email (contains `@`). If invalid, show an error message and do NOT call Firebase.
- **FR-006**: While the Firebase call is in progress, the "Send Reset Link" button MUST show a `Loader2` spinner and be disabled.
- **FR-007**: On successful resolution of `sendPasswordResetEmail`, a success toast MUST appear with the message "Password reset email sent! Check your inbox." and the view MUST redirect back to the login form after 2 seconds.
- **FR-008**: On rejection of `sendPasswordResetEmail`, an error message MUST appear with "Failed to send reset email. Please try again." and the user MUST stay on the Reset Password view (no redirect).
- **FR-009**: The "Back to Login" link MUST return the user to the standard login form, preserving the email value they typed.
- **FR-010**: The password reset email's "continue URL" (the page Firebase redirects to after the user clicks the link in the email) SHOULD be configured to `/auth` via `actionCodeSettings` so the user lands back on the login page. This is a nice-to-have; if it complicates the implementation, the default Firebase behavior (redirect to the app's domain) is acceptable.

#### Empty States Polish

- **FR-011**: The HomePage Routines section (around line 435) MUST render `<KineticEmptyState variant="routines" ... />` when `routines.length === 0`. The CTA button MUST navigate to `/builder`.
- **FR-012**: The HomePage Recent Activity section (around line 601) MUST render `<KineticEmptyState variant="workouts" ... />` when `recentWorkouts.length === 0`. The CTA button MUST navigate to `/` (home/generator).
- **FR-013**: The existing `KineticEmptyState` component MUST be used as-is (no modifications to the component itself). If the default titles/descriptions don't match the acceptance scenarios, pass custom `title` and `description` props.
- **FR-014**: When `routines.length > 0` or `recentWorkouts.length > 0`, the normal list MUST render (the empty state MUST be hidden). The existing conditional rendering pattern (`length > 0 ? <List /> : <EmptyState />`) is the target.
- **FR-015**: The empty state CTA buttons MUST use the existing `Button` component with appropriate `size="sm"` and `variant="outline"`.

#### Skeleton Loading States

- **FR-016**: The GeneratorWizard's generation result area (currently showing `Loader2` at line 1084 when `isGenerating`) MUST show a skeleton workout preview instead. The skeleton MUST include: a skeleton workout title bar, 4-6 skeleton exercise rows (each with skeleton name + sets/reps/rest fields), and a skeleton "Start Workout" button area.
- **FR-017**: The skeleton MUST use the existing `Skeleton` component and/or `skeleton-shimmer` CSS class. No new CSS animations.
- **FR-018**: The FeedPage post list (around line 456, when `isLoading` and `feed.length === 0`) MUST show 3-5 skeleton post cards. Each skeleton post card MUST include: a skeleton avatar (circle), skeleton author name, skeleton workout title, skeleton workout stats (duration/volume/exercises), and a skeleton kudos/comment bar.
- **FR-019**: The skeleton-to-content transition MUST be smooth (fade or instant — no layout jump). The skeleton and real content should occupy the same space.
- **FR-020**: If the AI generation or feed load fails, the skeleton MUST be replaced by an error/empty state (not left in a perpetual loading state).

#### Mobile UX Audit

- **FR-021**: Every `<button>` element and clickable `<a>` / `<Link>` in the app MUST have a minimum touch target of 44×44px on mobile viewports (≤768px). This can be achieved via the existing `Button` component sizes (`sm` = h-11 = 44px on mobile) or by adding `min-h-[44px] min-w-[44px]` to custom buttons.
- **FR-022**: Icon-only buttons (e.g. the delete button on routine cards, the close button on modals, the kudos heart) MUST have a 44×44px touch area. The visible icon can stay small (e.g. `h-4 w-4`); the touch area is achieved via padding on the button wrapper.
- **FR-023**: Input fields on the AuthPage (email, password) and comment inputs on the FeedPage MUST scroll into view when focused on a mobile device. This can be achieved via `onFocus={(e) => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' })}` or by verifying the browser's native behavior works with the current layout.
- **FR-024**: The WorkoutResultView's sticky share card MUST respect safe-area insets. Add `padding-top: env(safe-area-inset-top)` and `padding-bottom: env(safe-area-inset-bottom)` (or Tailwind equivalents `pt-[env(safe-area-inset-top)]` `pb-[env(safe-area-inset-bottom)]`) to the card or its container.
- **FR-025**: The confetti animation in WorkoutResultView (if/when it fires) MUST position its origin below the safe-area inset top. If using `canvas-confetti`, set the `origin.y` to account for the notch (e.g. `origin: { y: safeAreaTop + 0.1 }` where `safeAreaTop` is computed from `env(safe-area-inset-top)`).
- **FR-026**: Any bottom-fixed or sticky element (e.g. the workout session bottom bar, the comment input bar on the feed) MUST respect `env(safe-area-inset-bottom)` — add `pb-[env(safe-area-inset-bottom)]` so content doesn't overlap the home indicator.
- **FR-027**: The audit MUST identify and fix at minimum these known undersized touch targets: (a) the delete button on routine cards (`h-4 w-4` icon, no min size), (b) the "Forgot Password?" link (text-only, needs min-h), (c) the "Sign up"/"Login" toggle link (text-only, needs min-h), (d) the kudos heart button on feed posts, (e) the comment button on feed posts.

### Key Entities

- **sendPasswordResetEmail**: Firebase Auth function (`firebase/auth`). Signature: `sendPasswordResetEmail(auth: Auth, email: string, actionCodeSettings?: ActionCodeSettings): Promise<void>`. Resolves on success (even if email doesn't exist), rejects on network/config errors.
- **KineticEmptyState**: Existing component (`src/components/ui-custom/KineticEmptyState.tsx`). Props: `variant`, `icon`, `title`, `description`, `actionLabel`, `onAction`, `className`. 5 pre-built variants with custom SVG illustrations.
- **Skeleton**: Existing component (`src/components/ui-custom/Skeleton.tsx`). Base `Skeleton` (div with `skeleton-shimmer` class) + `SkeletonExerciseGrid` (6 skeleton exercise cards).
- **safe-area-inset**: CSS environment variables (`env(safe-area-inset-top)`, `env(safe-area-inset-bottom)`, `env(safe-area-inset-left)`, `env(safe-area-inset-right)`) that resolve to the safe area dimensions on notched devices. Requires `viewport-fit: cover` in the viewport meta (already set in `layout.tsx`).
- **Touch target**: The interactive area of a UI element. Apple's Human Interface Guidelines and Google's Material Design both specify 44×44px minimum for touch targets on mobile.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Navigating to `/auth` in login mode shows a "Forgot Password?" link below the password field. Clicking it shows a reset password form. Entering a valid email and clicking "Send Reset Link" calls `sendPasswordResetEmail` and shows a success toast.

- **SC-002**: A new user (0 routines, 0 workouts) viewing the HomePage sees `KineticEmptyState` illustrations in both the Routines section and the Recent Activity section, each with a CTA button that navigates to the correct page.

- **SC-003**: A user with 1+ routines and 1+ workouts sees the normal list views (no empty states) — the empty states only render when the respective arrays are empty.

- **SC-004**: Clicking "Generate" in the GeneratorWizard shows a skeleton workout preview (4-6 skeleton exercise rows) during the AI generation, not a bare spinner.

- **SC-005**: Navigating to the FeedPage while posts are loading shows 3-5 skeleton post cards (avatar + title + stats + action bar), not a blank spinner.

- **SC-006**: Running `grep -rn "min-h-\[44" src/` returns results for all fixed touch targets (or the `Button` component's `sm` size is used, which is already `h-11` = 44px on mobile).

- **SC-007**: On a notched phone viewport (Chrome DevTools iPhone 14 Pro), the WorkoutResultView's share card does not overlap the notch (top) or home indicator (bottom) — `env(safe-area-inset-*)` padding is applied.

- **SC-008**: Focusing an email or password input on a mobile viewport scrolls the input above the keyboard (visible and tappable).

- **SC-009**: `bun run lint` passes with 0 new errors. `npx tsc --noEmit` passes with ≤ 24 errors (the current baseline after Sprint 3). Agent Browser verification confirms all 4 user stories work end-to-end.

- **SC-010**: The "Forgot Password?" link is hidden in signup mode (only visible when `isLogin === true`).

- **SC-011**: The confetti origin (if confetti fires on workout completion) is positioned below the safe-area inset top, not behind the notch.

## Assumptions

- **Firebase `sendPasswordResetEmail` is available** in the installed `firebase/auth` package. The function is part of the standard Firebase Auth SDK and doesn't require any additional setup beyond what's already configured (the `auth` instance is imported in `AuthPage.tsx`).
- **The `KineticEmptyState` component works as designed** — it has 5 variants with SVG illustrations and Framer Motion animations. No modifications to the component are needed; we only wire it into the HomePage.
- **The `Skeleton` component and `skeleton-shimmer` CSS are production-ready** — the shimmer animation is defined in `globals.css` and used in the FeedPage already. We extend its usage to the GeneratorWizard and FeedPage post list.
- **`viewport-fit: cover` is already set** in `layout.tsx` (line 25: `viewportFit: "cover"`), so `env(safe-area-inset-*)` CSS variables will resolve correctly on notched devices.
- **`canvas-confetti` is installed** (^1.9.4) with types. If confetti isn't currently fired on workout completion (the grep showed no confetti usage in WorkoutResultView), the confetti fix (FR-025) is a no-op or a new feature addition — the plan stage decides whether to add confetti or just ensure the share card is notch-safe.
- **The app is mobile-first** (max-w-md) — the mobile UX audit focuses on the primary mobile layout. Desktop layouts (md+ breakpoints) are secondary; touch target requirements apply only to mobile (≤768px).
- **iOS Safari keyboard behavior** is the primary concern for keyboard-safe inputs. The `scrollIntoView({ block: 'center' })` approach works on most browsers; if iOS Safari misbehaves, a fallback (manual scroll calculation) may be needed — flagged for the plan stage.
- **The existing `Button` component** has 4 sizes: `sm` (h-11/44px mobile, h-9/36px desktop), `md` (h-12/48px), `lg` (h-14/56px), `icon` (h-12 w-12/48px). The `sm` size is already 44px on mobile. Custom buttons not using the `Button` component need manual `min-h-[44px]` additions.
- **No new dependencies** are needed for this sprint. All components (`KineticEmptyState`, `Skeleton`, `Button`), packages (`canvas-confetti`, `firebase/auth`), and CSS (`skeleton-shimmer`, `env(safe-area-inset-*)`) already exist.
- **The AuthPage is the only auth page** — there's no separate `/forgot-password` route. The forgot password flow is an inline view or modal within the AuthPage, not a new page. This keeps the change small and avoids adding a new route to the router.
