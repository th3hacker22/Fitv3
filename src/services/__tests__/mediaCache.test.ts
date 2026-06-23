import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isCacheApiSupported,
  getCachedMedia,
  putCachedMedia,
  fetchMediaWithCache,
  responseToObjectUrl,
} from "../mediaCache";

// ── Mocks ──
// mediaCache checks `typeof window !== "undefined"` first (SSR guard), so we
// need a window object present for the Cache API path to be exercised.

const mockCache = {
  match: vi.fn(),
  put: vi.fn(),
};

const mockCaches = {
  open: vi.fn().mockResolvedValue(mockCache),
};

// Minimal window stub so isCacheApiSupported() passes its SSR guard.
const windowStub = {} as Window;

beforeEach(() => {
  // @ts-expect-error — assign window for the SSR guard check
  global.window = windowStub;
  (global as { caches?: unknown }).caches = mockCaches;
  mockCaches.open.mockClear();
  mockCaches.open.mockResolvedValue(mockCache);
  mockCache.match.mockClear();
  mockCache.put.mockClear();
  mockCache.put.mockResolvedValue(undefined);
});

afterEach(() => {
  // @ts-expect-error — cleanup
  delete global.window;
  (global as { caches?: unknown }).caches = undefined;
});

describe("mediaCache service", () => {
  describe("isCacheApiSupported", () => {
    it("returns false during SSR (no window)", () => {
      // @ts-expect-error — simulate SSR
      delete global.window;
      expect(isCacheApiSupported()).toBe(false);
      // @ts-expect-error — restore
      global.window = windowStub;
    });

    it("returns false when caches is undefined", () => {
      const originalCaches = (global as { caches?: unknown }).caches;
      (global as { caches?: unknown }).caches = undefined;
      expect(isCacheApiSupported()).toBe(false);
      (global as { caches?: unknown }).caches = originalCaches;
    });

    it("returns true when caches.open is a function", () => {
      expect(isCacheApiSupported()).toBe(true);
    });

    it("returns false when accessing caches throws (private mode)", () => {
      Object.defineProperty(global, "caches", {
        get() {
          throw new Error("SecurityError");
        },
        configurable: true,
      });
      expect(isCacheApiSupported()).toBe(false);
      // Restore
      Object.defineProperty(global, "caches", {
        value: mockCaches,
        configurable: true,
        writable: true,
      });
    });
  });

  describe("getCachedMedia", () => {
    it("returns the cached Response on hit", async () => {
      (global as { caches?: unknown }).caches = mockCaches;
      const fakeResponse = new Response("blob-data", { status: 200 });
      mockCache.match.mockResolvedValueOnce(fakeResponse);

      const result = await getCachedMedia("https://example.com/bench.gif");
      expect(result).toBe(fakeResponse);
      expect(mockCaches.open).toHaveBeenCalledWith("pulse-exercise-media");
      expect(mockCache.match).toHaveBeenCalledWith("https://example.com/bench.gif");
    });

    it("returns null on cache miss", async () => {
      (global as { caches?: unknown }).caches = mockCaches;
      mockCache.match.mockResolvedValueOnce(undefined);

      const result = await getCachedMedia("https://example.com/unknown.gif");
      expect(result).toBeNull();
    });

    it("returns null when Cache API is unsupported (no throw)", async () => {
      (global as { caches?: unknown }).caches = undefined;
      const result = await getCachedMedia("https://example.com/bench.gif");
      expect(result).toBeNull();
    });

    it("returns null when caches.open throws", async () => {
      (global as { caches?: unknown }).caches = mockCaches;
      mockCaches.open.mockRejectedValueOnce(new Error("QuotaExceeded"));
      const result = await getCachedMedia("https://example.com/bench.gif");
      expect(result).toBeNull();
      mockCaches.open.mockResolvedValue(mockCache); // restore
    });
  });

  describe("putCachedMedia", () => {
    it("stores a clone of the response in the cache", async () => {
      (global as { caches?: unknown }).caches = mockCaches;
      const response = new Response("data", { status: 200 });

      await putCachedMedia("https://example.com/bench.gif", response);

      expect(mockCache.put).toHaveBeenCalledTimes(1);
      const [key, storedResponse] = mockCache.put.mock.calls[0];
      expect(key).toBe("https://example.com/bench.gif");
      // The stored value should be a clone (different object), not the same.
      expect(storedResponse).not.toBe(response);
    });

    it("is a no-op when Cache API is unsupported", async () => {
      (global as { caches?: unknown }).caches = undefined;
      const response = new Response("data");
      await putCachedMedia("https://example.com/bench.gif", response);
      // No throw — just silently skips.
      expect(mockCache.put).not.toHaveBeenCalled();
    });

    it("swallows errors from cache.put (fire-and-forget)", async () => {
      (global as { caches?: unknown }).caches = mockCaches;
      mockCache.put.mockRejectedValueOnce(new Error("QuotaExceeded"));
      const response = new Response("data");
      // Should NOT throw.
      await expect(putCachedMedia("https://example.com/bench.gif", response)).resolves.toBeUndefined();
      mockCache.put.mockResolvedValue(undefined); // restore
    });
  });

  describe("fetchMediaWithCache", () => {
    it("returns cached response on hit (no network fetch)", async () => {
      (global as { caches?: unknown }).caches = mockCaches;
      const cachedResponse = new Response("cached", { status: 200 });
      mockCache.match.mockResolvedValueOnce(cachedResponse);
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(new Response("network"));

      const result = await fetchMediaWithCache("https://example.com/bench.gif");
      expect(result).toBe(cachedResponse);
      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });

    it("fetches from network on cache miss and stores the response", async () => {
      (global as { caches?: unknown }).caches = mockCaches;
      mockCache.match.mockResolvedValueOnce(undefined);
      const networkResponse = new Response("network-data", { status: 200 });
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(networkResponse);

      const result = await fetchMediaWithCache("https://example.com/bench.gif");
      expect(result).toBe(networkResponse);
      expect(fetchSpy).toHaveBeenCalledWith("https://example.com/bench.gif", { mode: "cors" });
      // Stored in cache (fire-and-forget, but we can verify put was called).
      await new Promise((r) => setTimeout(r, 0)); // let the void promise resolve
      expect(mockCache.put).toHaveBeenCalled();
      fetchSpy.mockRestore();
    });

    it("returns null on network fetch failure (offline)", async () => {
      (global as { caches?: unknown }).caches = mockCaches;
      mockCache.match.mockResolvedValueOnce(undefined);
      const fetchSpy = vi.spyOn(global, "fetch").mockRejectedValue(new Error("NetworkError"));

      const result = await fetchMediaWithCache("https://example.com/bench.gif");
      expect(result).toBeNull();
      fetchSpy.mockRestore();
    });

    it("returns null when the network response is not ok", async () => {
      (global as { caches?: unknown }).caches = mockCaches;
      mockCache.match.mockResolvedValueOnce(undefined);
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(new Response("Not Found", { status: 404 }));

      const result = await fetchMediaWithCache("https://example.com/missing.gif");
      expect(result).toBeNull();
      fetchSpy.mockRestore();
    });

    it("returns null when Cache API is unsupported AND fetch fails", async () => {
      (global as { caches?: unknown }).caches = undefined;
      const fetchSpy = vi.spyOn(global, "fetch").mockRejectedValue(new Error("offline"));
      const result = await fetchMediaWithCache("https://example.com/bench.gif");
      expect(result).toBeNull();
      fetchSpy.mockRestore();
    });
  });

  describe("responseToObjectUrl", () => {
    it("returns an object URL for a valid response with a non-empty blob", async () => {
      const response = new Response("blob-data", { status: 200 });
      const url = await responseToObjectUrl(response);
      expect(typeof url).toBe("string");
      expect(url!.startsWith("blob:")).toBe(true);
      URL.revokeObjectURL(url!); // cleanup
    });

    it("returns null when response is null", async () => {
      expect(await responseToObjectUrl(null)).toBeNull();
    });

    it("returns null for an empty blob", async () => {
      const response = new Response("", { status: 200 });
      expect(await responseToObjectUrl(response)).toBeNull();
    });
  });
});
