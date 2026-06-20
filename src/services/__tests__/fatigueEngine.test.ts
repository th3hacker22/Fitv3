import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { assessFatigueACWR } from "../fatigueEngine";
import type { WorkoutSession } from "@/db/schema";
import type { GeneratorProfile } from "@/store/useGeneratorStore";

// ── Fixtures ──
const FIXED_NOW = new Date("2026-06-20T12:00:00Z").getTime();

const baseProfile: GeneratorProfile = {
  age: 30,
  medicalCautions: [],
  daysPerWeek: 4,
} as GeneratorProfile;

function makeSession(daysAgo: number, volumeKg: number, completed = true): WorkoutSession {
  const date = new Date(FIXED_NOW - daysAgo * 86400000).toISOString();
  return {
    id: `s-${daysAgo}`,
    date,
    name: "Test",
    completed,
    isFreeze: false,
    duration: 60,
    exercises: [
      {
        exerciseId: "ex1",
        exerciseName: "Squat",
        sets: [{ weight: volumeKg / 10, reps: 10, completed: true }],
      },
    ],
  } as unknown as WorkoutSession;
}

// ── Tests ──
describe("assessFatigueACWR", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("returns fully-recovered state for zero sessions", () => {
    const result = assessFatigueACWR([], baseProfile, new Map());
    expect(result.acuteLoad).toBe(0);
    expect(result.chronicLoad).toBe(0);
    expect(result.acwr).toBe(0);
    expect(result.fatigueScore).toBe(5);
  });

  it("flags acute spike (ACWR > 1.5) when 7 days of volume with no prior base", () => {
    const sessions = Array.from({ length: 7 }, (_, i) => makeSession(i, 1000));
    const result = assessFatigueACWR(sessions, baseProfile, new Map());
    expect(result.acwr).toBeGreaterThan(1.5);
    expect(result.fatigueScore).toBeLessThan(3);
  });

  it("reports optimal zone (0.8 ≤ ACWR ≤ 1.3) for 28 days of consistent volume", () => {
    const sessions = Array.from({ length: 28 }, (_, i) => makeSession(i, 1000));
    const result = assessFatigueACWR(sessions, baseProfile, new Map());
    expect(result.acwr).toBeGreaterThanOrEqual(0.8);
    expect(result.acwr).toBeLessThanOrEqual(1.3);
    expect(result.fatigueScore).toBeGreaterThanOrEqual(4);
  });

  it("ignores incomplete and freeze sessions", () => {
    const sessions = [
      makeSession(1, 1000, false), // incomplete
      { ...makeSession(2, 1000), isFreeze: true }, // freeze
    ];
    const result = assessFatigueACWR(sessions, baseProfile, new Map());
    expect(result.acuteLoad).toBe(0);
  });

  it("sets shouldDeload flag when ACWR is high", () => {
    const sessions = Array.from({ length: 7 }, (_, i) => makeSession(i, 2000));
    const result = assessFatigueACWR(sessions, baseProfile, new Map());
    expect(result.shouldDeload).toBe(true);
  });

  it("volumeAdjustment correlates inversely with ACWR", () => {
    const spike = assessFatigueACWR(
      Array.from({ length: 7 }, (_, i) => makeSession(i, 2000)),
      baseProfile,
      new Map()
    );
    const optimal = assessFatigueACWR(
      Array.from({ length: 28 }, (_, i) => makeSession(i, 1000)),
      baseProfile,
      new Map()
    );
    expect(spike.volumeAdjustment).toBeLessThan(optimal.volumeAdjustment);
  });
});
