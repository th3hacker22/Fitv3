# Pulse Fitness Constitution

## Core Principles

### I. Type Safety (NON-NEGOTIABLE)
All code must be strictly typed TypeScript. No `any` types are allowed — use `unknown` with type guards instead. Never set `ignoreBuildErrors: true` in tsconfig.json. Never set `eslintignore` for source files. All function parameters, return types, and state shapes must be explicitly typed.

### II. Offline-First Architecture
Dexie (IndexedDB) is the local source of truth for all user workout data (sessions, sets, PRs, measurements, photos, nutrition, routines). The server-side Prisma + SQLite database is ONLY for social features (feed, comments, kudos, follow) and challenges. Cloud sync is a background enhancement, never a blocker for core functionality. The app must function fully offline.

### III. Firebase Auth Only
Authentication uses Firebase Auth exclusively. Session cookies are minted via `firebase-admin`'s `createSessionCookie()` and verified via `verifySessionCookie(cookie, true)`. No next-auth, no custom JWT, no raw ID token storage in cookies. The `pulse_session` cookie is httpOnly, sameSite=lax, 7-day maxAge.

### IV. Security-First API Design
Every API route MUST call `requireUser(req)` and verify the caller's identity. Never trust client-supplied `x-user-name`, `x-user-photo`, or `x-user-uid` headers. Author identity is always fetched from `prisma.publicProfile.findUnique({ where: { uid: callerUid } })`. Input validation (Zod or manual) is required on ALL POST/DELETE/PUT endpoints. Rate limiting is enforced in middleware.

### V. Progressive Enhancement
UI components use Tailwind CSS v4 with shadcn/ui (New York style). Dark mode is the default identity. All animations must respect `prefers-reduced-motion`. WCAG AAA contrast is the target. Touch targets must be ≥44×44px. The app is mobile-first (max-w-md) but responsive to desktop.

## Technology Stack

### Frontend
- **Framework**: Next.js 16 with App Router (Turbopack)
- **Language**: TypeScript 5 (strict mode, no `any`)
- **Styling**: Tailwind CSS v4 with shadcn/ui component library
- **State**: Zustand for client state (individual selectors, not bare store subscriptions)
- **Charts**: Recharts
- **Animation**: Framer Motion
- **Icons**: Lucide React

### Backend
- **Database**: Prisma ORM with SQLite (client: `@prisma/client`)
- **Auth**: Firebase Auth (client SDK) + firebase-admin (server session cookies)
- **Storage**: Firebase Storage (avatars, progress photos)
- **AI**: Multi-provider router (z-ai-sdk → OpenRouter → heuristic fallback)
- **Rate Limiting**: In-memory token bucket (middleware)

### Client-Side Database
- **Dexie** (IndexedDB): workout sessions, body measurements, progress photos, food entries, routines, exercise feedback, achievements, nutrition goals
- **localStorage**: user preferences (theme, settings), avatar, user name, water intake

## Strict Rules

1. **NEVER** use `any` type — use `unknown` with type guards
2. **NEVER** set `ignoreBuildErrors: true` in tsconfig.json or next.config.ts
3. **NEVER** set `ignoreDuringBuilds: true` in ESLint config
4. **NEVER** use `prisma db push` in development — use `prisma migrate dev` for schema changes
5. **NEVER** trust client-supplied identity headers — always verify via session cookie
6. **NEVER** store API keys in client-side code — all keys must be in `.env` (server-only)
7. **NEVER** use `console.log` in production code — use structured logging
8. **ALWAYS** use `cmd /c` prefix for Windows commands
9. **ALWAYS** run `bun run lint` before committing — 0 new errors allowed
10. **ALWAYS** verify Firebase Admin SDK is initialized before calling `requireUser`

## Development Workflow

1. **Spec**: Describe the feature in `.specify/specs/` using the spec template
2. **Plan**: Create implementation plan in `.specify/plans/` using the plan template
3. **Tasks**: Break down into atomic tasks in `.specify/tasks/` using the tasks template
4. **Implement**: One file at a time, following the task list
5. **Verify**: Run `bun run lint` + `npx tsc --noEmit` + browser verification
6. **Commit**: Descriptive commit message referencing the task ID

## Quality Gates

- **TypeScript**: `npx tsc --noEmit` must pass with 0 errors
- **ESLint**: `bun run lint` must pass (0 new errors, pre-existing warnings OK)
- **Browser**: Agent Browser verification for all UI changes
- **Security**: All new API routes must have `requireUser` + input validation
- **Performance**: No full-table scans on IndexedDB (use indexes where possible)

## Governance

This constitution supersedes all other practices. Amendments require documentation, approval, and migration plan. All PRs/reviews must verify compliance. Complexity must be justified with a comment explaining why a simpler approach wouldn't work.

**Version**: 1.0.0 | **Ratified**: 2026-06-20 | **Last Amended**: 2026-06-20
