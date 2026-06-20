import { beforeEach, describe, it, expect, vi } from "vitest";
import { useWorkoutStore } from "../useWorkoutStore";
import { db, getPersonalRecords } from "@/db";
import { useAuthStore } from "@/store/useAuthStore";
import { useSocialStore } from "@/store/useSocialStore";
import { useAchievementsStore } from "@/store/useAchievementsStore";
import { useToastStore } from "@/store/useToastStore";
import { pushToCloud } from "@/lib/syncEngine";
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

// Mock DB — Dexie query chain + filter
const mockFilterQuery = {
  toArray: vi.fn().mockResolvedValue([]),
};
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
  },
  getPersonalRecords: vi.fn().mockResolvedValue([]),
}));

// Mock stores
vi.mock("@/store/useAuthStore", () => ({
  useAuthStore: {
    getState: vi.fn(() => ({
      user: { uid: "user_123", displayName: "Test User", photoURL: "http://test.com/photo.jpg" },
    })),
  },
}));

vi.mock("@/store/useSocialStore", () => {
  const publishSessionMock = vi.fn().mockResolvedValue(undefined);
  return {
    useSocialStore: {
      getState: vi.fn(() => ({ publishSession: publishSessionMock })),
    },
  };
});

vi.mock("@/store/useAchievementsStore", () => ({
  useAchievementsStore: {
    getState: vi.fn(() => ({ evaluateAchievements: vi.fn().mockResolvedValue(undefined) })),
  },
}));

vi.mock("@/store/useToastStore", () => ({
  useToastStore: { getState: vi.fn(() => ({ addToast: vi.fn() })) },
}));

vi.mock("@/lib/syncEngine", () => ({ pushToCloud: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/utils/audio", () => ({
  playWorkoutStartSound: vi.fn(),
  playWorkoutStopSound: vi.fn(),
}));

const mockExercises: Exercise[] = [
  {
    id: "1", name: "Bench Press", category: "strength", bodyPart: "chest",
    equipment: "barbell", instructions: "Push", instructionSteps: ["Push"],
    muscleGroup: "chest", secondaryMuscles: ["triceps"], target: "pectorals",
    imageUrl: "bench.jpg", gifUrl: "bench.gif",
  },
  {
    id: "2", name: "Squat", category: "strength", bodyPart: "upper legs",
    equipment: "barbell", instructions: "Squat", instructionSteps: ["Squat"],
    muscleGroup: "quads", secondaryMuscles: ["glutes"], target: "quadriceps",
    imageUrl: "squat.jpg", gifUrl: "squat.gif",
  },
];

describe("useWorkoutStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem("pulse_exercises_cache", JSON.stringify(mockExercises));
    idCounter = 0;
    useWorkoutStore.setState({ activeWorkout: null, restTimerActive: false });
  });

  it("initializes with default state", () => {
    const state = useWorkoutStore.getState();
    expect(state.activeWorkout).toBeNull();
    expect(state.restTimerActive).toBe(false);
  });

  describe("startWorkout", () => {
    it("starts a workout and loads exercises with 3 default sets", async () => {
      const workoutId = await useWorkoutStore.getState().startWorkout(["1", "2"]);
      expect(workoutId).toBe("mock_uid_1");

      const active = useWorkoutStore.getState().activeWorkout;
      expect(active).not.toBeNull();
      expect(active?.exercises).toHaveLength(2);
      expect(active?.exercises[0].exerciseId).toBe("1");
      expect(active?.exercises[0].exerciseName).toBe("Bench Press");
      expect(active?.exercises[0].sets).toHaveLength(3);
      expect(active?.exercises[0].isSupersetWithNext).toBe(false);
    });

    it("handles superset options", async () => {
      await useWorkoutStore.getState().startWorkout([
        { exerciseId: "1", isSupersetWithNext: true },
        "2",
      ]);
      const active = useWorkoutStore.getState().activeWorkout;
      expect(active?.exercises[0].isSupersetWithNext).toBe(true);
      expect(active?.exercises[1].isSupersetWithNext).toBe(false);
    });
  });

  describe("replaceExercise", () => {
    it("replaces the exercise at the given index", async () => {
      await useWorkoutStore.getState().startWorkout(["1", "2"]);
      await useWorkoutStore.getState().replaceExercise(0, "2");
      const active = useWorkoutStore.getState().activeWorkout;
      expect(active?.exercises[0].exerciseId).toBe("2");
      expect(active?.exercises[0].exerciseName).toBe("Squat");
    });
  });

  describe("addSet", () => {
    it("adds a set inheriting values from the last set", async () => {
      await useWorkoutStore.getState().startWorkout(["1"]);
      const state = useWorkoutStore.getState();
      const lastSetId = state.activeWorkout!.exercises[0].sets[2].id;
      useWorkoutStore.getState().updateSet(0, lastSetId, { weight: "90", reps: "8" });
      await useWorkoutStore.getState().addSet(0);

      const active = useWorkoutStore.getState().activeWorkout;
      expect(active?.exercises[0].sets).toHaveLength(4);
      expect(active?.exercises[0].sets[3].weight).toBe("90");
      expect(active?.exercises[0].sets[3].reps).toBe("8");
    });
  });

  describe("removeSet", () => {
    it("removes a set by id", async () => {
      await useWorkoutStore.getState().startWorkout(["1"]);
      const targetId = useWorkoutStore.getState().activeWorkout!.exercises[0].sets[1].id;
      useWorkoutStore.getState().removeSet(0, targetId);
      expect(useWorkoutStore.getState().activeWorkout?.exercises[0].sets).toHaveLength(2);
    });
  });

  describe("toggleSetComplete & rest timer", () => {
    it("toggles completion and activates rest timer when marking complete", async () => {
      await useWorkoutStore.getState().startWorkout(["1"]);
      const setId = useWorkoutStore.getState().activeWorkout!.exercises[0].sets[0].id;

      useWorkoutStore.getState().toggleSetComplete(0, setId);
      expect(useWorkoutStore.getState().activeWorkout!.exercises[0].sets[0].completed).toBe(true);
      expect(useWorkoutStore.getState().restTimerActive).toBe(true);

      useWorkoutStore.getState().dismissRestTimer();
      expect(useWorkoutStore.getState().restTimerActive).toBe(false);
    });
  });

  describe("cancelWorkout", () => {
    it("resets the active workout state", async () => {
      await useWorkoutStore.getState().startWorkout(["1"]);
      useWorkoutStore.getState().cancelWorkout();
      expect(useWorkoutStore.getState().activeWorkout).toBeNull();
      expect(useWorkoutStore.getState().restTimerActive).toBe(false);
    });
  });

  describe("finishWorkout", () => {
    it("returns early when there is no active workout", async () => {
      await useWorkoutStore.getState().finishWorkout();
      expect(db.workoutSessions.add).not.toHaveBeenCalled();
    });

    it("saves only completed sets/exercises to the DB", async () => {
      await useWorkoutStore.getState().startWorkout(["1", "2"]);
      const state = useWorkoutStore.getState();
      const ex1Sets = state.activeWorkout!.exercises[0].sets;

      useWorkoutStore.getState().updateSet(0, ex1Sets[0].id, { weight: "100", reps: "5", rpe: "9" });
      useWorkoutStore.getState().toggleSetComplete(0, ex1Sets[0].id);

      await useWorkoutStore.getState().finishWorkout();

      expect(db.workoutSessions.add).toHaveBeenCalledWith(
        expect.objectContaining({
          completed: true,
          exercises: expect.arrayContaining([
            expect.objectContaining({
              exerciseId: "1",
              exerciseName: "Bench Press",
              sets: [
                expect.objectContaining({ weight: 100, reps: 5, rpe: 9, completed: true }),
              ],
            }),
          ]),
        })
      );
      expect(useWorkoutStore.getState().activeWorkout).toBeNull();
    });

    it("publishes to feed when shareToFeed is true", async () => {
      await useWorkoutStore.getState().startWorkout(["1"]);
      const set = useWorkoutStore.getState().activeWorkout!.exercises[0].sets[0];
      useWorkoutStore.getState().updateSet(0, set.id, { weight: "100", reps: "5" });
      useWorkoutStore.getState().toggleSetComplete(0, set.id);

      await useWorkoutStore.getState().finishWorkout(true);

      expect(useSocialStore.getState().publishSession).toHaveBeenCalledWith(
        "user_123",
        "Test User",
        "http://test.com/photo.jpg",
        expect.objectContaining({ exercisesCount: 1, totalVolume: 500 })
      );
    });
  });
});
