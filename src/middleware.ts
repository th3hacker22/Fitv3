import { NextRequest, NextResponse } from "next/server";

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;

const ROUTE_LIMITS: { pattern: RegExp; limit: number }[] = [
  { pattern: /^\/api\/ai-workout$/, limit: 5 },
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

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

const WRITE_METHODS = new Set(["POST", "DELETE", "PUT", "PATCH"]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
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
