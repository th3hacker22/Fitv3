# Implementation Plan: Sprint 1 Final Security Hardening

**Branch**: `sprint1-security-hardening` | **Date**: 2026-06-20 | **Spec**: [sprint1-security-hardening.md](../specs/sprint1-security-hardening.md)

**Input**: Feature specification from `.specify/specs/sprint1-security-hardening.md`

## Summary

Eliminate the Caddyfile open-proxy SSRF, secure the rate-limiting middleware against IP spoofing via `X-Forwarded-For`, enforce per-route body size limits to prevent memory exhaustion, and merge the two duplicate notification modules into a single unified service.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Next.js 16 (Turbopack)

**Primary Dependencies**: Next.js middleware API, Caddy v2 (Caddyfile), firebase-admin, Prisma 6

**Storage**: N/A (no schema changes in this sprint)

**Testing**: `bun run lint` + `npx tsc --noEmit` + manual curl verification

**Target Platform**: Linux server (Caddy reverse proxy → Next.js)

**Performance Goals**: Body size check must add <1ms overhead (header parse only, no body read)

**Constraints**: Must not break existing API routes or the dev server. All changes must compile cleanly.

**Scale/Scope**: 4 files modified, 1 file created, 1 file deleted, 5 files with updated imports

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Type Safety | ✅ Pass | No `any` types introduced; all new code is strictly typed |
| II. Offline-First | ✅ Pass | No changes to Dexie or offline behavior |
| III. Firebase Auth Only | ✅ Pass | No auth changes in this sprint |
| IV. Security-First API | ✅ Pass | Directly improves API security (body limits, IP validation) |
| V. Progressive Enhancement | ✅ Pass | No UI changes |
| Rule: No `any` | ✅ Pass | All new code uses explicit types |
| Rule: No `ignoreBuildErrors` | ✅ Pass | Not touched |
| Rule: No `db push` | ✅ Pass | No schema changes |
| Rule: `cmd /c` prefix | ✅ Pass | N/A (Linux environment) |

## Project Structure

### Files to Modify

```text
Caddyfile                          # P0-1: Remove XTransformPort block
src/middleware.ts                  # P0-8 + P0-9: IP trust + body size limits
src/services/notificationService.ts # P0-10: Merge notifications.ts into this
```

### Files to Create

```text
Caddyfile.dev                      # P0-1: Dev-only Caddyfile with XTransformPort
```

### Files to Delete

```text
src/utils/notifications.ts         # P0-10: Merged into notificationService.ts
```

### Files with Updated Imports

```text
src/components/workout/RestTimer.tsx    # Change import from @/utils/notifications → @/services/notificationService
src/pages/SettingsPage.tsx              # Change import from @/utils/notifications → @/services/notificationService
```

**Structure Decision**: Single-project layout (existing). No new directories. All changes are file-level modifications within the existing `src/` tree.

---

## Implementation Phases

### Phase 1: Caddyfile SSRF Fix (FR-001, FR-002)

**File**: `Caddyfile`

**Changes**:
1. Remove the entire `@transform_port_query` block (lines 2-13 in current file)
2. Remove the `handle @transform_port_query` block
3. Keep only the default `handle` block that proxies to `localhost:3000`
4. The final Caddyfile should be a single `:81` block with one `reverse_proxy localhost:3000` directive

**Final Caddyfile content**:
```
:81 {
    reverse_proxy localhost:3000 {
        header_up Host {host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
        header_up X-Real-IP {remote_host}
    }
}
```

**File**: `Caddyfile.dev` (NEW)

**Changes**:
1. Copy the original Caddyfile content (with `XTransformPort` block) into `Caddyfile.dev`
2. Add a header comment: `# DEV ONLY — never deploy to production`

---

### Phase 2: Middleware IP Trust Fix (FR-003, FR-004)

**File**: `src/middleware.ts`

**Changes to `getClientIp()` function**:

Replace the current implementation:
```typescript
// CURRENT (vulnerable):
function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}
```

With the secure implementation:
```typescript
// NEW (secure):
function getTrustedProxyIps(): Set<string> {
  const env = process.env.TRUSTED_PROXY_IPS;
  if (!env) return new Set();
  return new Set(env.split(",").map((ip) => ip.trim()));
}

function getClientIp(req: NextRequest): string {
  const trustedProxies = getTrustedProxyIps();

  if (trustedProxies.size > 0) {
    const directIp = req.headers.get("x-real-ip") || req.ip || "unknown";
    if (trustedProxies.has(directIp)) {
      const forwarded = req.headers.get("x-forwarded-for");
      if (forwarded) {
        return forwarded.split(",")[0].trim();
      }
    }
    return directIp;
  }

  // No trusted proxies configured — don't trust X-Forwarded-For
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return req.ip || "unknown";
}
```

**Key logic**:
- If `TRUSTED_PROXY_IPS` env var is set: only trust `X-Forwarded-For` when the direct connection IP (`x-real-ip` or `req.ip`) is in the trusted set.
- If `TRUSTED_PROXY_IPS` is not set: never trust `X-Forwarded-For`; use `x-real-ip` (set by Caddy) or `req.ip` directly.
- Fallback to `"unknown"` if no IP can be determined.

---

### Phase 3: Body Size Limits (FR-005, FR-006, FR-007)

**File**: `src/middleware.ts`

**Add new constants** (after existing `ROUTE_LIMITS`):
```typescript
const BODY_SIZE_LIMITS: { pattern: RegExp; maxBytes: number }[] = [
  { pattern: /^\/api\/ai-coach$/, maxBytes: 50 * 1024 },
  { pattern: /^\/api\/ai-workout$/, maxBytes: 50 * 1024 },
  { pattern: /^\/api\/sync\/push$/, maxBytes: 10 * 1024 * 1024 },
];
const DEFAULT_BODY_LIMIT = 1 * 1024 * 1024; // 1MB
```

**Add new helper function**:
```typescript
function getBodySizeLimit(pathname: string): number {
  for (const { pattern, maxBytes } of BODY_SIZE_LIMITS) {
    if (pattern.test(pathname)) return maxBytes;
  }
  return DEFAULT_BODY_LIMIT;
}
```

**Add body size check in `middleware()` function** — BEFORE the rate-limit check:
```typescript
// Body size check (only for requests with Content-Length)
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
```

**Placement**: This check goes AFTER the `pathname.startsWith("/api/")` guard and BEFORE the `cleanupBuckets()` call, so oversized requests are rejected early without consuming rate-limit tokens.

---

### Phase 4: Notification Service Consolidation (FR-008, FR-009, FR-010, FR-011)

**File**: `src/services/notificationService.ts` (MODIFY — merge in content from `notifications.ts`)

**Changes**:
1. Add the simple `sendNotification(title: string, options?: NotificationOptions)` function from `notifications.ts` — rename the existing typed version to `sendTypedNotification(type: NotificationType, customBody?: string)`.
2. Ensure all functions from both files are exported:
   - From `notifications.ts`: `notificationsSupported` (rename to `isNotificationSupported` — already exists), `getNotificationPermission` (already exists), `requestNotificationPermission` (already exists), `sendNotification` (simple version — ADD)
   - From `notificationService.ts`: all existing exports remain
3. The `sendNotification` simple version should delegate to the browser `Notification` API directly (not through the typed templates), matching the original `notifications.ts` behavior.
4. Add `notificationsSupported` as an alias for `isNotificationSupported` for backward compatibility.

**File**: `src/utils/notifications.ts` (DELETE)

**File**: `src/components/workout/RestTimer.tsx` (MODIFY import)

Change:
```typescript
import { sendNotification } from "@/utils/notifications";
```
To:
```typescript
import { sendNotification } from "@/services/notificationService";
```

**File**: `src/pages/SettingsPage.tsx` (MODIFY imports)

Change:
```typescript
import {
  notificationsSupported,
  getNotificationPermission,
  requestNotificationPermission,
  sendNotification,
} from "@/utils/notifications";
```
To:
```typescript
import {
  isNotificationSupported as notificationsSupported,
  getNotificationPermission,
  requestNotificationPermission,
  sendNotification,
} from "@/services/notificationService";
```

---

## Execution Sequence

```
Step 1: Modify Caddyfile (remove SSRF block)
Step 2: Create Caddyfile.dev (preserve dev functionality)
  ↓ Verify: cat Caddyfile → no XTransformPort
  ↓ Verify: cat Caddyfile.dev → has XTransformPort
Step 3: Modify src/middleware.ts (add getTrustedProxyIps + rewrite getClientIp)
  ↓ Verify: npx tsc --noEmit → 0 errors
Step 4: Modify src/middleware.ts (add BODY_SIZE_LIMITS + getBodySizeLimit + body check)
  ↓ Verify: npx tsc --noEmit → 0 errors
Step 5: Modify src/services/notificationService.ts (add sendNotification simple + alias)
  ↓ Verify: npx tsc --noEmit → 0 errors
Step 6: Update src/components/workout/RestTimer.tsx (change import)
  ↓ Verify: npx tsc --noEmit → 0 errors
Step 7: Update src/pages/SettingsPage.tsx (change import)
  ↓ Verify: npx tsc --noEmit → 0 errors
Step 8: Delete src/utils/notifications.ts
  ↓ Verify: npx tsc --noEmit → 0 errors (no dangling imports)
Step 9: Run bun run lint → 0 new errors
Step 10: Run npx tsc --noEmit → 0 new errors
Step 11: Restart dev server → HTTP 200 on port 3000 + 81
Step 12: curl test: POST /api/ai-coach with Content-Length: 60000 → 413
Step 13: curl test: GET / with X-Forwarded-For: 99.99.99.99 → rate-limit keyed on real IP
```

## Verification Steps

| Step | Command | Expected Result |
|------|---------|-----------------|
| 1 | `grep XTransformPort Caddyfile` | No output (pattern not found) |
| 2 | `grep XTransformPort Caddyfile.dev` | Pattern found (dev file preserves it) |
| 3 | `npx tsc --noEmit 2>&1 \| grep middleware` | No output (0 type errors in middleware) |
| 4 | `npx tsc --noEmit 2>&1 \| grep notification` | No output (0 type errors in notification files) |
| 5 | `grep "utils/notifications" src/ -r` | No output (no imports from old path) |
| 6 | `ls src/utils/notifications.ts` | File not found (deleted) |
| 7 | `bun run lint 2>&1 \| tail -1` | 0 new errors (pre-existing OK) |
| 8 | `curl -s -w "%{http_code}" -X POST localhost:3000/api/ai-coach -H "Content-Length: 60000" -d ""` | `413` |
| 9 | `curl -s -o /dev/null -w "%{http_code}" localhost:3000/` | `200` |

## Complexity Tracking

No constitution violations. All changes are within the existing architecture and do not introduce new patterns or dependencies.
