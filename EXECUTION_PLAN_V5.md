# 📋 Pulse Fitness — Prioritized Execution Plan (V5 Audit)

> Based on `CODE_AUDIT_V5.md` (78 findings) and `USER_STORIES_V3.md` (51 new stories)
> **NO FIXES APPLIED YET** — this is the plan only.

---

## Execution Table

### 🔴 CRITICAL — Blocks Production (Sprint 1)

| Priority | Task | Skills Needed | Files Affected | Dependencies | Status |
|----------|------|---------------|----------------|--------------|--------|
| P0-1 | **Fix Caddyfile SSRF** — Remove `:81` open-proxy block that allows `XTransformPort` to probe internal services | `007` | `Caddyfile` | None | ⬜ Pending |
| P0-2 | **Firebase session cookies** — Switch from raw ID token (1hr TTL) to `createSessionCookie` (7-day) via `adminAuth.verifySessionCookie` | `007`, `api-security-best-practices` | `src/app/api/auth/session/route.ts`, `src/lib/authServer.ts`, `src/store/useAuthStore.ts` | None | ⬜ Pending |
| P0-3 | **Add `requireUser` to AI endpoints** — `/api/ai-coach` and `/api/ai-workout` must verify session, not just cookie existence | `007`, `api-security-best-practices` | `src/app/api/ai-coach/route.ts`, `src/app/api/ai-workout/route.ts` | P0-2 | ⬜ Pending |
| P0-4 | **Fix comment identity spoofing** — Remove trust of client-supplied `x-user-name`/`x-user-photo` headers; look up from `PublicProfile` by `callerUid` | `007`, `api-security-best-practices` | `src/app/api/social/comments/route.ts`, `src/store/useSocialStore.ts` | None | ⬜ Pending |
| P0-5 | **Add auth to public GET endpoints** — `/api/social/feed`, `/api/social/following`, `/api/challenges/[id]/progress` must require login | `007`, `api-security-best-practices` | `src/app/api/social/feed/route.ts`, `src/app/api/social/following/route.ts`, `src/app/api/challenges/[challengeId]/progress/route.ts` | P0-2 | ⬜ Pending |
| P0-6 | **Prevent kudos spam** — Add `Kudos` Prisma model with `@@unique([postId, userId])`; toggle instead of increment | `api-security-best-practices`, `api-endpoint-builder` | `prisma/schema.prisma`, `src/app/api/social/kudos/route.ts`, `src/store/useSocialStore.ts` | None | ⬜ Pending |
| P0-7 | **Fix profile name save** — `ProfilePage.handleSaveName` omits `uid` from body, causing 400 error | `api-endpoint-builder` | `src/pages/ProfilePage.tsx` | None | ⬜ Pending |
| P0-8 | **Remove `x-forwarded-for` trust** — Middleware trusts spoofed IPs; validate against known proxy chain | `007`, `api-security-best-practices` | `src/middleware.ts` | None | ⬜ Pending |
| P0-9 | **Add input body size limit** — AI endpoints accept unbounded request bodies; add `Content-Length` check (max 50KB) | `api-security-best-practices` | `src/app/api/ai-coach/route.ts`, `src/app/api/ai-workout/route.ts`, `src/middleware.ts` | None | ⬜ Pending |
| P0-10 | **Consolidate notification services** — `notifications.ts` and `notificationService.ts` duplicate logic; merge into one | `andrej-karpathy` | `src/utils/notifications.ts`, `src/services/notificationService.ts`, `src/pages/SettingsPage.tsx` | None | ⬜ Pending |

---

### 🟠 HIGH — Severe Issues (Sprint 2)

| Priority | Task | Skills Needed | Files Affected | Dependencies | Status |
|----------|------|---------------|----------------|--------------|--------|
| P1-1 | **Add Zod input validation** — All POST/DELETE API routes accept raw JSON without schema validation | `api-security-best-practices`, `api-endpoint-builder` | `src/lib/validation.ts`, ALL `src/app/api/*/route.ts` files (15 routes) | P0-2 | ⬜ Pending |
| P1-2 | **Add Firebase Storage rules** — No `storage.rules` file; anyone can read/write any path | `007` | `storage.rules` (NEW), `firebase.json` (NEW) | None | ⬜ Pending |
| P1-3 | **Add CI/CD pipeline** — No `.github/workflows/` exists; lint/tsc/test don't block deploy | `cc-skill-backend-patterns` | `.github/workflows/ci.yml` (NEW) | None | ⬜ Pending |
| P1-4 | **Lazy-load all 16 pages** — `app/page.tsx` statically imports all pages into initial bundle | `cc-skill-frontend-patterns` | `src/app/page.tsx` | None | ⬜ Pending |
| P1-5 | **Add per-user rate limiting** — Current limiter is per-IP only; logged-in users behind NAT share buckets | `api-security-best-practices` | `src/middleware.ts` | P0-2 | ⬜ Pending |
| P1-6 | **Implement real cloud sync** — `pushToCloud`/`pullFromCloud` are no-ops; data lost on browser wipe | `cc-skill-backend-patterns`, `progressive-web-app` | `src/lib/syncEngine.ts`, `src/app/api/sync/route.ts` (NEW), `src/store/useSyncStore.ts` | None | ⬜ Pending |
| P1-7 | **Add error monitoring** — 98 `console.error` calls vanish; add Sentry integration | `cc-skill-backend-patterns` | `src/app/layout.tsx`, `src/lib/sentry.ts` (NEW), `next.config.ts` | None | ⬜ Pending |
| P1-8 | **Fix `any` type violations** — 12+ `: any` usages in wizard/result-view; break TS strict mode | `andrej-karpathy`, `cc-skill-frontend-patterns` | `src/components/workout/GeneratorWizard.tsx`, `src/pages/WorkoutResultView.tsx`, `src/services/aiWorkoutService.ts` | None | ⬜ Pending |
| P1-9 | **Add API route integration tests** — 15 API routes have zero test coverage | `cc-skill-backend-patterns` | `src/app/api/__tests__/` (NEW, ~15 files) | P1-1, P1-3 | ⬜ Pending |
| P1-10 | **Implement real PWA service worker** — Current `sw.js` is pass-through; no caching, no background sync | `progressive-web-app` | `public/sw.js`, `next.config.ts` | P1-6 | ⬜ Pending |
| P1-11 | **Fix multi-account IndexedDB** — Single-user assumption; User B sees User A's data on shared device | `cc-skill-backend-patterns` | `src/db/schema.ts`, `src/db/index.ts`, `src/store/useAuthStore.ts` | None | ⬜ Pending |
| P1-12 | **Add session revocation on logout** — Firebase `revokeRefreshTokens` on sign-out | `007`, `api-security-best-practices` | `src/store/useAuthStore.ts`, `src/app/api/auth/session/route.ts` | P0-2 | ⬜ Pending |
| P1-13 | **Add E2E tests for critical flows** — signup → wizard → workout → finish → share → feed | `cc-skill-frontend-patterns` | `e2e/` (NEW directory) | P1-3 | ⬜ Pending |
| P1-14 | **Replace `<img>` with `next/image`** — 15+ raw `<img>` tags, no optimization | `cc-skill-frontend-patterns` | `src/pages/BodyPage.tsx`, `src/pages/FeedPage.tsx`, `src/components/ui-custom/Avatar.tsx`, `src/components/AchievementBadge.tsx`, `src/pages/HomePage.tsx` | None | ⬜ Pending |
| P1-15 | **Fix `useBackgroundSync` no-op polling** — Polls `syncAll` every 5min but sync is a no-op; wasted CPU | `andrej-karpathy` | `src/hooks/useBackgroundSync.ts` | P1-6 | ⬜ Pending |
| P1-16 | **Add unit tests for algorithm engines** — `fatigueEngine`, `overloadEngine`, `deloadEngine`, `variationEngine`, `learningLoop`, `movementPatterns`, `recoveryTracker` untested | `cc-skill-backend-patterns` | `src/services/__tests__/` (7 new test files) | None | ⬜ Pending |
| P1-17 | **Add GDPR endpoints** — Account deletion + data export (Articles 17 & 20) | `api-endpoint-builder`, `007` | `src/app/api/auth/delete-account/route.ts` (NEW), `src/app/api/auth/export-data/route.ts` (NEW) | P0-2 | ⬜ Pending |
| P1-18 | **Fix exercise cache performance** — 1300 exercises in localStorage (~1MB JSON parse per load); move to IndexedDB | `cc-skill-frontend-patterns` | `src/services/exerciseService.ts`, `src/store/useExerciseStore.ts` | None | ⬜ Pending |

---

### 🟡 MEDIUM — Polish (Sprint 3)

| Priority | Task | Skills Needed | Files Affected | Dependencies | Status |
|----------|------|---------------|----------------|--------------|--------|
| P2-1 | **Add structured logger** — Replace 98 `console.error` with structured logger (pino/winston) | `cc-skill-backend-patterns` | `src/lib/logger.ts` (NEW), ALL files with `console.error` | P1-7 | ⬜ Pending |
| P2-2 | **Add cursor pagination** — Feed always returns top 50; comments return all; no infinite scroll | `api-design-principles` | `src/app/api/social/feed/route.ts`, `src/app/api/social/comments/route.ts`, `src/pages/FeedPage.tsx` | None | ⬜ Pending |
| P2-3 | **Fix `ARCHITECTURE.md` drift** — Claims JWT (not used), 138 tests (now 170), offline-first (not real) | `cc-skill-backend-patterns` | `ARCHITECTURE.md` | None | ⬜ Pending |
| P2-4 | **Add `.env.example`** — No env template; onboarding requires reading `.env` directly | `cc-skill-backend-patterns` | `.env.example` (NEW) | None | ⬜ Pending |
| P2-5 | **Add `README.md` + `AGENTS.md`** — No project documentation | `cc-skill-backend-patterns` | `README.md` (NEW), `AGENTS.md` (NEW) | None | ⬜ Pending |
| P2-6 | **Add OpenAPI spec** — No API documentation | `api-design-principles`, `api-documenter` | `openapi.yaml` (NEW) | P1-1 | ⬜ Pending |
| P2-7 | **Fix `package.json` name** — Still `nextjs_tailwind_shadcn_ts` instead of `pulse-fitness` | `andrej-karpathy` | `package.json` | None | ⬜ Pending |
| P2-8 | **Re-enable disabled ESLint rules** — 16 errors suppressed; fix root causes | `andrej-karpathy` | `eslint.config.mjs`, 8+ source files | None | ⬜ Pending |
| P2-9 | **Add Dexie `completedInt` index** — Boolean can't be IDB key; add `0/1` integer field for indexed queries | `cc-skill-backend-patterns` | `src/db/schema.ts`, `src/db/migrations.ts`, `src/db/analytics.ts`, `src/store/useWorkoutStore.ts` | None | ⬜ Pending |
| P2-10 | **Add `useFeatureFlag` hook** — Gate new features behind flags | `cc-skill-frontend-patterns` | `src/hooks/useFeatureFlag.ts` (NEW) | None | ⬜ Pending |
| P2-11 | **Fix SSR-unsafe stores** — `useSyncStore` and `useCloudSyncState` read localStorage/navigator in `useState` initializer | `cc-skill-frontend-patterns` | `src/store/useSyncStore.ts`, `src/hooks/useCloudSyncState.ts` | None | ⬜ Pending |
| P2-12 | **Add backup strategy for SQLite** — Only Dexie has export; server DB has no backup | `cc-skill-backend-patterns` | `scripts/backup-db.sh` (NEW) | None | ⬜ Pending |

---

### 🔵 LOW — Refactoring (Sprint 4)

| Priority | Task | Skills Needed | Files Affected | Dependencies | Status |
|----------|------|---------------|----------------|--------------|--------|
| P3-1 | **Remove placeholder `/api/route.ts`** — Returns "Hello, world!" | `andrej-karpathy` | `src/app/api/route.ts` | None | ⬜ Pending |
| P3-2 | **Namespace `pulse_session` cookie** — Not namespaced; could collide | `andrej-karpathy` | `src/lib/authServer.ts` | P0-2 | ⬜ Pending |
| P3-3 | **Split `app/page.tsx` into server+client components** — Entirely `"use client"` | `cc-skill-frontend-patterns` | `src/app/page.tsx` | P1-4 | ⬜ Pending |
| P3-4 | **Add Storybook** — No component development environment | `cc-skill-frontend-patterns` | `.storybook/` (NEW) | None | ⬜ Pending |
| P3-5 | **Consolidate `exerciseTranslations.ts`** — Exists but i18n is English-only (dead code?) | `i18n-localization` | `src/utils/exerciseTranslations.ts` | None | ⬜ Pending |
| P3-6 | **Add WCAG 2.2 AA audit** — Run axe-core in E2E; fix violations | `accesslint-audit`, `accessibility-compliance-accessibility-audit` | ALL pages + components | P1-13 | ⬜ Pending |
| P3-7 | **Add analytics** — Self-hosted Posthog/Plausible; privacy-preserving events | `cc-skill-frontend-patterns` | `src/lib/analytics.ts` (NEW), `src/pages/SettingsPage.tsx` | P2-10 | ⬜ Pending |
| P3-8 | **Fix inconsistent indentation** — 2 vs 4 spaces across files | `andrej-karpathy` | Multiple files | None | ⬜ Pending |

---

## How to Execute

For each task, send me the corresponding prompt:

### Sprint 1 Prompts (Critical — Week 1)

```
Execute P0-1: Fix Caddyfile SSRF by removing the :81 XTransformPort open-proxy block
```

```
Execute P0-2: Switch Firebase auth from raw ID tokens to session cookies using createSessionCookie + verifySessionCookie
```

```
Execute P0-3: Add requireUser to /api/ai-coach and /api/ai-workout endpoints
```

```
Execute P0-4: Fix comment identity spoofing — remove x-user-name/x-user-photo header trust, look up from PublicProfile
```

```
Execute P0-5: Add requireUser to GET /api/social/feed, GET /api/social/following, GET /api/challenges/[id]/progress
```

```
Execute P0-6: Add Kudos Prisma model with @@unique([postId, userId]) to prevent spam; implement toggle logic
```

```
Execute P0-7: Fix ProfilePage.handleSaveName to include uid in request body
```

```
Execute P0-8: Remove x-forwarded-for trust in middleware; validate against known proxy chain
```

```
Execute P0-9: Add Content-Length body size limit (50KB max) to AI endpoints in middleware
```

```
Execute P0-10: Consolidate notifications.ts and notificationService.ts into a single service
```

### Sprint 2 Prompts (High — Week 2)

```
Execute P1-1: Add Zod input validation to all 15 API routes
```

```
Execute P1-2: Create Firebase Storage rules (storage.rules) securing user-specific paths
```

```
Execute P1-3: Create GitHub Actions CI/CD pipeline (.github/workflows/ci.yml) running lint, tsc, vitest
```

```
Execute P1-4: Convert all 16 page imports in app/page.tsx to dynamic() with ssr:false
```

```
Execute P1-5: Add per-user rate limiting in middleware (keyed on uid, not just IP)
```

```
Execute P1-6: Implement real cloud sync — pushToCloud/pullFromCloud should call /api/sync
```

```
Execute P1-7: Add Sentry error monitoring integration
```

```
Execute P1-8: Fix all `any` type violations across the codebase
```

```
Execute P1-9: Add integration tests for all 15 API routes
```

```
Execute P1-10: Implement real PWA service worker with Workbox caching + background sync
```

```
Execute P1-11: Fix multi-account IndexedDB — add per-uid data partitioning
```

```
Execute P1-12: Add session revocation on logout via Firebase revokeRefreshTokens
```

```
Execute P1-13: Add E2E tests for critical flows (signup → wizard → workout → share)
```

```
Execute P1-14: Replace all <img> tags with next/image
```

```
Execute P1-15: Fix useBackgroundSync no-op polling
```

```
Execute P1-16: Add unit tests for all 7 algorithm engines
```

```
Execute P1-17: Add GDPR endpoints (delete account + data export)
```

```
Execute P1-18: Move exercise cache from localStorage to IndexedDB
```

### Sprint 3 Prompts (Medium — Week 3)

```
Execute P2-1 through P2-12 (see table for details)
```

### Sprint 4 Prompts (Low — Week 4)

```
Execute P3-1 through P3-8 (see table for details)
```

---

## Dependency Graph

```
P0-1 (Caddyfile) ─── independent
P0-2 (Session cookies) ─┬─ P0-3 (AI auth)
                         ├─ P0-5 (GET auth)
                         ├─ P1-1 (Zod validation)
                         ├─ P1-5 (Per-user rate limit)
                         ├─ P1-12 (Session revocation)
                         └─ P1-17 (GDPR endpoints)
P0-4 (Comment spoofing) ─── independent
P0-6 (Kudos model) ─── independent (but needs db:push)
P0-7 (Profile name) ─── independent
P0-8 (X-Forwarded-For) ─── independent
P0-9 (Body size limit) ─── independent
P0-10 (Notification consolidation) ─── independent

P1-3 (CI/CD) ─┬─ P1-9 (API tests)
              └─ P1-13 (E2E tests)
P1-6 (Cloud sync) ─┬─ P1-10 (PWA service worker)
                    └─ P1-15 (Background sync fix)
P1-1 (Zod) ─── P2-6 (OpenAPI spec)
```

---

## Summary

| Sprint | Tasks | Severity | Timeline | Milestone |
|--------|-------|----------|----------|-----------|
| **Sprint 1** | 10 | 🔴 Critical | Week 1 | Unblocked from production |
| **Sprint 2** | 18 | 🟠 High | Week 2 | Production-grade |
| **Sprint 3** | 12 | 🟡 Medium | Week 3 | Well-tested + documented |
| **Sprint 4** | 8 | 🔵 Low | Week 4 | Polished |
| **Total** | **48** | | **4 weeks** | **SaaS-ready** |
