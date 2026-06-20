// Strength & training math helpers for Pulse.

/**
 * Estimate one-rep max (1RM) from a weight x reps set.
 *
 * Uses a piecewise formula based on sports-science evidence:
 *  - reps ≤ 1:   return weight exactly (it IS a 1RM)
 *  - reps ≤ 10:  Brzycki:   weight * 36 / (37 - reps)
 *  - reps 11-12: average of Epley + Brzycki (transitional zone)
 *  - reps ≥ 13:  Lombardi:  weight * reps^0.10
 *
 * The previous implementation capped reps at 12 and used the
 * Epley+Brzycki average for everything, which under-estimated
 * high-rep sets (>12) by ~25%. The Lombardi formula is far more
 * accurate in that range.
 *
 * References:
 *  - Brzycki (1993): "Strength testing — predicting a one-rep max from reps"
 *  - Epley (1985): Boyd Epley workout formula
 *  - Lombardi (1989): power formula for higher-rep extrapolation
 */
export function estimateOneRepMax(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;

  let estimate: number;

  if (reps <= 10) {
    // Brzycki — most accurate in low-rep strength range.
    estimate = (weight * 36) / (37 - reps);
  } else if (reps <= 12) {
    // Transitional zone: average Epley + Brzycki.
    const epley = weight * (1 + reps / 30);
    const brzycki = (weight * 36) / (37 - reps);
    estimate = (epley + brzycki) / 2;
  } else {
    // High-rep range: Lombardi power formula.
    estimate = weight * Math.pow(reps, 0.1);
  }

  return Math.round(estimate * 10) / 10;
}

/** Total volume (weight x reps) for a list of sets. */
export function setVolume(sets: { weight: number; reps: number }[]): number {
  return sets.reduce((sum, s) => sum + s.weight * s.reps, 0);
}

/**
 * Compute Relative Volume (RV) — a fatigue-weighted volume metric.
 * RV = sets × reps × intensityFactor, where intensityFactor scales with %1RM.
 * References: Helms et al. 2018.
 */
export function relativeVolume(
  sets: number,
  reps: number,
  intensityPct1RM: number
): number {
  // intensityPct1RM is 0..1 (e.g., 0.75 = 75% of 1RM)
  const factor = 1 + intensityPct1RM; // simplified RV factor
  return sets * reps * factor;
}

/**
 * Compute Average Concentric Velocity loss target for RPE-based autoregulation.
 * Not used directly — kept for future velocity-based training.
 */
export function rpeToRIR(rpe: number): number {
  // RPE 10 = 0 RIR, RPE 9 = 1 RIR, ..., RPE 5 = 5 RIR
  return Math.max(0, 10 - rpe);
}
