# Database & Authentication — SOP & Gap Analysis

## 1. Database Architecture Overview

Pulse Fitness uses a **dual-database** architecture:

| Layer | Technology | Location | Purpose |
|-------|-----------|----------|---------|
| Client (offline-first) | **Dexie.js (IndexedDB)** | `src/db/schema.ts` | Workouts, body measurements, nutrition, routines, progress photos, achievements, exercise feedback |
| Server (shared) | **Prisma + SQLite** | `prisma/schema.prisma` → `db/custom.db` | Social feed, follows, challenges, public profiles |

### Client DB: Dexie / IndexedDB

- **Class:** `PulseDB extends Dexie` (name: `"PulseDB"`)
- **Tables:** `exercises_v2`, `workoutSessions`, `bodyMeasurements`, `progressPhotos`, `userProfile`, `routines`, `foodEntries`, `nutritionGoals`, `unlockedAchievements`, `exerciseFeedback`
- **Migrations:** `src/db/migrations.ts` — versions 4 through 8
- **Schema error handling:** `db.open()` catches `UpgradeError` with an alert — data is preserved, not auto-migrated
- **Test helper:** `fake-indexeddb` available in devDependencies for unit testing

### Server DB: Prisma / SQLite

- **Provider:** `sqlite`
- **URL:** `file:../db/custom.db` (from `DATABASE_URL` env var)
- **Client singleton:** `src/lib/db.ts` — caches PrismaClient on `globalThis` to avoid hot-reload leaks
- **No migration files** — uses `prisma db push` directly (no migration history)
- **Commands:**
  - `bun run db:push` — push schema to DB
  - `bun run db:generate` — regenerate Prisma client
  - `bun run db:migrate` — create dev migration
  - `bun run db:reset` — reset database

### Models (Prisma)

| Model | Key Fields | Notes |
|-------|-----------|-------|
| `PublicProfile` | `uid` (PK), `displayName`, `photoURL` | One per user, created on first profile upsert |
| `Follow` | `followerUid`, `followingUid` (unique pair) | Bidirectional relations to PublicProfile |
| `FeedPost` | `authorUid`, `workoutTitle`, `duration`, `totalVolume`, `exercisesCount` | Tracks kudosCount, commentCount as denormalized counters |
| `Comment` | `postId` (FK → FeedPost), `authorUid`, `text` | Cascade delete with post |
| `Challenge` | `id`, `title`, `description`, `goalKg`, `startDate`, `endDate` | Seeded automatically when GET /api/challenges returns empty |
| `Participation` | `challengeId` + `userId` (unique) | Tracks `progressKg`, `completed` flag |
| `SyncedWorkoutSession` | `participationId` + `sessionId` (unique) | Links challenge participation to workout sessions |
| `ExerciseFeedback` | `exerciseId`, `action`, `timestamp` | Server-side mirror of client Dexie table |

---

## 2. Authentication Flow

### Architecture

- **No Firebase** — `src/lib/firebase.ts` is a shim that exports all nulls
- **Local-first identity** stored in `localStorage` key `"local_user"`
- **Server session** via HttpOnly cookie named `pulse_session` containing a JWT
- **JWT** HS256-signed (via `jose` library), 7-day expiry, payload: `{ uid: string }`

### Flow Diagram

```
AuthPage
  │
  ├─ Email sign-in:  generates UID = `local-user-${sanitizedEmail}`
  ├─ Guest sign-in:  generates UID = `local-guest-${crypto.randomUUID()}`
  │
  ├─ POST /api/auth/session  ──→  checks PublicProfile exists in Prisma
  │                                ↓ exists?        → creates JWT, sets cookie
  │                                ↓ not exists?    → returns 403 (bug for guests)
  │
  ├─ localStorage.setItem("local_user", JSON.stringify(mockUser))
  ├─ useAuthStore.setUser(mockUser)
  │
  └─ socialService.updatePublicProfile()  ──→  POST /api/social/profile
                                                → upserts PublicProfile in Prisma
                                                → requires valid JWT cookie
```

### Key Files

| File | Role |
|------|------|
| `src/pages/AuthPage.tsx` | Login UI — accepts any email or guest mode |
| `src/store/useAuthStore.ts` | Zustand store + `initAuthListener()` reads localStorage |
| `src/lib/jwt.ts` | `signJwt(uid)` and `verifyJwt(token)` |
| `src/lib/authServer.ts` | `getTokenFromCookie(req)` and `requireUser(req)` middleware helper |
| `src/app/api/auth/session/route.ts` | POST (create JWT+session) and DELETE (clear cookie) |
| `src/middleware.ts` | Rate limiting (token bucket) + JWT verification for API routes |

### Middleware Protection

- **Rate limiting:** In-memory token bucket per IP+path, 1-minute window
  - `/api/ai-workout`: 5 req/min
  - `/api/challenges/sync-volume`: 10 req/min
  - `/api/social/comments`: 20 req/min
  - `/api/social/feed`: 30 req/min
  - Default: 120 req/min
- **Auth enforcement:** All POST/DELETE/PUT/PATCH to `/api/social/*` and `/api/challenges/*` require valid JWT via `requireUser()`
- **Middleware only runs on `/api/:path*`** (non-API routes pass through)

---

## 3. Gap Analysis

### Critical Bugs

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| **G1** | **Guest users cannot obtain JWT session cookie** | `src/app/api/auth/session/route.ts:15-17` | Guest UIDs (`local-guest-*`) don't exist in Prisma `PublicProfile`. `findUnique` returns null → 403. The cookie is never set. Guest social features (feed, challenges) silently fail. |
| **G2** | **`.env` contains live OpenRouter API key** | `.env` file (committed to repo) | Secret exposed in version control. Anyone with repo access can use the key. |

### Security Gaps

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| **S1** | Password field is decorative | `AuthPage.tsx:177-182` | Any value accepted. No password verification or hashing. |
| **S2** | No email verification | `AuthPage.tsx` | Any email string accepted. No confirmation step. |
| **S3** | UID generation is fragile | `AuthPage.tsx:24` | `email.replace(/[^a-zA-Z0-9]/g, "")` — email collisions possible if sanitization produces same string |
| **S4** | `JWT_SECRET` may be missing | `.env` vs `.env.example` | Listed in `.env.example` but not in actual `.env`. If unset, `jwt.ts:6-8` throws at runtime. |
| **S5** | Rate limiting is in-memory only | `middleware.ts:9` | `Map<string, Bucket>` — lost on server restart, not shared across processes/instances |
| **S6** | No session refresh mechanism | `middleware.ts` | Cookie expires after 7 days with no refresh. Expired sessions require full re-login. |
| **S7** | No user deletion or account management | — | No API or UI to delete account, clear data, or manage sessions. |

### Database Gaps

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| **D1** | No Prisma migration history | `prisma/` | Uses `db push` instead of `migrate dev`. No version tracking, no rollback. Schema changes in production are risky. |
| **D2** | Dexie migrations stop at v8 | `src/db/migrations.ts` | No downgrade path. Schema errors trigger an alert and preserve data but don't fix the issue. |
| **D3** | No data export/import test coverage | `src/lib/syncEngine.ts` | `exportJSON`/`importJSON` exist but have no tests. |
| **D4** | Prisma connection cleanup on hot reload | `src/lib/db.ts:17-25` | SIGTERM/SIGINT handlers registered, but Next.js dev hot-reload may leak connections. |

### Testing Gaps

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| **T1** | Only 2 test files exist | `src/utils/__tests__/` | No tests for auth, DB operations, API routes, stores, or services. |
| **T2** | Vitest environment is `node` | `vitest.config.ts:11` | Browser tests use jsdom but IndexedDB tests need `fake-indexeddb` setup. No such setup exists. |

### Operational Gaps

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| **O1** | No CI/CD pipeline | `.github/workflows/` missing | No automated linting, testing, or building on commits/PRs. |
| **O2** | Manual build/deploy scripts | `.zscripts/` | `build.sh`, `start.sh` — no containerization or orchestration. |
| **O3** | `mini-services/` is empty | `mini-services/.gitkeep` | Referenced in build scripts but contains no actual services. |
