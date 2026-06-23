import { beforeEach, describe, it, expect, vi } from "vitest";
import { useWorkoutStore } from "../useWorkoutStore";
import { computeRemainingSeconds } from "@/components/workout/RestTimer";
import type { Exercise } from "@/types/exercise";

// localStorage shim
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

// Mock UID
let idCounter = 0;
vi.mock("@/utils/id", () => ({ uid: vi.fn(() => `mock_uid_${++idCounter}`) }));

const mockExercises: Exercise[] = [
  {
    id: "1", name: "Bench Press", category: "strength", bodyPart: "chest",
    equipment: "barbell", instructions: "Push", instructionSteps: ["Push"],
    muscleGroup: "chest", secondaryMuscles: ["triceps"], target: "pectorals",
    imageUrl: "bench.jpg", gifUrl: "bench.gif",
  },
];

// Mock DB — includes exercises_v2.get for buildExerciseItem
const mockFilterQuery = { toArray: vi.fn().mockResolvedValue([]) };
vi.mock("@/db", () => ({
  db: {
    workoutSessions: {
      add: vi.fn().mockResolvedValue("mock_session_id"),
      orderBy: vi.fn(() => ({
        reverse: vi.fn().mockReturnThis(),
        filter: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([]),
      })),
      where: vi.fn(() => ({
        equals: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([]),
      })),
      filter: vi.fn(() => mockFilterQuery),
    },
    exercises_v2: {
      get: vi.fn((id: string) =>
        mockExercises.find((e) => String(e.id) === String(id)) ?? undefined
      ),
    },
  },
  getPersonalRecords: vi.fn().mockResolvedValue([]),
}));

// Mock stores — toggleSetComplete now calls useSettingsStore.getState()
// and useGeneratorStore.getState() to compute the rest duration.
vi.mock("@/store/useSettingsStore", () => ({
  useSettingsStore: {
    getState: vi.fn(() => ({ restDuration: 90 })),
  },
}));
vi.mock("@/store/useGeneratorStore", () => ({
  useGeneratorStore: {
    getState: vi.fn(() => ({ goal: "Hypertrophy" })),
  },
}));
vi.mock("@/store/useAuthStore", () => ({
  useAuthStore: { getState: vi.fn(() => ({ user: { uid: "u1", displayName: "T", photoURL: "" } })) },
}));
vi.mock("@/store/useSocialStore", () => ({
  useSocialStore: { getState: vi.fn(() => ({ publishSession: vi.fn().mockResolvedValue(undefined) })) },
}));
vi.mock("@/store/useAchievementsStore", () => ({
  useAchievementsStore: { getState: vi.fn(() => ({ evaluateAchievements: vi.fn().mockResolvedValue(undefined) })) },
}));
vi.mock("@/store/useToastStore", () => ({
  useToastStore: { getState: vi.fn(() => ({ addToast: vi.fn() })) },
}));
vi.mock("@/lib/syncEngine", () => ({ pushToCloud: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/utils/audio", () => ({
  playWorkoutStartSound: vi.fn(),
  playWorkoutStopSound: vi.fn(),
  playTimerCompleteSound: vi.fn(),
}));
vi.mock("@/services/voiceCoach", () => ({
  voiceCoach: { speak: vi.fn(), setEnabled: vi.fn() },
}));

// ── Pure function tests: computeRemainingSeconds ──
describe("computeRemainingSeconds (timestamp-based countdown)", () => {
  it("returns 0 when endTs is undefined", () => {
    expect(computeRemainingSeconds(undefined)).toBe(0);
  });

  it("returns the correct remaining seconds when endTs is in the future", () => {
    const now = 1000000;
    const endTs = now + 90_000; // 90s in the future
    expect(computeRemainingSeconds(endTs, now)).toBe(90);
  });

  it("returns 0 when endTs is in the past", () => {
    const now = 1000000;
    const endTs = now - 5000; // 5s ago
    expect(computeRemainingSeconds(endTs, now)).toBe(0);
  });

  it("returns 0 exactly at endTs", () => {
    const now = 1000000;
    expect(computeRemainingSeconds(now, now)).toBe(0);
  });

  it("rounds up partial seconds (ceil)", () => {
    const now = 1000000;
    const endTs = now + 90_500; // 90.5s
    expect(computeRemainingSeconds(endTs, now)).toBe(91); // ceil(90.5) = 91
  });

  it("returns 1 when 0.1s remains (rounds up to 1)", () => {
    const now = 1000000;
    const endTs = now + 100; // 0.1s
    expect(computeRemainingSeconds(endTs, now)).toBe(1);
  });
});

// ── Store action tests: timestamp-based rest timer ──
describe("useWorkoutStore — timestamp-based rest timer (A2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    idCounter = 0;
    useWorkoutStore.setState({
      activeWorkout: null,
      isWorkoutActive: false,
      restTimerActive: false,
      restTimerExerciseRole: undefined,
      restTimerLastRPE: undefined,
      restTimerEndTs: undefined,
      restTimerTotalDuration: undefined,
    });
  });

  describe("dismissRestTimer", () => {
    it("clears all rest timer fields including the timestamp", () => {
      useWorkoutStore.setState({
        restTimerActive: true,
        restTimerExerciseRole: "compound",
        restTimerLastRPE: 9,
        restTimerEndTs: Date.now() + 60000,
        restTimerTotalDuration: 120,
      });

      useWorkoutStore.getState().dismissRestTimer();

      const state = useWorkoutStore.getState();
      expect(state.restTimerActive).toBe(false);
      expect(state.restTimerExerciseRole).toBeUndefined();
      expect(state.restTimerLastRPE).toBeUndefined();
      expect(state.restTimerEndTs).toBeUndefined();
      expect(state.restTimerTotalDuration).toBeUndefined();
    });
  });

  describe("adjustRestTimer (preset buttons)", () => {
    it("shifts restTimerEndTs forward by +delta seconds", () => {
      const baseEnd = Date.now() + 60000;
      useWorkoutStore.setState({
        restTimerActive: true,
        restTimerEndTs: baseEnd,
        restTimerTotalDuration: 90,
      });

      useWorkoutStore.getState().adjustRestTimer(15);

      const state = useWorkoutStore.getState();
      expect(state.restTimerEndTs).toBe(baseEnd + 15 * 1000);
      expect(state.restTimerTotalDuration).toBe(105);
    });

    it("shifts restTimerEndTs backward by -delta seconds", () => {
      const baseEnd = Date.now() + 60000;
      useWorkoutStore.setState({
        restTimerActive: true,
        restTimerEndTs: baseEnd,
        restTimerTotalDuration: 90,
      });

      useWorkoutStore.getState().adjustRestTimer(-15);

      const state = useWorkoutStore.getState();
      expect(state.restTimerEndTs).toBe(baseEnd - 15 * 1000);
      expect(state.restTimerTotalDuration).toBe(75);
    });

    it("is a no-op when no rest timer is active (restTimerEndTs undefined)", () => {
      useWorkoutStore.getState().adjustRestTimer(30);
      expect(useWorkoutStore.getState().restTimerEndTs).toBeUndefined();
      expect(useWorkoutStore.getState().restTimerTotalDuration).toBeUndefined();
    });

    it("does not let totalDuration drop below 15s (minimum floor)", () => {
      const baseEnd = Date.now() + 10000;
      useWorkoutStore.setState({
        restTimerActive: true,
        restTimerEndTs: baseEnd,
        restTimerTotalDuration: 20,
      });

      useWorkoutStore.getState().adjustRestTimer(-30);

      const state = useWorkoutStore.getState();
      expect(state.restTimerEndTs).toBe(baseEnd - 30 * 1000);
      expect(state.restTimerTotalDuration).toBe(15); // clamped
    });

    it("supports +60s preset (the largest preset)", () => {
      const baseEnd = Date.now() + 30000;
      useWorkoutStore.setState({
        restTimerActive: true,
        restTimerEndTs: baseEnd,
        restTimerTotalDuration: 120,
      });

      useWorkoutStore.getState().adjustRestTimer(60);

      const state = useWorkoutStore.getState();
      expect(state.restTimerEndTs).toBe(baseEnd + 60 * 1000);
      expect(state.restTimerTotalDuration).toBe(180);
    });
  });

  describe("toggleSetComplete — sets restTimerEndTs on activation", () => {
    it("sets restTimerEndTs and restTimerTotalDuration when a set is completed", async () => {
      await useWorkoutStore.getState().startWorkout(["1"]);
      const active = useWorkoutStore.getState().activeWorkout!;
      const setId = active.exercises[0].sets[0].id;

      const beforeNow = Date.now();
      useWorkoutStore.getState().toggleSetComplete(0, setId);
      const afterNow = Date.now();

      const state = useWorkoutStore.getState();
      expect(state.restTimerActive).toBe(true);
      expect(state.restTimerEndTs).toBeDefined();
      expect(state.restTimerTotalDuration).toBeDefined();
      expect(state.restTimerTotalDuration!).toBeGreaterThan(0);

      // restTimerEndTs ≈ now + totalDuration seconds.
      const expectedMin = beforeNow + state.restTimerTotalDuration! * 1000;
      const expectedMax = afterNow + state.restTimerTotalDuration! * 1000;
      expect(state.restTimerEndTs!).toBeGreaterThanOrEqual(expectedMin);
      expect(state.restTimerEndTs!).toBeLessThanOrEqual(expectedMax);
    });

    it("does not overwrite restTimerEndTs when un-completing a set", async () => {
      await useWorkoutStore.getState().startWorkout(["1"]);
      const active = useWorkoutStore.getState().activeWorkout!;
      const setId = active.exercises[0].sets[0].id;

      useWorkoutStore.getState().toggleSetComplete(0, setId);
      const firstEndTs = useWorkoutStore.getState().restTimerEndTs;
      expect(firstEndTs).toBeDefined();

      // Un-complete → should preserve the existing restTimerEndTs.
      useWorkoutStore.getState().toggleSetComplete(0, setId);
      expect(useWorkoutStore.getState().restTimerEndTs).toBe(firstEndTs);
    });
  });

  describe("startWorkout / cancelWorkout — clears rest timer", () => {
    it("startWorkout resets restTimerEndTs", async () => {
      useWorkoutStore.setState({
        restTimerActive: true,
        restTimerEndTs: Date.now() + 60000,
        restTimerTotalDuration: 90,
      });

      await useWorkoutStore.getState().startWorkout(["1"]);

      const state = useWorkoutStore.getState();
      expect(state.restTimerActive).toBe(false);
      expect(state.restTimerEndTs).toBeUndefined();
      expect(state.restTimerTotalDuration).toBeUndefined();
    });

    it("cancelWorkout resets restTimerEndTs", async () => {
      await useWorkoutStore.getState().startWorkout(["1"]);
      const active = useWorkoutStore.getState().activeWorkout!;
      const setId = active.exercises[0].sets[0].id;
      useWorkoutStore.getState().toggleSetComplete(0, setId);
      expect(useWorkoutStore.getState().restTimerEndTs).toBeDefined();

      useWorkoutStore.getState().cancelWorkout();

      const state = useWorkoutStore.getState();
      expect(state.restTimerActive).toBe(false);
      expect(state.restTimerEndTs).toBeUndefined();
      expect(state.restTimerTotalDuration).toBeUndefined();
    });
  });

  describe("timestamp-based resume (simulating reload)", () => {
    it("computeRemainingSeconds returns correct value for a persisted endTs", () => {
      // Simulate: timer started 30s ago with 90s total → 60s remaining.
      const startedAt = Date.now() - 30_000;
      const totalDuration = 90;
      const endTs = startedAt + totalDuration * 1000;
      const remaining = computeRemainingSeconds(endTs);
      // Should be ~60s (allow ±2s for test execution time).
      expect(remaining).toBeGreaterThan(55);
      expect(remaining).toBeLessThanOrEqual(60);
    });

    it("computeRemainingSeconds returns 0 when the rest period ended while away", () => {
      // Simulate: timer started 120s ago with 90s total → already expired.
      const startedAt = Date.now() - 120_000;
      const totalDuration = 90;
      const endTs = startedAt + totalDuration * 1000;
      const remaining = computeRemainingSeconds(endTs);
      expect(remaining).toBe(0);
    });
  });
});
