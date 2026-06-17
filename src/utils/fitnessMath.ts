// Strength & training math helpers for Pulse.

/**
 * Estimate one-rep max (1RM) from a weight x reps set.
 *
 * The classic Epley formula (w * (1 + reps/30)) drifts high at large rep
 * counts. We average Epley with Brzycki and cap reps at 12, since 1RM
 * estimates lose accuracy beyond ~10-12 reps. A 1-rep set returns the
 * weight itself.
 */
export function estimateOneRepMax(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;

  const r = Math.min(reps, 12);

  const epley = weight * (1 + r / 30);
  // Brzycki: weight * 36 / (37 - reps); guard the denominator.
  const brzycki = weight * (36 / (37 - r));

  const estimate = (epley + brzycki) / 2;
  return Math.round(estimate * 10) / 10;
}

/** Total volume (weight x reps) for a list of sets. */
export function setVolume(sets: { weight: number; reps: number }[]): number {
  return sets.reduce((sum, s) => sum + s.weight * s.reps, 0);
}
