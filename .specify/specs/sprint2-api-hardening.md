# Feature Specification: Sprint 2 API Hardening

**Feature Branch**: `sprint2-api-hardening`

**Created**: 2026-06-20

**Status**: Draft

**Input**: User description: "Sprint 2 High-Priority Hardening — (P1-1) Zod input validation for every API route's request body and query parameters, returning 400 on validation failure; (P1-5) per-user rate limiting keyed on the verified callerUid extracted from the Firebase session cookie, falling back to IP for unauthenticated routes. Limits: AI 20/hr, social writes 100/hr, sync 60/hr."

## Context & Scope

This spec covers exactly two high-priority hardening items from `CODE_AUDIT_V5.md`:

- **P1-1 — Zod Input Validation**: All POST/DELETE/PUT API routes under `src/app/api/` currently parse `await req.json()` into ad-hoc TypeScript interfaces (e.g. `interface CommentCreateBody`) with only scattered manual `validateString`/`validateId` checks. There is no single schema that rejects malformed, oversized, or unexpected fields before the handler runs. GET routes similarly read query parameters with `searchParams.get(...)` and ad-hoc null checks. We replace this with explicit Zod schemas validated at the top of every handler.

- **P1-5 — Per-User Rate Limiting**: The rate limiter in `src/middleware.ts` currently keys every bucket on `${ip}:${pathname}` (per-IP-per-route). Because the app is fronted by Caddy (one egress IP visible to Next.js under default config) and because shared-NAT users (campus Wi-Fi, corporate office, mobile carrier CGNAT) all share one public IP, a single heavy user on a shared network can exhaust the bucket for everyone behind that IP — while a single abusive user on a clean IP gets the full per-IP allowance to themselves. The fix is to key authenticated-route buckets on the **verified callerUid** extracted from the Firebase session cookie, and fall back to IP only when no valid session cookie is present.

This spec is **specification only**. No implementation is performed in this stage.

## Inventory: Routes In Scope

The following routes exist under `src/app/api/` and are all in scope for P1-1. POST/DELETE/PUT routes need a **body schema**; GET routes with query params need a **query schema**; routes with dynamic path segments need a **path-param schema**.

| # | Route | Methods | Body shape (current interface) | Query params |
|---|-------|---------|-------------------------------|--------------|
| 1 | `/api` | GET | — | — |
| 2 | `/api/ai-coach` | POST | `CoachRequest` (large nested: profile, recentSessions, personalRecords, analytics, exercises, userPrompt?) | — |
| 3 | `/api/ai-health` | GET | — | — |
| 4 | `/api/ai-workout` | POST | `StructuredRequestBody` (goal?, age?, gender?, fitnessLevel?, equipment?, selectedMuscles?) — must REJECT `prompt`/`systemInstruction` | — |
| 5 | `/api/auth/session` | POST, DELETE | POST: `{ idToken }` | — |
| 6 | `/api/challenges` | GET | — | — |
| 7 | `/api/challenges/[challengeId]/join` | POST | `{ userId, userName, userPhotoURL? }` | path: `challengeId` |
| 8 | `/api/challenges/[challengeId]/leaderboard` | GET | — | path: `challengeId` |
| 9 | `/api/challenges/[challengeId]/progress` | GET | — | `?userId`, path: `challengeId` |
| 10 | `/api/challenges/sync-volume` | POST | `{ userId, totalVolume, sessionId? }` | — |
| 11 | `/api/social/comments` | GET, POST, DELETE | POST: `{ postId, text }`; DELETE: `{ postId, commentId }` | GET: `?postId` |
| 12 | `/api/social/feed` | GET, POST | POST: `{ authorUid, authorName, authorPhotoURL?, workoutTitle, duration, totalVolume, exercisesCount }` | — |
| 13 | `/api/social/follow` | POST, DELETE | `{ currentUid, targetUid }` | — |
| 14 | `/api/social/following` | GET | — | `?uid`, `?includeProfiles` |
| 15 | `/api/social/kudos` | POST | `{ postId }` | — |
| 16 | `/api/social/posts` | DELETE | `{ postId }` | — |
| 17 | `/api/social/profile` | POST | `{ uid, displayName, photoURL? }` | — |
| 18 | `/api/social/search` | GET | — | `?q` |

**Totals**: 12 POST/DELETE routes need body schemas; 4 GET routes need query schemas; 3 routes consume a `challengeId` path param.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Zod Input Validation Across All API Routes (Priority: P1)

As a security-conscious API consumer (and as the application itself defending against malformed input), I want every POST/DELETE/PUT API route to validate its request body with an explicit Zod schema, and every GET route with query parameters to validate those parameters with a Zod schema, before any business logic runs — so that malformed, oversized, type-confused, or unexpected-field payloads are rejected with a clear `400 Bad Request` and never reach Prisma, the AI router, or the database.

**Why this priority**: The current handlers cast `await req.json()` to an interface (e.g. `as CommentCreateBody`) which provides zero runtime validation — TypeScript's `as` is a compile-time assertion that is erased at runtime. A payload like `{ "postId": 12345, "text": null }` sails past the cast, then crashes inside Prisma (`postId` is not a string) or silently writes corrupt data. Worse, the `/api/ai-workout` route interpolates unvalidated `age`, `goal`, `equipment`, and `selectedMuscles` fields directly into an LLM prompt — a prompt-injection vector. Constitution Article IV mandates input validation on all write endpoints; this story closes that gap uniformly with Zod (already a dependency at `zod@^4.0.2`).

**Independent Test**: Can be fully tested by sending deliberately malformed JSON to each route (wrong types, missing required fields, extra forbidden fields, oversized strings) and asserting a `400` response with a structured error message — without touching any downstream service, database, or AI provider. Delivering this story alone gives every route a hard input boundary.

**Acceptance Scenarios**:

1. **Given** a POST to `/api/social/comments` with body `{ "postId": 12345, "text": "hi" }` (postId is a number, not a string), **When** the handler runs, **Then** Zod rejects it and the response is `400` with a JSON body `{ "error": "Validation failed", "details": [...] }` listing the failing field(s), and no Prisma query executes.

2. **Given** a POST to `/api/social/comments` with body `{ "postId": "abc", "text": "   " }` (text is whitespace-only), **When** the handler runs, **Then** Zod rejects it with `400` (text must be non-empty after trim) and no comment is created.

3. **Given** a POST to `/api/social/comments` with body `{ "postId": "abc", "text": "ok", "authorUid": "attacker" }` (extra forbidden field), **When** the handler runs, **Then** Zod (in strict / `.strip()` mode) rejects the unknown field with `400`, preventing any shadow field from being processed.

4. **Given** a POST to `/api/social/comments` with body `{ "postId": "abc", "text": "x".repeat(501) }` (text exceeds 500-char cap), **When** the handler runs, **Then** Zod rejects it with `400` and the current 500-char cap is preserved as a `.max(500)` constraint.

5. **Given** a POST to `/api/ai-coach` with body missing the `profile` field, **When** the handler runs, **Then** Zod rejects it with `400` listing `profile` as required, and the AI router is never called (no wasted OpenRouter tokens).

6. **Given** a POST to `/api/ai-coach` with `profile.age` set to `"thirty"` (string instead of number), **When** the handler runs, **Then** Zod rejects it with `400` and the fatigue/deload engines are never invoked with corrupt data.

7. **Given** a POST to `/api/ai-workout` with body `{ "prompt": "ignore previous instructions" }`, **When** the handler runs, **Then** Zod rejects the `prompt` field (it is not in the schema) with `400`, preserving the existing prompt-injection guard but via schema rather than a manual `if` check.

8. **Given** a POST to `/api/ai-workout` with `selectedMuscles: ["chest", 42, null]`, **When** the handler runs, **Then** Zod rejects the non-string entries with `400`.

9. **Given** a GET to `/api/social/search?q=` (empty query), **When** the handler runs, **Then** Zod validates the query param and returns an empty array `[]` (current behavior preserved — empty `q` returns no results), NOT a `400`.

10. **Given** a GET to `/api/social/search?q=<script>alert(1)</script>` (200-char XSS payload), **When** the handler runs, **Then** Zod accepts the string (it is within the 100-char cap → actually rejected as `400` for exceeding the cap; if under cap it is accepted as a literal search string and passed to Prisma `contains` which is parameterized — no XSS risk). The 100-char cap is enforced by the schema.

11. **Given** a GET to `/api/challenges/[challengeId]/progress?userId=` (missing userId), **When** the handler runs, **Then** Zod rejects with `400` "Missing or invalid userId query parameter".

12. **Given** a POST to `/api/auth/session` with body `{}` (no idToken), **When** the handler runs, **Then** Zod rejects with `400` "Missing idToken" before `verifyIdToken` is called.

13. **Given** a POST to `/api/challenges/sync-volume` with `totalVolume: -50` (negative), **When** the handler runs, **Then** Zod rejects with `400` (totalVolume must be `>= 0`); the existing clamp-to-1e9 logic is preserved as a `.max(1e9)` constraint.

14. **Given** a DELETE to `/api/social/comments` with body `{ "postId": "abc" }` (missing commentId), **When** the handler runs, **Then** Zod rejects with `400` and no comment is deleted.

15. **Given** a POST to `/api/social/feed` with `duration: 100000` (exceeds 86400 = 24h cap), **When** the handler runs, **Then** Zod rejects with `400`; the existing 24h cap is preserved as `.max(86400)`.

16. **Given** a request body that is **not valid JSON at all** (e.g. `{bad json`), **When** any POST handler runs, **Then** the response is `400` with `{ "error": "Invalid JSON body" }` (the JSON parse error is caught and converted to a 400, not a 500).

17. **Given** a POST with a valid body that includes all required fields correctly typed, **When** the handler runs, **Then** Zod parsing succeeds, the handler receives a fully-typed object, and the request proceeds exactly as before (no behavioral regression).

---

### User Story 2 — Per-User Rate Limiting (Priority: P1)

As a legitimate user on a shared network (campus Wi-Fi, corporate office, mobile CGNAT) and as the platform operator defending compute budget, I want authenticated API routes to rate-limit per **verified user** (not per IP) so that (a) one abusive user cannot exhaust the rate-limit bucket shared by hundreds of users behind the same NAT, and (b) one user's heavy usage does not penalize other users on the same IP. Unauthenticated routes continue to be limited per IP.

**Why this priority**: The current `${ip}:${pathname}` keying has two failure modes on a shared IP: (1) a single spammer behind a campus NAT can burn the entire `/api/social/comments` allowance, locking out every other student on the same network; (2) conversely, a single abusive user on a clean residential IP gets the full per-IP allowance to themselves (no per-user ceiling). Both are unacceptable for a multi-user SaaS. Keying on the verified callerUid fixes both: each authenticated user gets their own bucket regardless of how many users share the IP, and the IP fallback only applies to routes that genuinely have no session (login, health check). This is constitutionally mandated (Article IV: "Rate limiting is enforced in middleware" + the per-user intent of multi-tenant isolation).

**Independent Test**: Can be tested by logging in as two different users from the same IP, hammering `/api/ai-coach` as User A until the 20/hr limit triggers, and asserting that User B can still call `/api/ai-coach` successfully (their bucket is independent). Also: an unauthenticated request to a public GET route is still limited by IP. Delivering this story alone makes the rate limiter multi-tenant-safe without touching input validation.

**Acceptance Scenarios**:

1. **Given** two authenticated users (User A, User B) on the **same IP** (e.g. both behind the same office NAT), **When** User A makes 20 POST requests to `/api/ai-coach` within one hour, **Then** User A's 21st request returns `429` with `Retry-After: 3600`, and User B's request to `/api/ai-coach` in the same hour succeeds (User B has a separate bucket keyed on User B's uid).

2. **Given** an authenticated user with a valid `pulse_session` cookie, **When** the middleware processes their request, **Then** the rate-limit bucket key is `uid:<callerUid>:<category>` (e.g. `uid:abc123:ai`), NOT `ip:<ip>:<pathname>`.

3. **Given** an unauthenticated request (no `pulse_session` cookie) to a public GET route (e.g. `/api/ai-health`), **When** the middleware processes it, **Then** the bucket key falls back to `ip:<ip>:<category>`.

4. **Given** a request with an **invalid or expired** `pulse_session` cookie (verification fails), **When** the middleware processes it, **Then** the bucket key falls back to `ip:<ip>:<category>` (the cookie is treated as absent for rate-limiting; the route's `requireUser` will separately reject it with `401`).

5. **Given** the AI category limit is 20/hr, **When** a user makes 10 calls to `/api/ai-coach` and 11 calls to `/api/ai-workout` within the same hour, **Then** the 21st call (to either route) returns `429` — because both routes share one `ai` category bucket per user (20/hr total across all AI routes, not 20/hr per route).

6. **Given** the social-writes category limit is 100/hr, **When** a user makes 100 POST/DELETE calls across `/api/social/comments`, `/api/social/feed`, `/api/social/follow`, `/api/social/kudos`, `/api/social/posts`, and `/api/social/profile` combined within one hour, **Then** the 101st social write returns `429`.

7. **Given** the sync category limit is 60/hr, **When** a user makes 61 POST calls to `/api/challenges/sync-volume` within one hour, **Then** the 61st returns `429`.

8. **Given** a `429` response is returned, **When** the client inspects the response, **Then** it includes headers `Retry-After` (seconds until the bucket has ≥1 token) and `X-RateLimit-Remaining: 0`, matching the existing response shape (no regression on the 429 contract).

9. **Given** a successful (non-429) request, **When** the client inspects the response, **Then** the `X-RateLimit-Remaining` header reflects the remaining tokens in the caller's bucket (per-user for authenticated, per-IP for unauthenticated).

10. **Given** the rate-limit category mapping, **When** a request arrives at `/api/challenges/sync-volume`, **Then** it is categorized as `sync` (60/hr); `/api/ai-coach` and `/api/ai-workout` as `ai` (20/hr); all POST/DELETE under `/api/social/*` as `social-writes` (100/hr); and all other routes as `default` (a sensible hourly cap, e.g. 300/hr — see FR-014).

11. **Given** a user is rate-limited (429) on the `ai` bucket, **When** they immediately call a `social-writes` route, **Then** the social-writes request succeeds (independent buckets per category).

---

### Edge Cases

- **What happens when the request body is empty on a POST that requires a body?** Zod rejects with `400` (required fields missing). The handler never runs.
- **What happens when `Content-Type` is not `application/json`?** `req.json()` throws a SyntaxError; this is caught and converted to `400 "Invalid JSON body"` (not a 500). This applies to all POST/DELETE/PUT handlers uniformly via the shared parse helper (see FR-004).
- **What happens when a Zod schema permits extra fields but the route only reads some?** By default, Zod `.parse()` strips unknown keys silently. To detect and reject unexpected fields (defense-in-depth against parameter-pollution), schemas MUST use `.strict()` or `.strip()` explicitly per route — see FR-006. The decision: **strict mode** (reject unknown keys with 400) for routes handling user identity / IDs (`/api/social/follow`, `/api/social/profile`, `/api/challenges/*/join`), **strip mode** for the large AI payloads (forward-compatibility with new client fields without breaking).
- **What happens when `pulse_session` cookie is present but is garbage (not a JWT)?** `verifySessionCookie` throws; the middleware catches it, falls back to IP-based keying, and lets the request proceed to the route (where `requireUser` will return `401`). Rate-limiting is never the auth boundary.
- **What happens when firebase-admin fails to initialize in middleware (e.g. missing service account in a fresh deploy)?** The middleware MUST catch the init error, fall back to IP-based rate limiting, and continue (never 500 the request due to rate-limiter init failure). An error is logged.
- **What happens when two users share a browser (same cookie)?** They share one uid-keyed bucket. This is correct — they are effectively one session. If they need separate limits, they sign in separately.
- **What happens when a user signs out (DELETE /api/auth/session) and signs back in as another user?** The cookie changes; the bucket key changes to the new uid. The old uid's bucket retains its token count (a malicious user cannot reset their limit by signing out — they'd need a new Firebase account, which is a separate abuse vector handled elsewhere).
- **What happens when the path param `challengeId` contains a path-traversal attempt like `../../`?** Zod validates it as a non-empty string with no whitespace/control chars (reusing the existing `validateId` rules). Next.js route matching constrains it to a single segment anyway, but the schema adds a defense-in-depth check.
- **What about the `/api/sync/push` route referenced in the middleware body-size limits (10MB cap)?** No `route.ts` exists for it in the inventory. The spec treats it as out-of-scope for body validation (no handler to validate) but in-scope for rate-limit categorization (if it is implemented later, it MUST be categorized as `sync`). The body-size limit in middleware already covers it.
- **What happens when the `includeProfiles` query param on `/api/social/following` is `"true"` vs `"1"` vs `"yes"`?** Zod coerces it via `z.enum(["true","false"]).default("false")` or `z.coerce.boolean()` — only the literal string `"true"` yields `true`; everything else is `false`. This matches the current `=== "true"` check.

## Requirements *(mandatory)*

### Functional Requirements

#### P1-1 — Zod Input Validation

- **FR-001**: A Zod schema MUST be defined for the request body of every POST, DELETE, and PUT handler under `src/app/api/`. Schemas SHOULD live in a co-located file `src/app/api/<route>/schema.ts` (or a shared `src/lib/apiSchemas.ts` for cross-route reuse) — exact location is a plan-stage decision, but each schema MUST be importable and unit-testable in isolation.
- **FR-002**: A Zod schema MUST be defined for the query parameters of every GET handler that reads `searchParams` — specifically `/api/social/comments` (`?postId`), `/api/social/search` (`?q`), `/api/social/following` (`?uid`, `?includeProfiles`), and `/api/challenges/[challengeId]/progress` (`?userId`).
- **FR-003**: A Zod schema MUST be defined for the `challengeId` path parameter on `/api/challenges/[challengeId]/join`, `/api/challenges/[challengeId]/leaderboard`, and `/api/challenges/[challengeId]/progress` (non-empty string, no whitespace/control chars, max 200 chars — matching the existing `validateId` rules).
- **FR-004**: A shared helper `parseRequestBody<T>(req, schema): { success: true, data: T } | { success: false, response: Response }` MUST be provided. It MUST (a) call `req.json()` inside try/catch, returning `400 { error: "Invalid JSON body" }` on SyntaxError; (b) call `schema.safeParse(body)`; (c) on failure return `400 { error: "Validation failed", details: [...] }` where `details` is the Zod issue array (field path + message), suitable for client display; (d) on success return the typed data. This helper eliminates per-route boilerplate and guarantees a uniform 400 shape.
- **FR-005**: A shared helper `parseQueryParams(req, schema)` MUST be provided with the same contract for URL search params (it reads `new URL(req.url).searchParams`, converts to a plain object, and runs `schema.safeParse`). On failure it returns `400` with the same `{ error, details }` shape.
- **FR-006**: Each schema MUST explicitly choose a strictness mode: `.strict()` (reject unknown keys → 400) for identity/ID-bearing routes (`/api/social/follow`, `/api/social/profile`, `/api/challenges/[challengeId]/join`, `/api/challenges/sync-volume`, `/api/social/kudos`, `/api/social/posts`); `.strip()` (silently drop unknown keys) for the large AI payloads (`/api/ai-coach`, `/api/ai-workout`) and the social content routes (`/api/social/comments`, `/api/social/feed`) to allow forward-compatible client field additions without breaking older servers. The chosen mode MUST be documented in a comment on each schema.
- **FR-007**: Existing field-level constraints (caps, ranges, URL schemes) MUST be preserved as Zod refinements — specifically:
  - `postId`, `commentId`, `uid`, `userId`, `currentUid`, `targetUid`, `sessionId`, `challengeId`: non-empty trimmed string, no whitespace/control chars, max 200 chars (mirrors `validateId`).
  - `text` (comment): trimmed, non-empty, max 500 chars (mirrors current `.slice(0, 500)`).
  - `workoutTitle`: trimmed, non-empty, max 100 chars.
  - `displayName`, `userName`: trimmed, non-empty, max 50 chars, no control chars (mirrors `validateDisplayName`).
  - `photoURL`, `authorPhotoURL`, `userPhotoURL`: optional, must be `http:`/`https:` scheme if present (mirrors `validateOptionalUrl`); `null` and `""` are accepted and normalized to `null`.
  - `duration`: integer, `0..86400`; `totalVolume`: number, `0..1e9`; `exercisesCount`: integer, `0..100` (mirror current `validateInt` bounds).
  - `totalVolume` (sync-volume): number, `0..1e9` (the existing runtime clamp becomes a schema-level `max(1e9)`).
  - `idToken` (auth/session): non-empty string.
  - `userPrompt` (ai-coach): optional, trimmed, max 1000 chars (mirrors `validateString(body.userPrompt, 1000)`).
  - `profile.age`: integer, `5..120`; `trainingYears`: integer, `0..80`; `daysPerWeek`: integer, `1..7`; `sessionLengthMin`: integer, `10..240`; `heightCm`: number, `50..300`; `weightKg`: number, `20..400` (reasonable human bounds; the current code has none — these are new safety bounds to be confirmed in plan stage, flagged as `NEEDS CONFIRMATION` below).
  - `equipment`, `priorityMuscles`, `injuries`, `medicalCautions`: arrays of strings, each string max 100 chars, array max 50 items.
  - `recentSessions`, `personalRecords`, `exercises`, `analytics.muscleGroupStats`, `analytics.weeklyTonnage`: arrays with max-length caps (e.g. 50 sessions, 50 PRs, 500 exercises, 20 muscle stats, 26 weeks) to bound AI prompt size and prevent token-overflow abuse. Exact caps flagged as `NEEDS CONFIRMATION`.
- **FR-008**: The `/api/ai-workout` schema MUST explicitly omit `prompt` and `systemInstruction` from its allowed keys and use `.strict()` so that any request containing either field is rejected with `400`. This replaces the current manual `if (body.prompt !== undefined ...)` check with a declarative schema guard.
- **FR-009**: On validation failure, the response body MUST be `{ "error": "Validation failed", "details": [{ "path": ["postId"], "message": "..." }, ...] }` with HTTP status `400`. The `details` array is derived from `zodError.issues`. No internal stack traces or Prisma errors are leaked.
- **FR-010**: The existing manual validators in `src/lib/validation.ts` (`validateString`, `validateId`, `validateDisplayName`, `validateUrl`, `validateOptionalUrl`, `validateInt`, `validateFloat`) MUST remain available (they are used elsewhere and by `handlePrismaError`/`errorResponse`/`serverErrorResponse`); the new Zod schemas layer ON TOP of / alongside them. Routes MAY be migrated to use the parsed Zod output instead of re-calling the manual validators, but the manual validators are NOT deleted in this sprint (deletion is a Sprint 4 cleanup task).
- **FR-011**: Every POST/DELETE/PUT handler MUST call `parseRequestBody` (or `parseQueryParams` for GET) as its FIRST action after `requireUser` (or before, for the `/api/auth/session` POST which has no session yet). Business logic, Prisma calls, and AI calls MUST only run after a successful parse. This guarantees no malformed input reaches downstream code.
- **FR-012**: `bun run lint` MUST pass with 0 new errors. `npx tsc --noEmit` MUST pass with 0 new errors. Zod v4 (`zod@^4.0.2`, already installed) is the ONLY validation library used — no new dependencies.

#### P1-5 — Per-User Rate Limiting

- **FR-013**: The middleware in `src/middleware.ts` MUST change the rate-limit bucket key from `${ip}:${pathname}` to a two-tier strategy:
  - **Authenticated routes**: key = `uid:<callerUid>:<category>` where `callerUid` is the uid extracted from the `pulse_session` Firebase session cookie.
  - **Unauthenticated requests** (no cookie, or cookie verification fails): key = `ip:<ip>:<category>`.
  - The `<category>` replaces `<pathname>` so that all routes in the same category share one bucket per caller (see FR-014).
- **FR-014**: The rate-limit category mapping MUST be:
  - **`ai`** (20 requests/hour): `/api/ai-coach` POST, `/api/ai-workout` POST. (`/api/ai-health` GET is a cheap health check and falls under `default`.)
  - **`sync`** (60 requests/hour): `/api/challenges/sync-volume` POST, and `/api/sync/push` if/when it is implemented.
  - **`social-writes`** (100 requests/hour): all POST and DELETE methods on `/api/social/comments`, `/api/social/feed`, `/api/social/follow`, `/api/social/kudos`, `/api/social/posts`, `/api/social/profile`.
  - **`default`** (300 requests/hour): every other `/api/*` route not matched above (GETs, `/api/challenges` GET, `/api/challenges/[id]/join` POST, `/api/challenges/[id]/leaderboard` GET, `/api/challenges/[id]/progress` GET, `/api/auth/session` POST/DELETE, `/api` GET, `/api/ai-health` GET).
- **FR-015**: The rate-limit window MUST change from the current 1-minute window (`WINDOW_MS = 60_000`) to a 1-hour window (`WINDOW_MS = 3_600_000`) so that the per-category limits (20/100/60/300) are interpreted as "per hour" as specified. The token-bucket algorithm is preserved: the bucket capacity equals the hourly limit, and tokens refill continuously at `limit / 3_600_000` per ms. This means a user can burst up to the full hourly allowance at once, then is throttled for the rest of the hour — matching typical rate-limit semantics.
- **FR-016**: The `callerUid` for rate-limit keying MUST be obtained by verifying the `pulse_session` cookie via `firebase-admin`'s `verifySessionCookie(cookie, false)`. The `false` argument disables the per-request revocation check (which would require a network call) while still verifying the JWT signature against Firebase's cached public keys. The full revocation check (`verifySessionCookie(cookie, true)`) continues to run in `requireUser` at the route handler — that remains the authoritative auth boundary. Rate-limiting is abuse prevention, not authorization.
- **FR-017**: Because `firebase-admin` uses Node.js APIs (`fs`, `path` — see `src/lib/firebaseAdmin.ts`), the middleware MUST declare `export const runtime = "nodejs"` to run in the Node.js runtime instead of the default Edge runtime. The matcher remains `["/api/:path*"]` so middleware only runs on API routes (no impact on static asset serving).
- **FR-018**: The uid-extraction logic in middleware MUST be wrapped in try/catch. If `getAdminAuth()` throws (e.g. missing service account on a fresh deploy), if `verifySessionCookie` throws (invalid/expired/garbage cookie), or if no cookie is present, the middleware MUST fall back to IP-based keying (`ip:<ip>:<category>`) and continue processing — it MUST NEVER return a 500 due to rate-limiter initialization failure. A structured error is logged via `console.error` (Sprint 4 will replace with structured logging per constitution rule 7).
- **FR-019**: The existing `getClientIp(req)` function (with `TRUSTED_PROXY_IPS` support from P0-8) MUST be preserved and used as the IP source for the fallback bucket. No regression on the P0-8 secure-IP-extraction work.
- **FR-020**: The existing P0-9 body-size-limit check MUST be preserved and continue to run BEFORE the rate-limit check (rejecting oversized payloads early with 413). No regression on P0-9.
- **FR-021**: The existing P0-2 session-cookie-existence check for write methods (`if (WRITE_METHODS.has(req.method) && !hasSession) return 401`) MUST be preserved. (Note: with per-user rate limiting now reading the cookie, the existence check is partially subsumed, but the explicit 401 for write-methods-without-cookie is kept as a fast-fail before the route handler runs.)
- **FR-022**: The 429 response MUST preserve the existing shape: `{ "error": "Rate limit exceeded. Please try again later." }` with status `429` and headers `Retry-After` and `X-RateLimit-Remaining: 0`. The `Retry-After` value SHOULD reflect the approximate seconds until the bucket next has ≥1 token (computed from the refill rate), but a conservative static `3600` is acceptable for v1.
- **FR-023**: The `X-RateLimit-Remaining` header on successful responses MUST reflect the remaining tokens in the caller's actual bucket (per-user or per-IP depending on auth state), rounded down.
- **FR-024**: The bucket cleanup logic (`cleanupBuckets`, evicting buckets idle > 10 min) MUST be updated to account for the longer 1-hour window — the idle-eviction cutoff SHOULD be raised to 2 hours (`now - 2 * 3_600_000`) so that active hourly buckets are not prematurely evicted mid-window. The cleanup interval (every 5 min) is preserved.
- **FR-025**: `bun run lint` and `npx tsc --noEmit` MUST pass with 0 new errors. No new runtime dependencies (firebase-admin is already installed at `^14.0.0`).

### Key Entities

- **ZodSchema**: A `z.object({...})` (or `z.ZodType`) defining the allowed shape, types, and constraints for a route's request body or query params. Each route has one (or one per HTTP method).
- **ValidationResult**: The discriminated union returned by `parseRequestBody` / `parseQueryParams`: `{ success: true, data: T }` or `{ success: false, response: Response }` (the `response` is a pre-built `400`).
- **RateLimitCategory**: Union type `"ai" | "sync" | "social-writes" | "default"`, derived from the route path + HTTP method.
- **RateLimitBucketKey**: String of the form `uid:<callerUid>:<category>` (authenticated) or `ip:<ip>:<category>` (unauthenticated/fallback).
- **callerUid (middleware scope)**: The uid extracted from the `pulse_session` cookie via `verifySessionCookie(cookie, false)`. Distinct from the `callerUid` returned by `requireUser` at the route handler (which uses `verifySessionCookie(cookie, true)` with revocation check). Both resolve to the same uid for a valid session; the middleware variant is the "fast path" for rate-limit keying only.
- **WINDOW_MS**: Refilled-window duration for the token bucket. Changes from `60_000` (1 min) to `3_600_000` (1 hr) in this sprint.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every POST/DELETE/PUT handler under `src/app/api/` (12 routes) calls `parseRequestBody` as its first action and has a co-located Zod schema. Verifiable by `grep -r "parseRequestBody" src/app/api/ | wc -l` ≥ 12 and `grep -rL "parseRequestBody\|parseQueryParams" src/app/api/**/route.ts` returning 0 routes with write methods lacking validation.

- **SC-002**: Every GET handler that reads `searchParams` (4 routes: comments, search, following, progress) calls `parseQueryParams` with a Zod query schema. Verifiable by inspection.

- **SC-003**: Sending a POST to `/api/social/comments` with `{ "postId": 12345, "text": "hi" }` (wrong type) returns `400` with `{ "error": "Validation failed", "details": [{ "path": ["postId"], ... }] }` and NO Prisma query executes (verifiable by DB row count before/after).

- **SC-004**: Sending a POST to `/api/ai-workout` with `{ "prompt": "..." }` returns `400` (the forbidden field is rejected by `.strict()` schema), and the OpenRouter API is never called (verifiable by no outbound HTTP to openrouter.ai).

- **SC-005**: Sending malformed non-JSON (e.g. `{bad`) to any POST route returns `400 { "error": "Invalid JSON body" }` (NOT `500`).

- **SC-006**: Two authenticated users on the same IP have independent rate-limit buckets: User A exhausting the `ai` bucket (20 calls) does NOT affect User B's ability to call `/api/ai-coach`. Verifiable by scripted test with two session cookies.

- **SC-007**: The rate-limit bucket key for an authenticated request is `uid:<callerUid>:<category>` (verifiable by inspecting the in-memory `buckets` Map keys in a debug endpoint or test).

- **SC-008**: A request with a garbage `pulse_session` cookie (e.g. `garbage`) is rate-limited by IP (fallback) and then rejected with `401` by `requireUser` at the route — the middleware does NOT 500.

- **SC-009**: The 429 response includes `Retry-After` and `X-RateLimit-Remaining: 0` headers (no regression on the 429 contract from Sprint 1).

- **SC-010**: `bun run lint` passes with 0 new errors. `npx tsc --noEmit` passes with 0 new errors. No `any` types introduced (constitution rule 1).

- **SC-011**: Agent Browser verification confirms the app's golden path still works end-to-end after both changes: sign in → generate an AI workout → post to feed → kudos a post → comment — all without a rate-limit false-positive or a validation false-negative on well-formed client payloads.

- **SC-012**: No behavioral regression on valid requests: a correctly-formed POST to each of the 12 write routes succeeds exactly as before the sprint (the Zod schema accepts the current client payload shapes, and the per-user rate limits are high enough that a single user's normal usage never trips them during a test session).

## Assumptions

- **Zod v4 is installed and stable** for this codebase (`zod@^4.0.2` per `package.json`). No version upgrade is needed. The `z.object().strict()` / `.strip()` / `.safeParse()` / `.refine()` APIs used are all present in v4.
- **`firebase-admin` can run in the Next.js Node.js-runtime middleware.** Next.js 16 supports `export const runtime = "nodejs"` in `middleware.ts`. The `getAdminAuth()` singleton in `src/lib/firebaseAdmin.ts` is process-scoped and will initialize once per server instance. The service account is available via `FIREBASE_SERVICE_ACCOUNT` env var or `service-account.json` file (already configured for the route handlers; the middleware reuses the same initializer).
- **`verifySessionCookie(cookie, false)` is sufficiently fast for per-request middleware use.** Signature verification uses Firebase's cached public keys (fetched once per ~24h from Google's CDN); no per-request network call occurs with `checkRevoked=false`. The revocation check (`true`) remains in `requireUser` at the route handler for the authoritative auth decision.
- **The 1-hour rate-limit window is acceptable** for this app's traffic profile (a fitness app, not a high-frequency API). Bursty users can spend their full hourly allowance in the first minute and then wait; this matches the user-specified "per hour" limits. A more sophisticated sliding-window limiter is out of scope for this sprint.
- **The per-category (not per-route) bucketing is the intended interpretation** of "AI 20/hr, social writes 100/hr, sync 60/hr" — i.e. 20 AI calls total per hour across all AI routes, not 20 per AI route. This is the stricter (safer) interpretation. If per-route bucketing is desired instead, FR-013/FR-014 would change to key on `${callerUid}:${pathname}` — flagged as `NEEDS CONFIRMATION` but the spec proceeds with the per-category (stricter) default.
- **The existing manual validators in `src/lib/validation.ts` are NOT removed** in this sprint. They remain used by `handlePrismaError`, `errorResponse`, `serverErrorResponse`, and possibly some non-API code. Migration of remaining callers to Zod is a Sprint 4 cleanup task. This avoids a large-blast-radius refactor inside a security sprint.
- **The `/api/sync/push` route** (referenced in the P0-9 middleware body-size limits as a 10MB route) has no `route.ts` in the current inventory. It is treated as out-of-scope for body validation (nothing to validate) but in-scope for rate-limit categorization (`sync` category, reserved for when it is implemented). If it is never implemented, the reservation is harmless.
- **The new numeric bounds on AI-coach profile fields** (age 5..120, heightCm 50..300, etc. — see FR-007) are safety additions not present in the current code. They are flagged `NEEDS CONFIRMATION` in the plan stage; if the product owner prefers to preserve the current "accept anything" behavior, those bounds are loosened or removed. The spec includes conservative bounds as the default because unbounded numeric inputs to an LLM prompt are a prompt-injection / token-overflow risk.
- **`TRUSTED_PROXY_IPS` is set** in the deployment `.env` (to `127.0.0.1` per the Sprint 1 spec assumptions), so `getClientIp` correctly reads `x-real-ip` / `x-forwarded-for` from the Caddy proxy. This sprint's IP fallback for rate-limiting inherits that behavior unchanged.
- **No new test files are written in this spec stage.** Test authorship is a plan/task-stage activity. The acceptance scenarios above define the test cases to be implemented.
