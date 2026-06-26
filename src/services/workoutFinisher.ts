/**
 * Workout Finisher — pure helpers extracted from useWorkoutStore.finishWorkout.
 *
 * Each function is independently testable and has a single responsibility.
 * The store action orchestrates them but delegates the logic here.
 */

import type { WorkoutSession, ExerciseSetData } from "@/db/schema";
import type { WorkoutExerciseItem } from "@/store/useWorkoutStore";
import { uid } from "@/utils/id";
import { estimateOneRepMax } from "@/utils/fitnessMath";
import { countsForPR } from "@/config/setTypes";

/**
 * Build a WorkoutSession from the active workout state.
 * Filters to only exercises with at least one completed set, and only
 * completed sets within each exercise. Computes estimated1RM + persists
 * setType for each set.
 */
export function buildSession(
  exercises: WorkoutExerciseItem[],
  startedAt: number
): WorkoutSession {
  const now = new Date().toISOString();
  const duration = Math.floor((Date.now() - startedAt) / 1000);

  return {
    id: uid(),
    name: `Pulse Workout ${new Date().toLocaleDateString("en-US")}`,
    date: now,
    duration,
    exercises: exercises
      .filter((e) => e.sets.some((s) => s.completed))
      .map((e) => ({
        exerciseId: e.exerciseId,
        exerciseName: e.exerciseName,
        notes: e.notes,
        sets: e.sets
          .filter((s) => s.completed)
          .map((s): ExerciseSetData => {
            const w = Number(s.weight) || 0;
            const r = Number(s.reps) || 0;
            return {
              weight: w,
              reps: r,
              rpe: s.rpe ? Number(s.rpe) : undefined,
              completed: true,
              estimated1RM: estimateOneRepMax(w, r),
              setType: s.setType ?? "normal",
            };
          }),
      })),
    completed: true,
    createdAt: now,
    updatedAt: now,
  };
}

export interface PRDetectionResult {
  /** Number of new PRs found in this session. */
  count: number;
  /** Details of each new PR for announcements (toast, voice, notification). */
  newPRs: Array<{
    exerciseId: string;
    exerciseName: string;
    weight: number;
    reps: number;
    estimated1RM: number;
  }>;
}

/**
 * Detect new personal records by comparing this session's best PR-eligible
 * e1RM per exercise against the user's prior bests.
 *
 * Only PR-eligible set types are considered (excludes warmup, drop_set,
 * failure, negative, partial, back_off, myo_reps — see src/config/setTypes.ts).
 */
export function detectNewPRs(
  session: WorkoutSession,
  priorBests: Map<string, number>
): PRDetectionResult {
  const newPRs: PRDetectionResult["newPRs"] = [];

  for (const ex of session.exercises) {
    let sessionMax1RM = 0;
    let bestSetWeight = 0;
    let bestSetReps = 0;

    for (const s of ex.sets) {
      if (!countsForPR(s.setType)) continue;
      const e1rm = s.estimated1RM || 0;
      if (e1rm > sessionMax1RM) {
        sessionMax1RM = e1rm;
        bestSetWeight = s.weight;
        bestSetReps = s.reps;
      }
    }

    if (sessionMax1RM <= 0) continue;

    const prior = priorBests.get(String(ex.exerciseId)) ?? 0;
    if (sessionMax1RM > prior) {
      newPRs.push({
        exerciseId: String(ex.exerciseId),
        exerciseName: ex.exerciseName,
        weight: bestSetWeight,
        reps: bestSetReps,
        estimated1RM: sessionMax1RM,
      });
    }
  }

  return { count: newPRs.length, newPRs };
}

/**
 * Compute total volume of a session (sum of weight × reps for all
 * completed sets). Used for social feed posts and challenge sync.
 */
export function computeSessionVolume(session: WorkoutSession): number {
  return session.exercises.reduce(
    (sum, ex) => sum + ex.sets.reduce((sSum, set) => sSum + set.weight * set.reps, 0),
    0
  );
}
