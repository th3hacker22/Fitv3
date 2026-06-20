import { NextRequest, NextResponse } from "next/server";
import {
  categorizeRequest,
  checkRateLimit,
  cleanupBuckets,
  extractUidForRateLimit,
  buildBucketKey,
} from "@/lib/rateLimit";

// firebase-admin (used by extractUidForRateLimit) relies on Node.js fs/path,
// so the middleware MUST run in the Node.js runtime instead of the default Edge.
export const runtime = "nodejs";

// ── P0-8: Secure IP extraction ──
// Only trust x-forwarded-for if the request came from a trusted proxy.
// TRUSTED_PROXY_IPS is a comma-separated env var (e.g., "127.0.0.1,10.0.0.1").
function getTrustedProxyIps(): Set<string> {
  const env = process.env.TRUSTED_PROXY_IPS;
  if (!env) return new Set();
  return new Set(env.split(",").map((ip) => ip.trim()));
}

function getClientIp(req: NextRequest): string {
  const trustedProxies = getTrustedProxyIps();

  // If we have trusted proxies configured, only trust X-Forwarded-For
  // when the direct connection came from a trusted proxy.
  if (trustedProxies.size > 0) {
    const directIp = req.headers.get("x-real-ip") || "unknown";

    if (trustedProxies.has(directIp)) {
      // Request came from a trusted proxy — safe to read X-Forwarded-For
      const forwarded = req.headers.get("x-forwarded-for");
      if (forwarded) {
        return forwarded.split(",")[0].trim();
      }
    }
    // Not from a trusted proxy — use the direct IP
    return directIp;
  }

  // No trusted proxies configured — use the direct IP (don't trust headers)
  // Fallback: try x-real-ip (set by Caddy), then "unknown"
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

// ── P0-9: Request body size limits ──
const BODY_SIZE_LIMITS: { pattern: RegExp; maxBytes: number }[] = [
  // AI endpoints: 50KB max (profile + exercises list)
  { pattern: /^\/api\/ai-coach$/, maxBytes: 50 * 1024 },
  { pattern: /^\/api\/ai-workout$/, maxBytes: 50 * 1024 },
  // Sync endpoint: 10MB max (bulk data upload)
  { pattern: /^\/api\/sync\/push$/, maxBytes: 10 * 1024 * 1024 },
];

const DEFAULT_BODY_LIMIT = 1 * 1024 * 1024; // 1MB for all other /api/ routes

function getBodySizeLimit(pathname: string): number {
  for (const { pattern, maxBytes } of BODY_SIZE_LIMITS) {
    if (pattern.test(pathname)) return maxBytes;
  }
  return DEFAULT_BODY_LIMIT;
}

const WRITE_METHODS = new Set(["POST", "DELETE", "PUT", "PATCH"]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // ── P0-9: Body size check (before rate-limiting to reject early) ──
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
          "Retry-After": "3600", // conservative static (1 hour window)
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  // ── P0-2: Write-method session-cookie existence check ──
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

export const config = {
  matcher: ["/api/:path*"],
};
