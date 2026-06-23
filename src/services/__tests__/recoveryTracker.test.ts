import { describe, it, expect } from "vitest";
import {
  calculateMuscleRecovery,
  computeLoadFactor,
  getRecoveryColor,
  getRecoverySummary,
  type MuscleRecoveryStatus,
} from "../recoveryTracker";
import type { WorkoutSession } from "@/db/schema";
import type { Exercise } from "@/types/exercise";

// ── Fixtures ────────────────────────────────────────────────────────────────

const benchPress: Exercise = {
  id: "ex-bench",
  name: "Bench Press",
  category: "strength",
  bodyPart: "chest",
  equipment: "barbell",
  instructions: "",
  instructionSteps: [],
  muscleGroup: "chest",
  secondaryMuscles: ["triceps"],
  target: "pectorals",
  imageUrl: "",
  gifUrl: "",
};

const allExercises: Exercise[] = [benchPress];

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

/**
 * Build a single-session workout that targets the chest via bench press.
 * volume = weight × reps × numSets.
 */
function makeBenchSession(
  weight: number,
  reps: number,
  numSets: number,
  rpe: number | undefined,
  dateISO: string
): WorkoutSession {
  const sets = Array.from({ length: numSets }, () => ({
    weight,
    reps,
    rpe,
    completed: true,
    estimated1RM: weight,
  }));
  return {
    id: `s_${Math.random()}`,
    name: "Test",
    date: dateISO,
    duration: 3600,
    exercises: [
      {
        exerciseId: "ex-bench",
        exerciseName: "Bench Press",
        sets,
      },
    ],
    completed: true,
    createdAt: dateISO,
    updatedAt: dateISO,
  };
}

// ── Pure function: computeLoadFactor ───────────────────────────────────────

describe("computeLoadFactor (pure function)", () => {
  it("returns 1.0 for an average-volume, baseline-RPE session", () => {
    // sessionVolume === userAvgVolume, RPE === 7 (baseline) → no bumps.
    expect(computeLoadFactor(3000, 7, 3000)).toBeCloseTo(1.0, 5);
  });

  it("returns 1.0 when RPE is undefined (falls back to baseline 7)", () => {
    expect(computeLoadFactor(3000, undefined, 3000)).toBeCloseTo(1.0, 5);
  });

  it("returns 1.0 when RPE is NaN", () => {
    expect(computeLoadFactor(3000, NaN, 3000)).toBeCloseTo(1.0, 5);
  });

  it("applies a positive bump for high RPE", () => {
    // RPE 10 → +0.15 (3 points above baseline × 0.05)
    const lf = computeLoadFactor(3000, 10, 3000);
    expect(lf).toBeCloseTo(1.15, 5);
  });

  it("applies a small bump for RPE 8", () => {
    // RPE 8 → +0.05 (1 point above baseline × 0.05)
    const lf = computeLoadFactor(3000, 8, 3000);
    expect(lf).toBeCloseTo(1.05, 5);
  });

  it("does NOT apply a negative RPE bump for low RPE (RPE below baseline = 0 bump)", () => {
    // RPE 5 → no negative bump from RPE (volume bump only).
    expect(computeLoadFactor(3000, 5, 3000)).toBeCloseTo(1.0, 5);
  });

  it("applies a positive volume bump for a heavy session (2× average)", () => {
    // volumeRatio = 2 → volumeBump = (2-1) × 0.30 = 0.30
    const lf = computeLoadFactor(6000, 7, 3000);
    expect(lf).toBeCloseTo(1.30, 5);
  });

  it("applies a negative volume bump for a light session (0.5× average)", () => {
    // volumeRatio = 0.5 → volumeBump = (0.5-1) × 0.30 = −0.15
    const lf = computeLoadFactor(1500, 7, 3000);
    expect(lf).toBeCloseTo(0.85, 5); // clamped to LOAD_FACTOR_MIN
  });

  it("combines volume + RPE bumps", () => {
    // 2× volume (+0.30) + RPE 10 (+0.15) = 1.45
    const lf = computeLoadFactor(6000, 10, 3000);
    expect(lf).toBeCloseTo(1.45, 5);
  });

  it("clamps to LOAD_FACTOR_MAX (1.5) for a brutal session", () => {
    // 5× volume (+1.20) + RPE 10 (+0.15) = 2.35 → clamped to 1.5
    const lf = computeLoadFactor(15000, 10, 3000);
    expect(lf).toBe(1.5);
  });

  it("clamps to LOAD_FACTOR_MIN (0.85) for a very light session", () => {
    // 0.1× volume (−0.27) + RPE 5 (0) = 0.73 → clamped to 0.85
    const lf = computeLoadFactor(300, 5, 3000);
    expect(lf).toBe(0.85);
  });

  it("treats sessionVolume=0 as 'no data' → average (loadFactor = 1 + RPE bump only)", () => {
    expect(computeLoadFactor(0, 7, 3000)).toBeCloseTo(1.0, 5);
    expect(computeLoadFactor(0, 10, 3000)).toBeCloseTo(1.15, 5);
  });

  it("falls back to DEFAULT_USER_AVG_VOLUME when userAvgVolume is 0", () => {
    // userAvgVolume=0 → uses default 3000; sessionVolume 3000 → ratio 1 → no bump.
    expect(computeLoadFactor(3000, 7, 0)).toBeCloseTo(1.0, 5);
  });
});

// ── Integration: calculateMuscleRecovery ───────────────────────────────────

describe("calculateMuscleRecovery (A3: volume + intensity aware)", () => {
  describe("no history", () => {
    it("returns 100% recovery for all muscles", () => {
      const recovery = calculateMuscleRecovery([], allExercises);
      const chest = recovery.get("upper-chest") ?? recovery.get("mid-lower-chest");
      expect(chest).toBeDefined();
      expect(chest!.recoveryPercent).toBe(100);
      expect(chest!.status).toBe("never-trained");
      expect(chest!.hoursSinceTrained).toBeNull();
      expect(chest!.lastSessionVolume).toBeNull();
      expect(chest!.lastSessionAvgRPE).toBeNull();
      expect(chest!.loadFactor).toBe(1);
    });
  });

  describe("light session vs heavy session (same time ago)", () => {
    it("a heavy session recovers SLOWER than a light session", () => {
      // Both 24h ago, but light = 3×100×5 (1500) and heavy = 3×100×12 (3600).
      // Need ≥2 sessions for the user-avg to be computed; add an old baseline
      // session so the average is established.
      const baseline = makeBenchSession(100, 10, 3, 7, hoursAgo(72)); // 3000 vol
      const light = makeBenchSession(100, 5, 3, 7, hoursAgo(24)); // 1500 vol
      const heavy = makeBenchSession(100, 12, 3, 7, hoursAgo(24)); // 3600 vol

      const lightRec = calculateMuscleRecovery([baseline, light], allExercises);
      const heavyRec = calculateMuscleRecovery([baseline, heavy], allExercises);

      const lightChest = lightRec.get("upper-chest") ?? lightRec.get("mid-lower-chest");
      const heavyChest = heavyRec.get("upper-chest") ?? heavyRec.get("mid-lower-chest");

      expect(lightChest).toBeDefined();
      expect(heavyChest).toBeDefined();

      // Heavy session → higher loadFactor → more recovery hours → lower %.
      expect(heavyChest!.loadFactor).toBeGreaterThan(lightChest!.loadFactor);
      expect(heavyChest!.recoveryHours).toBeGreaterThan(lightChest!.recoveryHours);
      expect(heavyChest!.recoveryPercent).toBeLessThan(lightChest!.recoveryPercent);
    });
  });

  describe("high RPE vs low RPE (same volume, same time ago)", () => {
    it("a high-RPE session recovers SLOWER than a low-RPE session", () => {
      const baseline = makeBenchSession(100, 10, 3, 7, hoursAgo(72));
      const easy = makeBenchSession(100, 10, 3, 6, hoursAgo(24)); // RPE 6
      const brutal = makeBenchSession(100, 10, 3, 10, hoursAgo(24)); // RPE 10

      const easyRec = calculateMuscleRecovery([baseline, easy], allExercises);
      const brutalRec = calculateMuscleRecovery([baseline, brutal], allExercises);

      const easyChest = easyRec.get("upper-chest") ?? easyRec.get("mid-lower-chest");
      const brutalChest = brutalRec.get("upper-chest") ?? brutalRec.get("mid-lower-chest");

      expect(easyChest).toBeDefined();
      expect(brutalChest).toBeDefined();

      // RPE 10 → +0.15 bump; RPE 6 → 0 bump. Same volume → loadFactor differs.
      expect(brutalChest!.loadFactor).toBeGreaterThan(easyChest!.loadFactor);
      expect(brutalChest!.recoveryHours).toBeGreaterThan(easyChest!.recoveryHours);
      expect(brutalChest!.recoveryPercent).toBeLessThan(easyChest!.recoveryPercent);

      // avgRPE should be recorded.
      expect(brutalChest!.lastSessionAvgRPE).toBe(10);
      expect(easyChest!.lastSessionAvgRPE).toBe(6);
    });
  });

  describe("missing RPE (backward compatible)", () => {
    it("treats missing RPE as baseline 7 (no extra bump)", () => {
      const baseline = makeBenchSession(100, 10, 3, 7, hoursAgo(72));
      const noRpe = makeBenchSession(100, 10, 3, undefined, hoursAgo(24));

      const rec = calculateMuscleRecovery([baseline, noRpe], allExercises);
      const chest = rec.get("upper-chest") ?? rec.get("mid-lower-chest");

      expect(chest).toBeDefined();
      // Both sessions have the same volume (3000) → loadFactor should be 1.0
      // (average volume, baseline RPE fallback).
      expect(chest!.loadFactor).toBeCloseTo(1.0, 1);
      expect(chest!.lastSessionAvgRPE).toBe(7); // fallback
    });
  });

  describe("status bands (unchanged from time-only version)", () => {
    it("a just-trained muscle (< 33%) is 'just-trained' (red)", () => {
      // Heavy session 2h ago on a 48h muscle → ~4% recovered.
      const session = makeBenchSession(100, 10, 3, 7, hoursAgo(2));
      const rec = calculateMuscleRecovery([session], allExercises);
      const chest = rec.get("upper-chest") ?? rec.get("mid-lower-chest");
      expect(chest!.status).toBe("just-trained");
      expect(chest!.recoveryPercent).toBeLessThan(33);
    });

    it("a mid-recovery muscle (34-66%) is 'recovering' (orange)", () => {
      // 24h ago on a 48h muscle → ~50% recovered.
      const session = makeBenchSession(100, 10, 3, 7, hoursAgo(24));
      const rec = calculateMuscleRecovery([session], allExercises);
      const chest = rec.get("upper-chest") ?? rec.get("mid-lower-chest");
      expect(chest!.status).toBe("recovering");
      expect(chest!.recoveryPercent).toBeGreaterThanOrEqual(33);
      expect(chest!.recoveryPercent).toBeLessThan(67);
    });

    it("a fully-recovered muscle (≥ 67%) is 'recovered' (green)", () => {
      // 72h ago on a 48h muscle → 100% recovered.
      const session = makeBenchSession(100, 10, 3, 7, hoursAgo(72));
      const rec = calculateMuscleRecovery([session], allExercises);
      const chest = rec.get("upper-chest") ?? rec.get("mid-lower-chest");
      expect(chest!.status).toBe("recovered");
      expect(chest!.recoveryPercent).toBeGreaterThanOrEqual(67);
    });
  });

  describe("extended status fields (transparency)", () => {
    it("exposes lastSessionVolume, lastSessionAvgRPE, loadFactor, baseRecoveryHours", () => {
      const session = makeBenchSession(100, 10, 3, 9, hoursAgo(12));
      const rec = calculateMuscleRecovery([session], allExercises);
      const chest = rec.get("upper-chest") ?? rec.get("mid-lower-chest");

      expect(chest).toBeDefined();
      expect(chest!.lastSessionVolume).toBe(3000); // 3 × 100 × 10
      expect(chest!.lastSessionAvgRPE).toBe(9);
      expect(chest!.loadFactor).toBeGreaterThan(1); // RPE 9 → +0.10 bump
      expect(chest!.baseRecoveryHours).toBe(48); // chest = large muscle
      expect(chest!.recoveryHours).toBeGreaterThan(chest!.baseRecoveryHours);
    });
  });

  describe("freeze sessions are excluded", () => {
    it("a freeze session does not contribute to recovery", () => {
      const freezeSession: WorkoutSession = {
        ...makeBenchSession(100, 10, 3, 10, hoursAgo(2)),
        isFreeze: true,
      };
      const rec = calculateMuscleRecovery([freezeSession], allExercises);
      const chest = rec.get("upper-chest") ?? rec.get("mid-lower-chest");
      expect(chest!.status).toBe("never-trained");
      expect(chest!.recoveryPercent).toBe(100);
    });
  });
});

// ── AnatomyMap compatibility: getRecoveryColor + getRecoverySummary ────────

describe("AnatomyMap compatibility (getRecoveryColor + getRecoverySummary)", () => {
  it("getRecoveryColor returns red for just-trained", () => {
    const status: MuscleRecoveryStatus = {
      muscleId: "x",
      recoveryPercent: 10,
      hoursSinceTrained: 2,
      recoveryHours: 48,
      baseRecoveryHours: 48,
      loadFactor: 1,
      lastSessionVolume: 3000,
      lastSessionAvgRPE: 7,
      status: "just-trained",
      label: "Just trained",
    };
    expect(getRecoveryColor(status)).toBe("#FF4444");
  });

  it("getRecoveryColor returns orange for recovering", () => {
    const status: MuscleRecoveryStatus = {
      muscleId: "x",
      recoveryPercent: 50,
      hoursSinceTrained: 24,
      recoveryHours: 48,
      baseRecoveryHours: 48,
      loadFactor: 1,
      lastSessionVolume: 3000,
      lastSessionAvgRPE: 7,
      status: "recovering",
      label: "Recovering",
    };
    expect(getRecoveryColor(status)).toBe("#FFAA00");
  });

  it("getRecoveryColor returns green for recovered", () => {
    const status: MuscleRecoveryStatus = {
      muscleId: "x",
      recoveryPercent: 100,
      hoursSinceTrained: 72,
      recoveryHours: 48,
      baseRecoveryHours: 48,
      loadFactor: 1,
      lastSessionVolume: 3000,
      lastSessionAvgRPE: 7,
      status: "recovered",
      label: "Recovered",
    };
    expect(getRecoveryColor(status)).toBe("#00FF66");
  });

  it("getRecoveryColor returns transparent for never-trained / undefined", () => {
    expect(getRecoveryColor(undefined)).toBe("transparent");
    const status: MuscleRecoveryStatus = {
      muscleId: "x",
      recoveryPercent: 100,
      hoursSinceTrained: null,
      recoveryHours: 48,
      baseRecoveryHours: 48,
      loadFactor: 1,
      lastSessionVolume: null,
      lastSessionAvgRPE: null,
      status: "never-trained",
      label: "Not trained yet",
    };
    expect(getRecoveryColor(status)).toBe("transparent");
  });

  it("getRecoverySummary counts statuses correctly", () => {
    const recovery = new Map<string, MuscleRecoveryStatus>([
      ["m1", { muscleId: "m1", recoveryPercent: 10, hoursSinceTrained: 2, recoveryHours: 48, baseRecoveryHours: 48, loadFactor: 1, lastSessionVolume: 3000, lastSessionAvgRPE: 7, status: "just-trained", label: "" }],
      ["m2", { muscleId: "m2", recoveryPercent: 50, hoursSinceTrained: 24, recoveryHours: 48, baseRecoveryHours: 48, loadFactor: 1, lastSessionVolume: 3000, lastSessionAvgRPE: 7, status: "recovering", label: "" }],
      ["m3", { muscleId: "m3", recoveryPercent: 100, hoursSinceTrained: 72, recoveryHours: 48, baseRecoveryHours: 48, loadFactor: 1, lastSessionVolume: 3000, lastSessionAvgRPE: 7, status: "recovered", label: "" }],
      ["m4", { muscleId: "m4", recoveryPercent: 100, hoursSinceTrained: null, recoveryHours: 48, baseRecoveryHours: 48, loadFactor: 1, lastSessionVolume: null, lastSessionAvgRPE: null, status: "never-trained", label: "" }],
    ]);
    const summary = getRecoverySummary(recovery);
    expect(summary.justTrained).toBe(1);
    expect(summary.recovering).toBe(1);
    expect(summary.recovered).toBe(1);
    expect(summary.neverTrained).toBe(1);
    expect(summary.readyToTrain).toContain("m3");
    expect(summary.readyToTrain).toContain("m4");
  });
});
