---

description: "Atomic task list for Sprint 2 API Hardening implementation"
---

# Tasks: Sprint 2 API Hardening

**Input**: Implementation plan from `.specify/plans/sprint2-api-hardening.md`

**Prerequisites**: `plan.md` (required), `spec.md` (required for user stories)

**Organization**: Tasks are grouped into a Foundational phase, two user-story phases (US1 = Zod Validation, US2 = Per-User Rate Limiting), and a final Verification phase. Within each user-story phase, tasks are decomposed by route group to enable parallel execution.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with sibling tasks (different files, no cross-dependencies within the group)
- **[Story]**: `US1` = Zod Input Validation (P1-1), `US2` = Per-User Rate Limiting (P1-5), `SHARED` = foundational/verification
- Include exact file paths in descriptions

## Path Conventions

- Single project: `src/` at repository root
- All paths below are relative to `/home/z/my-project/`

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: Shared validation utility that ALL subsequent tasks depend on. MUST complete before any US1 or US2 task begins.

**⚠️ CRITICAL**: No user-story work can begin until this phase is complete.

---

- [ ] **S2-T01** [SHARED] Create `src/lib/apiSchemas.ts` — shared Zod primitives + `parseRequestBody` / `parseQueryParams` / `parsePathParam` helpers, and add re-exports to `src/lib/validation.ts`

**Files to create**:

1. `src/lib/apiSchemas.ts` (NEW):

```typescript
import { z } from "zod";
import { NextRequest } from "next/server";

// ── Shared Zod primitives ──
// These mirror the rules in src/lib/validation.ts (validateId, validateDisplayName,
// validateOptionalUrl) so that co-located route schemas stay terse and consistent.

/** ID primitive: non-empty trimmed string, no whitespace/control chars, max 200 chars. */
export const zId = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[^\s\x00-\x1f\x7f]+$/u, "no whitespace or control chars");

/** Display name: 1-50 chars, no control chars. */
export const zDisplayName = z
  .string()
  .trim()
  .min(1)
  .max(50)
  .regex(/^[^\x00-\x1f\x7f]+$/u, "no control chars");

/**
 * Optional URL: accepts null, "", undefined, or a valid http(s) URL.
 * Always normalizes to `string | null`.
 */
export const zOptionalUrl = z
  .union([
    z.null(),
    z.literal(""),
    z
      .string()
      .trim()
      .url()
      .refine((v) => {
        try {
          const u = new URL(v);
          return u.protocol === "http:" || u.protocol === "https:";
        } catch {
          return false;
        }
      }, "must be http or https"),
  ])
  .transform((v) => (v === null || v === "" ? null : v))
  .optional()
  .nullable();

// ── Parse helpers ──

export type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; response: Response };

/**
 * Parse and validate a JSON request body against a Zod schema.
 * - Returns 400 { error: "Invalid JSON body" } if req.json() throws.
 * - Returns 400 { error: "Validation failed", details: [...] } if schema rejects.
 * - Returns { success: true, data } if schema accepts.
 */
export async function parseRequestBody<T>(
  req: NextRequest,
  schema: z.ZodType<T>
): Promise<ParseResult<T>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return {
      success: false,
      response: Response.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      ),
    };
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      success: false,
      response: Response.json(
        {
          error: "Validation failed",
          details: result.error.issues.map((i) => ({
            path: i.path,
            message: i.message,
          })),
        },
        { status: 400 }
      ),
    };
  }
  return { success: true, data: result.data };
}

/**
 * Parse and validate URL search params against a Zod schema.
 * - Returns 400 { error: "Validation failed", details: [...] } if schema rejects.
 */
export function parseQueryParams<T>(
  req: NextRequest,
  schema: z.ZodType<T>
): ParseResult<T> {
  const url = new URL(req.url);
  const obj: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    obj[key] = value;
  });
  const result = schema.safeParse(obj);
  if (!result.success) {
    return {
      success: false,
      response: Response.json(
        {
          error: "Validation failed",
          details: result.error.issues.map((i) => ({
            path: i.path,
            message: i.message,
          })),
        },
        { status: 400 }
      ),
    };
  }
  return { success: true, data: result.data };
}

/**
 * Parse and validate a dynamic path parameter (e.g. challengeId) against a Zod schema.
 * - Returns 400 { error: "Validation failed", details: [...] } if schema rejects.
 */
export function parsePathParam<T>(
  value: string,
  schema: z.ZodType<T>
): ParseResult<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    return {
      success: false,
      response: Response.json(
        {
          error: "Validation failed",
          details: result.error.issues.map((i) => ({
            path: i.path,
            message: i.message,
          })),
        },
        { status: 400 }
      ),
    };
  }
  return { success: true, data: result.data };
}

// ── Strict-vs-strip policy (documented, per spec FR-006) ──
// Identity/ID-bearing routes use .strict() (reject unknown keys → 400).
// Large AI payloads + social content routes use .strip() (silently drop unknown keys).
// Each route's schema.ts documents which mode it uses in a comment.
```

2. `src/lib/validation.ts` (MODIFY — append re-exports at the bottom; do NOT delete existing exports):

```typescript
// Re-export the Zod-based parsers for convenience. The manual validators above
// remain for backward compatibility (handlePrismaError, errorResponse, etc.)
// and will be migrated to Zod-only in Sprint 4.
export { parseRequestBody, parseQueryParams, parsePathParam } from "./apiSchemas";
export type { ParseResult } from "./apiSchemas";
```

**Verification**:
```bash
npx tsc --noEmit
# Expected: 0 errors
```

**Checkpoint**: Foundation ready — US1 and US2 implementation can now begin in parallel (US1 tasks depend on T01; US2 task T08 has no dependency on T01).

---

## Phase 2: User Story 1 — Zod Input Validation (Priority: P1) 🎯

**Goal**: Every POST/DELETE/PUT API route validates its request body with an explicit Zod schema, and every GET route with query parameters validates those parameters, before any business logic runs. Malformed input returns `400` with a structured error; valid input proceeds unchanged.

**Independent Test**: Send deliberately malformed JSON to each route (wrong types, missing required fields, extra forbidden fields, oversized strings) and assert a `400` response — without touching any downstream service, database, or AI provider.

### Schema Creation Tasks (parallelizable by route group)

---

- [ ] **S2-T02** [P] [US1] Create AI route Zod schemas — `src/app/api/ai-coach/schema.ts` and `src/app/api/ai-workout/schema.ts`

**Files to create**:

1. `src/app/api/ai-coach/schema.ts` (NEW) — `.strip()` mode (forward-compat for large AI payloads):

```typescript
import { z } from "zod";

// STRIP mode: unknown keys are silently dropped (forward-compat with new client fields).
// Rationale: the AI coach payload is large and client-driven; new fields may be added
// without coordinated server releases. Strict mode would break older servers.

const setSchema = z.object({
  weight: z.number().min(0).max(1e6),
  reps: z.number().min(0).max(1e6),
  completed: z.boolean(),
});

const exerciseSchema = z.object({
  exerciseId: z.string().min(1).max(200),
  exerciseName: z.string().min(1).max(200),
  sets: z.array(setSchema).max(100),
});

const sessionSchema = z.object({
  date: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  exercises: z.array(exerciseSchema).max(50),
  duration: z.number().min(0).max(86400),
  completed: z.boolean(),
});

const personalRecordSchema = z.object({
  exerciseId: z.string().min(1).max(200),
  exerciseName: z.string().min(1).max(200),
  maxWeight: z.number().min(0).max(1e6),
  max1RM: z.number().min(0).max(1e6),
  date: z.string().min(1).max(50),
});

const profileSchema = z.object({
  gender: z.string().nullable(),
  age: z.number().int().min(5).max(120),
  goal: z.string().nullable(),
  fitnessLevel: z.string().nullable(),
  trainingYears: z.number().int().min(0).max(80),
  equipment: z.array(z.string().max(100)).max(50),
  priorityMuscles: z.array(z.string().max(100)).max(50),
  physiqueFocus: z.string(),
  injuries: z.array(z.string().max(100)).max(50),
  medicalCautions: z.array(z.string().max(100)).max(50),
  mobilityLimited: z.boolean(),
  daysPerWeek: z.number().int().min(1).max(7),
  sessionLengthMin: z.number().int().min(10).max(240),
  intensityStyle: z.string(),
  includeCardio: z.boolean(),
  includeWarmup: z.boolean(),
  includeCoreFinisher: z.boolean(),
  bodyFatLevel: z.string().nullable(),
  heightCm: z.number().min(50).max(300),
  weightKg: z.number().min(20).max(400),
});

const analyticsSchema = z.object({
  streak: z.number().int().min(0),
  totalWorkouts: z.number().int().min(0),
  totalVolume: z.number().min(0).max(1e12),
  totalDuration: z.number().min(0),
  muscleGroupStats: z
    .array(z.object({ muscle: z.string().max(100), volume: z.number() }))
    .max(20),
  weeklyTonnage: z
    .array(z.object({ week: z.string().max(50), tonnage: z.number() }))
    .max(26),
});

const exerciseRefSchema = z.object({
  id: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  target: z.string().max(100),
  equipment: z.string().max(100),
  bodyPart: z.string().max(100),
});

export const coachRequestSchema = z
  .object({
    profile: profileSchema,
    recentSessions: z.array(sessionSchema).max(50),
    personalRecords: z.array(personalRecordSchema).max(50),
    analytics: analyticsSchema,
    exercises: z.array(exerciseRefSchema).min(1).max(500),
    userPrompt: z.string().trim().max(1000).optional(),
  })
  .strip();

export type CoachRequest = z.infer<typeof coachRequestSchema>;
```

2. `src/app/api/ai-workout/schema.ts` (NEW) — `.strict()` mode (prompt-injection guard):

```typescript
import { z } from "zod";

// STRICT mode: unknown keys (esp. `prompt`, `systemInstruction`) → 400.
// Rationale: this route interpolates fields into an LLM prompt. The strict schema
// is the declarative guard that replaces the manual `if (body.prompt !== undefined)` check.

export const structuredRequestBodySchema = z
  .object({
    goal: z.string().max(200).nullable().optional(),
    age: z.number().int().min(5).max(120).optional(),
    gender: z.string().max(50).nullable().optional(),
    fitnessLevel: z.string().max(50).nullable().optional(),
    equipment: z.array(z.string().max(100)).max(50).optional(),
    selectedMuscles: z.array(z.string().max(100)).max(50).optional(),
    // NOTE: `prompt` and `systemInstruction` are deliberately absent → .strict() rejects them.
  })
  .strict();

export type StructuredRequestBody = z.infer<typeof structuredRequestBodySchema>;
```

**Verification**:
```bash
npx tsc --noEmit
# Expected: 0 errors (schemas compile, z.infer types resolve)
```

**Depends on**: S2-T01

---

- [ ] **S2-T03** [P] [US1] Create Auth + Challenges route Zod schemas — 5 files: `auth/session/schema.ts`, `challenges/schema.ts`, `challenges/[challengeId]/join/schema.ts`, `challenges/[challengeId]/progress/schema.ts`, `challenges/sync-volume/schema.ts`

**Files to create**:

1. `src/app/api/auth/session/schema.ts` (NEW) — `.strict()` mode:

```typescript
import { z } from "zod";

// STRICT mode: only idToken accepted.
export const sessionPostSchema = z
  .object({
    idToken: z.string().min(1).max(4096),
  })
  .strict();

export type SessionPostBody = z.infer<typeof sessionPostSchema>;
```

2. `src/app/api/challenges/schema.ts` (NEW) — shared path-param schema:

```typescript
import { z } from "zod";

// Shared by join, leaderboard, progress routes (dynamic [challengeId] segment).
export const challengeIdParamSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[^\s\x00-\x1f\x7f]+$/u);
```

3. `src/app/api/challenges/[challengeId]/join/schema.ts` (NEW) — `.strict()` mode:

```typescript
import { z } from "zod";
import { zId, zDisplayName, zOptionalUrl } from "@/lib/apiSchemas";

// STRICT mode: identity-bearing route (userId impersonation check follows in handler).
export const joinBodySchema = z
  .object({
    userId: zId,
    userName: zDisplayName,
    userPhotoURL: zOptionalUrl,
  })
  .strict();

export type JoinBody = z.infer<typeof joinBodySchema>;
```

4. `src/app/api/challenges/[challengeId]/progress/schema.ts` (NEW) — GET query schema:

```typescript
import { z } from "zod";
import { zId } from "@/lib/apiSchemas";

// GET query schema for progress lookup.
export const progressQuerySchema = z
  .object({
    userId: zId,
  })
  .strict();

export type ProgressQuery = z.infer<typeof progressQuerySchema>;
```

5. `src/app/api/challenges/sync-volume/schema.ts` (NEW) — `.strict()` mode:

```typescript
import { z } from "zod";
import { zId } from "@/lib/apiSchemas";

// STRICT mode: identity-bearing route (userId must match callerUid).
export const syncVolumeBodySchema = z
  .object({
    userId: zId,
    totalVolume: z.number().min(0).max(1e9), // replaces the runtime clamp
    sessionId: zId.optional(),
  })
  .strict();

export type SyncVolumeBody = z.infer<typeof syncVolumeBodySchema>;
```

**Verification**:
```bash
npx tsc --noEmit
# Expected: 0 errors
```

**Depends on**: S2-T01

---

- [ ] **S2-T04** [P] [US1] Create Social route Zod schemas — 8 files: `comments/schema.ts`, `feed/schema.ts`, `follow/schema.ts`, `following/schema.ts`, `kudos/schema.ts`, `posts/schema.ts`, `profile/schema.ts`, `search/schema.ts`

**Files to create**:

1. `src/app/api/social/comments/schema.ts` (NEW) — mixed modes:

```typescript
import { z } from "zod";
import { zId } from "@/lib/apiSchemas";

// STRIP mode for POST (content route — forward-compat).
export const commentCreateSchema = z
  .object({
    postId: zId,
    text: z.string().trim().min(1).max(500), // preserves current 500-char cap
  })
  .strip();

// STRICT mode for DELETE (identity-bearing — commentId ownership check follows).
export const commentDeleteSchema = z
  .object({
    postId: zId,
    commentId: zId,
  })
  .strict();

// GET query schema.
export const commentsQuerySchema = z
  .object({
    postId: zId,
  })
  .strict();

export type CommentCreateBody = z.infer<typeof commentCreateSchema>;
export type CommentDeleteBody = z.infer<typeof commentDeleteSchema>;
```

2. `src/app/api/social/feed/schema.ts` (NEW) — `.strip()` mode:

```typescript
import { z } from "zod";
import { zId, zDisplayName, zOptionalUrl } from "@/lib/apiSchemas";

// STRIP mode: content route. Author identity is verified against callerUid in handler.
export const feedPostSchema = z
  .object({
    authorUid: zId,
    authorName: zDisplayName,
    authorPhotoURL: zOptionalUrl,
    workoutTitle: z.string().trim().min(1).max(100),
    duration: z.number().int().min(0).max(86400), // max 24h
    totalVolume: z.number().min(0).max(1e9),
    exercisesCount: z.number().int().min(0).max(100),
  })
  .strip();

export type FeedPostBody = z.infer<typeof feedPostSchema>;
```

3. `src/app/api/social/follow/schema.ts` (NEW) — `.strict()` mode:

```typescript
import { z } from "zod";
import { zId } from "@/lib/apiSchemas";

// STRICT mode: identity-bearing route (currentUid must match callerUid).
export const followBodySchema = z
  .object({
    currentUid: zId,
    targetUid: zId,
  })
  .strict();

export type FollowBody = z.infer<typeof followBodySchema>;
```

4. `src/app/api/social/following/schema.ts` (NEW) — GET query schema:

```typescript
import { z } from "zod";
import { zId } from "@/lib/apiSchemas";

// GET query schema. includeProfiles is coerced from "true"/"false" string.
export const followingQuerySchema = z
  .object({
    uid: zId,
    includeProfiles: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
  })
  .strict();

export type FollowingQuery = z.infer<typeof followingQuerySchema>;
```

5. `src/app/api/social/kudos/schema.ts` (NEW) — `.strict()` mode:

```typescript
import { z } from "zod";
import { zId } from "@/lib/apiSchemas";

// STRICT mode: identity-bearing (postId ownership implicit via kudos unique constraint).
export const kudosBodySchema = z
  .object({
    postId: zId,
  })
  .strict();

export type KudosBody = z.infer<typeof kudosBodySchema>;
```

6. `src/app/api/social/posts/schema.ts` (NEW) — `.strict()` mode:

```typescript
import { z } from "zod";
import { zId } from "@/lib/apiSchemas";

// STRICT mode: identity-bearing (post ownership check in handler).
export const postDeleteSchema = z
  .object({
    postId: zId,
  })
  .strict();

export type PostDeleteBody = z.infer<typeof postDeleteSchema>;
```

7. `src/app/api/social/profile/schema.ts` (NEW) — `.strict()` mode:

```typescript
import { z } from "zod";
import { zId, zDisplayName, zOptionalUrl } from "@/lib/apiSchemas";

// STRICT mode: identity-bearing (uid must match callerUid).
export const profileBodySchema = z
  .object({
    uid: zId,
    displayName: zDisplayName,
    photoURL: zOptionalUrl,
  })
  .strict();

export type ProfileBody = z.infer<typeof profileBodySchema>;
```

8. `src/app/api/social/search/schema.ts` (NEW) — GET query schema:

```typescript
import { z } from "zod";

// GET query schema. q is optional — empty/missing q returns [] (current behavior).
export const searchQuerySchema = z
  .object({
    q: z.string().trim().max(100).optional(),
  })
  .strict();

export type SearchQuery = z.infer<typeof searchQuerySchema>;
```

**Verification**:
```bash
npx tsc --noEmit
# Expected: 0 errors (all 8 social schemas compile)
```

**Depends on**: S2-T01

---

### Route Migration Tasks (parallelizable by route group; each depends on its matching schema task)

---

- [ ] **S2-T05** [P] [US1] Migrate AI route handlers — `src/app/api/ai-coach/route.ts` and `src/app/api/ai-workout/route.ts`

**Files to modify**:

1. `src/app/api/ai-coach/route.ts`:

**Changes**:
- Add import: `import { parseRequestBody } from "@/lib/apiSchemas";` and `import { coachRequestSchema, type CoachRequest } from "./schema";`
- Remove the local `interface CoachRequest { ... }` (lines 15-78 in current file) — now imported from schema.
- Replace the POST handler body section:
  ```typescript
  // BEFORE:
  const body = (await req.json()) as CoachRequest;
  const userPrompt = validateString(body.userPrompt, 1000) || "Generate my next workout";
  if (!body.profile || !body.exercises || body.exercises.length === 0) {
    return NextResponse.json({ error: "Missing profile or exercises data" }, { status: 400 });
  }
  ```
  with:
  ```typescript
  // AFTER:
  const parsed = await parseRequestBody(req, coachRequestSchema);
  if (!parsed.success) return parsed.response;
  const body: CoachRequest = parsed.data;
  const userPrompt = body.userPrompt || "Generate my next workout";
  ```
- Remove the now-unused `validateString` import (if no other usage in the file — verify before removing).
- The rest of the handler (`buildCoachPrompt(body)`, AI router call, JSON validation) is unchanged — `body` is now the typed `CoachRequest`.

2. `src/app/api/ai-workout/route.ts`:

**Changes**:
- Add import: `import { parseRequestBody } from "@/lib/apiSchemas";` and `import { structuredRequestBodySchema, type StructuredRequestBody } from "./schema";`
- Remove the local `interface StructuredRequestBody { ... }` (lines 8-15).
- Replace the POST handler body section:
  ```typescript
  // BEFORE:
  const body = await req.json();
  if (body.prompt !== undefined || body.systemInstruction !== undefined) {
    return NextResponse.json(
      { error: "Explicitly forbidden fields in request: prompt, systemInstruction" },
      { status: 400 }
    );
  }
  const { goal, age, gender, fitnessLevel, equipment, selectedMuscles } = body as StructuredRequestBody;
  ```
  with:
  ```typescript
  // AFTER:
  const parsed = await parseRequestBody(req, structuredRequestBodySchema);
  if (!parsed.success) return parsed.response;
  const { goal, age, gender, fitnessLevel, equipment, selectedMuscles } = parsed.data;
  ```
- The `.strict()` schema rejects `prompt`/`systemInstruction` declaratively — the manual `if` check is removed.

**Verification**:
```bash
npx tsc --noEmit
# Expected: 0 errors (route handlers compile against new schemas)
```

**Depends on**: S2-T02

---

- [ ] **S2-T06** [P] [US1] Migrate Auth + Challenges route handlers — 5 files: `auth/session/route.ts`, `challenges/[challengeId]/join/route.ts`, `challenges/[challengeId]/leaderboard/route.ts`, `challenges/[challengeId]/progress/route.ts`, `challenges/sync-volume/route.ts`

**Files to modify**:

1. `src/app/api/auth/session/route.ts` (POST only; DELETE has no body):

**Changes**:
- Add import: `import { parseRequestBody } from "@/lib/apiSchemas";` and `import { sessionPostSchema } from "./schema";`
- In POST handler, replace:
  ```typescript
  // BEFORE:
  const { idToken } = await req.json();
  if (!idToken) {
    return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
  }
  ```
  with:
  ```typescript
  // AFTER:
  const parsed = await parseRequestBody(req, sessionPostSchema);
  if (!parsed.success) return parsed.response;
  const { idToken } = parsed.data;
  ```

2. `src/app/api/challenges/[challengeId]/join/route.ts` (POST):

**Changes**:
- Add imports: `import { parseRequestBody, parsePathParam } from "@/lib/apiSchemas";`, `import { joinBodySchema, type JoinBody } from "./schema";`, `import { challengeIdParamSchema } from "../../schema";`
- Remove local `interface JoinBody { ... }`.
- Order: `requireUser` → parse body → impersonation check (preserves current order; avoids parsing body for unauthenticated requests). Insert path-param validation right after `await params`:
  ```typescript
  const { challengeId: rawChallengeId } = await params;
  const pathParsed = parsePathParam(rawChallengeId, challengeIdParamSchema);
  if (!pathParsed.success) return pathParsed.response;
  const challengeId = pathParsed.data;
  ```
- Replace body parsing + manual validators:
  ```typescript
  // BEFORE:
  const body = (await req.json()) as JoinBody;
  const userId = validateId(body.userId);
  const userName = validateDisplayName(body.userName);
  const userPhotoURL = validateOptionalUrl(body.userPhotoURL);
  if (!userId || !userName) {
    return NextResponse.json({ error: "Missing or invalid userId or userName" }, { status: 400 });
  }
  ```
  with:
  ```typescript
  // AFTER:
  const parsed = await parseRequestBody(req, joinBodySchema);
  if (!parsed.success) return parsed.response;
  const { userId, userName, userPhotoURL } = parsed.data;
  ```
- Remove now-unused `validateId`, `validateDisplayName`, `validateOptionalUrl` imports IF no other usage. Keep `handlePrismaError`, `serverErrorResponse` (still used).
- The `requireUser` + impersonation check (`if (userId !== callerUid)`) remains unchanged.

3. `src/app/api/challenges/[challengeId]/leaderboard/route.ts` (GET, no query):

**Changes**:
- Add imports: `import { parsePathParam } from "@/lib/apiSchemas";`, `import { challengeIdParamSchema } from "../../schema";`
- Insert path-param validation right after `await params`:
  ```typescript
  const { challengeId: rawChallengeId } = await params;
  const pathParsed = parsePathParam(rawChallengeId, challengeIdParamSchema);
  if (!pathParsed.success) return pathParsed.response;
  const challengeId = pathParsed.data;
  ```
- Rest of handler unchanged.

4. `src/app/api/challenges/[challengeId]/progress/route.ts` (GET with query):

**Changes**:
- Add imports: `import { parseQueryParams, parsePathParam } from "@/lib/apiSchemas";`, `import { progressQuerySchema } from "./schema";`, `import { challengeIdParamSchema } from "../../schema";`
- Insert path-param validation after `await params`.
- Replace query parsing:
  ```typescript
  // BEFORE:
  const { searchParams } = new URL(req.url);
  const rawUserId = searchParams.get("userId");
  const userId = validateId(rawUserId);
  if (!userId) {
    return NextResponse.json({ error: "Missing or invalid userId query parameter" }, { status: 400 });
  }
  ```
  with:
  ```typescript
  // AFTER:
  const parsed = parseQueryParams(req, progressQuerySchema);
  if (!parsed.success) return parsed.response;
  const { userId } = parsed.data;
  ```
- Remove `validateId` import if unused elsewhere.

5. `src/app/api/challenges/sync-volume/route.ts` (POST):

**Changes**:
- Add imports: `import { parseRequestBody } from "@/lib/apiSchemas";`, `import { syncVolumeBodySchema } from "./schema";`
- Remove local `interface SyncVolumeBody { ... }`.
- Replace body parsing + clamp:
  ```typescript
  // BEFORE:
  const { userId, totalVolume, sessionId } = (await req.json()) as SyncVolumeBody;
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }
  // ... (requireUser + impersonation check) ...
  const volume = Number(totalVolume) || 0;
  const clampedVolume = Math.min(Math.max(0, volume), 1e9);
  if (clampedVolume <= 0) {
    return NextResponse.json({ ok: true, updated: 0 });
  }
  ```
  with:
  ```typescript
  // AFTER:
  const parsed = await parseRequestBody(req, syncVolumeBodySchema);
  if (!parsed.success) return parsed.response;
  const { userId, totalVolume, sessionId } = parsed.data;
  // ... (requireUser + impersonation check unchanged) ...
  // Schema already enforces 0 <= totalVolume <= 1e9; no runtime clamp needed.
  if (totalVolume <= 0) {
    return NextResponse.json({ ok: true, updated: 0 });
  }
  ```
- Update the loop body to use `totalVolume` instead of `clampedVolume`:
  ```typescript
  // In the tx loop:
  const updatedRow = await tx.participation.update({
    where: { id: p.id },
    data: { progressKg: { increment: totalVolume } },  // was: clampedVolume
    select: { progressKg: true },
  });
  ```
- Note: `requireUser` + impersonation check remains BEFORE the parse in the current code order. **Confirm order during implementation**: current code does `await req.json()` first, then `requireUser`. We preserve that order: parse body → requireUser → impersonation check. (This is acceptable because the body is small for sync-volume.)

**Verification**:
```bash
npx tsc --noEmit
# Expected: 0 errors
```

**Depends on**: S2-T03

---

- [ ] **S2-T07** [P] [US1] Migrate Social route handlers — 8 files: `comments/route.ts`, `feed/route.ts`, `follow/route.ts`, `following/route.ts`, `kudos/route.ts`, `posts/route.ts`, `profile/route.ts`, `search/route.ts`

**Files to modify**:

1. `src/app/api/social/comments/route.ts` (GET, POST, DELETE):

**Changes**:
- Add imports: `import { parseRequestBody, parseQueryParams } from "@/lib/apiSchemas";`, `import { commentCreateSchema, commentDeleteSchema, commentsQuerySchema, type CommentCreateBody, type CommentDeleteBody } from "./schema";`
- Remove local `interface CommentCreateBody` and `interface CommentDeleteBody`.
- **GET**: replace `searchParams.get("postId")` + `if (!postId)` with `parseQueryParams(req, commentsQuerySchema)`.
- **POST**: replace `(await req.json()) as CommentCreateBody` + `if (!postId || !text?.trim())` + `text.trim().slice(0, 500)` with `parseRequestBody(req, commentCreateSchema)`. The schema trims + caps text. Use `parsed.data.text` directly (already trimmed, already capped).
- **DELETE**: replace `(await req.json()) as CommentDeleteBody` + `if (!postId || !commentId)` with `parseRequestBody(req, commentDeleteSchema)`.

2. `src/app/api/social/feed/route.ts` (GET, POST):

**Changes**:
- Add imports: `import { parseRequestBody } from "@/lib/apiSchemas";`, `import { feedPostSchema } from "./schema";`
- Remove local `interface FeedPostBody`.
- **GET**: unchanged (already calls `requireUser`, no query params).
- **POST**: replace the `FeedPostBody` cast + 7 manual validators + 2 `if` checks with:
  ```typescript
  const parsed = await parseRequestBody(req, feedPostSchema);
  if (!parsed.success) return parsed.response;
  const { authorUid, authorName, authorPhotoURL, workoutTitle, duration, totalVolume, exercisesCount } = parsed.data;
  ```
- Remove `validateId`, `validateDisplayName`, `validateOptionalUrl`, `validateString`, `validateInt` imports if unused elsewhere (keep `serverErrorResponse`).

3. `src/app/api/social/follow/route.ts` (POST, DELETE):

**Changes**:
- Add imports: `import { parseRequestBody } from "@/lib/apiSchemas";`, `import { followBodySchema } from "./schema";`
- Remove local `interface FollowBody`.
- **Both POST and DELETE**: replace `FollowBody` cast + `validateId` x2 + `if (!follower || !following)` with `parseRequestBody(req, followBodySchema)`. Preserve the `if (follower === following)` self-follow check (now `if (parsed.data.currentUid === parsed.data.targetUid)`).
- Remove `validateId` import if unused (keep `serverErrorResponse`).

4. `src/app/api/social/following/route.ts` (GET):

**Changes**:
- Add imports: `import { parseQueryParams } from "@/lib/apiSchemas";`, `import { followingQuerySchema } from "./schema";`
- Replace `searchParams.get("uid")` + `if (!uid)` + `searchParams.get("includeProfiles") === "true"` with `parseQueryParams(req, followingQuerySchema)`. The schema coerces `includeProfiles` to boolean. Use `parsed.data.uid` and `parsed.data.includeProfiles`.

5. `src/app/api/social/kudos/route.ts` (POST):

**Changes**:
- Add imports: `import { parseRequestBody } from "@/lib/apiSchemas";`, `import { kudosBodySchema } from "./schema";`
- Remove local `interface KudosBody`.
- Replace `KudosBody` cast + `validateId(postId)` + `if (!id)` with `parseRequestBody(req, kudosBodySchema)`. Use `parsed.data.postId` as the `id` (rename for clarity or keep `const { postId } = parsed.data; const id = postId;`).
- Remove `validateId` import if unused (keep `handlePrismaError`).

6. `src/app/api/social/posts/route.ts` (DELETE):

**Changes**:
- Add imports: `import { parseRequestBody } from "@/lib/apiSchemas";`, `import { postDeleteSchema } from "./schema";`
- Remove local `interface PostDeleteBody`.
- Replace `PostDeleteBody` cast + `if (!postId)` with `parseRequestBody(req, postDeleteSchema)`.

7. `src/app/api/social/profile/route.ts` (POST):

**Changes**:
- Add imports: `import { parseRequestBody } from "@/lib/apiSchemas";`, `import { profileBodySchema } from "./schema";`
- Remove local `interface ProfileBody`.
- Replace `ProfileBody` cast + `validateId`/`validateDisplayName`/`validateOptionalUrl` + `if (!uid || !displayName)` with `parseRequestBody(req, profileBodySchema)`.
- Remove `validateId`, `validateDisplayName`, `validateOptionalUrl` imports if unused (keep `serverErrorResponse`).

8. `src/app/api/social/search/route.ts` (GET):

**Changes**:
- Add imports: `import { parseQueryParams } from "@/lib/apiSchemas";`, `import { searchQuerySchema } from "./schema";`
- Replace `searchParams.get("q")` + `validateString(rawQ, 100)` + `if (!q) return []` with `parseQueryParams(req, searchQuerySchema)`. The schema's `.optional()` means missing `q` parses to `undefined`; handler returns `[]` if `q` is undefined or empty:
  ```typescript
  const parsed = parseQueryParams(req, searchQuerySchema);
  if (!parsed.success) return parsed.response;
  const q = parsed.data.q;
  if (!q) {
    return NextResponse.json([]);
  }
  ```
- Remove `validateString` import if unused (keep `serverErrorResponse`).

**Verification**:
```bash
npx tsc --noEmit
# Expected: 0 errors (all 8 social routes compile)
bun run lint
# Expected: 0 new errors (pre-existing warnings OK)
```

**Depends on**: S2-T04

**Checkpoint**: At this point, User Story 1 (Zod Input Validation) is fully implemented. All 12 POST/DELETE routes and 4 GET-with-query routes validate input via Zod. Test independently by sending malformed JSON to any route and asserting a `400` response.

---

## Phase 3: User Story 2 — Per-User Rate Limiting (Priority: P1) 🎯

**Goal**: Authenticated API routes rate-limit per verified user (not per IP), keyed on the callerUid extracted from the Firebase session cookie. Unauthenticated routes fall back to IP. Limits: AI 20/hr, sync 60/hr, social-writes 100/hr, default 300/hr — with a 1-hour token-bucket window.

**Independent Test**: Log in as two different users from the same IP, hammer `/api/ai-coach` as User A until the 20/hr limit triggers, and assert that User B can still call `/api/ai-coach` successfully (their bucket is independent).

> **Note**: US2 tasks (S2-T08, S2-T09) have NO dependency on US1 tasks. They can be executed in parallel with US1 if team capacity allows. However, the final verification task (S2-T10) depends on BOTH stories being complete.

---

- [ ] **S2-T08** [P] [US2] Create `src/lib/rateLimit.ts` — extracted rate-limit logic (categories, token bucket, uid extraction, bucket key builder)

**File to create**: `src/lib/rateLimit.ts` (NEW):

```typescript
import { NextRequest } from "next/server";
import { getAdminAuth } from "./firebaseAdmin";

// ── Rate-limit categories (per spec FR-014) ──
export type RateLimitCategory = "ai" | "sync" | "social-writes" | "default";

const CATEGORY_LIMITS: Record<RateLimitCategory, number> = {
  ai: 20, // 20/hr across ai-coach + ai-workout
  sync: 60, // 60/hr across sync-volume + (future) sync/push
  "social-writes": 100, // 100/hr across all social POST/DELETE
  default: 300, // 300/hr for everything else
};

// Map (method, pathname) → category. Order matters: more specific patterns first.
const CATEGORY_RULES: {
  pattern: RegExp;
  methods: Set<string>;
  category: RateLimitCategory;
}[] = [
  { pattern: /^\/api\/ai-coach$/, methods: new Set(["POST"]), category: "ai" },
  { pattern: /^\/api\/ai-workout$/, methods: new Set(["POST"]), category: "ai" },
  {
    pattern: /^\/api\/challenges\/sync-volume$/,
    methods: new Set(["POST"]),
    category: "sync",
  },
  {
    pattern: /^\/api\/sync\/push$/,
    methods: new Set(["POST", "PUT"]),
    category: "sync",
  },
  {
    pattern: /^\/api\/social\//,
    methods: new Set(["POST", "DELETE", "PUT", "PATCH"]),
    category: "social-writes",
  },
];

export function categorizeRequest(
  method: string,
  pathname: string
): RateLimitCategory {
  for (const rule of CATEGORY_RULES) {
    if (rule.methods.has(method) && rule.pattern.test(pathname)) {
      return rule.category;
    }
  }
  return "default";
}

// ── Token bucket (per spec FR-015: 1-hour window) ──
interface Bucket {
  tokens: number;
  lastRefill: number;
}

// Module-level Map — persists across requests within the same server instance.
const buckets = new Map<string, Bucket>();

// 1-hour window (per spec FR-015). Capacity = category limit.
export const WINDOW_MS = 3_600_000;

export function checkRateLimit(
  bucketKey: string,
  category: RateLimitCategory
): { allowed: boolean; remaining: number } {
  const limit = CATEGORY_LIMITS[category];
  const now = Date.now();

  let bucket = buckets.get(bucketKey);
  if (!bucket) {
    bucket = { tokens: limit, lastRefill: now };
    buckets.set(bucketKey, bucket);
  }

  const elapsed = now - bucket.lastRefill;
  const refill = (elapsed / WINDOW_MS) * limit;
  bucket.tokens = Math.min(limit, bucket.tokens + refill);
  bucket.lastRefill = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return { allowed: true, remaining: Math.floor(bucket.tokens) };
  }
  return { allowed: false, remaining: 0 };
}

// ── Bucket cleanup (per spec FR-024: 2-hour idle eviction) ──
let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 5 * 60_000; // every 5 min (unchanged)
const IDLE_EVICT_CUTOFF_MS = 2 * 3_600_000; // 2 hours (was 10 min)

export function cleanupBuckets(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  const cutoff = now - IDLE_EVICT_CUTOFF_MS;
  for (const [key, bucket] of buckets) {
    if (bucket.lastRefill < cutoff) {
      buckets.delete(key);
    }
  }
}

// ── Uid extraction for rate-limit keying (per spec FR-016, FR-018) ──
// Fast-path uid extraction for rate-limit keying ONLY.
// Uses verifySessionCookie(cookie, false) — signature check, no revocation check
// (no network call). The authoritative auth boundary remains requireUser at the route.
// Returns null if: no cookie, cookie invalid/expired, or firebase-admin fails to init.
// NEVER throws — always falls back to null (caller falls back to IP).
export async function extractUidForRateLimit(
  req: NextRequest
): Promise<string | null> {
  const cookie = req.cookies.get("pulse_session")?.value;
  if (!cookie) return null;
  try {
    const decoded = await getAdminAuth().verifySessionCookie(cookie, false);
    return decoded.uid;
  } catch {
    // Invalid/expired/garbage cookie OR firebase-admin init failure.
    // Fall back to IP-based rate limiting. Do NOT throw.
    return null;
  }
}

// ── Bucket key builder (per spec FR-013) ──
export function buildBucketKey(
  uid: string | null,
  ip: string,
  category: RateLimitCategory
): string {
  if (uid) {
    return `uid:${uid}:${category}`;
  }
  return `ip:${ip}:${category}`;
}
```

**Verification**:
```bash
npx tsc --noEmit
# Expected: 0 errors (rateLimit.ts compiles, firebaseAdmin import resolves)
```

**Depends on**: None (independent of US1). Can run in parallel with S2-T01..S2-T07.

---

- [ ] **S2-T09** [US2] Rewrite `src/middleware.ts` — switch to Node.js runtime, per-user-per-category rate limiting, preserve all Sprint 1 work

**File to modify**: `src/middleware.ts`

**Changes**:

1. **Add runtime declaration** (FR-017) at the top of the file:
   ```typescript
   export const runtime = "nodejs"; // required for firebase-admin (fs/path usage)
   ```

2. **Remove old rate-limit internals** from `middleware.ts` (moved to `rateLimit.ts`):
   - Delete: `interface Bucket`, `const buckets = new Map<...>()`, `const WINDOW_MS = 60_000`, `const ROUTE_LIMITS = [...]`, `const DEFAULT_LIMIT = 120`, `function getRateLimit(...)`, `function checkRateLimit(...)`, `function cleanupBuckets()`, `let lastCleanup`.
   - **Keep**: `getTrustedProxyIps()`, `getClientIp()` (P0-8 — unchanged), `BODY_SIZE_LIMITS`, `getBodySizeLimit()` (P0-9 — unchanged), `const WRITE_METHODS`, `export const config`.

3. **Add imports** from `rateLimit.ts`:
   ```typescript
   import {
     categorizeRequest,
     checkRateLimit,
     cleanupBuckets,
     extractUidForRateLimit,
     buildBucketKey,
   } from "@/lib/rateLimit";
   ```

4. **Rewrite the `middleware()` function** body (order is critical):

```typescript
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // ── P0-9: Body size check (unchanged from Sprint 1) ──
  const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
  if (contentLength > 0) {
    const maxBytes = getBodySizeLimit(pathname);
    if (contentLength > maxBytes) {
      return NextResponse.json(
        {
          error: `Request body too large. Maximum allowed: ${maxBytes / 1024}KB.`,
        },
        { status: 413 }
      );
    }
  }

  // ── P1-5: Per-user rate limiting ──
  cleanupBuckets();
  const category = categorizeRequest(req.method, pathname);
  const ip = getClientIp(req); // P0-8 secure IP extraction
  const uid = await extractUidForRateLimit(req); // null if no/invalid cookie
  const bucketKey = buildBucketKey(uid, ip, category);
  const { allowed, remaining } = checkRateLimit(bucketKey, category);

  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": "3600", // conservative static (per FR-022)
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  // ── P0-2: Write-method session-cookie existence check (unchanged) ──
  if (WRITE_METHODS.has(req.method)) {
    const hasSession = req.cookies.has("pulse_session");
    if (!hasSession) {
      return NextResponse.json(
        { error: "Authentication required. Please sign in." },
        { status: 401 }
      );
    }
  }

  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  return response;
}
```

5. **Preserve `config` export** (unchanged):
   ```typescript
   export const config = {
     matcher: ["/api/:path*"],
   };
   ```

**Behavioral changes**:
- Window: 1 min → 1 hour.
- Bucket key: `${ip}:${pathname}` → `uid:<uid>:<cat>` or `ip:<ip>:<cat>`.
- Category: per-route → per-category (4 categories).
- Uid extraction: none → `verifySessionCookie(cookie, false)` with null fallback.
- Runtime: Edge (default) → Node.js.
- Cleanup cutoff: 10 min → 2 hours.

**Behavioral preservations**:
- P0-8 `getClientIp` with `TRUSTED_PROXY_IPS` — unchanged.
- P0-9 body-size limits — unchanged.
- P0-2 write-method cookie-existence check — unchanged.
- 429 response shape + headers — unchanged.
- `X-RateLimit-Remaining` on success — unchanged (now reflects per-user/per-IP bucket).
- Matcher `/api/:path*` — unchanged.

**Verification**:
```bash
npx tsc --noEmit
# Expected: 0 errors
bun run lint
# Expected: 0 new errors
# Check dev server starts cleanly:
tail -20 /home/z/my-project/dev.log
# Expected: "Ready in" message, no Error lines
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/
# Expected: 200 (app still loads)
```

**Depends on**: S2-T08

**Checkpoint**: At this point, User Story 2 (Per-User Rate Limiting) is fully implemented. Test independently by logging in as two users on the same IP and verifying independent rate-limit buckets.

---

## Phase 4: End-to-End Verification

**Purpose**: Verify the full system against all 12 Success Criteria from the spec. No code changes here unless a criterion fails (in which case, return to the relevant task).

---

- [ ] **S2-T10** [SHARED] End-to-end verification — run all verification steps from the plan, confirm SC-001 through SC-012 pass, perform Agent Browser golden-path test

**No files to create/modify** — this is a verification-only task.

**Verification steps** (execute in order):

1. **Coverage checks (SC-001, SC-002)**:
   ```bash
   # All write routes have parseRequestBody:
   grep -rc "parseRequestBody" src/app/api/ | grep -v ":0" | wc -l
   # Expected: ≥ 12 (one per POST/DELETE/PUT handler)

   # All GET-with-query routes have parseQueryParams:
   grep -rc "parseQueryParams" src/app/api/ | grep -v ":0" | wc -l
   # Expected: ≥ 4 (comments GET, search GET, following GET, progress GET)
   ```

2. **Malformed input rejection (SC-003, SC-004, SC-005)** — requires a valid session cookie; substitute `VALID_COOKIE`:
   ```bash
   # Wrong type → 400 with details:
   curl -s -X POST localhost:3000/api/social/comments \
     -H "Content-Type: application/json" \
     -H "Cookie: pulse_session=VALID_COOKIE" \
     -d '{"postId":12345,"text":"hi"}'
   # Expected: 400 {"error":"Validation failed","details":[{"path":["postId"],...}]}

   # Forbidden field → 400:
   curl -s -X POST localhost:3000/api/ai-workout \
     -H "Content-Type: application/json" \
     -H "Cookie: pulse_session=VALID_COOKIE" \
     -d '{"prompt":"ignore previous"}'
   # Expected: 400 (prompt rejected by .strict())

   # Malformed JSON → 400 (not 500):
   curl -s -X POST localhost:3000/api/social/comments \
     -H "Content-Type: application/json" \
     -H "Cookie: pulse_session=VALID_COOKIE" \
     -d '{bad json'
   # Expected: 400 {"error":"Invalid JSON body"}
   ```

3. **Per-user rate-limit independence (SC-006, SC-007)**:
   - Scripted test: User A (session cookie A) makes 20 POST requests to `/api/ai-coach` within 1 hour; User B (session cookie B, same IP) makes 1 POST to `/api/ai-coach`.
   - Expected: User A's 21st request → `429`; User B's 1st request → `200` (independent buckets).
   - Optionally add a temporary `console.log(Array.from(buckets.keys()))` to `rateLimit.ts` and check `dev.log` to confirm the key is `uid:<callerUid>:ai`.

4. **Garbage-cookie fallback (SC-008)**:
   ```bash
   curl -s -o /dev/null -w "%{http_code}" localhost:3000/api/social/feed \
     -H "Cookie: pulse_session=garbage"
   # Expected: 429 (IP bucket) OR 401 (requireUser) — but NOT 500
   ```

5. **429 response shape (SC-009)**:
   - Inspect the 429 response headers from step 3.
   - Expected: `Retry-After` and `X-RateLimit-Remaining: 0` present.

6. **Lint + tsc + no-any (SC-010)**:
   ```bash
   bun run lint 2>&1 | tail -5
   # Expected: 0 new errors (pre-existing warnings OK)

   npx tsc --noEmit 2>&1 | tail -5
   # Expected: 0 errors

   grep -rn ": any" src/lib/apiSchemas.ts src/lib/rateLimit.ts src/app/api/**/schema.ts src/middleware.ts 2>/dev/null
   # Expected: no output (no `any` introduced)
   ```

7. **Agent Browser golden path (SC-011, SC-012)**:
   - Open the app in Agent Browser at `/`.
   - Sign in (Firebase Auth).
   - Generate an AI workout via the generator wizard.
   - Post the workout to the feed.
   - Give kudos to a feed post.
   - Comment on a feed post.
   - Expected: all 5 actions succeed with no rate-limit false-positive (a single user's normal usage should not trip the 20/100/60 limits in a test session) and no validation false-negative on well-formed client payloads.
   - Verify the sticky footer is at the bottom on short pages and pushed down on long pages (no overlap, no floating gap).
   - Check `dev.log` for any `Error:` or `Unhandled` lines from middleware or route handlers during the test.

8. **Dev log final check**:
   ```bash
   tail -50 /home/z/my-project/dev.log
   # Expected: no Error/Unhandled lines from the test session
   ```

**Depends on**: S2-T05, S2-T06, S2-T07 (US1 complete) AND S2-T09 (US2 complete)

**If any criterion fails**: Return to the relevant task (S2-T01..S2-T09), fix the root cause, and re-run the full verification. Do not mark S2-T10 complete until all 12 success criteria pass.

---

## Dependencies & Execution Order

### Task Dependency Graph

```
S2-T01 (apiSchemas.ts)  ──┬──> S2-T02 (AI schemas)         ──> S2-T05 (AI routes)        ──┐
                           ├──> S2-T03 (Auth+Ch schemas)    ──> S2-T06 (Auth+Ch routes)   ──┤
                           └──> S2-T04 (Social schemas)     ──> S2-T07 (Social routes)    ──┤
                                                                                            ├──> S2-T10 (verify)
S2-T08 (rateLimit.ts) ──────────────────────> S2-T09 (middleware.ts) ─────────────────────┘
```

### Parallel Opportunities

| Parallel Group | Tasks | Condition |
|----------------|-------|-----------|
| **A** (schema creation) | S2-T02, S2-T03, S2-T04 | After S2-T01 completes — all three can run in parallel (different files, no cross-deps) |
| **B** (route migration) | S2-T05, S2-T06, S2-T07 | After their matching schema task (T05←T02, T06←T03, T07←T04) — all three can run in parallel |
| **C** (rate limiting) | S2-T08 | Independent of US1 — can run in parallel with Groups A and B |
| **D** (middleware) | S2-T09 | After S2-T08 only — can run in parallel with Group B route migrations |

### Strict Sequential (if single-developer)

```
S2-T01 → S2-T02 → S2-T05 → S2-T03 → S2-T06 → S2-T04 → S2-T07 → S2-T08 → S2-T09 → S2-T10
```

### Recommended Parallel Execution (if multi-developer or sub-agent)

```
Developer/Agent 1: S2-T01 → (S2-T02 → S2-T05) → (S2-T03 → S2-T06) → (S2-T04 → S2-T07)
Developer/Agent 2:                                    S2-T08 → S2-T09
Merge:                                                                              → S2-T10
```

---

## Within-Task Rules

- **One file at a time**: Each task touches a defined set of files. Do not modify files outside the task's scope.
- **Verify after each task**: Run the verification step (tsc/lint) before marking the task complete and moving to the next.
- **Commit after each task**: Use a descriptive commit message referencing the task ID (e.g., `feat(sprint2): S2-T01 add apiSchemas shared validation utility`).
- **No `any` types**: All new code uses explicit types or Zod-inferred types (constitution rule 1).
- **No new dependencies**: `zod@^4.0.2` and `firebase-admin@^14.0.0` are already installed.
- **Preserve Sprint 1 work**: Do not regress P0-2 (session cookie check), P0-8 (IP trust), P0-9 (body size limits).

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete S2-T01 (foundational utility).
2. Complete S2-T02, S2-T03, S2-T04 (all schemas — can be parallel).
3. Complete S2-T05, S2-T06, S2-T07 (all route migrations — can be parallel).
4. **STOP and VALIDATE**: Send malformed JSON to every route; confirm `400` responses. Confirm valid requests still work (Agent Browser golden path with the old per-IP rate limiter still in place).
5. Deploy/demo US1 if ready — the app is more secure even without per-user rate limiting.

### Incremental Delivery

1. S2-T01 → foundation ready.
2. S2-T02..S2-T07 → US1 (Zod validation) complete → test independently → deploy.
3. S2-T08 → rate-limit module ready (not yet wired in).
4. S2-T09 → US2 (per-user rate limiting) complete → test independently → deploy.
5. S2-T10 → full system verified against all 12 success criteria.

---

## Notes

- **[P] tasks** = different files, no dependencies within the group.
- **[Story] label** maps each task to `US1`, `US2`, or `SHARED` for traceability to the spec's user stories.
- Each user story is independently completable and testable: US1 can ship without US2 (the old per-IP rate limiter continues to work until S2-T09 lands), and US2 can ship without US1 (the rate-limit module + middleware rewrite don't depend on Zod schemas).
- **Verify tsc after each task** — do not batch multiple tasks before checking types.
- **Commit after each task** — enables clean rollback if a later task reveals an issue.
- **Avoid**: vague tasks, same-file conflicts (none in this breakdown — each file is touched by exactly one task), cross-story dependencies that break independence.
- **The `zOptionalUrl` Zod syntax** (union + transform + nullable + optional) is the trickiest part of S2-T01. If it fails type-checking during implementation, simplify to a `.refine()`-based approach that accepts `string | null | undefined` and normalizes to `string | null`. The exact syntax is an implementation detail; the contract is "accepts null/''/undefined/valid-http(s)-URL, normalizes to `string | null`".
