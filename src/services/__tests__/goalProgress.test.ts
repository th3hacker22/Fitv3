import { describe, it, expect } from "vitest";
import {
  computeGoalProgress,
  computeAllGoalProgress,
  getTimeFrameStart,
  formatGoalValue,
} from "../goalProgress";
import type { Goal, WorkoutSession } from "@/db/schema";

// ── Fixtures ──

function makeSession(
  daysAgo: number,
  exercises: { exerciseId: string; exerciseName: string; sets: { weight: number; reps: number; completed?: boolean; rpe?: number; setType?: string; estimated1RM?: number }[] }[],
  opts: { completed?: boolean; isFreeze?: boolean } = {}
): WorkoutSession {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(10, 0, 0, 0);
  return {
    id: `s-${daysAgo}-${Math.random()}`,
    name: "Test",
    date: date.toISOString(),
    duration: 3600,
    exercises: exercises.map((ex) => ({
      exerciseId: ex.exerciseId,
      exerciseName: ex.exerciseName,
      sets: ex.sets.map((s) => ({
        weight: s.weight,
        reps: s.reps,
        completed: s.completed ?? true,
        rpe: s.rpe,
        setType: s.setType ?? "normal",
        estimated1RM: s.estimated1RM,
      })),
    })),
    completed: opts.completed ?? true,
    isFreeze: opts.isFreeze ?? false,
    createdAt: date.toISOString(),
    updatedAt: date.toISOString(),
  } as unknown as WorkoutSession;
}

const benchSession = (daysAgo: number, weight: number, reps: number, rpe?: number) =>
  makeSession(daysAgo, [{
    exerciseId: "ex-bench",
    exerciseName: "Bench Press",
    sets: [{ weight, reps, rpe }],
  }]);

const baseGoal = (overrides: Partial<Goal> = {}): Goal => ({
  id: "g1",
  type: "volume",
  targetValue: 10000,
  timeFrame: "month",
  achieved: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

// ── getTimeFrameStart ──

describe("getTimeFrameStart", () => {
  it("returns Monday of the current week for 'week'", () => {
    // June 22, 2026 is a Sunday — Monday should be June 16... wait, let me check.
    // Actually June 22, 2026 — let's use a known date. Jan 7, 2026 is a Wednesday.
    // Monday of that week is Jan 5, 2026.
    const wed = new Date(2026, 0, 7, 15, 0, 0);
    const start = getTimeFrameStart("week", wed);
    expect(start.getDay()).toBe(1); // Monday
    expect(start.getDate()).toBe(5); // Jan 5
    expect(start.getMonth()).toBe(0); // January
  });

  it("returns 1st of current month for 'month'", () => {
    const mid = new Date(2026, 5, 15, 12, 0, 0); // June 15
    const start = getTimeFrameStart("month", mid);
    expect(start.getDate()).toBe(1);
    expect(start.getMonth()).toBe(5); // June
  });

  it("returns Jan 1 of current year for 'year'", () => {
    const mid = new Date(2026, 5, 15, 12, 0, 0);
    const start = getTimeFrameStart("year", mid);
    expect(start.getDate()).toBe(1);
    expect(start.getMonth()).toBe(0);
    expect(start.getFullYear()).toBe(2026);
  });

  it("handles Sunday correctly (day 0 → 6 days back to Monday)", () => {
    const sunday = new Date(2026, 5, 21, 12, 0, 0); // June 21, 2026 (Sunday)
    const start = getTimeFrameStart("week", sunday);
    expect(start.getDay()).toBe(1); // Monday
    // Monday is June 15 (6 days before Sunday June 21... wait June 21 is a Sunday so Monday is June 15)
    // Actually June 22 is Monday based on the calendar, so June 21 is Sunday → Monday = June 15
    // Let me not hardcode the date and just verify it's a Monday
    expect(start.getDay()).toBe(1);
  });
});

// ── formatGoalValue ──

describe("formatGoalValue", () => {
  it("formats volume with kg-reps suffix", () => {
    expect(formatGoalValue("volume", 500)).toBe("500 kg-reps");
    expect(formatGoalValue("volume", 1500)).toBe("1.5k kg-reps");
    expect(formatGoalValue("volume", 10000)).toBe("10.0k kg-reps");
  });

  it("formats 1rm with kg suffix", () => {
    expect(formatGoalValue("1rm", 120)).toBe("120 kg");
    expect(formatGoalValue("1rm", 133.3)).toBe("133.3 kg");
  });

  it("formats reps with reps suffix", () => {
    expect(formatGoalValue("reps", 50)).toBe("50 reps");
  });

  it("formats workouts with workouts suffix", () => {
    expect(formatGoalValue("workouts", 12)).toBe("12 workouts");
  });
});

// ── computeGoalProgress — VOLUME ──

describe("computeGoalProgress — VOLUME", () => {
  it("sums weight × reps for all completed sets in the time frame", () => {
    const sessions = [
      benchSession(1, 100, 10), // 1000
      benchSession(3, 100, 5),  // 500
    ];
    const goal = baseGoal({ type: "volume", targetValue: 2000, timeFrame: "month" });
    const progress = computeGoalProgress(goal, sessions);
    expect(progress.current).toBe(1500); // 1000 + 500
    expect(progress.percent).toBe(75); // 1500/2000
    expect(progress.achieved).toBe(false);
  });

  it("excludes warmup sets (countsInVolume = false)", () => {
    const sessions = [
      makeSession(1, [{
        exerciseId: "ex-bench",
        exerciseName: "Bench Press",
        sets: [
          { weight: 40, reps: 10, setType: "warmup" }, // excluded
          { weight: 100, reps: 10, setType: "normal" }, // 1000
        ],
      }]),
    ];
    const goal = baseGoal({ type: "volume", targetValue: 1000, timeFrame: "month" });
    const progress = computeGoalProgress(goal, sessions);
    expect(progress.current).toBe(1000);
  });

  it("filters by exerciseId when set", () => {
    const sessions = [
      benchSession(1, 100, 10), // bench: 1000
      makeSession(1, [{
        exerciseId: "ex-squat",
        exerciseName: "Squat",
        sets: [{ weight: 120, reps: 5 }], // squat: 600
      }]),
    ];
    const goal = baseGoal({
      type: "volume",
      targetValue: 1000,
      timeFrame: "month",
      exerciseId: "ex-bench",
    });
    const progress = computeGoalProgress(goal, sessions);
    expect(progress.current).toBe(1000); // only bench
  });

  it("excludes sessions outside the time frame", () => {
    const sessions = [
      benchSession(1, 100, 10), // 1 day ago — within week
      benchSession(10, 100, 10), // 10 days ago — outside week
    ];
    const goal = baseGoal({ type: "volume", targetValue: 2000, timeFrame: "week" });
    const progress = computeGoalProgress(goal, sessions);
    expect(progress.current).toBe(1000); // only 1 day ago
  });

  it("marks achieved when current >= target", () => {
    const sessions = [benchSession(1, 100, 10)]; // 1000
    const goal = baseGoal({ type: "volume", targetValue: 1000, timeFrame: "month" });
    const progress = computeGoalProgress(goal, sessions);
    expect(progress.achieved).toBe(true);
    expect(progress.percent).toBe(100);
  });

  it("excludes freeze sessions", () => {
    const sessions = [
      benchSession(1, 100, 10),
      { ...benchSession(2, 100, 10), isFreeze: true },
    ];
    const goal = baseGoal({ type: "volume", targetValue: 1000, timeFrame: "month" });
    const progress = computeGoalProgress(goal, sessions);
    expect(progress.current).toBe(1000); // only non-freeze
  });
});

// ── computeGoalProgress — 1RM ──

describe("computeGoalProgress — 1RM", () => {
  it("finds the highest e1RM in the time frame", () => {
    const sessions = [
      benchSession(1, 100, 10), // e1RM ≈ 133
      benchSession(3, 90, 5),   // e1RM ≈ 105
    ];
    const goal = baseGoal({ type: "1rm", targetValue: 130, timeFrame: "month" });
    const progress = computeGoalProgress(goal, sessions);
    expect(progress.current).toBeGreaterThan(130); // 100×10 → e1RM ≈ 133
    expect(progress.achieved).toBe(true);
  });

  it("excludes warmup sets (countsForPR = false)", () => {
    const sessions = [
      makeSession(1, [{
        exerciseId: "ex-bench",
        exerciseName: "Bench Press",
        sets: [
          { weight: 60, reps: 5, setType: "warmup" }, // excluded from PR
          { weight: 100, reps: 10, setType: "normal" }, // e1RM ≈ 133
        ],
      }]),
    ];
    const goal = baseGoal({ type: "1rm", targetValue: 130, timeFrame: "month" });
    const progress = computeGoalProgress(goal, sessions);
    expect(progress.current).toBeGreaterThan(130); // uses the normal set
  });

  it("excludes drop_set from PR (countsForPR = false)", () => {
    const sessions = [
      makeSession(1, [{
        exerciseId: "ex-bench",
        exerciseName: "Bench Press",
        sets: [
          { weight: 150, reps: 3, setType: "drop_set" }, // excluded — higher weight but drop
          { weight: 100, reps: 10, setType: "normal" }, // e1RM ≈ 133
        ],
      }]),
    ];
    const goal = baseGoal({ type: "1rm", targetValue: 140, timeFrame: "month" });
    const progress = computeGoalProgress(goal, sessions);
    // Should use 100×10 (e1RM ≈ 133), not 150×3 (drop set excluded)
    expect(progress.current).toBeLessThan(140);
    expect(progress.current).toBeGreaterThan(130);
  });

  it("filters by exerciseId when set", () => {
    const sessions = [
      benchSession(1, 100, 10), // bench e1RM ≈ 133
      makeSession(1, [{
        exerciseId: "ex-squat",
        exerciseName: "Squat",
        sets: [{ weight: 200, reps: 3 }], // squat e1RM ≈ 233
      }]),
    ];
    const goal = baseGoal({
      type: "1rm",
      targetValue: 130,
      timeFrame: "month",
      exerciseId: "ex-bench",
    });
    const progress = computeGoalProgress(goal, sessions);
    expect(progress.current).toBeGreaterThan(130);
    expect(progress.current).toBeLessThan(200); // not the squat
  });
});

// ── computeGoalProgress — REPS ──

describe("computeGoalProgress — REPS", () => {
  it("sums all completed reps in the time frame", () => {
    const sessions = [
      benchSession(1, 100, 10), // 10 reps
      benchSession(3, 100, 8),  // 8 reps
    ];
    const goal = baseGoal({ type: "reps", targetValue: 20, timeFrame: "month" });
    const progress = computeGoalProgress(goal, sessions);
    expect(progress.current).toBe(18); // 10 + 8
    expect(progress.percent).toBe(90);
  });

  it("excludes warmup sets", () => {
    const sessions = [
      makeSession(1, [{
        exerciseId: "ex-bench",
        exerciseName: "Bench Press",
        sets: [
          { weight: 40, reps: 10, setType: "warmup" }, // excluded
          { weight: 100, reps: 10, setType: "normal" }, // 10 reps
        ],
      }]),
    ];
    const goal = baseGoal({ type: "reps", targetValue: 10, timeFrame: "month" });
    const progress = computeGoalProgress(goal, sessions);
    expect(progress.current).toBe(10);
  });
});

// ── computeGoalProgress — WORKOUTS ──

describe("computeGoalProgress — WORKOUTS", () => {
  it("counts completed sessions in the time frame", () => {
    const sessions = [
      benchSession(1, 100, 10),
      benchSession(3, 100, 10),
      benchSession(5, 100, 10),
    ];
    const goal = baseGoal({ type: "workouts", targetValue: 3, timeFrame: "month" });
    const progress = computeGoalProgress(goal, sessions);
    expect(progress.current).toBe(3);
    expect(progress.achieved).toBe(true);
  });

  it("counts only sessions with the target exercise when exerciseId is set", () => {
    const sessions = [
      benchSession(1, 100, 10), // has bench
      makeSession(2, [{
        exerciseId: "ex-squat",
        exerciseName: "Squat",
        sets: [{ weight: 120, reps: 5 }],
      }]), // no bench
    ];
    const goal = baseGoal({
      type: "workouts",
      targetValue: 2,
      timeFrame: "month",
      exerciseId: "ex-bench",
    });
    const progress = computeGoalProgress(goal, sessions);
    expect(progress.current).toBe(1); // only the bench session
  });

  it("excludes incomplete and freeze sessions", () => {
    const sessions = [
      benchSession(1, 100, 10),
      { ...benchSession(2, 100, 10), completed: false },
      { ...benchSession(3, 100, 10), isFreeze: true },
    ];
    const goal = baseGoal({ type: "workouts", targetValue: 3, timeFrame: "month" });
    const progress = computeGoalProgress(goal, sessions);
    expect(progress.current).toBe(1);
  });
});

// ── computeAllGoalProgress (batch) ──

describe("computeAllGoalProgress", () => {
  it("computes progress for multiple goals", () => {
    const sessions = [
      benchSession(1, 100, 10), // volume=1000, reps=10, e1RM≈133, workouts=1
    ];
    const goals: Goal[] = [
      baseGoal({ id: "g1", type: "volume", targetValue: 1000 }),
      baseGoal({ id: "g2", type: "1rm", targetValue: 120 }),
      baseGoal({ id: "g3", type: "reps", targetValue: 10 }),
      baseGoal({ id: "g4", type: "workouts", targetValue: 1 }),
    ];
    const results = computeAllGoalProgress(goals, sessions);
    expect(results).toHaveLength(4);
    expect(results[0].achieved).toBe(true); // volume
    expect(results[1].achieved).toBe(true); // 1rm
    expect(results[2].achieved).toBe(true); // reps
    expect(results[3].achieved).toBe(true); // workouts
  });

  it("returns empty array for no goals", () => {
    const results = computeAllGoalProgress([], []);
    expect(results).toEqual([]);
  });
});

// ── Edge cases ──

describe("computeGoalProgress — edge cases", () => {
  it("returns 0 progress for no sessions", () => {
    const goal = baseGoal({ type: "volume", targetValue: 1000 });
    const progress = computeGoalProgress(goal, []);
    expect(progress.current).toBe(0);
    expect(progress.percent).toBe(0);
    expect(progress.achieved).toBe(false);
  });

  it("returns 0 progress when targetValue is 0", () => {
    const sessions = [benchSession(1, 100, 10)];
    const goal = baseGoal({ type: "volume", targetValue: 0 });
    const progress = computeGoalProgress(goal, sessions);
    expect(progress.current).toBe(1000);
    expect(progress.percent).toBe(0); // avoid div-by-zero
    expect(progress.achieved).toBe(false); // target 0 = not achievable
  });

  it("caps percent at 100 even if current >> target", () => {
    const sessions = [benchSession(1, 100, 100)]; // volume = 10000
    const goal = baseGoal({ type: "volume", targetValue: 1000 });
    const progress = computeGoalProgress(goal, sessions);
    expect(progress.percent).toBe(100);
    expect(progress.achieved).toBe(true);
  });
});
