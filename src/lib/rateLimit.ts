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
// Authenticated requests are keyed by uid; unauthenticated by IP.
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
