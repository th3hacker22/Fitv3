import { NextRequest, NextResponse } from "next/server";

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;

const ROUTE_LIMITS: { pattern: RegExp; limit: number }[] = [
  { pattern: /^\/api\/ai-workout$/, limit: 5 },
  { pattern: /^\/api\/ai-coach$/, limit: 5 },
  { pattern: /^\/api\/challenges\/sync-volume$/, limit: 10 },
  { pattern: /^\/api\/social\/comments$/, limit: 20 },
  { pattern: /^\/api\/social\/feed$/, limit: 30 },
  { pattern: /^\/api\/social/, limit: 60 },
  { pattern: /^\/api\/challenges/, limit: 60 },
];

const DEFAULT_LIMIT = 120;

function getRateLimit(pathname: string): number {
  for (const { pattern, limit } of ROUTE_LIMITS) {
    if (pattern.test(pathname)) return limit;
  }
  return DEFAULT_LIMIT;
}

function checkRateLimit(ip: string, pathname: string): { allowed: boolean; remaining: number } {
  const key = `${ip}:${pathname}`;
  const limit = getRateLimit(pathname);
  const now = Date.now();

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: limit, lastRefill: now };
    buckets.set(key, bucket);
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

let lastCleanup = Date.now();
function cleanupBuckets() {
  const now = Date.now();
  if (now - lastCleanup < 5 * 60_000) return;
  lastCleanup = now;
  const cutoff = now - 10 * 60_000;
  for (const [key, bucket] of buckets) {
    if (bucket.lastRefill < cutoff) {
      buckets.delete(key);
    }
  }
}

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

  cleanupBuckets();

  const ip = getClientIp(req);
  const { allowed, remaining } = checkRateLimit(ip, pathname);

  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": "60",
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

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
