/**
 * Media Cache Service.
 *
 * Lightweight wrapper around the Cache API for offline-first media playback.
 * Used by ExerciseVideoPlayer to cache GIF/video responses so they're
 * available when the user is offline.
 *
 * Design notes:
 *  - All operations are best-effort: if the Cache API is unavailable (older
 *    browsers, private mode, SSR) or the operation fails, callers get a
 *    clean `null`/`false` and the normal network request proceeds. This
 *    keeps the offline-first promise without ever breaking the UI.
 *  - The cache key is the request URL. We use `cache.match(url)` which does
 *    a URL-based lookup (ignoring Vary headers) — good enough for static
 *    media assets.
 *  - We never block the main render on cache writes; they fire-and-forget.
 */

const CACHE_NAME = "pulse-exercise-media";
/** Maximum number of cached media entries. When exceeded, oldest entries are evicted (LRU). */
const MAX_CACHE_ENTRIES = 50;

/**
 * True when the Cache API is available in the current context.
 * SSR-safe + private-mode-safe (Safari throws on `caches` in some modes).
 */
export function isCacheApiSupported(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return typeof caches !== "undefined" && typeof caches.open === "function";
  } catch {
    return false;
  }
}

/**
 * Try to read a cached Response for the given URL. Returns the Response on
 * hit, `null` on miss or when the Cache API is unavailable.
 *
 * Callers should use `URL.createObjectURL(await response.blob())` to get a
 * playable object URL — this avoids re-fetching and works offline.
 */
export async function getCachedMedia(url: string): Promise<Response | null> {
  if (!isCacheApiSupported()) return null;
  try {
    const cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(url);
    return hit ?? null;
  } catch {
    return null;
  }
}

/**
 * Store a network Response in the cache for future offline use.
 * Fire-and-forget — never throws. Only called after a successful fetch so
 * we don't pollute the cache with error responses.
 */
export async function putCachedMedia(url: string, response: Response): Promise<void> {
  if (!isCacheApiSupported()) return;
  try {
    const cache = await caches.open(CACHE_NAME);
    // Clone before storing — the original response is consumed by the caller.
    await cache.put(url, response.clone());

    // LRU eviction: if the cache has more than MAX_CACHE_ENTRIES, delete the
    // oldest. Cache API doesn't have built-in LRU, so we check the entry count
    // and delete the first (oldest) keys until we're under the limit.
    const keys = await cache.keys();
    if (keys.length > MAX_CACHE_ENTRIES) {
      const toDelete = keys.slice(0, keys.length - MAX_CACHE_ENTRIES);
      await Promise.all(toDelete.map((req) => cache.delete(req)));
    }
  } catch {
    /* swallow — caching is best-effort */
  }
}

/**
 * Fetch a media URL with cache-first strategy:
 *   1. Check the Cache API. On hit → return the cached Response.
 *   2. On miss → fetch from network. On success → store in cache (fire-and-
 *      forget) and return the Response.
 *   3. On network failure → return null (caller shows placeholder).
 *
 * Returns a Response (which can be converted to a blob URL) or null.
 */
export async function fetchMediaWithCache(url: string): Promise<Response | null> {
  // 1. Cache lookup
  const cached = await getCachedMedia(url);
  if (cached) return cached;

  // 2. Network fetch
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) return null;
    // 3. Store for next time (fire-and-forget).
    void putCachedMedia(url, response);
    return response;
  } catch {
    return null;
  }
}

/**
 * Convert a Response to an object URL suitable for `<img src>` / `<video src>`.
 * Returns null if the Response is null or the blob can't be read.
 */
export async function responseToObjectUrl(response: Response | null): Promise<string | null> {
  if (!response) return null;
  try {
    const blob = await response.blob();
    if (blob.size === 0) return null;
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}
