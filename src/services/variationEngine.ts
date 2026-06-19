/**
 * Exercise Variation Rotation Engine.
 *
 * The body adapts to the same exercises after ~4-6 weeks. Rotating variations
 * (e.g., barbell bench → dumbbell bench → incline bench) provides novel
 * stimulus while preserving the movement pattern.
 *
 * This engine groups exercises by MOVEMENT PATTERN + TARGET MUSCLE, then
 * recommends a rotation when the user has done the same exercise for >= 4
 * consecutive weeks.
 */

import type { Exercise } from "@/types/exercise";
import type { WorkoutSession } from "@/db/schema";
import { classifyMovementPattern, type MovementPattern } from "./movementPatterns";

// ── Types ──

export interface VariationGroup {
  /** Canonical movement pattern that defines this group. */
  pattern: MovementPattern;
  /** Target muscle keyword (e.g., "chest", "lats"). */
  targetMuscle: string;
  /** All exercises in this group (same pattern + target). */
  exercises: Exercise[];
}

export interface VariationRecommendation {
  /** The exercise the user has been doing for too long. */
  currentExerciseId: string;
  /** How many consecutive weeks the user has done this exercise. */
  consecutiveWeeks: number;
  /** Suggested alternative exercise (same pattern + target). */
  suggestedAlternative: Exercise | null;
  /** All viable alternatives (including the suggestion). */
  allAlternatives: Exercise[];
  /** Human-readable reason. */
  reason: string;
}

// ── Build variation groups ──

/**
 * Group all available exercises by (movementPattern, targetMuscle).
 * Exercises in the same group are valid rotation alternatives for each other.
 */
export function buildVariationGroups(exercises: Exercise[]): Map<string, VariationGroup> {
  const groups = new Map<string, VariationGroup>();

  for (const ex of exercises) {
    const pattern = classifyMovementPattern(ex);
    if (pattern === "other") continue; // skip unclassifiable

    const targetMuscle = (ex.target || "").toLowerCase().split(/[^a-z]+/i)[0] || "unknown";
    const key = `${pattern}::${targetMuscle}`;

    let group = groups.get(key);
    if (!group) {
      group = {
        pattern,
        targetMuscle,
        exercises: [],
      };
      groups.set(key, group);
    }
    group.exercises.push(ex);
  }

  // Filter out groups with only 1 exercise (no rotation possible)
  const filtered = new Map<string, VariationGroup>();
  for (const [key, group] of groups) {
    if (group.exercises.length >= 2) {
      filtered.set(key, group);
    }
  }

  return filtered;
}

// ── Detect exercises that need rotation ──

/**
 * Analyze session history and find exercises that have been performed for
 * >= 4 consecutive weeks. Returns rotation recommendations for each.
 */
export function detectRotationNeeds(
  sessions: WorkoutSession[],
  exercises: Exercise[],
  thresholdWeeks = 4
): VariationRecommendation[] {
  const completed = sessions
    .filter((s) => s.completed === true)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (completed.length === 0) return [];

  // Build a per-exercise list of session dates
  const exerciseDates = new Map<string, Date[]>();
  for (const s of completed) {
    for (const ex of s.exercises) {
      const id = String(ex.exerciseId);
      if (!exerciseDates.has(id)) exerciseDates.set(id, []);
      exerciseDates.get(id)!.push(new Date(s.date));
    }
  }

  // For each exercise, count consecutive weeks (from the most recent backwards)
  const groups = buildVariationGroups(exercises);
  const exerciseMap = new Map(exercises.map((e) => [String(e.id), e]));
  const recommendations: VariationRecommendation[] = [];

  for (const [exerciseId, dates] of exerciseDates) {
    if (dates.length === 0) continue;
    const sortedDates = dates.sort((a, b) => a.getTime() - b.getTime());

    // Count consecutive weeks from the most recent date backwards
    let consecutiveWeeks = 1;
    for (let i = sortedDates.length - 1; i > 0; i--) {
      const diffDays = Math.round(
        (sortedDates[i].getTime() - sortedDates[i - 1].getTime()) / 86400000
      );
      if (diffDays <= 10 && diffDays >= 3) {
        // Trained this exercise within the same ~1-week window → consecutive
        consecutiveWeeks++;
      } else if (diffDays > 14) {
        // Gap of 2+ weeks → chain broken
        break;
      }
    }

    if (consecutiveWeeks >= thresholdWeeks) {
      const currentEx = exerciseMap.get(exerciseId);
      if (!currentEx) continue;

      const pattern = classifyMovementPattern(currentEx);
      const targetMuscle = (currentEx.target || "").toLowerCase().split(/[^a-z]+/i)[0] || "unknown";
      const groupKey = `${pattern}::${targetMuscle}`;
      const group = groups.get(groupKey);

      if (!group) continue;

      // Find alternatives the user has NOT done in the last 2 weeks
      const recentCutoff = Date.now() - 14 * 86400000;
      const alternatives = group.exercises.filter((alt) => {
        if (alt.id === exerciseId) return false;
        const altDates = exerciseDates.get(String(alt.id)) || [];
        return !altDates.some((d) => d.getTime() > recentCutoff);
      });

      if (alternatives.length === 0) continue;

      // Pick the alternative not done for the longest time (or never done)
      alternatives.sort((a, b) => {
        const aDates = exerciseDates.get(String(a.id)) || [];
        const bDates = exerciseDates.get(String(b.id)) || [];
        const aLast = aDates.length > 0 ? aDates[aDates.length - 1].getTime() : 0;
        const bLast = bDates.length > 0 ? bDates[bDates.length - 1].getTime() : 0;
        return aLast - bLast; // smallest (oldest) first
      });

      const suggested = alternatives[0];
      recommendations.push({
        currentExerciseId: exerciseId,
        consecutiveWeeks,
        suggestedAlternative: suggested,
        allAlternatives: alternatives,
        reason: `${currentEx.name} has been performed for ${consecutiveWeeks} consecutive weeks. Rotate to ${suggested.name} to provide novel stimulus while preserving the same movement pattern.`,
      });
    }
  }

  return recommendations;
}
