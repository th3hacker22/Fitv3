# Pulse Fitness — Code Review Report & Improvement Plan

**Date:** 2026-06-18
**Reviewer:** Code review agents (3 parallel reviews)
**Scope:** Full Next.js 16 codebase — 40+ files reviewed

---

## Executive Summary

| Severity | Count | Description |
|----------|-------|-------------|
| **CRITICAL** | 8 | Must fix before any production deployment |
| **HIGH** | 23 | Significant bugs, security gaps, or performance issues |
| **MEDIUM** | 40 | Code quality, a11y, minor bugs |
| **LOW** | 43 | Polish, dead code, minor inconsistencies |

**Total findings: 114** across 3 review domains.

---

## Part 1: Critical Findings (8)

### C-1: Auth-redirect race — page flash on every reload
**Files:** `src/app/page.tsx` (lines 36–44, 116–118) + `src/store/useAuthStore.ts`

React fires child effects before parent effects. `AppShell`'s redirect effect runs while `user` is still `null` (initial state), pushing `navigate("auth")` onto history. Only afterwards does the parent's lazy `initAuthListener()` resolve and read `localStorage`. Every logged-in user sees the AuthPage flicker on each hard load, and an `auth → home` entry permanently pollutes the back stack.

### C-2: No authentication on any API route
**Files:** All 13 routes under `src/app/api/`

Every body parameter naming a user (`uid`, `userId`, `currentUid`, `authorUid`) is trusted from the request body with zero server-side verification. The local-only auth model (localStorage) means the server cannot verify who the caller is. Any anonymous attacker with network access can:
- Overwrite any user's profile
- Post to the feed as any user
- Make any user follow/unfollow anyone
- Inflate any user's challenge progress to instantly complete every challenge
- Delete any comment
- Spam kudos infinitely

### C-3: `sync-volume` replay attack
**File:** `src/app/api/challenges/sync-volume/route.ts`

Body `{ userId, totalVolume }` has no auth, no idempotency key, no rate limit. `for i in {1..100}; do curl -d '{"userId":"victim","totalVolume":1000000}'; done` instantly completes every challenge the victim joined and crowns them #1 on every leaderboard.

### C-4: Comments DELETE IDOR — anyone can delete any comment
**File:** `src/app/api/social/comments/route.ts` (line 122)

`prisma.comment.delete({ where: { id: commentId } })` — no ownership check. An attacker passes any `commentId` and any `postId`; the comment is deleted and `commentCount` on the wrong post is decremented.

### C-5: Comments identity contract mismatch
**Files:** `src/app/api/social/comments/route.ts` (lines 19–26) + `src/store/useSocialStore.ts`

The route reads author identity from `x-user-*` headers, but the client store never sends them. Every comment by every user is authored as the shared identity "Local Athlete". `deleteComment` cannot be ownership-scoped because all comments share one uid.

### C-6: `OptionBtn` defined inside `GeneratorWizard` component
**File:** `src/components/workout/GeneratorWizard.tsx` (lines 80–107)

`OptionBtn` is recreated with a new function identity on every render. React sees a "new component type" each render and unmounts/remounts all instances — losing focus, triggering DOM teardown, and causing heavy churn on every option click / slider move.

### C-7: `MacroBar` defined inside `NutritionPage` component
**File:** `src/pages/NutritionPage.tsx` (lines 144–173)

Same anti-pattern as C-6. `MacroBar` is recreated every render → React remounts it → the `motion.div` re-runs `initial={{ width: 0 }}` → **macro progress bars animate from 0% to their value on every parent re-render** (every entry add, day switch, modal open/close).

### C-8: Theme flash on first paint (white flash for dark-mode users)
**Files:** `src/app/layout.tsx` + `src/app/globals.css` + `src/utils/theme.ts`

`<html>` has no `data-theme` in SSR HTML. `:root` defaults to light mode. Dark-mode users see a full white flash on every load until `useEffect` applies `data-theme="dark"`. The `suppressHydrationWarning` masks the warning but doesn't fix the visual flash.

---

## Part 2: High-Severity Findings (23)

### Architecture (6)

| # | Finding | File |
|---|---------|------|
| H-1 | `<Link>` hrefs contain literal `$exerciseId` — broken for ctrl+click / new tab | `router-shim.tsx` |
| H-2 | `<Link>` onClick swallows modifier keys — can't open in new tab | `router-shim.tsx` |
| H-3 | Router `history` grows unbounded — memory leak + re-renders | `router/index.ts` |
| H-4 | `syncAll` has no in-flight guard — concurrent callers race | `syncEngine.ts` |
| H-5 | Prisma `log: ['query']` always on — production log flooding | `lib/db.ts` |
| H-6 | `initThemeListener()` return value discarded — memory leak | `page.tsx` |

### API Security (9)

| # | Finding | Route |
|---|---------|-------|
| H-7 | Anyone can overwrite any user's profile | `social/profile` |
| H-8 | Anyone can make any user follow/unfollow anyone | `social/follow` |
| H-9 | Anyone can publish feed posts as any user | `social/feed` |
| H-10 | Unbounded anonymous kudos inflation (no dedup table) | `social/kudos` |
| H-11 | No rate limiting on LLM route — cost DoS | `ai-workout` |
| H-12 | AI route uses `role: "assistant"` for system prompt | `ai-workout` |
| H-13 | Non-transactional multi-step writes (6 routes) | multiple |
| H-14 | `sync-volume` lost-update race (read-modify-write) | `challenges/sync-volume` |
| H-15 | `sync-volume` accepts `Infinity` / `1e308` | `challenges/sync-volume` |

### Components (8)

| # | Finding | File |
|---|---------|------|
| H-16 | Layout Challenges badge non-reactive (`getState()` in render) | `Layout.tsx` |
| H-17 | `ExerciseWorkoutCard` image fallback invisible (`-z-10` bug) | `ExerciseWorkoutCard.tsx` |
| H-18 | `RestTimer` interval recreated every second (deps include `seconds`) | `RestTimer.tsx` |
| H-19 | Full-store subscriptions (8 occurrences) cause cascading re-renders | multiple |
| H-20 | `<img>` instead of `next/image` — no optimization, CLS risk | `HomePage.tsx` |
| H-21 | StatsPage effect re-runs on `exercises` array reference change | `StatsPage.tsx` |
| H-22 | `userScalable: false` — WCAG 1.4.4 violation | `layout.tsx` |
| H-23 | Side effects inside `setSeconds` updater (StrictMode double-fire) | `RestTimer.tsx` |

---

## Part 3: Improvement Plan

### Phase 1: Critical Fixes (Day 1 — 4 hours)

**Goal:** Eliminate crashes, security holes, and visible bugs.

#### 1.1 Fix auth-redirect race (C-1) — 30 min
- Gate redirect effect on `useAuthStore.isLoading === false`
- Add `replace(route)` method to router (no history pollution)
- Call `initAuthListener()` synchronously (remove dynamic import)

#### 1.2 Fix theme flash (C-8) — 20 min
- Inline blocking `<script>` in `<head>` reading `localStorage["pulse-settings"]`
- Set `data-theme` before first paint

#### 1.3 Hoist inner components (C-6, C-7) — 15 min each
- Move `OptionBtn` to module scope in `GeneratorWizard.tsx`
- Move `MacroBar` to module scope in `NutritionPage.tsx`

#### 1.4 Fix comments identity + IDOR (C-4, C-5) — 45 min
- Client: send `x-user-uid`, `x-user-name`, `x-user-photo` headers from `useAuthStore`
- Server DELETE: scope by `authorUid === callerUid`, return 404 for missing
- Wrap POST + count increment in `prisma.$transaction`

#### 1.5 Fix `sync-volume` race + replay (C-3, H-14, H-15) — 30 min
- Use atomic `prisma.update({ data: { progressKg: { increment: volume } } })`
- Only set `completedAt` on `false → true` transition
- Clamp `totalVolume` to max 1e9

#### 1.6 Fix AI route system prompt (H-12) — 5 min
- Change `role: "assistant"` to `role: "system"`

#### 1.7 Remove WCAG violation (H-22) — 2 min
- Delete `userScalable: false, maximumScale: 1` from viewport

#### 1.8 Gate Prisma logging (H-5) — 2 min
- `log: process.env.NODE_ENV === 'development' ? ['query','error','warn'] : ['error']`

---

### Phase 2: Security Hardening (Day 2 — 6 hours)

**Goal:** Make API routes safe for deployment.

#### 2.1 Add authentication middleware — 2 hours
- Create `src/middleware.ts`
- Issue signed JWT at "login" (local auth + server secret)
- Validate JWT on all `/api/social/*` and `/api/challenges/*` routes
- Extract `callerUid` from token, ignore body-supplied `uid`/`userId`

#### 2.2 Add rate limiting — 1.5 hours
- In-memory token bucket in `middleware.ts` (per-IP + per-uid)
- Strict limits: AI route (5/min), sync-volume (10/hour), comments (20/hour)
- Looser limits: feed GET, search, leaderboard

#### 2.3 Input validation everywhere — 1 hour
- Max lengths: `displayName` (50), `workoutTitle` (100), `text` (500), `q` (100)
- URL validation for `photoURL` (reject `javascript:`, `data:` schemes)
- Numeric clamping: `duration` (0–86400), `totalVolume` (0–1e9), `exercisesCount` (0–100)

#### 2.4 Wrap multi-step writes in transactions — 30 min
- `social/follow` POST: 2 profile upserts + follow upsert → `$transaction`
- `social/comments` POST/DELETE: comment write + count update → `$transaction`
- `challenges/route` GET seeding: 3 upserts → `$transaction`

#### 2.5 Fix status codes — 30 min
- Prisma `P2025` (not found) → 404 (currently 500)
- Non-existent `challengeId` → 404 (currently 200 null)

#### 2.6 Sanitize error responses — 15 min
- Return generic `"Internal server error"` to client
- Log full `error.message` server-side only

---

### Phase 3: React Performance & UX (Day 3 — 4 hours)

**Goal:** Eliminate unnecessary re-renders, fix focus behavior, improve a11y.

#### 3.1 Fix full-store subscriptions (H-19) — 1 hour
Split bare `useStore()` calls into individual selectors:
- `useGeneratorStore()` → `useGeneratorStore((s) => s.gender)` etc.
- `useExerciseStore()` → `useExerciseStore((s) => s.exercises)` + `((s) => s.loadExercises)`
- `useAuthStore()` → `useAuthStore((s) => s.user)`
- Same for achievements, nutrition, social stores (8 occurrences)

#### 3.2 Fix RestTimer interval recreation (H-18, H-23) — 30 min
- Remove `seconds` from effect deps
- Move side effects (sound, notification, dismiss) to a separate effect watching `seconds === 0`
- Use ref for current seconds inside interval callback

#### 3.3 Fix StatsPage effect deps (H-21) — 10 min
- Change `[exercises]` to `[exercises.length]` (primitive comparison)

#### 3.4 Fix ExerciseWorkoutCard image fallback (H-17) — 10 min
- Remove `-z-10` from fallback div, or use React state (`hasError`)

#### 3.5 Make Layout Challenges badge reactive (H-16) — 5 min
- Replace `useAuthStore.getState().user` with `const user = useAuthStore((s) => s.user)`

#### 3.6 Fix `<Link>` hrefs + modifier keys (H-1, H-2) — 20 min
- Substitute params into href: `/exercises/$exerciseId` → `/exercises/abc123`
- Bail out of `preventDefault()` for `metaKey || ctrlKey || shiftKey || altKey || button !== 0`

#### 3.7 Cap router history (H-3) — 10 min
- Keep last 50 entries: `history: [...current.history, entry].slice(-50)`

#### 3.8 Add syncAll in-flight guard (H-4) — 10 min
- Module-level `let syncing = false` flag; skip if already syncing

#### 3.9 Unsubscribe theme listener (H-6) — 5 min
- Capture and return `initThemeListener()` cleanup in useEffect

---

### Phase 4: Accessibility (Day 4 — 3 hours)

**Goal:** WCAG 2.1 AA compliance.

#### 4.1 Add `aria-label` to icon-only buttons — 30 min
- Layout scroll-to-top, RestTimer dismiss/+30s, CommentsSheet submit/delete, NutritionPage nav, Toast close

#### 4.2 Associate labels with inputs — 30 min
- GeneratorWizard: height/weight/age inputs → `htmlFor`/`id`
- ExerciseWorkoutCard: notes textarea → `<label>`
- CommentsSheet: comment textarea → `aria-label`

#### 4.3 Add `aria-expanded`/`aria-controls` to collapsibles — 20 min
- ExerciseWorkoutCard Tips + Notes toggles

#### 4.4 Add `role="progressbar"` to visual bars — 20 min
- NutritionPage MacroBar: `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label`
- RestTimer ring: same

#### 4.5 Add `aria-current="page"` to active nav — 5 min
- Layout NavItem

#### 4.6 Fix error toast aria-live — 10 min
- Toast container: `aria-live="assertive"` for error type, `polite` for success/info

#### 4.7 Add `prefers-reduced-motion` support — 30 min
- Disable `neon-pulse`, `shimmer`, `float`, `pulse-glow`, `scan-line` animations
- Disable `scroll-behavior: smooth`

#### 4.8 Add list semantics to comment list — 10 min
- `<ul>`/`<li>` or `role="list"`/`role="listitem"`

---

### Phase 5: Code Quality & Polish (Day 5 — 3 hours)

**Goal:** Clean code, remove dead code, fix CSS issues.

#### 5.1 CSS fixes — 45 min
- Replace hardcoded lime in `::selection` + `input:focus` with `var(--c-primary-glow)`
- Fix `.skeleton-shimmer` to use `var(--skeleton-base)` / `var(--skeleton-highlight)`
- Fix `transition: all` on `.glass-card` → specific properties
- Remove dead `--c-bg-card` token
- Fix `--color-primary-light` (identical to `--color-primary`)

#### 5.2 Replace `<img>` with `next/image` (H-20) — 1 hour
- HomePage hero, template images, AuthPage hero
- Add `width`/`height` or `fill` + `priority` for above-fold

#### 5.3 Add try/catch to async handlers — 30 min
- HomePage `loadData`, ExercisesPage `handleCustomSubmit`, ProfilePage `onClick` sync, NutritionPage handlers (5 occurrences)

#### 5.4 Remove dead code — 20 min
- Delete `src/i18n/locales/ar.json`
- Remove dead PWA code in `Layout.tsx` (needRefresh stubs)
- Remove dead Arabic branches in `ExerciseWorkoutCard.tsx`
- Remove unused `useRouter` import in `HomePage.tsx`
- Remove `buildPath` from router (returns route name, not path)

#### 5.5 Add `importLocalBackup` — 30 min
- Complete Phase 3 feature: parse JSON, convert base64 → Blob for photos, bulkPut to Dexie
- Add "Import" button is already in Settings; wire it up

#### 5.6 Add graceful Prisma shutdown — 10 min
- `process.on('SIGTERM', () => prisma.$disconnect())`

---

### Phase 6: Testing Expansion (Day 6 — 2 hours)

**Goal:** Lock in fixes with regression tests.

#### 6.1 Add API route integration tests — 1 hour
- Test auth middleware (401 without token, 200 with)
- Test rate limiting (429 after threshold)
- Test sync-volume atomic increment (concurrent calls don't lose updates)
- Test comments DELETE ownership check (403 for non-owner)

#### 6.2 Add component regression tests — 1 hour
- Test `OptionBtn` doesn't remount on parent re-render (focus preserved)
- Test `MacroBar` doesn't re-animate on parent re-render
- Test `RestTimer` interval doesn't drift (mock timers)
- Test `<Link>` ctrl+click opens new tab (doesn't preventDefault)

---

## Priority Matrix

```
         IMPACT
          HIGH
    ┌─────────────┬─────────────┐
    │  Phase 1    │  Phase 2    │
    │  Critical   │  Security   │
    │  (4h)       │  (6h)       │
    ├─────────────┼─────────────┤
HIG │  Phase 3    │  Phase 4    │
EFF │  Perf+UX    │  A11y       │
ORT │  (4h)       │  (3h)       │
    ├─────────────┼─────────────┤
    │  Phase 5    │  Phase 6    │
    │  Quality    │  Tests      │
    │  (3h)       │  (2h)       │
    └─────────────┴─────────────┘
          LOW
```

**Total estimated effort: 22 hours** (3 working days).

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Console errors on load | 0 | 0 |
| Hydration mismatches | 0 | 0 |
| Infinite loops | 0 | 0 |
| Auth flash on reload | Yes | No |
| Theme flash on reload | Yes | No |
| WCAG AA violations | ~15 | 0 |
| API routes with auth | 0/13 | 13/13 |
| API routes with rate limit | 0/13 | 4/13 (critical) |
| Test coverage | 90 tests | 110+ tests |
| Lighthouse performance | ~70 | 90+ |
| Lighthouse accessibility | ~60 | 95+ |

---

## Decision Points for User

1. **Auth strategy**: Add real JWT auth (Phase 2.1) OR keep local-only and document "trusted network only"?
2. **`next/image`**: Migrate now (Phase 5.2) or defer? Requires `next.config.ts` `images` config.
3. **Arabic removal**: Permanently delete `ar.json` or keep for future re-enablement?
4. **PWA**: The `manifest.json` exists but service worker registration was removed. Re-add PWA or drop the manifest?
