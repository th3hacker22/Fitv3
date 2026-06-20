# Implementation Plan: Sprint 2 API Hardening

**Branch**: `sprint2-api-hardening` | **Date**: 2026-06-20 | **Spec**: [sprint2-api-hardening.md](../specs/sprint2-api-hardening.md)

**Input**: Feature specification from `.specify/specs/sprint2-api-hardening.md`

## Summary

Implement two high-priority hardening items: **(P1-1)** Zod input validation for every API route's request body and query parameters (12 write routes + 4 GET-with-query routes + 3 path-param routes), and **(P1-5)** per-user rate limiting keyed on the verified callerUid extracted from the Firebase session cookie, falling back to IP for unauthenticated routes. Limits: AI 20/hr, social-writes 100/hr, sync 60/hr, default 300/hr — with a 1-hour token-bucket window.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Next.js 16 (Turbopack, App Router)

**Primary Dependencies**: `zod@^4.0.2` (already installed), `firebase-admin@^14.0.0` (already installed), Next.js middleware API, Prisma 6

**Storage**: N/A (no schema changes in this sprint — no Prisma migrations)

**Testing**: `bun run lint` + `npx tsc --noEmit` + Agent Browser end-to-end verification

**Target Platform**: Linux server (Caddy reverse proxy → Next.js Node.js runtime)

**Performance Goals**: Zod `safeParse` must add <2ms overhead per request (in-memory schema validation). Middleware uid-extraction via `verifySessionCookie(cookie, false)` must add <5ms (cached Firebase public keys, no network call).

**Constraints**: Must not break existing API routes or the dev server. All changes must compile cleanly. No `any` types (constitution rule 1). No new runtime dependencies. No behavioral regression on valid requests.

**Scale/Scope**: 1 new shared utility file, 1 new schemas directory with 18 schema files (co-located), 18 route files modified, 1 middleware file modified, 1 validation utility file extended. ~25 functional requirements decomposed into 6 implementation phases.

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Type Safety | ✅ Pass | All Zod schemas produce inferred types; no `any` introduced. `parseRequestBody<T>` is generic. |
| II. Offline-First | ✅ Pass | No changes to Dexie or offline behavior. API validation only affects server-side routes. |
| III. Firebase Auth Only | ✅ Pass | Middleware uid-extraction uses `verifySessionCookie(cookie, false)` (Firebase session cookie). `requireUser` at routes unchanged (`verifySessionCookie(cookie, true)`). No next-auth, no custom JWT. |
| IV. Security-First API | ✅ Pass | Directly implements Article IV mandates: Zod validation on all write endpoints + rate limiting in middleware. |
| V. Progressive Enhancement | ✅ Pass | No UI changes in this sprint. |
| Rule: No `any` | ✅ Pass | All new code uses explicit types or Zod-inferred types. |
| Rule: No `ignoreBuildErrors` | ✅ Pass | Not touched. |
| Rule: No `db push` | ✅ Pass | No schema changes. |
| Rule: `cmd /c` prefix | ✅ Pass | N/A (Linux environment). |
| Rule: `bun run lint` before commit | ✅ Pass | Verification gate included in execution sequence. |
| Rule: Verify Firebase Admin initialized before `requireUser` | ✅ Pass | `getAdminAuth()` singleton in `firebaseAdmin.ts` handles init; middleware wraps uid-extraction in try/catch and falls back to IP. |

## Project Structure

### Files to Create

```text
src/lib/apiSchemas.ts                    # Shared Zod schemas + parseRequestBody/parseQueryParams helpers
src/lib/rateLimit.ts                     # NEW: extracted rate-limit logic (categories, buckets, uid extraction)
src/app/api/ai-coach/schema.ts           # Zod schema for CoachRequest
src/app/api/ai-workout/schema.ts         # Zod schema for StructuredRequestBody
src/app/api/auth/session/schema.ts       # Zod schema for { idToken }
src/app/api/challenges/schema.ts         # Zod schema for challengeId path param (shared by 3 routes)
src/app/api/challenges/[challengeId]/join/schema.ts        # Zod schema for JoinBody
src/app/api/challenges/sync-volume/schema.ts               # Zod schema for SyncVolumeBody
src/app/api/social/comments/schema.ts    # Zod schemas for CommentCreateBody + CommentDeleteBody + GET query
src/app/api/social/feed/schema.ts        # Zod schema for FeedPostBody
src/app/api/social/follow/schema.ts      # Zod schema for FollowBody
src/app/api/social/following/schema.ts   # Zod schema for GET query (uid, includeProfiles)
src/app/api/social/kudos/schema.ts       # Zod schema for KudosBody
src/app/api/social/posts/schema.ts       # Zod schema for PostDeleteBody
src/app/api/social/profile/schema.ts     # Zod schema for ProfileBody
src/app/api/social/search/schema.ts      # Zod schema for GET query (q)
```

### Files to Modify

```text
src/middleware.ts                                     # P1-5: per-user rate limiting, runtime=nodejs, 1hr window, categories
src/lib/validation.ts                                 # P1-1: re-export parseRequestBody/parseQueryParams from apiSchemas (convenience)
src/app/api/ai-coach/route.ts                         # P1-1: call parseRequestBody with CoachRequestSchema
src/app/api/ai-workout/route.ts                       # P1-1: call parseRequestBody with StructuredRequestBodySchema (.strict)
src/app/api/auth/session/route.ts                     # P1-1: call parseRequestBody with SessionBodySchema (POST only)
src/app/api/challenges/[challengeId]/join/route.ts    # P1-1: parseRequestBody + path param validation
src/app/api/challenges/[challengeId]/leaderboard/route.ts  # P1-1: path param validation only (GET, no query)
src/app/api/challenges/[challengeId]/progress/route.ts     # P1-1: parseQueryParams + path param validation
src/app/api/challenges/sync-volume/route.ts           # P1-1: call parseRequestBody with SyncVolumeBodySchema
src/app/api/social/comments/route.ts                  # P1-1: parseRequestBody (POST+DELETE) + parseQueryParams (GET)
src/app/api/social/feed/route.ts                      # P1-1: call parseRequestBody with FeedPostBodySchema (POST)
src/app/api/social/follow/route.ts                    # P1-1: call parseRequestBody with FollowBodySchema (POST+DELETE)
src/app/api/social/following/route.ts                 # P1-1: call parseQueryParams with FollowingQuerySchema (GET)
src/app/api/social/kudos/route.ts                     # P1-1: call parseRequestBody with KudosBodySchema
src/app/api/social/posts/route.ts                     # P1-1: call parseRequestBody with PostDeleteBodySchema
src/app/api/social/profile/route.ts                   # P1-1: call parseRequestBody with ProfileBodySchema
src/app/api/social/search/route.ts                    # P1-1: call parseQueryParams with SearchQuerySchema
```

### Files NOT Modified

```text
src/app/api/route.ts                  # GET-only, no params, no validation needed
src/app/api/ai-health/route.ts        # GET-only, no params, no validation needed
src/app/api/challenges/route.ts       # GET-only, no params, no validation needed
prisma/schema.prisma                  # No schema changes
Caddyfile                             # No gateway changes
package.json                          # No new dependencies
```

**Structure Decision**: Single-project layout (existing). New `schema.ts` files are co-located with their `route.ts` (Next.js convention — keeps route + schema together). Shared helpers live in `src/lib/`. Rate-limit logic extracted to `src/lib/rateLimit.ts` to keep `middleware.ts` focused on request orchestration.

---

## Implementation Phases

### Phase 1: Shared Validation Utility (FR-004, FR-005, FR-009)

**Why first**: Every subsequent phase depends on `parseRequestBody` and `parseQueryParams`. Building the shared utility first means each route migration is a thin change (import + one call), and the 400 response shape is guaranteed uniform.

**File**: `src/lib/apiSchemas.ts` (NEW)

**Contents**:

1. **Re-exports** of common Zod primitives so route schemas stay terse:
   ```typescript
   import { z } from "zod";

   // Shared primitives — mirror the rules in src/lib/validation.ts
   export const zId = z.string().trim().min(1).max(200).regex(/^[^\s\x00-\x1f\x7f]+$/u, "no whitespace or control chars");
   export const zDisplayName = z.string().trim().min(1).max(50).regex(/^[^\x00-\x1f\x7f]+$/u, "no control chars");
   export const zOptionalUrl = z.union([z.null(), z.literal("")]).catch(null)
     .or(z.string().trim().url().refine(
       (v) => { try { const u = new URL(v); return u.protocol === "http:" || u.protocol === "https:"; } catch { return false; } },
       "must be http or https"
     ).transform((v) => v || null).optional().nullable());
   // NOTE: zOptionalUrl is designed to accept null, "", undefined, or a valid http(s) URL,
   // and always normalize to `string | null`. Implementation detail to be finalized in code.
   ```

2. **`parseRequestBody<T>` helper**:
   ```typescript
   export type ParseResult<T> =
     | { success: true; data: T }
     | { success: false; response: Response };

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
   ```

3. **`parseQueryParams<T>` helper**:
   ```typescript
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
   ```

4. **`parsePathParam<T>` helper** (for dynamic route segments like `challengeId`):
   ```typescript
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
   ```

5. **Strict-vs-strip policy constant** (documented):
   ```typescript
   // Policy (per spec FR-006):
   // - Identity/ID-bearing routes use .strict() (reject unknown keys → 400)
   // - Large AI payloads + social content routes use .strip() (silently drop unknown keys)
   // Each route's schema.ts documents which mode it uses in a comment.
   ```

**File**: `src/lib/validation.ts` (MODIFY — add re-exports only, no deletion)

Add at the bottom:
```typescript
// Re-export the Zod-based parsers for convenience. The manual validators above
// remain for backward compatibility (handlePrismaError, errorResponse, etc.)
// and will be migrated to Zod-only in Sprint 4.
export { parseRequestBody, parseQueryParams, parsePathParam } from "./apiSchemas";
export type { ParseResult } from "./apiSchemas";
```

**Verification**: `npx tsc --noEmit` → 0 errors. The helpers compile and export correctly.

---

### Phase 2: Per-Route Zod Schemas (FR-001, FR-002, FR-003, FR-006, FR-007, FR-008)

**Why second**: Schemas must exist before routes can call them. This phase creates all 16 `schema.ts` files (some routes share, e.g. the 3 challenge routes share `challengeId` path param schema). Each schema is self-contained and independently testable.

**File**: `src/app/api/ai-coach/schema.ts` (NEW) — `.strip()` mode (forward-compat for AI payloads)

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
  age: z.number().int().min(5).max(120),       // NEW safety bound (NEEDS CONFIRMATION per spec)
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
  heightCm: z.number().min(50).max(300),       // NEW safety bound
  weightKg: z.number().min(20).max(400),       // NEW safety bound
});

const analyticsSchema = z.object({
  streak: z.number().int().min(0),
  totalWorkouts: z.number().int().min(0),
  totalVolume: z.number().min(0).max(1e12),
  totalDuration: z.number().min(0),
  muscleGroupStats: z.array(z.object({ muscle: z.string().max(100), volume: z.number() })).max(20),
  weeklyTonnage: z.array(z.object({ week: z.string().max(50), tonnage: z.number() })).max(26),
});

const exerciseRefSchema = z.object({
  id: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  target: z.string().max(100),
  equipment: z.string().max(100),
  bodyPart: z.string().max(100),
});

export const coachRequestSchema = z.object({
  profile: profileSchema,
  recentSessions: z.array(sessionSchema).max(50),
  personalRecords: z.array(personalRecordSchema).max(50),
  analytics: analyticsSchema,
  exercises: z.array(exerciseRefSchema).min(1).max(500),
  userPrompt: z.string().trim().max(1000).optional(),
}).strip();

export type CoachRequest = z.infer<typeof coachRequestSchema>;
```

**File**: `src/app/api/ai-workout/schema.ts` (NEW) — `.strict()` mode (prompt-injection guard)

```typescript
import { z } from "zod";

// STRICT mode: unknown keys (esp. `prompt`, `systemInstruction`) → 400.
// Rationale: this route interpolates fields into an LLM prompt. The strict schema
// is the declarative guard that replaces the manual `if (body.prompt !== undefined)` check.

export const structuredRequestBodySchema = z.object({
  goal: z.string().max(200).nullable().optional(),
  age: z.number().int().min(5).max(120).optional(),
  gender: z.string().max(50).nullable().optional(),
  fitnessLevel: z.string().max(50).nullable().optional(),
  equipment: z.array(z.string().max(100)).max(50).optional(),
  selectedMuscles: z.array(z.string().max(100)).max(50).optional(),
  // NOTE: `prompt` and `systemInstruction` are deliberately absent → .strict() rejects them.
}).strict();

export type StructuredRequestBody = z.infer<typeof structuredRequestBodySchema>;
```

**File**: `src/app/api/auth/session/schema.ts` (NEW) — `.strict()` mode

```typescript
import { z } from "zod";

// STRICT mode: only idToken accepted.
export const sessionPostSchema = z.object({
  idToken: z.string().min(1).max(4096),
}).strict();

export type SessionPostBody = z.infer<typeof sessionPostSchema>;
```

**File**: `src/app/api/challenges/schema.ts` (NEW) — shared path-param schema

```typescript
import { z } from "zod";

// Shared by join, leaderboard, progress routes.
export const challengeIdParamSchema = z.string().trim().min(1).max(200).regex(/^[^\s\x00-\x1f\x7f]+$/u);
```

**File**: `src/app/api/challenges/[challengeId]/join/schema.ts` (NEW) — `.strict()` mode

```typescript
import { z } from "zod";
import { zId, zDisplayName, zOptionalUrl } from "@/lib/apiSchemas";

// STRICT mode: identity-bearing route (userId impersonation check follows in handler).
export const joinBodySchema = z.object({
  userId: zId,
  userName: zDisplayName,
  userPhotoURL: zOptionalUrl,
}).strict();

export type JoinBody = z.infer<typeof joinBodySchema>;
```

**File**: `src/app/api/challenges/sync-volume/schema.ts` (NEW) — `.strict()` mode

```typescript
import { z } from "zod";
import { zId } from "@/lib/apiSchemas";

// STRICT mode: identity-bearing route (userId must match callerUid).
export const syncVolumeBodySchema = z.object({
  userId: zId,
  totalVolume: z.number().min(0).max(1e9),   // replaces the runtime clamp
  sessionId: zId.optional(),
}).strict();

export type SyncVolumeBody = z.infer<typeof syncVolumeBodySchema>;
```

**File**: `src/app/api/social/comments/schema.ts` (NEW) — mixed modes

```typescript
import { z } from "zod";
import { zId } from "@/lib/apiSchemas";

// STRIP mode for POST (content route — forward-compat).
export const commentCreateSchema = z.object({
  postId: zId,
  text: z.string().trim().min(1).max(500),   // preserves current 500-char cap
}).strip();

// STRICT mode for DELETE (identity-bearing — commentId ownership check follows).
export const commentDeleteSchema = z.object({
  postId: zId,
  commentId: zId,
}).strict();

// GET query schema.
export const commentsQuerySchema = z.object({
  postId: zId,
}).strict();

export type CommentCreateBody = z.infer<typeof commentCreateSchema>;
export type CommentDeleteBody = z.infer<typeof commentDeleteSchema>;
```

**File**: `src/app/api/social/feed/schema.ts` (NEW) — `.strip()` mode

```typescript
import { z } from "zod";
import { zId, zDisplayName, zOptionalUrl } from "@/lib/apiSchemas";

// STRIP mode: content route. Author identity is verified against callerUid in handler.
export const feedPostSchema = z.object({
  authorUid: zId,
  authorName: zDisplayName,
  authorPhotoURL: zOptionalUrl,
  workoutTitle: z.string().trim().min(1).max(100),
  duration: z.number().int().min(0).max(86400),     // max 24h
  totalVolume: z.number().min(0).max(1e9),
  exercisesCount: z.number().int().min(0).max(100),
}).strip();

export type FeedPostBody = z.infer<typeof feedPostSchema>;
```

**File**: `src/app/api/social/follow/schema.ts` (NEW) — `.strict()` mode

```typescript
import { z } from "zod";
import { zId } from "@/lib/apiSchemas";

// STRICT mode: identity-bearing route (currentUid must match callerUid).
export const followBodySchema = z.object({
  currentUid: zId,
  targetUid: zId,
}).strict();

export type FollowBody = z.infer<typeof followBodySchema>;
```

**File**: `src/app/api/social/following/schema.ts` (NEW) — GET query schema

```typescript
import { z } from "zod";
import { zId } from "@/lib/apiSchemas";

// GET query schema. includeProfiles is coerced from "true"/"false" string.
export const followingQuerySchema = z.object({
  uid: zId,
  includeProfiles: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
}).strict();

export type FollowingQuery = z.infer<typeof followingQuerySchema>;
```

**File**: `src/app/api/social/kudos/schema.ts` (NEW) — `.strict()` mode

```typescript
import { z } from "zod";
import { zId } from "@/lib/apiSchemas";

// STRICT mode: identity-bearing (postId ownership implicit via kudos unique constraint).
export const kudosBodySchema = z.object({
  postId: zId,
}).strict();

export type KudosBody = z.infer<typeof kudosBodySchema>;
```

**File**: `src/app/api/social/posts/schema.ts` (NEW) — `.strict()` mode

```typescript
import { z } from "zod";
import { zId } from "@/lib/apiSchemas";

// STRICT mode: identity-bearing (post ownership check in handler).
export const postDeleteSchema = z.object({
  postId: zId,
}).strict();

export type PostDeleteBody = z.infer<typeof postDeleteSchema>;
```

**File**: `src/app/api/social/profile/schema.ts` (NEW) — `.strict()` mode

```typescript
import { z } from "zod";
import { zId, zDisplayName, zOptionalUrl } from "@/lib/apiSchemas";

// STRICT mode: identity-bearing (uid must match callerUid).
export const profileBodySchema = z.object({
  uid: zId,
  displayName: zDisplayName,
  photoURL: zOptionalUrl,
}).strict();

export type ProfileBody = z.infer<typeof profileBodySchema>;
```

**File**: `src/app/api/social/search/schema.ts` (NEW) — GET query schema

```typescript
import { z } from "zod";

// GET query schema. q is optional — empty/missing q returns [] (current behavior).
export const searchQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
}).strict();

export type SearchQuery = z.infer<typeof searchQuerySchema>;
```

**Verification**: `npx tsc --noEmit` → 0 errors. All schemas compile and infer correct types.

---

### Phase 3: Route Handler Migration (FR-011)

**Why third**: With schemas + helpers in place, each route migration is mechanical: replace `await req.json() as FooBody` with `parseRequestBody(req, fooSchema)`, and `searchParams.get(...)` with `parseQueryParams(req, fooQuerySchema)`. Migrate routes in dependency order (leaf routes first, no cross-route dependencies here so order is by risk: auth/session first, then AI, then social, then challenges).

**Migration pattern** (applied uniformly to every write route):

```typescript
// BEFORE:
const body = (await req.json()) as CommentCreateBody;
if (!postId || !text?.trim()) {
  return NextResponse.json({ error: "Missing postId or text" }, { status: 400 });
}
const trimmedText = text.trim().slice(0, 500);

// AFTER:
const parsed = await parseRequestBody<CommentCreateBody>(req, commentCreateSchema);
if (!parsed.success) return parsed.response;
const { postId, text } = parsed.data;   // text is already trimmed + capped by schema
```

**Migration pattern** (applied uniformly to every GET-with-query route):

```typescript
// BEFORE:
const { searchParams } = new URL(req.url);
const postId = searchParams.get("postId");
if (!postId) {
  return NextResponse.json({ error: "Missing postId query parameter" }, { status: 400 });
}

// AFTER:
const parsed = parseQueryParams(req, commentsQuerySchema);
if (!parsed.success) return parsed.response;
const { postId } = parsed.data;
```

**Migration pattern** (applied to dynamic path-param routes):

```typescript
// BEFORE:
const { challengeId } = await params;
// (no validation — challengeId used directly)

// AFTER:
const { challengeId: rawChallengeId } = await params;
const pathParsed = parsePathParam(rawChallengeId, challengeIdParamSchema);
if (!pathParsed.success) return pathParsed.response;
const challengeId = pathParsed.data;
```

#### Route-by-route migration details:

**3.1 — `src/app/api/auth/session/route.ts`** (POST only; DELETE has no body)
- POST: replace `const { idToken } = await req.json()` + `if (!idToken)` check with `parseRequestBody(req, sessionPostSchema)`.
- DELETE: unchanged (no body).

**3.2 — `src/app/api/ai-coach/route.ts`** (POST)
- Replace the `CoachRequest` interface cast + `validateString(body.userPrompt, 1000)` + `if (!body.profile || !body.exercises || body.exercises.length === 0)` check with `parseRequestBody(req, coachRequestSchema)`.
- The schema's `.min(1)` on `exercises` replaces the manual empty-check.
- The `userPrompt` default (`"Generate my next workout"`) is applied AFTER successful parse: `const userPrompt = parsed.data.userPrompt || "Generate my next workout";`.
- Remove the local `CoachRequest` interface (now imported from `schema.ts` as `z.infer`).

**3.3 — `src/app/api/ai-workout/route.ts`** (POST)
- Replace the `StructuredRequestBody` interface cast + the manual `if (body.prompt !== undefined || body.systemInstruction !== undefined)` check with `parseRequestBody(req, structuredRequestBodySchema)`.
- The `.strict()` schema rejects `prompt`/`systemInstruction` declaratively — the manual check is removed.
- Remove the local `StructuredRequestBody` interface.

**3.4 — `src/app/api/challenges/[challengeId]/join/route.ts`** (POST)
- Add `parsePathParam(challengeId, challengeIdParamSchema)` at the top.
- Replace the `JoinBody` interface cast + manual `validateId`/`validateDisplayName`/`validateOptionalUrl` calls + `if (!userId || !userName)` check with `parseRequestBody(req, joinBodySchema)`.
- The impersonation check (`if (userId !== callerUid)`) is preserved AFTER the parse — it depends on `requireUser` which runs after parse in the current code order. Confirm order: parse body → requireUser → impersonation check. (Current code does requireUser first; we keep that order: requireUser → parse body → impersonation check. This avoids parsing a body for an unauthenticated request.)
- Remove the local `JoinBody` interface.

**3.5 — `src/app/api/challenges/[challengeId]/leaderboard/route.ts`** (GET, no query)
- Add `parsePathParam(challengeId, challengeIdParamSchema)` at the top.
- No body/query validation needed (GET with no search params).

**3.6 — `src/app/api/challenges/[challengeId]/progress/route.ts`** (GET with query)
- Add `parsePathParam(challengeId, challengeIdParamSchema)`.
- Replace `searchParams.get("userId")` + `validateId` + `if (!userId)` check with `parseQueryParams(req, progressQuerySchema)`.
- Create `src/app/api/challenges/[challengeId]/progress/schema.ts` with:
  ```typescript
  export const progressQuerySchema = z.object({ userId: zId }).strict();
  ```

**3.7 — `src/app/api/challenges/sync-volume/route.ts`** (POST)
- Replace the `SyncVolumeBody` interface cast + manual `if (!userId)` check + `Number(totalVolume) || 0` + `Math.min(Math.max(0, volume), 1e9)` clamp with `parseRequestBody(req, syncVolumeBodySchema)`. The schema's `.max(1e9)` replaces the runtime clamp.
- The `if (clampedVolume <= 0) return { ok: true, updated: 0 }` early-return is preserved: `if (parsed.data.totalVolume <= 0) return NextResponse.json({ ok: true, updated: 0 });`.
- Remove the local `SyncVolumeBody` interface.

**3.8 — `src/app/api/social/comments/route.ts`** (GET, POST, DELETE)
- GET: replace `searchParams.get("postId")` + `if (!postId)` with `parseQueryParams(req, commentsQuerySchema)`.
- POST: replace `CommentCreateBody` cast + `if (!postId || !text?.trim())` + `text.trim().slice(0, 500)` with `parseRequestBody(req, commentCreateSchema)`. The schema trims + caps text.
- DELETE: replace `CommentDeleteBody` cast + `if (!postId || !commentId)` with `parseRequestBody(req, commentDeleteSchema)`.
- Remove local `CommentCreateBody`/`CommentDeleteBody` interfaces.

**3.9 — `src/app/api/social/feed/route.ts`** (GET, POST)
- GET: no query params — unchanged (already calls `requireUser`).
- POST: replace `FeedPostBody` cast + 7 manual validators + 2 `if` checks with `parseRequestBody(req, feedPostSchema)`. The schema encodes all bounds.
- Remove local `FeedPostBody` interface.

**3.10 — `src/app/api/social/follow/route.ts`** (POST, DELETE)
- Both: replace `FollowBody` cast + `validateId` x2 + `if (!follower || !following)` + `if (follower === following)` with `parseRequestBody(req, followBodySchema)` + `if (parsed.data.currentUid === parsed.data.targetUid)` self-follow check.
- Remove local `FollowBody` interface.

**3.11 — `src/app/api/social/following/route.ts`** (GET)
- Replace `searchParams.get("uid")` + `if (!uid)` + `searchParams.get("includeProfiles") === "true"` with `parseQueryParams(req, followingQuerySchema)`. The schema coerces `includeProfiles` to boolean.

**3.12 — `src/app/api/social/kudos/route.ts`** (POST)
- Replace `KudosBody` cast + `validateId(postId)` + `if (!id)` with `parseRequestBody(req, kudosBodySchema)`.
- Remove local `KudosBody` interface.

**3.13 — `src/app/api/social/posts/route.ts`** (DELETE)
- Replace `PostDeleteBody` cast + `if (!postId)` with `parseRequestBody(req, postDeleteSchema)`.
- Remove local `PostDeleteBody` interface.

**3.14 — `src/app/api/social/profile/route.ts`** (POST)
- Replace `ProfileBody` cast + `validateId`/`validateDisplayName`/`validateOptionalUrl` + `if (!uid || !displayName)` with `parseRequestBody(req, profileBodySchema)`.
- Remove local `ProfileBody` interface.

**3.15 — `src/app/api/social/search/route.ts`** (GET)
- Replace `searchParams.get("q")` + `validateString(rawQ, 100)` + `if (!q) return []` with `parseQueryParams(req, searchQuerySchema)`. The schema's `.optional()` means missing `q` parses to `undefined`; handler returns `[]` if `q` is undefined or empty after trim.

**Verification after each route**: `npx tsc --noEmit` → 0 errors. After all 15 routes: `bun run lint` → 0 new errors.

---

### Phase 4: Rate-Limit Logic Extraction (FR-013, FR-014, FR-015, FR-024)

**Why fourth**: Extracting rate-limit logic into `src/lib/rateLimit.ts` before modifying `middleware.ts` makes the middleware change a clean swap and lets the rate-limit module be unit-testable in isolation. This phase creates the module but does NOT yet wire it into middleware (that's Phase 5).

**File**: `src/lib/rateLimit.ts` (NEW)

**Contents**:

1. **Category type + mapping**:
   ```typescript
   export type RateLimitCategory = "ai" | "sync" | "social-writes" | "default";

   const CATEGORY_LIMITS: Record<RateLimitCategory, number> = {
     "ai": 20,            // 20/hr across ai-coach + ai-workout
     "sync": 60,          // 60/hr across sync-volume + (future) sync/push
     "social-writes": 100,// 100/hr across all social POST/DELETE
     "default": 300,      // 300/hr for everything else
   };

   // Map (method, pathname) → category. Order matters: more specific patterns first.
   const CATEGORY_RULES: { pattern: RegExp; methods: Set<string>; category: RateLimitCategory }[] = [
     { pattern: /^\/api\/ai-coach$/, methods: new Set(["POST"]), category: "ai" },
     { pattern: /^\/api\/ai-workout$/, methods: new Set(["POST"]), category: "ai" },
     { pattern: /^\/api\/challenges\/sync-volume$/, methods: new Set(["POST"]), category: "sync" },
     { pattern: /^\/api\/sync\/push$/, methods: new Set(["POST", "PUT"]), category: "sync" },
     {
       pattern: /^\/api\/social\//,
       methods: new Set(["POST", "DELETE", "PUT", "PATCH"]),
       category: "social-writes",
     },
   ];

   export function categorizeRequest(method: string, pathname: string): RateLimitCategory {
     for (const rule of CATEGORY_RULES) {
       if (rule.methods.has(method) && rule.pattern.test(pathname)) {
         return rule.category;
       }
     }
     return "default";
   }
   ```

2. **Bucket interface + storage** (preserves token-bucket algorithm):
   ```typescript
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
   ```

3. **Bucket cleanup** (FR-024 — raised cutoff to 2 hours):
   ```typescript
   let lastCleanup = Date.now();
   const CLEANUP_INTERVAL_MS = 5 * 60_000;          // every 5 min (unchanged)
   const IDLE_EVICT_CUTOFF_MS = 2 * 3_600_000;      // 2 hours (was 10 min)

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
   ```

4. **Uid extraction from session cookie** (FR-016, FR-018):
   ```typescript
   import { getAdminAuth } from "./firebaseAdmin";

   // Fast-path uid extraction for rate-limit keying ONLY.
   // Uses verifySessionCookie(cookie, false) — signature check, no revocation check
   // (no network call). The authoritative auth boundary remains requireUser at the route.
   // Returns null if: no cookie, cookie invalid/expired, or firebase-admin fails to init.
   // NEVER throws — always falls back to null (caller falls back to IP).
   export async function extractUidForRateLimit(req: NextRequest): Promise<string | null> {
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
   ```

5. **Bucket key builder** (FR-013):
   ```typescript
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

**Verification**: `npx tsc --noEmit` → 0 errors. The module exports are correct and `firebaseAdmin` import resolves.

---

### Phase 5: Middleware Rewrite (FR-013, FR-015, FR-016, FR-017, FR-018, FR-019, FR-020, FR-021, FR-022, FR-023, FR-024, FR-025)

**Why fifth**: Now that `rateLimit.ts` exists, `middleware.ts` becomes a thin orchestrator. This phase swaps the old per-IP-per-route logic for the new per-user-per-category logic, preserves all Sprint 1 work (P0-8 IP trust, P0-9 body limits, P0-2 session-cookie check), and switches to Node.js runtime.

**File**: `src/middleware.ts` (MODIFY — substantial rewrite)

**Changes**:

1. **Add runtime declaration** (FR-017):
   ```typescript
   export const runtime = "nodejs";  // required for firebase-admin (fs/path usage)
   ```

2. **Remove old rate-limit internals** from `middleware.ts` (moved to `rateLimit.ts`):
   - Delete: `interface Bucket`, `const buckets`, `const WINDOW_MS = 60_000`, `ROUTE_LIMITS`, `DEFAULT_LIMIT`, `getRateLimit()`, `checkRateLimit()`, `cleanupBuckets()`, `lastCleanup`.
   - Keep: `getTrustedProxyIps()`, `getClientIp()` (P0-8 — unchanged), `BODY_SIZE_LIMITS`, `getBodySizeLimit()` (P0-9 — unchanged).

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
           { error: `Request body too large. Maximum allowed: ${maxBytes / 1024}KB.` },
           { status: 413 }
         );
       }
     }

     // ── P1-5: Per-user rate limiting ──
     cleanupBuckets();
     const category = categorizeRequest(req.method, pathname);
     const ip = getClientIp(req);                    // P0-8 secure IP extraction
     const uid = await extractUidForRateLimit(req);  // null if no/invalid cookie
     const bucketKey = buildBucketKey(uid, ip, category);
     const { allowed, remaining } = checkRateLimit(bucketKey, category);

     if (!allowed) {
       return NextResponse.json(
         { error: "Rate limit exceeded. Please try again later." },
         {
           status: 429,
           headers: {
             "Retry-After": "3600",                   // conservative static (per FR-022)
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

**Key behavioral changes**:
- Window: 1 min → 1 hour.
- Bucket key: `${ip}:${pathname}` → `uid:<uid>:<cat>` or `ip:<ip>:<cat>`.
- Category: per-route → per-category (4 categories).
- Uid extraction: none → `verifySessionCookie(cookie, false)` with null fallback.
- Runtime: Edge (default) → Node.js.
- Cleanup cutoff: 10 min → 2 hours.

**Key behavioral preservations**:
- P0-8 `getClientIp` with `TRUSTED_PROXY_IPS` — unchanged.
- P0-9 body-size limits — unchanged.
- P0-2 write-method cookie-existence check — unchanged.
- 429 response shape + headers — unchanged.
- `X-RateLimit-Remaining` on success — unchanged (now reflects per-user/per-IP bucket).
- Matcher `/api/:path*` — unchanged.

**Verification**: `npx tsc --noEmit` → 0 errors. `bun run lint` → 0 new errors. Dev server starts on port 3000 without errors.

---

### Phase 6: End-to-End Verification (SC-001 through SC-012)

**Why last**: All code changes are complete; this phase verifies the full system against the spec's success criteria. No code changes here unless a criterion fails (in which case, return to the relevant phase).

**Verification steps** (detailed in the table below).

---

## Execution Sequence

```
Phase 1: Create src/lib/apiSchemas.ts (parseRequestBody, parseQueryParams, parsePathParam, shared primitives)
  ↓ Verify: npx tsc --noEmit → 0 errors
  ↓ Verify: src/lib/validation.ts re-exports compile

Phase 2: Create all 16 schema.ts files (ai-coach, ai-workout, auth/session, challenges, challenges/[id]/join,
          challenges/[id]/progress, challenges/sync-volume, social/comments, social/feed, social/follow,
          social/following, social/kudos, social/posts, social/profile, social/search)
  ↓ Verify: npx tsc --noEmit → 0 errors (all schemas compile, z.infer types resolve)

Phase 3: Migrate all 15 route handlers (auth/session, ai-coach, ai-workout, challenges/[id]/join,
          challenges/[id]/leaderboard, challenges/[id]/progress, challenges/sync-volume,
          social/comments, social/feed, social/follow, social/following, social/kudos,
          social/posts, social/profile, social/search)
  ↓ Verify after EACH route: npx tsc --noEmit → 0 errors
  ↓ Verify after all 15: bun run lint → 0 new errors

Phase 4: Create src/lib/rateLimit.ts (categorizeRequest, checkRateLimit, cleanupBuckets,
          extractUidForRateLimit, buildBucketKey, WINDOW_MS=3.6M)
  ↓ Verify: npx tsc --noEmit → 0 errors

Phase 5: Rewrite src/middleware.ts (runtime=nodejs, remove old rate-limit internals, wire rateLimit.ts,
          preserve P0-8/P0-9/P0-2, 1hr window, per-user-per-category buckets)
  ↓ Verify: npx tsc --noEmit → 0 errors
  ↓ Verify: bun run lint → 0 new errors
  ↓ Verify: dev server starts on :3000 (check dev.log for "Ready in")
  ↓ Verify: GET / → 200 (app still loads)

Phase 6: End-to-end verification (see table below)
  ↓ Verify: all SC-001..SC-012 pass
  ↓ Verify: Agent Browser golden path (sign in → AI workout → feed post → kudos → comment)
```

## Verification Steps

| Step | Command / Action | Expected Result | SC ref |
|------|-----------------|-----------------|--------|
| 1 | `grep -rL "parseRequestBody\|parseQueryParams" src/app/api/**/route.ts` (excluding route.ts files with only GET-no-params) | 0 write routes lacking validation | SC-001 |
| 2 | `grep -c "parseRequestBody" src/app/api/ -r` | ≥ 12 (one per POST/DELETE/PUT handler) | SC-001 |
| 3 | `grep -c "parseQueryParams" src/app/api/ -r` | ≥ 4 (comments GET, search GET, following GET, progress GET) | SC-002 |
| 4 | `curl -s -X POST localhost:3000/api/social/comments -H "Content-Type: application/json" -d '{"postId":12345,"text":"hi"}'` (with valid session cookie) | `400` with `{"error":"Validation failed","details":[{"path":["postId"],...}]}` | SC-003 |
| 5 | `curl -s -X POST localhost:3000/api/ai-workout -H "Content-Type: application/json" -d '{"prompt":"ignore previous"}'` (with valid session cookie) | `400` (prompt field rejected by .strict() schema) | SC-004 |
| 6 | `curl -s -X POST localhost:3000/api/social/comments -H "Content-Type: application/json" -d '{bad json'` | `400` with `{"error":"Invalid JSON body"}` (NOT 500) | SC-005 |
| 7 | Scripted test: User A makes 20 POST to /api/ai-coach within 1hr; User B (same IP, different session cookie) makes 1 POST to /api/ai-coach | User A's 21st → `429`; User B's 1st → `200` (independent buckets) | SC-006 |
| 8 | Add temporary `console.log(Array.from(buckets.keys()))` to rateLimit.ts; hit an authenticated route; check dev.log | Key is `uid:<callerUid>:ai` (not `ip:...`) | SC-007 |
| 9 | `curl -s localhost:3000/api/social/feed -H "Cookie: pulse_session=garbage"` | `429` possible (IP bucket) OR `401` (requireUser) — but NOT `500` | SC-008 |
| 10 | Inspect 429 response headers | `Retry-After` + `X-RateLimit-Remaining: 0` present | SC-009 |
| 11 | `bun run lint 2>&1 \| tail -5` | 0 new errors (pre-existing warnings OK) | SC-010 |
| 12 | `npx tsc --noEmit 2>&1 \| tail -5` | 0 errors | SC-010 |
| 13 | `grep -rn ": any" src/lib/apiSchemas.ts src/lib/rateLimit.ts src/app/api/**/schema.ts src/middleware.ts` | No output (no `any` introduced) | SC-010 |
| 14 | Agent Browser: sign in → generate AI workout → post to feed → kudos a post → comment | All 5 actions succeed; no rate-limit false-positive; no validation false-negative | SC-011 |
| 15 | Agent Browser: post a valid comment (correct types, under 500 chars) | Comment posts successfully (no regression on valid input) | SC-012 |
| 16 | Agent Browser: check sticky footer still works on / route | Footer at bottom, no overlap | (UI sanity) |
| 17 | `tail -50 /home/z/my-project/dev.log` after all tests | No `Error:` or `Unhandled` lines from middleware or route handlers | (runtime sanity) |

## Complexity Tracking

No constitution violations. All changes are within the existing architecture:

- **No new dependencies** — `zod` and `firebase-admin` already installed.
- **No new patterns** — Zod schemas are the constitutional standard (Article IV); rate-limit extraction is a refactor, not a new pattern.
- **No schema changes** — Prisma schema untouched; no migrations.
- **No UI changes** — purely server-side hardening.
- **Co-located schemas** — follow Next.js convention (`route.ts` + `schema.ts` in the same directory); no new top-level directories.
- **Rate-limit extraction** — moves logic from `middleware.ts` to `src/lib/rateLimit.ts` for testability and single-responsibility; `middleware.ts` becomes a thin orchestrator. This is a justified refactor (the middleware was becoming a 179-line god-module; extracting rate-limit logic keeps it focused on request orchestration and lets the rate-limit module be unit-tested in isolation in Sprint 3).

## Notes for the `/tasks` Stage

The 6 phases above will be decomposed into atomic tasks in `.specify/tasks/sprint2-api-hardening.md`. Suggested task granularity:

- **Task S2-T01**: Create `src/lib/apiSchemas.ts` (Phase 1)
- **Task S2-T02**: Create the 16 `schema.ts` files (Phase 2) — may be split into 2-3 parallel sub-tasks by route group (AI, social, challenges)
- **Task S2-T03**: Migrate the 15 route handlers (Phase 3) — may be split into 3-4 parallel sub-tasks by route group
- **Task S2-T04**: Create `src/lib/rateLimit.ts` (Phase 4)
- **Task S2-T05**: Rewrite `src/middleware.ts` (Phase 5)
- **Task S2-T06**: End-to-end verification + Agent Browser (Phase 6)

Parallelism opportunities: Phase 2 schema files are independent of each other (can be written in parallel). Phase 3 route migrations are independent of each other (can be written in parallel) BUT all depend on Phase 1. Phase 4 depends on nothing except the existing `firebaseAdmin.ts`. Phase 5 depends on Phase 4. Phase 6 depends on all prior phases.
