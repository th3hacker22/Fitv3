/**
 * Barbell Plate Calculator.
 *
 * Given a target total weight and a set of available plates, calculates
 * the optimal plate combination to load on EACH SIDE of the barbell.
 *
 * Standard Olympic barbell = 20kg (or 15kg for women's bar).
 * Plates are loaded symmetrically (same on both sides).
 *
 * Available plates (kg): 25, 20, 15, 10, 5, 2.5, 1.25
 * (Common gym set — we also support 0.5kg micro-plates if available)
 */

export interface PlateConfig {
  /** Available plate weights in kg, largest first. */
  availablePlates: number[];
  /** Barbell weight in kg (default 20). */
  barWeight: number;
}

export interface PlateLoad {
  /** Total target weight (kg). */
  totalWeight: number;
  /** Weight on each side (kg) = (total - bar) / 2. */
  perSide: number;
  /** Plates to load on EACH side, largest first. e.g. [25, 10, 2.5] */
  platesPerSide: number[];
  /** Whether the exact weight is achievable with available plates. */
  exact: boolean;
  /** Actual achievable weight (may differ from target if not exact). */
  actualWeight: number;
  /** Shortfall (target - actual). Positive = under-loaded. */
  shortfall: number;
}

const DEFAULT_CONFIG: PlateConfig = {
  availablePlates: [25, 20, 15, 10, 5, 2.5, 1.25, 0.5],
  barWeight: 20,
};

/**
 * Calculate the plate combination for a target weight.
 * Uses a greedy algorithm: start with the largest plate that fits, repeat.
 *
 * @param targetWeight The total weight including barbell (kg)
 * @param config Available plates + bar weight
 * @returns PlateLoad with per-side breakdown
 */
export function calculatePlates(
  targetWeight: number,
  config: PlateConfig = DEFAULT_CONFIG
): PlateLoad {
  const { availablePlates, barWeight } = config;

  // Sort plates largest first
  const plates = [...availablePlates].sort((a, b) => b - a);

  if (targetWeight <= barWeight) {
    // Just the bar, or invalid
    return {
      totalWeight: barWeight,
      perSide: 0,
      platesPerSide: [],
      exact: targetWeight === barWeight,
      actualWeight: barWeight,
      shortfall: Math.max(0, targetWeight - barWeight),
    };
  }

  // Weight needed per side
  const perSideTarget = (targetWeight - barWeight) / 2;

  // Greedy: use largest plate that fits, repeat
  const platesPerSide: number[] = [];
  let remaining = perSideTarget;

  for (const plate of plates) {
    while (remaining >= plate - 0.001) {
      // small tolerance for float errors
      platesPerSide.push(plate);
      remaining -= plate;
      remaining = Math.round(remaining * 1000) / 1000; // round to avoid float drift
    }
  }

  const actualPerSide = perSideTarget - remaining;
  const actualWeight = barWeight + actualPerSide * 2;
  const exact = Math.abs(remaining) < 0.01;

  return {
    totalWeight: targetWeight,
    perSide: Math.round(actualPerSide * 100) / 100,
    platesPerSide,
    exact,
    actualWeight: Math.round(actualWeight * 100) / 100,
    shortfall: Math.round((targetWeight - actualWeight) * 100) / 100,
  };
}

/**
 * Format plates for display.
 * e.g. [25, 25, 10, 2.5] → "25 + 25 + 10 + 2.5 kg"
 */
export function formatPlateStack(plates: number[]): string {
  if (plates.length === 0) return "Empty bar";
  return plates.map((p) => `${p}kg`).join(" + ");
}

/**
 * Visual representation: map plate weight to color for UI.
 */
export function plateColor(weight: number): string {
  switch (weight) {
    case 25:
      return "bg-red-500"; // red — heaviest
    case 20:
      return "bg-blue-500"; // blue
    case 15:
      return "bg-yellow-500"; // yellow
    case 10:
      return "bg-green-500"; // green
    case 5:
      return "bg-white border-2 border-gray-400"; // white
    case 2.5:
      return "bg-gray-400"; // gray
    case 1.25:
      return "bg-gray-300"; // light gray
    case 0.5:
      return "bg-purple-400"; // micro-plate
    default:
      return "bg-gray-500";
  }
}

/**
 * Get available plate presets for different gym types.
 */
export const GYM_PRESETS = {
  commercial: {
    availablePlates: [25, 20, 15, 10, 5, 2.5, 1.25],
    barWeight: 20,
  },
  home: {
    availablePlates: [20, 10, 5, 2.5],
    barWeight: 20,
  },
  powerlifting: {
    availablePlates: [25, 20, 15, 10, 5, 2.5, 1.25, 0.5, 0.25],
    barWeight: 20,
  },
  womensBar: {
    availablePlates: [25, 20, 15, 10, 5, 2.5, 1.25],
    barWeight: 15,
  },
} as const;
