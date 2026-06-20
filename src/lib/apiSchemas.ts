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
