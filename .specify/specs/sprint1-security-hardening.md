# Feature Specification: Sprint 1 Final Security Hardening

**Feature Branch**: `sprint1-security-hardening`

**Created**: 2026-06-20

**Status**: Draft

**Input**: User description: "Sprint 1 Final Security Hardening — Caddyfile SSRF fix, IP trust validation, request body size limits, and notification service consolidation."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Caddyfile SSRF Elimination (Priority: P1)

As a system administrator, I want the Caddy reverse proxy configuration to only proxy to the known Next.js server on localhost:3000, so that attackers cannot use the `XTransformPort` query parameter to probe or access arbitrary internal services.

**Why this priority**: The open-proxy SSRF vulnerability allows unauthenticated attackers to scan and access any service on the host machine. This is the most critical security finding and blocks production deployment.

**Independent Test**: Can be tested by sending a request with `?XTransformPort=8080` to the gateway and verifying it returns a 502 (or proxies to 3000) instead of connecting to port 8080.

**Acceptance Scenarios**:

1. **Given** the Caddyfile is deployed, **When** a request arrives at `:81?XTransformPort=5432`, **Then** the request is proxied to `localhost:3000` (not port 5432), and no open-proxy behavior exists.
2. **Given** the Caddyfile is deployed, **When** a normal request arrives at `:81/`, **Then** it is correctly proxied to `localhost:3000` with proper `X-Forwarded-For`, `X-Forwarded-Proto`, and `X-Real-IP` headers.
3. **Given** a developer needs port-forwarding for local dev, **When** they use `Caddyfile.dev`, **Then** the `XTransformPort` block is available for development only and is never deployed to production.

---

### User Story 2 - Secure IP Extraction (Priority: P1)

As a security-conscious developer, I want the rate-limiting middleware to stop blindly trusting the `X-Forwarded-For` header, so that attackers cannot spoof their IP address to bypass rate limits.

**Why this priority**: The current `getClientIp()` function trusts `X-Forwarded-For` verbatim, allowing any client to set `X-Forwarded-For: 1.2.3.4` and get a fresh rate-limit bucket. This defeats the entire rate-limiting system.

**Independent Test**: Can be tested by sending a request with a spoofed `X-Forwarded-For: 99.99.99.99` header and verifying the rate-limit bucket is keyed on the real IP, not the spoofed one.

**Acceptance Scenarios**:

1. **Given** `TRUSTED_PROXY_IPS` is not set in `.env`, **When** a request arrives with `X-Forwarded-For: 99.99.99.99`, **Then** the middleware uses the direct connection IP (from `x-real-ip` or `req.ip`) for rate-limiting, ignoring the spoofed header.
2. **Given** `TRUSTED_PROXY_IPS=127.0.0.1` is set, **When** a request arrives from `127.0.0.1` with `X-Forwarded-For: 203.0.113.5`, **Then** the middleware trusts the header and uses `203.0.113.5` for rate-limiting (because it came from a trusted proxy).
3. **Given** `TRUSTED_PROXY_IPS=127.0.0.1` is set, **When** a request arrives from `10.0.0.5` (not in trusted list) with `X-Forwarded-For: 203.0.113.5`, **Then** the middleware ignores the header and uses `10.0.0.5` for rate-limiting.

---

### User Story 3 - Request Body Size Limits (Priority: P1)

As a product owner, I want all API routes to enforce request body size limits, so that attackers cannot send oversized payloads to exhaust server memory or crash the application.

**Why this priority**: Without body size limits, any authenticated user can POST a multi-gigabyte payload to `/api/ai-coach` or `/api/social/feed`, causing memory exhaustion and potential denial of service.

**Independent Test**: Can be tested by sending a POST request with a `Content-Length: 100000000` header to `/api/ai-coach` and verifying it returns 413 before reading the body.

**Acceptance Scenarios**:

1. **Given** a POST request to `/api/ai-coach` with `Content-Length: 60000` (60KB), **When** the middleware processes it, **Then** the request is rejected with `413 Payload Too Large` and a JSON error message indicating the 50KB limit.
2. **Given** a POST request to `/api/ai-coach` with `Content-Length: 30000` (30KB), **When** the middleware processes it, **Then** the request proceeds normally to the route handler.
3. **Given** a POST request to `/api/social/feed` with `Content-Length: 2000000` (2MB), **When** the middleware processes it, **Then** the request is rejected with `413` and the 1MB limit message.
4. **Given** a POST request to `/api/sync/push` with `Content-Length: 5000000` (5MB), **When** the middleware processes it, **Then** the request proceeds normally (10MB limit for sync).
5. **Given** a GET request (no body) to any `/api/` route, **When** the middleware processes it, **Then** no body size check is performed (GET requests don't have bodies).

---

### User Story 4 - Notification Service Consolidation (Priority: P2)

As a developer maintaining the codebase, I want the two duplicate notification modules (`src/utils/notifications.ts` and `src/services/notificationService.ts`) merged into a single unified service, so that there is one source of truth for notification logic, no dead code, and all imports are consistent.

**Why this priority**: Having two notification modules with overlapping functions (`sendNotification`, `requestNotificationPermission`, `getNotificationPermission`) creates confusion, maintenance burden, and the risk of one being updated while the other is neglected. This is a code-quality issue, not a security blocker, but it should be resolved before Sprint 2.

**Independent Test**: Can be tested by verifying that `src/utils/notifications.ts` no longer exists, all imports across the codebase point to `src/services/notificationService.ts`, and all notification functions work correctly (permission request, send notification, PR notification, etc.).

**Acceptance Scenarios**:

1. **Given** the consolidation is complete, **When** a developer searches for `sendNotification` imports, **Then** all imports resolve to `@/services/notificationService` (no imports from `@/utils/notifications`).
2. **Given** the consolidation is complete, **When** the file `src/utils/notifications.ts` is checked, **Then** it does not exist (or is an empty re-export stub for backward compat).
3. **Given** the SettingsPage toggle is turned on, **When** the user triggers a notification (e.g., rest timer completes), **Then** the notification fires correctly using the unified service.
4. **Given** the `RestTimer` component calls `sendNotification`, **When** the rest timer reaches 0, **Then** the notification fires from the unified service without import errors.
5. **Given** the `useWorkoutStore` calls `sendPRNotification` dynamically, **When** a new PR is detected, **Then** the PR notification fires from the unified service.

---

### Edge Cases

- What happens when `Content-Length` header is missing but the body is large? (The middleware can only check `Content-Length` — if it's missing, the request proceeds and the route handler reads the body. This is acceptable because Next.js route handlers have their own body parsing limits.)
- What happens when `TRUSTED_PROXY_IPS` contains invalid IPs? (They are simply never matched — the set comparison is string-based, so invalid IPs are harmless.)
- What happens when the unified notification service is imported on the server side? (The service checks `typeof window !== "undefined"` before accessing `Notification` — it's a no-op on the server.)
- What happens if Caddy is not running and the app is accessed directly on port 3000? (The middleware's `getClientIp` falls back to `req.ip` which is the direct connection IP — this is correct behavior.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The production `Caddyfile` MUST NOT contain any `XTransformPort` query-parameter-based reverse proxy block. It MUST proxy all traffic to `localhost:3000` only.
- **FR-002**: A `Caddyfile.dev` file MUST be created for development use that retains the `XTransformPort` functionality. This file MUST NOT be deployed to production.
- **FR-003**: The middleware's `getClientIp()` function MUST NOT trust `X-Forwarded-For` unless the direct connection IP is in the `TRUSTED_PROXY_IPS` set (comma-separated env var).
- **FR-004**: When `TRUSTED_PROXY_IPS` is not set or empty, the middleware MUST use the direct connection IP (`x-real-ip` header or `req.ip`) for rate-limiting.
- **FR-005**: The middleware MUST check `Content-Length` on all POST/PUT/PATCH/DELETE requests to `/api/*` routes and reject with `413` if the size exceeds the route-specific limit.
- **FR-006**: Body size limits MUST be: 50KB for `/api/ai-coach` and `/api/ai-workout`, 10MB for `/api/sync/push`, 1MB for all other `/api/*` routes.
- **FR-007**: The 413 response MUST be a JSON object with format `{ "error": "Request body too large. Maximum allowed: Xkb." }`.
- **FR-008**: `src/utils/notifications.ts` and `src/services/notificationService.ts` MUST be merged into a single file at `src/services/notificationService.ts`.
- **FR-009**: The unified notification service MUST export all functions previously available in both files: `sendNotification` (both the simple and typed versions), `requestNotificationPermission`, `getNotificationPermission`, `isNotificationSupported`, `isNotificationsEnabled`, `disableNotifications`, `sendPRNotification`, `sendStreakWarning`, `scheduleWorkoutReminders`, `initNotifications`.
- **FR-010**: All imports of `@/utils/notifications` across the codebase MUST be updated to `@/services/notificationService`.
- **FR-011**: The `sendNotification` function signature MUST support both calling conventions: `sendNotification(title: string, options?: NotificationOptions)` (from utils) and `sendNotification(type: NotificationType, customBody?: string)` (from service). This MUST be resolved by renaming one to avoid ambiguity — the typed version should be `sendTypedNotification(type, customBody)` and the simple version retains `sendNotification(title, options)`.

### Key Entities

- **TRUSTED_PROXY_IPS**: Environment variable (comma-separated IP list) controlling which direct connection IPs are allowed to set `X-Forwarded-For`.
- **BODY_SIZE_LIMITS**: Internal middleware configuration mapping route patterns to maximum allowed `Content-Length` in bytes.
- **NotificationType**: Union type `"workout_reminder" | "pr_celebration" | "streak_warning" | "rest_complete" | "deload_reminder"` used by the unified notification service.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Sending `?XTransformPort=5432` to the gateway returns a response from port 3000 (not port 5432), confirming no open-proxy behavior.
- **SC-002**: Sending 100 requests with spoofed `X-Forwarded-For: 99.99.99.99` from the same real IP triggers rate-limiting on the real IP (not the spoofed one).
- **SC-003**: Sending a POST to `/api/ai-coach` with `Content-Length: 60000` returns `413` with a JSON error message.
- **SC-004**: Sending a POST to `/api/sync/push` with `Content-Length: 5000000` (5MB) proceeds normally (under 10MB limit).
- **SC-005**: `grep -r "utils/notifications" src/` returns 0 results after consolidation.
- **SC-006**: `bun run lint` passes with 0 new errors after all changes.
- **SC-007**: `npx tsc --noEmit` passes with 0 new errors after all changes.

## Assumptions

- The Caddy gateway runs on port 81 (not 443/80) because this is a sandbox environment. In production, the port would be 443 with TLS.
- `TRUSTED_PROXY_IPS` will be set in `.env` to `127.0.0.1` (the Caddy proxy runs on the same host).
- The `req.ip` property is available in Next.js middleware (it may be `undefined` in some edge cases — the fallback is `x-real-ip` header set by Caddy).
- `Content-Length` header is present for all requests with a body. Requests without `Content-Length` (chunked encoding) are rare in this app's usage and will not be blocked.
- The `notifications.ts` file's `sendNotification(title, options)` function is used by `RestTimer.tsx` and `SettingsPage.tsx`. The `notificationService.ts` file's `sendNotification(type, customBody)` is used internally and via dynamic imports. The rename to `sendTypedNotification` for the typed version avoids breaking the simple-version callers.
