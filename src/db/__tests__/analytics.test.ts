import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { db, type WorkoutSession } from "../schema";
import {
  getWorkoutStreak,
  getTotalStats,
  getPersonalRecords,
  getWeeklyVolume,
  getWeeklyTonnage,
  getMuscleGroupStats,
} from "../analytics";
import type { Exercise } from "@/types/exercise";

function makeSession(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: `session_${Math.random()}`,
    name: "Test Session",
    date: new Date().toISOString(),
    duration: 3600,
    exercises: [
      {
        exerciseId: "ex1",
        exerciseName: "Bench Press",
        sets: [
          { weight: 100, reps: 10, completed: true },
          { weight: 105, reps: 8, completed: true },
        ],
      },
    ],
    completed: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const mockExercises: Exercise[] = [
  {
    id: "ex1",
    name: "Bench Press",
    category: "strength",
    bodyPart: "chest",
    equipment: "barbell",
    instructions: "",
    instructionSteps: [],
    muscleGroup: "Chest",
    secondaryMuscles: [],
    target: "pectorals",
    imageUrl: "",
    gifUrl: "",
  },
];

describe("analytics (using .filter instead of .where for boolean index)", () => {
  beforeEach(async () => {
    await db.workoutSessions.clear();
  });

  describe("getWorkoutStreak", () => {
    it("returns 0 when there are no completed sessions", async () => {
      expect(await getWorkoutStreak()).toBe(0);
    });

    it("returns 1 for a single session today", async () => {
      await db.workoutSessions.add(makeSession({ date: new Date().toISOString() }));
      expect(await getWorkoutStreak()).toBe(1);
    });

    it("does not count incomplete sessions", async () => {
      await db.workoutSessions.add(makeSession({ completed: false }));
      expect(await getWorkoutStreak()).toBe(0);
    });

    it("does not count freeze sessions toward volume stats", async () => {
      await db.workoutSessions.add(makeSession({ isFreeze: true }));
      const stats = await getTotalStats();
      expect(stats.totalWorkouts).toBe(0);
    });
  });

  describe("getTotalStats", () => {
    it("sums volume and duration across completed sessions", async () => {
      await db.workoutSessions.add(makeSession({ duration: 1800 }));
      const stats = await getTotalStats();
      expect(stats.totalWorkouts).toBe(1);
      // volume = (100*10) + (105*8) = 1000 + 840 = 1840
      expect(stats.totalVolume).toBe(1840);
      expect(stats.totalDuration).toBe(1800);
    });
  });

  describe("getPersonalRecords", () => {
    it("extracts the best set per exercise by estimated 1RM", async () => {
      await db.workoutSessions.add(makeSession());
      const prs = await getPersonalRecords();
      expect(prs).toHaveLength(1);
      expect(prs[0].exerciseId).toBe("ex1");
      // 100x10 → e1RM ≈ 133.3, 105x8 → e1RM ≈ 131.7
      // The best set by e1RM is 100x10
      expect(prs[0].max1RM).toBeGreaterThan(0);
      expect(prs[0].weight).toBe(100);
      expect(prs[0].reps).toBe(10);
    });
  });

  describe("getWeeklyVolume / getWeeklyTonnage", () => {
    it("returns an array of weekly buckets", async () => {
      await db.workoutSessions.add(makeSession());
      const vol = await getWeeklyVolume(4);
      expect(vol).toHaveLength(4);
      expect(vol.every((w) => "week" in w && "volume" in w)).toBe(true);

      const tonnage = await getWeeklyTonnage(8);
      expect(tonnage).toHaveLength(8);
    });
  });

  describe("getMuscleGroupStats", () => {
    it("groups volume by muscle group", async () => {
      await db.workoutSessions.add(makeSession());
      const stats = await getMuscleGroupStats(mockExercises);
      expect(stats).toHaveLength(1);
      expect(stats[0].muscle).toBe("Chest");
      expect(stats[0].volume).toBe(1840);
    });

    it("returns empty array when exercises list is empty", async () => {
      await db.workoutSessions.add(makeSession());
      const stats = await getMuscleGroupStats([]);
      expect(stats).toEqual([]);
    });
  });
});
