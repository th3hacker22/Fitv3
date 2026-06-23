/**
 * RPE-Based Progressive Overload + MEV/MAV Engine.
 *
 * Replaces the heuristic overload logic with evidence-based autoregulation:
 *
 * - RPE (Rate of Perceived Exertion): 1-10 scale, 10 = absolute max, 9 = 1 rep
 *   in reserve (RIR), 8 = 2 RIR, etc.
 * - Double Progression: hit top of rep range at RPE ≤ 8 → increase weight;
 *   hit bottom of rep range at RPE 9-10 → keep weight; fail rep range → deload.
 * - MEV (Minimum Effective Volume): 10 sets/week per muscle (Beginner).
 * - MAV (Maximum Adaptive Volume): 20 sets/week per muscle (recovery ceiling).
 *
 * References: Helms et al. 2018 (RPE-based training); Schoenfeld et al. 2017 (volume).
 */

import type { Exercise } from "@/types/exercise";
import { getMuscleIdsForExercise } from "@/utils/muscleMapper";
import { estimateOneRepMax, rpeToRIR } from "@/utils/fitnessMath";
import type { WorkoutSession } from "@/db/schema";

// ── Types ──

export interface ExerciseHistoryEntry {
  exerciseId: string;
  /** Most recent session weight (kg). */
  lastWeight: number;
  /** Most recent session reps (top set or average). */
  lastReps: number;
  /** ISO date string of last session. */
  lastDate: string;
  /** Times this exercise has been performed (lifetime). */
  sessionsCompleted: number;
  /** Last estimated 1RM (kg). */
  lastE1RM: number;
  /** Average RPE of last session's working sets (1-10). 0 = not recorded. */
  lastRPE: number;
  /** Whether all prescribed sets were completed at the target rep range. */
  allSetsCompleted: boolean;
  /** Trend in estimated 1RM over the last 3-5 sessions. */
  trend: "increasing" | "plateaued" | "decreasing" | "new";
}

export interface OverloadRecommendation {
  exerciseId: string;
  previousWeight: number | null;
  previousReps: number | null;
  /** Suggested weight for the upcoming session (kg, rounded to nearest 0.5/2.5). */
  suggestedWeight: number | null;
  /** Suggested rep target for the upcoming session. */
  suggestedReps: string | null;
  /** Human-readable explanation. */
  progressionTip: string;
  /** The progression strategy chosen. */
  strategy: "increase-weight" | "add-reps" | "hold" | "deload" | "new-exercise";
}

// ── MEV/MAV per muscle ──

/** Default MEV/MAV by training age (sets/week per muscle group). */
const VOLUME_THRESHOLDS = {
  novice:     { mev: 8,  mav: 16 },
  beginner:   { mev: 10, mav: 20 },
  intermediate:{ mev: 12, mav: 22 },
  advanced:   { mev: 14, mav: 24 },
};

export interface MuscleVolumeStatus {
  muscle: string;
  weeklySets: number;
  mev: number;
  mav: number;
  status: "below-mev" | "optimal" | "above-mav";
  recommendation: "prioritize" | "maintain" | "reduce";
}

/**
 * Compute per-muscle weekly set volume from the last 7 days of sessions.
 * Uses exerciseMap to look up muscle groups.
 */
export function computeMuscleVolumeStatus(
  sessions: WorkoutSession[],
  exerciseMap: Map<string, { muscleGroup: string }>,
  trainingLevel: keyof typeof VOLUME_THRESHOLDS = "beginner"
): MuscleVolumeStatus[] {
  const now = Date.now();
  const SEVEN_DAYS = 7 * 86400000;
  const setsPerMuscle = new Map<string, number>();

  for (const s of sessions) {
    if (!s.completed || s.isFreeze) continue;
    if (now - new Date(s.date).getTime() > SEVEN_DAYS) continue;
    for (const ex of s.exercises) {
      const def = exerciseMap.get(String(ex.exerciseId));
      if (!def) continue;
      const completedSets = ex.sets.filter((set) => set.completed).length;
      setsPerMuscle.set(
        def.muscleGroup,
        (setsPerMuscle.get(def.muscleGroup) || 0) + completedSets
      );
    }
  }

  const thresholds = VOLUME_THRESHOLDS[trainingLevel];
  const allMuscles = new Set<string>([
    ...setsPerMuscle.keys(),
    "Chest", "Back", "Legs", "Shoulders", "Arms", "Core",
  ]);

  return Array.from(allMuscles).map((muscle) => {
    const weeklySets = setsPerMuscle.get(muscle) || 0;
    let status: MuscleVolumeStatus["status"] = "optimal";
    let recommendation: MuscleVolumeStatus["recommendation"] = "maintain";
    if (weeklySets < thresholds.mev) {
      status = "below-mev";
      recommendation = "prioritize";
    } else if (weeklySets > thresholds.mav) {
      status = "above-mav";
      recommendation = "reduce";
    }
    return {
      muscle,
      weeklySets,
      mev: thresholds.mev,
      mav: thresholds.mav,
      status,
      recommendation,
    };
  });
}

// ── RPE-based progressive overload ──

/**
 * Determine the optimal progression strategy for an exercise based on
 * the user's last session performance.
 *
 * Decision tree:
 * - No history → "new-exercise", suggest conservative starting weight
 * - All sets completed AND RPE ≤ 7 → "increase-weight" (+2.5kg upper, +5kg lower)
 * - All sets completed AND RPE 8 → "increase-weight" smaller (+1.25kg upper, +2.5kg lower)
 * - All sets completed AND RPE 9 → "add-reps" (hold weight, +1 rep target)
 * - All sets completed AND RPE 10 → "hold" (max effort, give it a week)
 * - Any set failed OR decreasing trend → "deload" (-10%)
 * - Plateau (no e1RM change in 3+ sessions) → "add-reps" or "increase-weight" tiny
 */
export function calculateProgressiveOverloadRPE(
  exercise: Exercise,
  history: ExerciseHistoryEntry | undefined,
  goal: string
): OverloadRecommendation {
  const exerciseId = String(exercise.id);

  // ── No history: new exercise ──
  if (!history || history.sessionsCompleted === 0) {
    return {
      exerciseId,
      previousWeight: null,
      previousReps: null,
      suggestedWeight: null,
      suggestedReps: null,
      progressionTip:
        "New exercise — start with a conservative weight you can control for all sets with 2 RIR.",
      strategy: "new-exercise",
    };
  }

  const { lastWeight, lastReps, lastRPE, allSetsCompleted, trend, lastE1RM } = history;
  const isLowerBody = /squat|deadlift|leg|glute|calf/i.test(exercise.target);
  const smallIncrement = isLowerBody ? 2.5 : 1.25;
  const bigIncrement = isLowerBody ? 5 : 2.5;

  // ── Decreasing trend or failed sets: deload ──
  if (trend === "decreasing" || !allSetsCompleted) {
    const newWeight = Math.max(0, Math.round((lastWeight * 0.9) / 0.5) * 0.5);
    return {
      exerciseId,
      previousWeight: lastWeight,
      previousReps: lastReps,
      suggestedWeight: newWeight,
      suggestedReps: null,
      progressionTip: `Recent performance declining (RPE ${lastRPE || "?"}, trend ${trend}). Reduce to ${newWeight}kg and focus on form quality.`,
      strategy: "deload",
    };
  }

  // ── RPE-based progression (no RPE recorded = assume RPE 8) ──
  const effectiveRPE = lastRPE || 8;
  const rir = rpeToRIR(effectiveRPE);

  if (effectiveRPE <= 7) {
    // Easy — bump weight significantly
    const newWeight = Math.round((lastWeight + bigIncrement) / 0.5) * 0.5;
    return {
      exerciseId,
      previousWeight: lastWeight,
      previousReps: lastReps,
      suggestedWeight: newWeight,
      suggestedReps: null,
      progressionTip: `Last session: ${lastWeight}kg × ${lastReps} @ RPE ${effectiveRPE} (${rir} RIR). Easy — increase to ${newWeight}kg.`,
      strategy: "increase-weight",
    };
  }

  if (effectiveRPE === 8) {
    // Good — small bump
    const newWeight = Math.round((lastWeight + smallIncrement) / 0.5) * 0.5;
    return {
      exerciseId,
      previousWeight: lastWeight,
      previousReps: lastReps,
      suggestedWeight: newWeight,
      suggestedReps: null,
      progressionTip: `Last session: ${lastWeight}kg × ${lastReps} @ RPE 8 (2 RIR). Increase to ${newWeight}kg.`,
      strategy: "increase-weight",
    };
  }

  if (effectiveRPE === 9) {
    // Hold weight, aim for +1 rep
    return {
      exerciseId,
      previousWeight: lastWeight,
      previousReps: lastReps,
      suggestedWeight: lastWeight,
      suggestedReps: `${lastReps + 1}-${lastReps + 2}`,
      progressionTip: `Last session: ${lastWeight}kg × ${lastReps} @ RPE 9 (1 RIR). Keep weight, aim for ${lastReps + 1}-${lastReps + 2} reps.`,
      strategy: "add-reps",
    };
  }

  // RPE 10 — max effort, hold
  if (trend === "plateaued") {
    return {
      exerciseId,
      previousWeight: lastWeight,
      previousReps: lastReps,
      suggestedWeight: lastWeight,
      suggestedReps: null,
      progressionTip: `Plateau at ${lastWeight}kg (e1RM stable). Hold weight, focus on bar speed and technique for 1 week before attempting PR.`,
      strategy: "hold",
    };
  }

  // RPE 10 (or >10) — give it a week
  return {
    exerciseId,
    previousWeight: lastWeight,
    previousReps: lastReps,
    suggestedWeight: lastWeight,
    suggestedReps: null,
    progressionTip: `Last session: ${lastWeight}kg × ${lastReps} @ RPE ${effectiveRPE} (max effort). Hold weight this week, let fatigue clear.`,
    strategy: "hold",
  };
}

// ── Build ExerciseHistoryEntry from raw sessions ──

/**
 * Build a Map<exerciseId, ExerciseHistoryEntry> from the user's completed sessions.
 * Computes trend by comparing the last 3 sessions' e1RM.
 */
export function buildExerciseHistory(
  sessions: WorkoutSession[],
  exerciseMap?: Map<string, Exercise>
): Map<string, ExerciseHistoryEntry> {
  const completed = sessions
    .filter((s) => s.completed === true)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const byExercise = new Map<string, WorkoutSession[]>();
  for (const s of completed) {
    for (const ex of s.exercises) {
      const id = String(ex.exerciseId);
      if (!byExercise.has(id)) byExercise.set(id, []);
      byExercise.get(id)!.push(s);
    }
  }

  const result = new Map<string, ExerciseHistoryEntry>();
  for (const [exerciseId, sessList] of byExercise) {
    if (sessList.length === 0) continue;
    const last = sessList[sessList.length - 1];
    const lastEx = last.exercises.find((e) => String(e.exerciseId) === exerciseId);
    if (!lastEx || lastEx.sets.length === 0) continue;

    // Find best (highest e1RM) completed set in last session
    let bestWeight = 0, bestReps = 0, bestE1RM = 0, totalRPE = 0, rpeCount = 0;
    let allCompleted = true;
    for (const set of lastEx.sets) {
      if (!set.completed) { allCompleted = false; continue; }
      const e1rm = set.estimated1RM ?? estimateOneRepMax(set.weight, set.reps);
      if (e1rm > bestE1RM) {
        bestE1RM = e1rm;
        bestWeight = set.weight;
        bestReps = set.reps;
      }
      const rpe = parseFloat(String(set.rpe || ""));
      if (!isNaN(rpe) && rpe > 0) {
        totalRPE += rpe;
        rpeCount++;
      }
    }
    if (bestWeight === 0) continue;

    // Compute trend: compare last 3 sessions' best e1RM
    const recentSessions = sessList.slice(-3);
    const e1rms = recentSessions.map((s) => {
      const ex = s.exercises.find((e) => String(e.exerciseId) === exerciseId);
      if (!ex) return 0;
      let best = 0;
      for (const set of ex.sets) {
        if (!set.completed) continue;
        const e = set.estimated1RM ?? estimateOneRepMax(set.weight, set.reps);
        if (e > best) best = e;
      }
      return best;
    }).filter((v) => v > 0);

    let trend: ExerciseHistoryEntry["trend"] = "new";
    if (e1rms.length >= 2) {
      const first = e1rms[0];
      const lastE = e1rms[e1rms.length - 1];
      const delta = (lastE - first) / first;
      if (delta > 0.02) trend = "increasing";
      else if (delta < -0.02) trend = "decreasing";
      else trend = "plateaued";
    }

    result.set(exerciseId, {
      exerciseId,
      lastWeight: bestWeight,
      lastReps: bestReps,
      lastDate: last.date,
      sessionsCompleted: sessList.length,
      lastE1RM: Math.round(bestE1RM * 10) / 10,
      lastRPE: rpeCount > 0 ? Math.round((totalRPE / rpeCount) * 10) / 10 : 0,
      allSetsCompleted: allCompleted,
      trend,
    });
  }

  return result;
}
