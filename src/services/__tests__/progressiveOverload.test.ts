import { describe, it, expect } from "vitest";
import {
  pickProgressionModel,
  analyzeExerciseProgress,
  recommendOverload,
  formatOverloadForPrompt,
  type ExerciseHistoryPoint,
} from "../progressiveOverload";

// ── Helpers ──

function hist(overrides: Partial<ExerciseHistoryPoint> = {}): ExerciseHistoryPoint {
  return {
    date: "2026-06-01T00:00:00.000Z",
    weight: 50,
    reps: 10,
    rpe: 7,
    setsCompleted: 3,
    setsTargeted: 3,
    estimated1RM: 66,
    ...overrides,
  };
}

// Build a streak of N sessions where the user beat the top of the rep range
function beatStreak(
  count: number,
  startWeight = 50,
  topRep = 12
): ExerciseHistoryPoint[] {
  const out: ExerciseHistoryPoint[] = [];
  for (let i = 0; i < count; i++) {
    out.push(
      hist({
        date: new Date(Date.parse("2026-01-01") + i * 7 * 86400000).toISOString(),
        weight: startWeight,
        reps: topRep, // at or above top of 8-12 range
        rpe: 7,
        setsCompleted: 3,
        setsTargeted: 3,
        estimated1RM: startWeight * (1 + topRep / 30),
      })
    );
  }
  return out;
}

// ── pickProgressionModel ──

describe("pickProgressionModel", () => {
  it("returns linear for novices / beginners under 1.5 years", () => {
    expect(pickProgressionModel(0.5, "Novice")).toBe("linear");
    expect(pickProgressionModel(1, "Beginner")).toBe("linear");
    expect(pickProgressionModel(1.4, "Intermediate")).toBe("linear");
  });

  it("returns weekly-undulating for intermediates (1.5–5 years)", () => {
    expect(pickProgressionModel(1.5, "Intermediate")).toBe("weekly-undulating");
    expect(pickProgressionModel(3, "Intermediate")).toBe("weekly-undulating");
    expect(pickProgressionModel(5, "Intermediate")).toBe("weekly-undulating");
  });

  it("returns block-periodization for advanced (>5 years or Advanced level)", () => {
    expect(pickProgressionModel(5.1, "Intermediate")).toBe("block-periodization");
    expect(pickProgressionModel(2, "Advanced")).toBe("block-periodization");
  });

  it("treats Advanced level as authoritative even with low years", () => {
    expect(pickProgressionModel(0.5, "Advanced")).toBe("block-periodization");
  });
});

// ── analyzeExerciseProgress ──

describe("analyzeExerciseProgress", () => {
  it("returns nullish lastSession for empty history", () => {
    const a = analyzeExerciseProgress([]);
    expect(a.lastSession).toBeNull();
    expect(a.beatCount).toBe(0);
    expect(a.completionRatio).toBe(0);
  });

  it("picks the most recent session as lastSession", () => {
    const history = [
      hist({ date: "2026-01-01T00:00:00Z", weight: 40 }),
      hist({ date: "2026-02-01T00:00:00Z", weight: 50 }),
      hist({ date: "2026-03-01T00:00:00Z", weight: 60 }),
    ];
    const a = analyzeExerciseProgress(history);
    expect(a.lastSession?.weight).toBe(60);
  });

  it("computes completionRatio as completed/targeted across history", () => {
    const history = [
      hist({ setsCompleted: 3, setsTargeted: 3 }),
      hist({ setsCompleted: 2, setsTargeted: 3 }),
      hist({ setsCompleted: 3, setsTargeted: 3 }),
    ];
    const a = analyzeExerciseProgress(history);
    // 8 completed / 9 targeted
    expect(a.completionRatio).toBeCloseTo(8 / 9, 2);
  });

  it("computes avgRpe only over sessions that reported RPE", () => {
    const history = [
      hist({ rpe: 7 }),
      hist({ rpe: 9 }),
      hist({ rpe: undefined }),
    ];
    const a = analyzeExerciseProgress(history);
    expect(a.avgRpe).toBeCloseTo(8, 2); // (7+9)/2
  });

  it("returns null avgRpe when no session has RPE", () => {
    const history = [hist({ rpe: undefined }), hist({ rpe: undefined })];
    const a = analyzeExerciseProgress(history);
    expect(a.avgRpe).toBeNull();
  });

  it("counts beatCount: consecutive sessions (from most recent) where reps >= top of 8-12 range", () => {
    // most recent first chronologically handled internally by sort
    const history = [
      hist({ date: "2026-01-01", reps: 8 }),
      hist({ date: "2026-02-01", reps: 12 }), // beat
      hist({ date: "2026-03-01", reps: 12 }), // beat
      hist({ date: "2026-04-01", reps: 12 }), // beat (most recent)
    ];
    const a = analyzeExerciseProgress(history);
    expect(a.beatCount).toBe(3);
    expect(a.streakBeatTarget).toBe(true);
  });

  it("stops beatCount at first non-beating session from the top", () => {
    const history = [
      hist({ date: "2026-01-01", reps: 12 }),
      hist({ date: "2026-02-01", reps: 8 }),  // not beat — breaks streak
      hist({ date: "2026-03-01", reps: 12 }), // only this one beats from the top
    ];
    const a = analyzeExerciseProgress(history);
    expect(a.beatCount).toBe(1);
    expect(a.streakBeatTarget).toBe(false); // need >=3
  });
});

// ── recommendOverload ──

describe("recommendOverload", () => {
  it("introduces a conservative weight for an exercise with no history", () => {
    const rec = recommendOverload({
      history: [],
      model: "linear",
      age: 25,
      bodyweightKg: 70,
      exerciseCategory: "barbell",
      targetReps: 10,
    });
    expect(rec.ready).toBe(true);
    expect(rec.readinessSignal).toBe("introduce");
    expect(rec.previousWeight).toBeNull();
    expect(rec.suggestedWeight).toBeGreaterThan(0);
    // Conservative: should be well under bodyweight for a barbell press to start
    expect(rec.suggestedWeight).toBeLessThan(70);
  });

  it("advances linearly by 2.5% when user completed all sets at low RPE and beat the range 3x", () => {
    const history = beatStreak(3, 50, 12);
    const rec = recommendOverload({
      history,
      model: "linear",
      age: 30,
      bodyweightKg: 80,
      exerciseCategory: "barbell",
      targetReps: 10,
    });
    expect(rec.readinessSignal).toBe("advance");
    expect(rec.previousWeight).toBe(50);
    expect(rec.incrementPct).toBeCloseTo(0.025, 3);
    expect(rec.suggestedWeight).toBeCloseTo(51.25, 2);
  });

  it("holds (no increment) when completion ratio is high but range not beaten", () => {
    const history = [
      hist({ weight: 50, reps: 8, setsCompleted: 3, setsTargeted: 3, rpe: 7 }),
      hist({ weight: 50, reps: 9, setsCompleted: 3, setsTargeted: 3, rpe: 7 }),
    ];
    const rec = recommendOverload({
      history,
      model: "linear",
      age: 30,
      bodyweightKg: 80,
      exerciseCategory: "barbell",
      targetReps: 10,
    });
    expect(rec.readinessSignal).toBe("hold");
    expect(rec.suggestedWeight).toBe(50);
    expect(rec.incrementPct).toBe(0);
  });

  it("triggers deload when avg RPE >= 9 across recent sessions", () => {
    const history = [
      hist({ weight: 60, rpe: 9, setsCompleted: 3, setsTargeted: 3 }),
      hist({ weight: 60, rpe: 9.5, setsCompleted: 2, setsTargeted: 3 }),
    ];
    const rec = recommendOverload({
      history,
      model: "linear",
      age: 30,
      bodyweightKg: 80,
      exerciseCategory: "barbell",
      targetReps: 10,
    });
    expect(rec.readinessSignal).toBe("deload");
    expect(rec.suggestedWeight).toBeLessThan(60);
    expect(rec.incrementPct).toBeLessThan(0);
  });

  it("triggers deload when completion ratio < 0.7", () => {
    const history = [
      hist({ weight: 60, setsCompleted: 1, setsTargeted: 3, rpe: 8 }),
      hist({ weight: 60, setsCompleted: 1, setsTargeted: 3, rpe: 8 }),
    ];
    const rec = recommendOverload({
      history,
      model: "linear",
      age: 30,
      bodyweightKg: 80,
      exerciseCategory: "barbell",
      targetReps: 10,
    });
    expect(rec.readinessSignal).toBe("deload");
    expect(rec.suggestedWeight).toBeLessThan(60);
  });

  it("caps linear increment at 2% for ages 41-55", () => {
    const history = beatStreak(3, 50, 12);
    const rec = recommendOverload({
      history,
      model: "linear",
      age: 48,
      bodyweightKg: 80,
      exerciseCategory: "barbell",
      targetReps: 10,
    });
    expect(rec.incrementPct).toBeLessThanOrEqual(0.02);
  });

  it("caps linear increment at 1.25% for ages 55+", () => {
    const history = beatStreak(3, 50, 12);
    const rec = recommendOverload({
      history,
      model: "linear",
      age: 60,
      bodyweightKg: 80,
      exerciseCategory: "barbell",
      targetReps: 10,
    });
    expect(rec.incrementPct).toBeLessThanOrEqual(0.0125);
  });

  it("weekly-undulating advances by smaller per-microcycle increment (~1.25%)", () => {
    const history = beatStreak(3, 50, 12);
    const rec = recommendOverload({
      history,
      model: "weekly-undulating",
      age: 30,
      bodyweightKg: 80,
      exerciseCategory: "barbell",
      targetReps: 10,
    });
    expect(rec.readinessSignal).toBe("advance");
    expect(rec.incrementPct).toBeCloseTo(0.0125, 3);
  });

  it("tracks reps instead of weight for bodyweight exercises (weight = 0)", () => {
    const history = [
      hist({ weight: 0, reps: 10, rpe: 7, setsCompleted: 3, setsTargeted: 3 }),
      hist({ weight: 0, reps: 12, rpe: 7, setsCompleted: 3, setsTargeted: 3 }),
      hist({ weight: 0, reps: 12, rpe: 7, setsCompleted: 3, setsTargeted: 3 }),
    ];
    const rec = recommendOverload({
      history,
      model: "linear",
      age: 30,
      bodyweightKg: 80,
      exerciseCategory: "bodyweight",
      targetReps: 10,
    });
    expect(rec.readinessSignal).toBe("advance");
    expect(rec.suggestedReps).toBeGreaterThan(12);
    expect(rec.suggestedWeight).toBe(0);
  });

  it("rounds suggested weight to nearest 0.5kg or 1.25kg plate increment", () => {
    const history = beatStreak(3, 50, 12);
    const rec = recommendOverload({
      history,
      model: "linear",
      age: 30,
      bodyweightKg: 80,
      exerciseCategory: "barbell",
      targetReps: 10,
    });
    // 50 * 1.025 = 51.25 — already clean; ensure it's a multiple of 0.25
    expect((rec.suggestedWeight * 4) % 1).toBe(0);
  });

  it("uses last session as previousWeight", () => {
    const history = [
      hist({ date: "2026-01-01", weight: 40 }),
      hist({ date: "2026-02-01", weight: 50 }),
    ];
    const rec = recommendOverload({
      history,
      model: "linear",
      age: 30,
      bodyweightKg: 80,
      exerciseCategory: "barbell",
      targetReps: 10,
    });
    expect(rec.previousWeight).toBe(50);
  });
});

// ── formatOverloadForPrompt ──

describe("formatOverloadForPrompt", () => {
  it("returns empty string for empty recommendations", () => {
    expect(formatOverloadForPrompt([])).toBe("");
  });

  it("includes exercise id, previous, suggested, and signal", () => {
    const recs = [
      recommendOverload({
        history: beatStreak(3, 50, 12),
        model: "linear",
        age: 30,
        bodyweightKg: 80,
        exerciseCategory: "barbell",
        targetReps: 10,
        exerciseId: "bench",
      }),
    ];
    const out = formatOverloadForPrompt(recs);
    expect(out).toContain("bench");
    expect(out).toContain("50");
    expect(out.toLowerCase()).toContain("advance");
  });
});
