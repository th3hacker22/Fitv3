# Pulse Fitness — Agent Instructions

## Commands (use `bun` not `npm`)

| Command | Purpose |
|---------|---------|
| `bun run dev` | Dev server on port 3000 |
| `bun run build` | Production build (standalone output) |
| `bun run start` | Run production server |
| `bun run lint` | ESLint check |
| `bun run test` | Vitest (once) |
| `bun run test:watch` | Vitest (watch) |
| `bun run db:push` | Push Prisma schema to SQLite |
| `bun run db:generate` | Regenerate Prisma client |
| `bun run db:migrate` | Create dev migration |
| `bun run db:reset` | Reset SQLite DB |

## Architecture

- **Single route SPA:** All pages live on `/` via a Zustand in-memory router (`src/router/index.ts`). Use `src/router-shim.tsx` `<Link>`, `useNavigate`, `useParams` for navigation.
- **16 client routes:** home, exercises, exercise-detail, workout, stats, body, profile, settings, auth, nutrition, feed, builder, wizard, generator-result, challenges, challenge-detail.
- **Offline-first:** User data (workouts, body, nutrition, routines) lives in IndexedDB via Dexie (`src/db/schema.ts`). Social/challenges use Prisma + SQLite.
- **No Firebase:** `src/lib/firebase.ts` is a null shim.

## Database

- **Client (Dexie/IndexedDB):** `PulseDB` class in `src/db/schema.ts`. Migrations in `src/db/migrations.ts` (v4–v8). Tables: exercises_v2, workoutSessions, bodyMeasurements, progressPhotos, userProfile, routines, foodEntries, nutritionGoals, unlockedAchievements, exerciseFeedback.
- **Server (Prisma/SQLite):** `prisma/schema.prisma` → `db/custom.db`. Models: PublicProfile, Follow, FeedPost, Comment, Challenge, Participation, SyncedWorkoutSession, ExerciseFeedback. No migration files — uses `db push`.
- **Prisma client singleton** in `src/lib/db.ts` cached on `globalThis`.

## Auth

- **No real authentication.** Any email or guest mode accepted. Password field is decorative.
- **Flow:** AuthPage → generate UID → save `LocalUser` to localStorage → POST `/api/auth/session` creates HS256 JWT cookie (`pulse_session`, 7d) → middleware verifies for write API routes.
- **Guest users:** UIDs like `local-guest-<random>`. **Bug:** POST `/api/auth/session` requires a Prisma `PublicProfile` record, which guests don't have. Guest session cookie is never set. If fixing: upsert PublicProfile in the session route instead of rejecting.
- **Files:** `src/lib/jwt.ts` (sign/verify), `src/lib/authServer.ts` (requireUser), `src/middleware.ts` (rate limiting + auth), `src/store/useAuthStore.ts` (zustand + initAuthListener).
- **Env vars:** `DATABASE_URL`, `JWT_SECRET` (required), `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`.

## Testing

- Vitest 4.x, env=node, `src/**/*.{test,spec}.{ts,tsx}`. Only 2 test files exist. `fake-indexeddb` in devDeps.
- Test setup needs `fake-indexeddb` configured for Dexie tests.

## Build & Deploy

- Production build: `next build` → standalone output copied to `.next/standalone/`. Scripts in `.zscripts/`.
- Reverse proxy: Caddy on port 81 → localhost:3000 (`Caddyfile`).
- No CI/CD pipelines exist.

## ESLint

- `@typescript-eslint/no-explicit-any: error` (strict)
- `@typescript-eslint/no-unused-vars: warn`
- `no-console: off`, `@next/next/no-img-element: off`
- Run: `bun run lint`

## Key File Map

| Purpose | Path |
|---------|------|
| App shell | `src/app/page.tsx` |
| Root layout | `src/app/layout.tsx` |
| Global CSS (design system) | `src/app/globals.css` |
| Client router | `src/router/index.ts` |
| Router compat shim | `src/router-shim.tsx` |
| Auth page | `src/pages/AuthPage.tsx` |
| Auth API | `src/app/api/auth/session/route.ts` |
| JWT utils | `src/lib/jwt.ts` |
| Auth middleware | `src/lib/authServer.ts` |
| Next.js middleware | `src/middleware.ts` |
| Dexie schema | `src/db/schema.ts` |
| Dexie migrations | `src/db/migrations.ts` |
| Prisma schema | `prisma/schema.prisma` |
| Prisma client | `src/lib/db.ts` |
| Sync engine | `src/lib/syncEngine.ts` |
| Workout generator | `src/services/workoutGenerator.ts` |
| AI provider router | `src/server/aiProviders.ts` |
| Validation utils | `src/lib/validation.ts` |
| Architecture doc | `ARCHITECTURE.md` |
| DB + Auth gap analysis | `docs/database-auth-sop.md` |
