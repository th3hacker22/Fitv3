/**
 * Warmup Set Calculator.
 *
 * Generates a sequence of warmup sets that ramp from empty bar to the
 * working weight, following the RAMP protocol (Reps/Added weight/Maximally
 * Productive). The protocol:
 *
 *  - 5-6 warmup sets total (including empty bar)
 *  - First set: empty bar (20kg) for 10-15 reps
 *  - Each subsequent set: ~20% jump in weight, ~40% drop in reps
 *  - Last warmup set: ~90% of working weight for 1-3 reps
 *  - Never exceed 5 reps on the last warmup (avoid fatigue)
 *
 * For bodyweight exercises (no weight), returns an empty array — no warmup
 * sets needed (the user should do dynamic stretching instead).
 */

export interface WarmupSet {
  weight: number; // kg
  reps: number;
  /** Percentage of working weight (for display). */
  percentOfWorking: number;
  /** Label like "Empty bar", "Light", "Moderate", "Heavy". */
  label: string;
}

const EMPTY_BAR_WEIGHT = 20; // standard Olympic barbell

/**
 * Calculate warmup sets for a given working weight.
 *
 * @param workingWeight The target weight for the first working set (kg)
 * @param exerciseEquipment The exercise's equipment type (for barbell/dumbbell detection)
 * @returns Array of warmup sets (empty if bodyweight or weight too low)
 */
export function calculateWarmupSets(
  workingWeight: number,
  exerciseEquipment: string = ""
): WarmupSet[] {
  // Bodyweight exercises — no weighted warmup needed
  const eq = exerciseEquipment.toLowerCase();
  if (eq.includes("body weight") || workingWeight <= 0) {
    return [];
  }

  // If working weight is very low (< 40kg), don't over-warmup
  // Just do 2-3 light sets
  if (workingWeight < 40) {
    const sets: WarmupSet[] = [];
    if (workingWeight > EMPTY_BAR_WEIGHT) {
      sets.push({
        weight: EMPTY_BAR_WEIGHT,
        reps: 10,
        percentOfWorking: Math.round((EMPTY_BAR_WEIGHT / workingWeight) * 100),
        label: "Empty bar",
      });
    }
    sets.push({
      weight: Math.round(workingWeight * 0.6),
      reps: 6,
      percentOfWorking: 60,
      label: "Light",
    });
    sets.push({
      weight: Math.round(workingWeight * 0.85),
      reps: 3,
      percentOfWorking: 85,
      label: "Heavy",
    });
    return sets;
  }

  // Standard RAMP protocol for working weight ≥ 40kg
  const sets: WarmupSet[] = [];

  // Set 1: Empty bar (or first dumbbell weight if dumbbells)
  const isDumbbell = eq.includes("dumbbell");
  const startingWeight = isDumbbell ? Math.max(5, Math.round(workingWeight * 0.2)) : EMPTY_BAR_WEIGHT;
  sets.push({
    weight: startingWeight,
    reps: 12,
    percentOfWorking: Math.round((startingWeight / workingWeight) * 100),
    label: isDumbbell ? "Very light" : "Empty bar",
  });

  // Set 2: ~40% of working weight
  const w2 = Math.round((workingWeight * 0.4) / 2.5) * 2.5; // round to 2.5kg
  sets.push({
    weight: w2,
    reps: 8,
    percentOfWorking: 40,
    label: "Light",
  });

  // Set 3: ~60% of working weight
  const w3 = Math.round((workingWeight * 0.6) / 2.5) * 2.5;
  sets.push({
    weight: w3,
    reps: 5,
    percentOfWorking: 60,
    label: "Moderate",
  });

  // Set 4: ~80% of working weight
  const w4 = Math.round((workingWeight * 0.8) / 2.5) * 2.5;
  sets.push({
    weight: w4,
    reps: 3,
    percentOfWorking: 80,
    label: "Heavy",
  });

  // Set 5: ~90% of working weight (final primer)
  const w5 = Math.round((workingWeight * 0.9) / 2.5) * 2.5;
  sets.push({
    weight: w5,
    reps: 1,
    percentOfWorking: 90,
    label: "Single",
  });

  return sets;
}

/**
 * Estimate the total warmup time in seconds.
 * ~20s per set (load + perform + rest briefly).
 */
export function estimateWarmupTime(sets: WarmupSet[]): number {
  return sets.length * 30; // 30s per set including brief rest
}
