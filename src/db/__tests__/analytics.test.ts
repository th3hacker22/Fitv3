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

// ── Set-type aware analytics (A1: 11 set types) ──────────────────────────────
// These tests verify that volume and PR calculations respect the
// countsInVolume / countsForPR flags from src/config/setTypes.ts.
// Warmup, negative → excluded from volume.
// Warmup, drop_set, failure, negative, partial, back_off, myo_reps → excluded from PR.
describe("analytics — set-type aware volume & PR (A1)", () => {
  beforeEach(async () => {
    await db.workoutSessions.clear();
  });

  describe("getTotalStats — countsInVolume filtering", () => {
    it("excludes warmup sets from total volume", async () => {
      // 2 warmup sets @ 60kg×5 + 80kg×3 = 300 + 240 = 540 (should NOT count)
      // 1 working set @ 100kg×10 = 1000 (should count)
      await db.workoutSessions.add(
        makeSession({
          exercises: [
            {
              exerciseId: "ex1",
              exerciseName: "Bench Press",
              sets: [
                { weight: 60, reps: 5, completed: true, setType: "warmup" },
                { weight: 80, reps: 3, completed: true, setType: "warmup" },
                { weight: 100, reps: 10, completed: true, setType: "normal" },
              ],
            },
          ],
        })
      );
      const stats = await getTotalStats();
      expect(stats.totalVolume).toBe(1000); // only the working set
    });

    it("excludes negative sets from total volume (eccentric-only)", async () => {
      // negative @ 120kg×3 = 360 (should NOT count)
      // normal @ 100kg×10 = 1000 (should count)
      await db.workoutSessions.add(
        makeSession({
          exercises: [
            {
              exerciseId: "ex1",
              exerciseName: "Bench Press",
              sets: [
                { weight: 120, reps: 3, completed: true, setType: "negative" },
                { weight: 100, reps: 10, completed: true, setType: "normal" },
              ],
            },
          ],
        })
      );
      const stats = await getTotalStats();
      expect(stats.totalVolume).toBe(1000);
    });

    it("counts drop_set, failure, myo_reps, partial, top_set, back_off, right, left in volume", async () => {
      await db.workoutSessions.add(
        makeSession({
          exercises: [
            {
              exerciseId: "ex1",
              exerciseName: "Bench Press",
              sets: [
                { weight: 80, reps: 12, completed: true, setType: "drop_set" }, // 960
                { weight: 90, reps: 5, completed: true, setType: "failure" }, // 450
                { weight: 70, reps: 15, completed: true, setType: "myo_reps" }, // 1050
                { weight: 110, reps: 4, completed: true, setType: "partial" }, // 440
                { weight: 100, reps: 5, completed: true, setType: "top_set" }, // 500
                { weight: 85, reps: 8, completed: true, setType: "back_off" }, // 680
                { weight: 50, reps: 10, completed: true, setType: "right" }, // 500
                { weight: 50, reps: 10, completed: true, setType: "left" }, // 500
              ],
            },
          ],
        })
      );
      const stats = await getTotalStats();
      expect(stats.totalVolume).toBe(960 + 450 + 1050 + 440 + 500 + 680 + 500 + 500);
    });

    it("treats sets without setType as 'normal' (backward compatible)", async () => {
      // Old sessions without setType field should count fully.
      await db.workoutSessions.add(
        makeSession({
          exercises: [
            {
              exerciseId: "ex1",
              exerciseName: "Bench Press",
              sets: [
                { weight: 100, reps: 10, completed: true }, // no setType
                { weight: 105, reps: 8, completed: true }, // no setType
              ],
            },
          ],
        })
      );
      const stats = await getTotalStats();
      expect(stats.totalVolume).toBe(1000 + 840);
    });
  });

  describe("getPersonalRecords — countsForPR filtering", () => {
    it("excludes warmup sets from PR detection even if they have the highest e1RM", async () => {
      // Warmup @ 60kg×5 → e1RM ≈ 70 (would be "best" if not excluded)
      // Working @ 100kg×10 → e1RM ≈ 133 (the true PR)
      await db.workoutSessions.add(
        makeSession({
          exercises: [
            {
              exerciseId: "ex1",
              exerciseName: "Bench Press",
              sets: [
                { weight: 60, reps: 5, completed: true, setType: "warmup" },
                { weight: 100, reps: 10, completed: true, setType: "normal" },
              ],
            },
          ],
        })
      );
      const prs = await getPersonalRecords();
      expect(prs).toHaveLength(1);
      expect(prs[0].weight).toBe(100); // the working set, not the warmup
      expect(prs[0].reps).toBe(10);
    });

    it("excludes drop_set, failure, negative, partial, back_off, myo_reps from PR", async () => {
      // All non-PR-eligible types have higher weight but should NOT be the PR.
      // Only the single 'normal' set should be considered for PR.
      await db.workoutSessions.add(
        makeSession({
          exercises: [
            {
              exerciseId: "ex1",
              exerciseName: "Bench Press",
              sets: [
                { weight: 120, reps: 6, completed: true, setType: "drop_set" }, // higher e1RM, excluded
                { weight: 130, reps: 4, completed: true, setType: "failure" }, // higher e1RM, excluded
                { weight: 140, reps: 3, completed: true, setType: "negative" }, // higher e1RM, excluded
                { weight: 110, reps: 5, completed: true, setType: "partial" }, // higher e1RM, excluded
                { weight: 115, reps: 8, completed: true, setType: "back_off" }, // higher e1RM, excluded
                { weight: 125, reps: 10, completed: true, setType: "myo_reps" }, // higher e1RM, excluded
                { weight: 100, reps: 10, completed: true, setType: "normal" }, // the PR
              ],
            },
          ],
        })
      );
      const prs = await getPersonalRecords();
      expect(prs).toHaveLength(1);
      expect(prs[0].weight).toBe(100);
      expect(prs[0].reps).toBe(10);
    });

    it("includes top_set, right, left in PR detection (PR-eligible types)", async () => {
      await db.workoutSessions.add(
        makeSession({
          exercises: [
            {
              exerciseId: "ex1",
              exerciseName: "Bench Press",
              sets: [
                { weight: 90, reps: 5, completed: true, setType: "top_set" }, // e1RM ≈ 105
                { weight: 100, reps: 10, completed: true, setType: "normal" }, // e1RM ≈ 133
                { weight: 80, reps: 8, completed: true, setType: "right" }, // e1RM ≈ 96
                { weight: 80, reps: 8, completed: true, setType: "left" }, // e1RM ≈ 96
              ],
            },
          ],
        })
      );
      const prs = await getPersonalRecords();
      expect(prs).toHaveLength(1);
      // The normal set @ 100×10 has the highest e1RM among PR-eligible sets.
      expect(prs[0].weight).toBe(100);
      expect(prs[0].reps).toBe(10);
    });

    it("returns no PR when all sets are non-PR-eligible (warmup only)", async () => {
      await db.workoutSessions.add(
        makeSession({
          exercises: [
            {
              exerciseId: "ex1",
              exerciseName: "Bench Press",
              sets: [
                { weight: 60, reps: 5, completed: true, setType: "warmup" },
                { weight: 80, reps: 3, completed: true, setType: "warmup" },
              ],
            },
          ],
        })
      );
      const prs = await getPersonalRecords();
      expect(prs).toHaveLength(0);
    });

    it("old sessions without setType are treated as normal (PR-eligible)", async () => {
      await db.workoutSessions.add(
        makeSession({
          exercises: [
            {
              exerciseId: "ex1",
              exerciseName: "Bench Press",
              sets: [
                { weight: 100, reps: 10, completed: true }, // no setType
              ],
            },
          ],
        })
      );
      const prs = await getPersonalRecords();
      expect(prs).toHaveLength(1);
      expect(prs[0].weight).toBe(100);
    });
  });

  describe("getWeeklyVolume — countsInVolume filtering", () => {
    it("excludes warmup volume from weekly buckets", async () => {
      await db.workoutSessions.add(
        makeSession({
          exercises: [
            {
              exerciseId: "ex1",
              exerciseName: "Bench Press",
              sets: [
                { weight: 40, reps: 10, completed: true, setType: "warmup" }, // 400, excluded
                { weight: 100, reps: 10, completed: true, setType: "normal" }, // 1000, included
              ],
            },
          ],
        })
      );
      const vol = await getWeeklyVolume(1);
      expect(vol).toHaveLength(1);
      expect(vol[0].volume).toBe(1000);
    });
  });

  describe("getMuscleGroupStats — countsInVolume filtering", () => {
    it("excludes warmup and negative from muscle group volume", async () => {
      await db.workoutSessions.add(
        makeSession({
          exercises: [
            {
              exerciseId: "ex1",
              exerciseName: "Bench Press",
              sets: [
                { weight: 40, reps: 10, completed: true, setType: "warmup" }, // excluded
                { weight: 120, reps: 3, completed: true, setType: "negative" }, // excluded
                { weight: 100, reps: 10, completed: true, setType: "normal" }, // 1000, included
              ],
            },
          ],
        })
      );
      const stats = await getMuscleGroupStats(mockExercises);
      expect(stats).toHaveLength(1);
      expect(stats[0].muscle).toBe("Chest");
      expect(stats[0].volume).toBe(1000);
    });
  });
});

// ── Monthly calendar analytics (B2) ────────────────────────────────────────
import {
  getSessionsByMonth,
  getMonthActivitySummary,
} from "../analytics";

describe("getSessionsByMonth + getMonthActivitySummary (B2 calendar)", () => {
  beforeEach(async () => {
    await db.workoutSessions.clear();
  });

  describe("getSessionsByMonth", () => {
    it("returns only sessions within the specified month", async () => {
      await db.workoutSessions.add(
        makeSession({ date: "2026-01-15T10:00:00.000Z", id: "jan15" })
      );
      await db.workoutSessions.add(
        makeSession({ date: "2026-01-31T23:59:00.000Z", id: "jan31" })
      );
      await db.workoutSessions.add(
        makeSession({ date: "2026-02-01T00:01:00.000Z", id: "feb01" })
      );
      await db.workoutSessions.add(
        makeSession({ date: "2025-12-31T23:59:00.000Z", id: "dec31" })
      );

      const janSessions = await getSessionsByMonth(2026, 0); // Jan 2026
      const ids = janSessions.map((s) => s.id).sort();
      expect(ids).toEqual(["jan15", "jan31"]);
    });

    it("returns empty array when no sessions exist for the month", async () => {
      await db.workoutSessions.add(makeSession({ date: "2026-01-15T10:00:00.000Z" }));
      const febSessions = await getSessionsByMonth(2026, 1);
      expect(febSessions).toEqual([]);
    });

    it("excludes incomplete (not completed) sessions", async () => {
      await db.workoutSessions.add(
        makeSession({ date: "2026-01-15T10:00:00.000Z", completed: false, id: "incomplete" })
      );
      await db.workoutSessions.add(
        makeSession({ date: "2026-01-20T10:00:00.000Z", id: "complete" })
      );

      const sessions = await getSessionsByMonth(2026, 0);
      expect(sessions.map((s) => s.id)).toEqual(["complete"]);
    });

    it("handles month boundaries correctly (year rollover)", async () => {
      await db.workoutSessions.add(
        makeSession({ date: "2026-12-31T12:00:00.000Z", id: "dec31" })
      );
      await db.workoutSessions.add(
        makeSession({ date: "2027-01-01T00:00:00.000Z", id: "jan01" })
      );

      const decSessions = await getSessionsByMonth(2026, 11);
      const janSessions = await getSessionsByMonth(2027, 0);
      expect(decSessions.map((s) => s.id)).toEqual(["dec31"]);
      expect(janSessions.map((s) => s.id)).toEqual(["jan01"]);
    });

    it("uses preloadedSessions when provided (skips Dexie)", async () => {
      const preloaded: WorkoutSession[] = [
        makeSession({ date: "2026-01-15T10:00:00.000Z", id: "preloaded-jan" }),
      ];
      const sessions = await getSessionsByMonth(2026, 0, preloaded);
      expect(sessions.map((s) => s.id)).toEqual(["preloaded-jan"]);
    });
  });

  describe("getMonthActivitySummary", () => {
    it("returns a map keyed by local YYYY-MM-DD date", async () => {
      await db.workoutSessions.add(
        makeSession({ date: "2026-01-15T10:00:00.000Z", id: "s1" })
      );

      const summary = await getMonthActivitySummary(2026, 0);
      expect(summary.size).toBe(1);
      // The date key depends on the local timezone, so just check the format.
      const key = Array.from(summary.keys())[0];
      expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("aggregates multiple sessions on the same day into one entry", async () => {
      // Two sessions on the same day → one summary entry with sessionCount=2.
      await db.workoutSessions.add(
        makeSession({
          date: "2026-01-15T08:00:00.000Z",
          id: "s1",
          exercises: [
            {
              exerciseId: "ex1",
              exerciseName: "Bench Press",
              sets: [{ weight: 100, reps: 10, completed: true }],
            },
          ],
        })
      );
      await db.workoutSessions.add(
        makeSession({
          date: "2026-01-15T18:00:00.000Z",
          id: "s2",
          exercises: [
            {
              exerciseId: "ex2",
              exerciseName: "Squat",
              sets: [{ weight: 120, reps: 5, completed: true }],
            },
          ],
        })
      );

      const summary = await getMonthActivitySummary(2026, 0);
      expect(summary.size).toBe(1);
      const entry = Array.from(summary.values())[0];
      expect(entry.sessionCount).toBe(2);
      // volume = (100*10) + (120*5) = 1000 + 600 = 1600
      expect(entry.volume).toBe(1600);
      expect(entry.exerciseCount).toBe(2);
    });

    it("excludes freeze sessions from the summary", async () => {
      await db.workoutSessions.add(
        makeSession({ date: "2026-01-15T10:00:00.000Z", id: "real", isFreeze: false })
      );
      await db.workoutSessions.add(
        makeSession({ date: "2026-01-15T12:00:00.000Z", id: "freeze", isFreeze: true })
      );

      const summary = await getMonthActivitySummary(2026, 0);
      expect(summary.size).toBe(1);
      const entry = Array.from(summary.values())[0];
      expect(entry.sessionCount).toBe(1); // only the non-freeze session
    });

    it("respects countsInVolume for set types (warmup excluded)", async () => {
      await db.workoutSessions.add(
        makeSession({
          date: "2026-01-15T10:00:00.000Z",
          id: "s1",
          exercises: [
            {
              exerciseId: "ex1",
              exerciseName: "Bench Press",
              sets: [
                { weight: 60, reps: 5, completed: true, setType: "warmup" }, // excluded
                { weight: 100, reps: 10, completed: true, setType: "normal" }, // 1000
              ],
            },
          ],
        })
      );

      const summary = await getMonthActivitySummary(2026, 0);
      const entry = Array.from(summary.values())[0];
      expect(entry.volume).toBe(1000); // only the working set
    });

    it("returns an empty map when the month has no sessions", async () => {
      const summary = await getMonthActivitySummary(2026, 5);
      expect(summary.size).toBe(0);
    });

    it("marks isActive=true for days with sessions", async () => {
      await db.workoutSessions.add(
        makeSession({ date: "2026-01-15T10:00:00.000Z", id: "s1" })
      );

      const summary = await getMonthActivitySummary(2026, 0);
      const entry = Array.from(summary.values())[0];
      expect(entry.isActive).toBe(true);
    });

    it("counts only exercises with at least one completed set", async () => {
      await db.workoutSessions.add(
        makeSession({
          date: "2026-01-15T10:00:00.000Z",
          id: "s1",
          exercises: [
            {
              exerciseId: "ex1",
              exerciseName: "Bench Press",
              sets: [{ weight: 100, reps: 10, completed: true }],
            },
            {
              exerciseId: "ex2",
              exerciseName: "Squat",
              sets: [{ weight: 120, reps: 5, completed: false }], // not completed
            },
          ],
        })
      );

      const summary = await getMonthActivitySummary(2026, 0);
      const entry = Array.from(summary.values())[0];
      expect(entry.exerciseCount).toBe(1); // only Bench Press counted
    });
  });
});
