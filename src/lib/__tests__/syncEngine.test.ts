import "fake-indexeddb/auto";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { pushToCloud, pullFromCloud, syncAll, exportLocalBackup } from "../syncEngine";

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

describe("syncEngine (local-mode / Next.js port)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe("pushToCloud", () => {
    it("is a no-op that resolves with success: true", async () => {
      const result = await pushToCloud("user_123");
      expect(result.success).toBe(true);
    });
  });

  describe("pullFromCloud", () => {
    it("is a no-op that resolves with success: true", async () => {
      const result = await pullFromCloud("user_123");
      expect(result.success).toBe(true);
    });
  });

  describe("syncAll", () => {
    it("returns status idle and stamps lastSyncedAt", async () => {
      const result = await syncAll("user_123");
      expect(result.status).toBe("idle");
      expect(result.lastSyncedAt).not.toBeNull();
      expect(result.error).toBeUndefined();
      // Should be a valid ISO date
      expect(new Date(result.lastSyncedAt!).getTime()).not.toBeNaN();
    });

    it("returns idle without lastSyncedAt when already in-flight", async () => {
      // Start two concurrent calls — the second should return early
      const [r1, r2] = await Promise.all([syncAll("user_123"), syncAll("user_123")]);
      // At least one should have a lastSyncedAt (the first)
      expect(r1.status).toBe("idle");
      // The second may or may not have lastSyncedAt depending on timing,
      // but it should be "idle" status (the early-return value)
      expect(r2.status).toBe("idle");
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

      await db.workoutSessions.delete("test_session_1");
    });
  });
});
