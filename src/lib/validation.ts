/**
 * Input validation helpers for API routes.
 *
 * These functions sanitize and validate request body fields to prevent abuse
 * (oversized payloads, invalid URLs, injection attempts, numeric overflow).
 */

// ── String validation ──

/** Trims and caps a string to maxLength. Returns null if empty after trim. */
export function validateString(
  value: unknown,
  maxLength: number = 255
): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

/** Validates a display name (1-50 chars, no control chars). */
export function validateDisplayName(value: unknown): string | null {
  const name = validateString(value, 50);
  if (!name) return null;
  // Reject control characters
  if (/[\x00-\x1f\x7f]/.test(name)) return null;
  return name;
}

/** Validates a URL — rejects javascript:, data:, and other dangerous schemes. */
export function validateUrl(value: unknown): string | null {
  const url = validateString(value, 2048);
  if (!url) return null;
  try {
    const parsed = new URL(url);
    // Only allow http and https
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

/** Validates a photo URL (can be null, but if present must be http/https). */
export function validateOptionalUrl(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  return validateUrl(value);
}

// ── Numeric validation ──

/** Validates a non-negative integer within [min, max]. Returns null if invalid. */
export function validateInt(
  value: unknown,
  min: number = 0,
  max: number = Number.MAX_SAFE_INTEGER
): number | null {
  const num = typeof value === "string" ? Number(value) : value;
  if (typeof num !== "number" || !Number.isFinite(num)) return null;
  const int = Math.trunc(num);
  if (int < min || int > max) return null;
  return int;
}

/** Validates a non-negative float within [min, max]. Returns null if invalid. */
export function validateFloat(
  value: unknown,
  min: number = 0,
  max: number = 1e9
): number | null {
  const num = typeof value === "string" ? Number(value) : value;
  if (typeof num !== "number" || !Number.isFinite(num)) return null;
  if (num < min || num > max) return null;
  return num;
}

// ── ID validation ──

/** Validates a user/post/comment/challenge ID (non-empty, reasonable length). */
export function validateId(value: unknown): string | null {
  const id = validateString(value, 200);
  if (!id) return null;
  // Reject if it contains whitespace or control chars
  if (/\s/.test(id)) return null;
  return id;
}

// ── Generic helpers ──

/** Returns a generic error response (sanitized — no internal details leaked). */
export function errorResponse(message: string, status: number = 400) {
  return Response.json({ error: message }, { status });
}

/** Returns a generic 500 error (never leaks internal details). */
export function serverErrorResponse() {
  return Response.json({ error: "Internal server error" }, { status: 500 });
}

/** Handles Prisma P2025 (record not found) → 404, otherwise → 500. */
export function handlePrismaError(error: unknown): Response {
  const prismaError = error as { code?: string };
  if (prismaError?.code === "P2025") {
    return errorResponse("Record not found", 404);
  }
  console.error("Prisma error:", error);
  return serverErrorResponse();
}
