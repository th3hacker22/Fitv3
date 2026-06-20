/**
 * Muscle Recovery Tracker.
 *
 * Calculates per-muscle recovery status (0-100%) based on when each muscle
 * was last trained. Recovery time depends on muscle size:
 *  - Large (quads, back, chest, hamstrings, glutes): 48h
 *  - Medium (shoulders, traps, abs): 36h
 *  - Small (biceps, triceps, calves, forearms): 24h
 *
 * Status:
 *  - 0-33%: Just trained (red) — needs rest
 *  - 34-66%: Recovering (yellow) — can train but submaximal
 *  - 67-100%: Recovered (green) — ready to train
 */

import type { WorkoutSession } from "@/db/schema";
import { getMuscleIdsForExercise } from "@/utils/muscleMapper";
import type { Exercise } from "@/types/exercise";

// ── Recovery time by muscle group (in hours) ──
const RECOVERY_HOURS: Record<string, number> = {
  // Large muscles — 48h
  "outer-quad": 48,
  "rectus-femoris": 48,
  "vmo": 48,
  "lats": 48,
  "upper-chest": 48,
  "mid-lower-chest": 48,
  "medial-ham": 48,
  "lateral-ham": 48,
  "glute-max": 48,
  "glute-med": 48,
  "lower-back": 48,
  "traps-mid": 48,
  "lower-traps": 48,
  // Medium muscles — 36h
  "front-delt": 36,
  "lateral-delt": 36,
  "post-delt": 36,
  "lat-delt-back": 36,
  "upper-traps": 36,
  "upper-abs": 36,
  "lower-abs": 36,
  "obliques": 36,
  // Small muscles — 24h
  "biceps-long": 24,
  "biceps-short": 24,
  "triceps-long": 24,
  "triceps-lat": 24,
  "triceps-med": 24,
  "gastrocnemius": 24,
  "gastroc-back": 24,
  "soleus": 24,
  "soleus-back": 24,
  "forearm-ext": 24,
  "forearm-flex": 24,
  "forearm-ext-back": 24,
  "forearm-flex-back": 24,
  "adductors": 36,
  "tibialis": 24,
  "neck": 36,
  "neck-back": 36,
  "traps-back": 36,
};

const DEFAULT_RECOVERY_HOURS = 36;

export interface MuscleRecoveryStatus {
  /** Muscle ID (matches AnatomyMap's muscle IDs). */
  muscleId: string;
  /** Recovery percentage 0-100 (100 = fully recovered). */
  recoveryPercent: number;
  /** Hours since last trained. null = never trained. */
  hoursSinceTrained: number | null;
  /** Hours needed for full recovery. */
  recoveryHours: number;
  /** Status label. */
  status: "just-trained" | "recovering" | "recovered" | "never-trained";
  /** Human-readable text like "Recovering · 18h left". */
  label: string;
}

/**
 * Calculate recovery status for all muscles based on session history.
 *
 * @param sessions Completed workout sessions (will be filtered internally)
 * @param exercises Exercise lookup map (for muscle mapping)
 */
export function calculateMuscleRecovery(
  sessions: WorkoutSession[],
  exercises: Exercise[]
): Map<string, MuscleRecoveryStatus> {
  const now = Date.now();
  const exerciseMap = new Map<string, Exercise>();
  for (const e of exercises) {
    exerciseMap.set(String(e.id), e);
  }

  // Find the most recent training date for each muscle ID
  const lastTrainedMap = new Map<string, number>(); // muscleId → timestamp

  const completed = sessions.filter((s) => s.completed === true && !s.isFreeze);
  for (const session of completed) {
    const sessionTime = new Date(session.date).getTime();
    for (const ex of session.exercises) {
      const exerciseDef = exerciseMap.get(String(ex.exerciseId));
      if (!exerciseDef) continue;

      // Only count if at least one set was completed
      const hasCompletedSet = ex.sets.some((s) => s.completed);
      if (!hasCompletedSet) continue;

      const muscleIds = getMuscleIdsForExercise(exerciseDef.target, exerciseDef.secondaryMuscles);
      for (const muscleId of muscleIds) {
        const existing = lastTrainedMap.get(muscleId);
        if (!existing || sessionTime > existing) {
          lastTrainedMap.set(muscleId, sessionTime);
        }
      }
    }
  }

  // Build recovery status for ALL known muscles (from RECOVERY_HOURS + any trained)
  const result = new Map<string, MuscleRecoveryStatus>();
  const allMuscleIds = new Set<string>([
    ...lastTrainedMap.keys(),
    ...Object.keys(RECOVERY_HOURS),
  ]);

  for (const muscleId of allMuscleIds) {
    const lastTrained = lastTrainedMap.get(muscleId);
    const recoveryHours = RECOVERY_HOURS[muscleId] || DEFAULT_RECOVERY_HOURS;

    if (!lastTrained) {
      result.set(muscleId, {
        muscleId,
        recoveryPercent: 100,
        hoursSinceTrained: null,
        recoveryHours,
        status: "never-trained",
        label: "Not trained yet",
      });
      continue;
    }

    const hoursSince = (now - lastTrained) / (1000 * 60 * 60);
    const recoveryPercent = Math.max(0, Math.min(100, Math.round((hoursSince / recoveryHours) * 100)));

    let status: MuscleRecoveryStatus["status"];
    let label: string;

    if (recoveryPercent < 33) {
      status = "just-trained";
      const hoursLeft = Math.ceil(recoveryHours - hoursSince);
      label = `Just trained · ${hoursLeft}h left`;
    } else if (recoveryPercent < 67) {
      status = "recovering";
      const hoursLeft = Math.ceil(recoveryHours - hoursSince);
      label = `Recovering · ${hoursLeft}h left`;
    } else {
      status = "recovered";
      label = "Recovered";
    }

    result.set(muscleId, {
      muscleId,
      recoveryPercent,
      hoursSinceTrained: Math.round(hoursSince),
      recoveryHours,
      status,
      label,
    });
  }

  return result;
}

/**
 * Get a summary of recovery status for display.
 */
export function getRecoverySummary(
  recovery: Map<string, MuscleRecoveryStatus>
): {
  recovered: number;
  recovering: number;
  justTrained: number;
  neverTrained: number;
  readyToTrain: string[];
} {
  let recovered = 0, recovering = 0, justTrained = 0, neverTrained = 0;
  const readyToTrain: string[] = [];

  for (const [, status] of recovery) {
    switch (status.status) {
      case "recovered":
        recovered++;
        readyToTrain.push(status.muscleId);
        break;
      case "recovering":
        recovering++;
        break;
      case "just-trained":
        justTrained++;
        break;
      case "never-trained":
        neverTrained++;
        readyToTrain.push(status.muscleId);
        break;
    }
  }

  return { recovered, recovering, justTrained, neverTrained, readyToTrain };
}

/**
 * Get recovery color for a muscle (for the AnatomyMap overlay).
 * Returns a hex color or CSS variable.
 */
export function getRecoveryColor(status: MuscleRecoveryStatus | undefined): string {
  if (!status) return "transparent";
  switch (status.status) {
    case "just-trained":
      return "#FF4444"; // red — needs rest
    case "recovering":
      return "#FFAA00"; // orange — recovering
    case "recovered":
      return "#00FF66"; // green — ready
    case "never-trained":
      return "transparent"; // no data
    default:
      return "transparent";
  }
}
