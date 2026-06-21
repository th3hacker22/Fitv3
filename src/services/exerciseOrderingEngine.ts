/**
 * Exercise Ordering Intelligence Layer
 *
 * Reorders exercises within a training day using established strength-training
 * principles:
 *   1. Warm-ups first
 *   2. Compounds before isolation (heaviest neurological demand first)
 *   3. Push/pull alternation (reduces antagonist fatigue)
 *   4. No same-muscle-group back-to-back (allows intra-workout recovery)
 *   5. Antagonistic pairs adjacent (enables superset option)
 *
 * This is a PURE function — no side effects, no state, no I/O.
 * Worst case: returns the original order unchanged.
 */

import type { ProgramExercise } from "./workoutGenerator";
import { classifyMovementPattern, areAntagonisticPatterns } from "./movementPatterns";

/**
 * Optimize the order of exercises within a single training day.
 *
 * @param exercises The selected exercises for one day (from generateProgram)
 * @returns A new array with the same exercises in optimized order
 */
export function optimizeExerciseOrder(exercises: ProgramExercise[]): ProgramExercise[] {
  if (exercises.length <= 1) return [...exercises];

  const result: ProgramExercise[] = [];
  const remaining = [...exercises];

  // ── Rule 1: Warm-ups first ──
  const warmups = remaining.filter((e) => e.role === "warmup" || e.role === "cardio");
  const nonWarmups = remaining.filter((e) => e.role !== "warmup" && e.role !== "cardio");

  result.push(...warmups);
  remaining.length = 0;
  remaining.push(...nonWarmups);

  // ── Rule 2: Compounds before isolation ──
  // Sort remaining by role priority: compound → core → isolation
  const rolePriority: Record<string, number> = {
    compound: 0,
    core: 1,
    isolation: 2,
  };
  remaining.sort((a, b) => (rolePriority[a.role] ?? 3) - (rolePriority[b.role] ?? 3));

  // ── Rules 3+4+5: Greedy alternation ──
  // Pick the next exercise that:
  //   (a) doesn't share the same muscle group as the previous pick
  //   (b) preferably has an antagonistic movement pattern to the previous
  //   (c) if no antagonistic match, pick the highest-priority remaining
  while (remaining.length > 0) {
    if (result.length === 0) {
      // First non-warmup: pick the top compound
      result.push(remaining.shift()!);
      continue;
    }

    const prev = result[result.length - 1];
    const prevPattern = prev.movementPattern ?? classifyMovementPattern(prev.exercise);
    const prevMuscle = prev.exercise.muscleGroup.toLowerCase();
    const prevTarget = prev.exercise.target.toLowerCase();

    // Score each remaining exercise
    let bestIdx = 0;
    let bestScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      const candPattern = candidate.movementPattern ?? classifyMovementPattern(candidate.exercise);
      const candMuscle = candidate.exercise.muscleGroup.toLowerCase();
      const candTarget = candidate.exercise.target.toLowerCase();

      let score = 0;

      // Rule 4: Penalize same muscle group back-to-back
      if (candMuscle === prevMuscle || candTarget === prevTarget) {
        score -= 50;
      }

      // Rule 4b: Also penalize if candidate's secondary muscles overlap with previous
      const prevSecondary = new Set(prev.exercise.secondaryMuscles.map((m) => m.toLowerCase()));
      const candSecondary = candidate.exercise.secondaryMuscles.map((m) => m.toLowerCase());
      if (candSecondary.some((m) => prevSecondary.has(m) || m === prevMuscle)) {
        score -= 15;
      }

      // Rule 3+5: Bonus for antagonistic movement patterns (push after pull, etc.)
      if (areAntagonisticPatterns(prevPattern, candPattern)) {
        score += 30;
      }

      // Rule 3b: Bonus for different movement pattern category (push vs pull vs legs)
      const prevIsPush = prevPattern.includes("push");
      const prevIsPull = prevPattern.includes("pull");
      const candIsPush = candPattern.includes("push");
      const candIsPull = candPattern.includes("pull");

      if ((prevIsPush && candIsPull) || (prevIsPull && candIsPush)) {
        score += 20; // push/pull alternation
      }

      // Prefer higher-priority roles (compounds earlier)
      score += (rolePriority[candidate.role] ?? 3) === 0 ? 5 : 0;

      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    result.push(remaining.splice(bestIdx, 1)[0]);
  }

  return result;
}
