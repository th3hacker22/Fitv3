import { describe, it, expect } from "vitest";
import { estimateOneRepMax, setVolume } from "../fitnessMath";

describe("estimateOneRepMax", () => {
  it("returns 0 for zero or negative weight", () => {
    expect(estimateOneRepMax(0, 5)).toBe(0);
    expect(estimateOneRepMax(-10, 5)).toBe(0);
  });

  it("returns 0 for zero or negative reps", () => {
    expect(estimateOneRepMax(100, 0)).toBe(0);
    expect(estimateOneRepMax(100, -1)).toBe(0);
  });

  it("returns the weight itself for a 1-rep max", () => {
    expect(estimateOneRepMax(135, 1)).toBe(135);
    expect(estimateOneRepMax(100, 1)).toBe(100);
  });

  it("calculates 1RM using Brzycki formula for reps <= 10", () => {
    // 120kg x 5 → Brzycki: (120 * 36) / 32 = 135
    expect(estimateOneRepMax(120, 5)).toBe(135);
    // 100kg x 6 → Brzycki: (100 * 36) / 31 = 116.1 (rounded)
    expect(estimateOneRepMax(100, 6)).toBe(116.1);
    // 80kg x 8 → Brzycki: (80 * 36) / 29 = 99.3
    expect(estimateOneRepMax(80, 8)).toBe(99.3);
    // 100kg x 5 → Brzycki: (100 * 36) / 32 = 112.5
    expect(estimateOneRepMax(100, 5)).toBe(112.5);
    // 105kg x 4 → Brzycki: (105 * 36) / 33 = 114.5
    expect(estimateOneRepMax(105, 4)).toBe(114.5);
  });

  it("averages Epley and Brzycki formulas for reps 11-12 (transitional)", () => {
    // 50kg x 12 → Epley 70, Brzycki 72 → avg 71
    expect(estimateOneRepMax(50, 12)).toBe(71);
  });

  it("uses Lombardi power formula for reps >= 13", () => {
    // 50kg x 20 → Lombardi: 50 * 20^0.1 = 67.5
    expect(estimateOneRepMax(50, 20)).toBe(67.5);
  });

  it("rounds to one decimal place", () => {
    const result = estimateOneRepMax(77, 7);
    // Should have at most 1 decimal
    const decimals = (String(result).split(".")[1] || "").length;
    expect(decimals).toBeLessThanOrEqual(1);
  });
});

describe("setVolume", () => {
  it("returns 0 for an empty array", () => {
    expect(setVolume([])).toBe(0);
  });

  it("sums weight × reps across sets", () => {
    expect(
      setVolume([
        { weight: 100, reps: 5 },
        { weight: 90, reps: 10 },
      ])
    ).toBe(1400); // 500 + 900
  });

  it("handles zero-weight sets", () => {
    expect(
      setVolume([
        { weight: 0, reps: 20 },
        { weight: 50, reps: 5 },
      ])
    ).toBe(250);
  });
});
