import "fake-indexeddb/auto";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { pushToCloud, pullFromCloud, syncAll, exportLocalBackup } from "../syncEngine";
import { useSyncStore } from "@/store/useSyncStore";
import { useToastStore } from "@/store/useToastStore";

// localStorage shim for node environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] || null,
    setItem: (k: string, v: string) => { store[k] = String(v); },
    clear: () => { store = {}; },
    removeItem: (k: string) => { delete store[k]; },
  };
})();
Object.defineProperty(global, "localStorage", { value: localStorageMock, writable: true });

// Mock toast store
vi.mock("@/store/useToastStore", () => ({
  useToastStore: {
    getState: () => ({ addToast: vi.fn() }),
  },
}));

describe("syncEngine (local-mode / Next.js port)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSyncStore.setState({ status: "idle", lastSyncedAt: null });
    localStorage.clear();
  });

  describe("pushToCloud", () => {
    it("is a no-op that resolves without throwing", async () => {
      await expect(pushToCloud("user_123")).resolves.toBeUndefined();
    });
  });

  describe("pullFromCloud", () => {
    it("is a no-op that resolves without throwing", async () => {
      await expect(pullFromCloud("user_123")).resolves.toBeUndefined();
    });
  });

  describe("syncAll", () => {
    it("sets status to idle and stamps lastSyncedAt in store state", async () => {
      await syncAll("user_123");
      const s = useSyncStore.getState();
      expect(s.status).toBe("idle");
      expect(s.lastSyncedAt).not.toBeNull();
      // Should be a valid ISO date
      expect(new Date(s.lastSyncedAt!).getTime()).not.toBeNaN();
    });
  });

  describe("exportLocalBackup", () => {
    it("returns a JSON-serializable object with all local collections", async () => {
      const backup = await exportLocalBackup();
      expect(backup).toHaveProperty("exportedAt");
      expect(backup).toHaveProperty("version", 1);
      expect(Array.isArray(backup.workoutSessions)).toBe(true);
      expect(Array.isArray(backup.bodyMeasurements)).toBe(true);
      expect(Array.isArray(backup.routines)).toBe(true);
      expect(Array.isArray(backup.foodEntries)).toBe(true);
      expect(Array.isArray(backup.nutritionGoals)).toBe(true);
      expect(Array.isArray(backup.unlockedAchievements)).toBe(true);
      // exportedAt should be a valid ISO date
      expect(new Date(backup.exportedAt).getTime()).not.toBeNaN();
    });

    it("includes workout sessions that were added to the local DB", async () => {
      const { db } = await import("@/db");
      await db.workoutSessions.add({
        id: "test_session_1",
        name: "Test Workout",
        date: new Date().toISOString(),
        duration: 1800,
        exercises: [],
        completed: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const backup = await exportLocalBackup();
      expect(backup.workoutSessions.some((s) => s.id === "test_session_1")).toBe(true);

      // Cleanup
      await db.workoutSessions.delete("test_session_1");
    });
  });
});
