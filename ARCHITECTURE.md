# Pulse Fitness — Architecture

**Last updated:** 2026-06-18

---

## High-Level Architecture

Pulse Fitness is an **offline-first** single-user fitness tracker built on Next.js 16.
All workout, body, and nutrition data lives in the browser's **IndexedDB (via Dexie)**.
The server (Prisma + SQLite) is only used for **shared, multi-user** features: social feed, follows, and volume challenges.

```
┌─────────────────────────────────────────────────────────────┐
│                       Browser (Client)                       │
│                                                              │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────────┐    │
│  │ React Pages │──▶│ Zustand     │──▶│ Dexie / IndexedDB│    │
│  │ (16 pages)  │   │ Stores (11) │   │  (offline-first) │    │
│  └─────────────┘   └─────────────┘   └─────────────────┘    │
│         │                  │                  │              │
│         │                  ▼                  │              │
│         │          ┌──────────────┐           │              │
│         │          │ Pure Services│           │              │
│         │          │ (workoutGen, │           │              │
│         │          │  overload,   │           │              │
│         │          │  fatigue...)│           │              │
│         │          └──────────────┘           │              │
│         │                                     │              │
└─────────┼─────────────────────────────────────┼─────────────┘
          │  fetch (Bearer JWT)                 │
          ▼                                     ▼
┌─────────────────────────────┐    ┌──────────────────────────┐
│   Next.js API Routes        │    │  Export/Import JSON      │
│  /api/ai-coach              │    │  (local backup)          │
│  /api/social/*              │    └──────────────────────────┘
│  /api/challenges/*          │
│  /api/auth/login (JWT)      │
│         │                   │
│         ▼                   │
│  ┌──────────────────┐       │
│  │ Prisma + SQLite  │       │
│  │ (shared data)    │       │
│  └──────────────────┘       │
└─────────────────────────────┘
```

---

## Key Decisions

### 1. Offline-first — workout data stays client-side
**Why:** Users can train without internet (gym, outdoor). Syncing heavy workout data would require auth + a backend that doesn't exist yet.
**Implication:** Progressive overload, fatigue management, learning loop all compute on local Dexie data via **pure modules**. No Prisma model for workouts.

### 2. Single visible route `/`
**Why:** Deployment constraint — only `/` is exposed. Client-side routing via Zustand (`useRouterStore`) keeps all 16 pages within a single shell.
**Files:** `src/app/page.tsx` (shell) + `src/router/` (in-memory router).

### 3. Pure service modules feed 3 paths
Every algorithm (workout generation, overload, fatigue, pairing, learning) is a **pure function module** under `src/services/`. It feeds:
1. **AI Coach prompt** (`/api/ai-coach`) — deterministic data injected into the LLM context
2. **Heuristic fallback** (`generateProgram`) — used when AI is offline/unavailable
3. **Ghost UI** (SetRow "Prev/Target" badges) — pre-fills suggested weights

### 4. Auth: signed JWT (replacing forgeable `x-user-uid`)
**Why:** `x-user-uid` header was self-reported by the client — any attacker could impersonate any user.
**Now:** Server issues HS256-signed JWT at `/api/auth/login` (7-day expiry). Middleware verifies signature + extracts `callerUid` from `sub`. Falls back to header-based in dev if `PULSE_JWT_SECRET` is unset (with loud warning).

### 5. Multi-provider AI router
**File:** `src/server/aiProviders.ts`
**Chain:** z-ai-sdk → Groq → Gemini → OpenRouter → heuristic fallback (graceful degradation).

---

## Data Storage Map

| Data                          | Storage        | Owner   |
|-------------------------------|----------------|---------|
| Workout sessions, sets, PRs   | IndexedDB      | Client  |
| Body measurements, photos     | IndexedDB      | Client  |
| Nutrition logs                | IndexedDB      | Client  |
| Exercise library (1324)       | IndexedDB      | Client  |
| Routines                      | IndexedDB      | Client  |
| Exercise feedback (learning)  | IndexedDB      | Client  |
| Public profiles               | Prisma/SQLite  | Shared  |
| Follows                       | Prisma/SQLite  | Shared  |
| Feed posts + comments         | Prisma/SQLite  | Shared  |
| Challenges + participation    | Prisma/SQLite  | Shared  |

---

## Test Strategy

- **Pure modules:** Vitest, deterministic, no mocks (`src/services/__tests__/`).
- **Stores:** Vitest + fake-indexeddb (`src/store/__tests__/`).
- **API integration:** Vitest, exercises real client store behavior.
- **Regression:** Tests that lock in Phase 1–5 fixes (OptionBtn hoist, router cap, etc.).
- **Baseline:** 138 tests across 14 files (pre-Sprint 1).

---

## File Layout (key paths)

```
src/
├── app/
│   ├── api/          # Next.js route handlers (social, challenges, ai-coach, auth)
│   ├── layout.tsx    # Root layout, theme init, PWA SW registration
│   └── page.tsx      # Single-route app shell + client router
├── components/
│   ├── workout/      # GeneratorWizard, SetRow, RestTimer, ExerciseWorkoutCard...
│   └── ...
├── db/
│   ├── schema.ts     # Dexie schema (WorkoutSession, BodyMeasurement, ...)
│   ├── analytics.ts  # PRs, streak, weekly volume, muscle stats
│   ├── repositories/ # CRUD wrappers per entity
│   └── migrations.ts
├── lib/
│   ├── db.ts         # Prisma client
│   ├── jwt.ts        # JWT sign/verify (Sprint 5)
│   ├── validation.ts # Input validation helpers
│   ├── authServer.ts # requireUser(req) (Sprint 5)
│   └── syncEngine.ts # Local backup export/import
├── server/
│   └── aiProviders.ts # Multi-provider LLM router
├── services/         # PURE modules: workoutGenerator, progressiveOverload, fatigue...
├── store/            # 11 Zustand stores
├── types/
└── utils/            # fitnessMath, muscleMapper, theme, audio...

prisma/
└── schema.prisma     # Social + challenges only

public/
├── manifest.json
├── sw.js             # Service worker (Sprint 5)
└── icons/
```
