/**
 * Goal Progress Calculator (B3).
 *
 * Pure functions that compute progress toward a goal based on workout
 * session history. No I/O — sessions are passed as a parameter.
 *
 * Goal types:
 *  - VOLUME:   Σ (weight × reps) of completed, countsInVolume sets in the
 *              time frame. For exercise-specific goals, only sets from that
 *              exercise are counted.
 *  - 1RM:      Highest estimated 1RM (Epley formula) of completed,
 *              countsForPR sets in the time frame. For exercise-specific
 *              goals, only sets from that exercise are considered.
 *  - REPS:     Total reps of completed, countsInVolume sets in the time
 *              frame.
 *  - WORKOUTS: Count of completed (non-freeze) sessions in the time frame.
 */

import type { WorkoutSession } from "@/db/schema";
import type { Goal, GoalTimeFrame } from "@/db/schema";
import { estimateOneRepMax } from "@/utils/fitnessMath";
import { countsInVolume, countsForPR } from "@/config/setTypes";

export interface GoalProgress {
  /** The goal being tracked. */
  goal: Goal;
  /** Current progress value (in the same unit as targetValue). */
  current: number;
  /** Target value (convenience — same as goal.targetValue). */
  target: number;
  /** Progress percentage 0-100, capped at 100. */
  percent: number;
  /** Whether the goal has been achieved (current ≥ target). */
  achieved: boolean;
  /** Human-readable label for the current value (e.g. "5,200 kg-reps"). */
  currentLabel: string;
  /** Human-readable label for the target value. */
  targetLabel: string;
}

/**
 * Compute the start of the current time frame (local timezone, DST-safe).
 * - week: start of the current week (Monday 00:00)
 * - month: start of the current month (1st 00:00)
 * - year: start of the current year (Jan 1 00:00)
 */
export function getTimeFrameStart(timeFrame: GoalTimeFrame, now: Date = new Date()): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // local midnight
  switch (timeFrame) {
    case "week": {
      // JS getDay(): 0=Sun, 1=Mon, ..., 6=Sat. We want Monday as start.
      const dayOfWeek = d.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // days since Monday
      d.setDate(d.getDate() - diff);
      return d;
    }
    case "month":
      return new Date(d.getFullYear(), d.getMonth(), 1);
    case "year":
      return new Date(d.getFullYear(), 0, 1);
    default:
      return d;
  }
}

/**
 * Filter sessions to those within the time frame and not deleted/freeze.
 */
function filterSessionsByTimeFrame(
  sessions: WorkoutSession[],
  timeFrame: GoalTimeFrame,
  now: Date = new Date()
): WorkoutSession[] {
  const start = getTimeFrameStart(timeFrame, now).getTime();
  return sessions.filter((s) => {
    if (!s.completed || s.isFreeze) return false;
    return new Date(s.date).getTime() >= start;
  });
}

/**
 * Format a value for display based on goal type.
 */
export function formatGoalValue(type: Goal["type"], value: number): string {
  switch (type) {
    case "volume":
      if (value >= 1000) return `${(value / 1000).toFixed(1)}k kg-reps`;
      return `${Math.round(value)} kg-reps`;
    case "1rm":
      return `${Math.round(value * 10) / 10} kg`;
    case "reps":
      return `${Math.round(value)} reps`;
    case "workouts":
      return `${Math.round(value)} workouts`;
    default:
      return String(Math.round(value));
  }
}

/**
 * Compute progress for a single goal.
 *
 * @param goal The goal to compute progress for.
 * @param sessions All completed workout sessions (will be filtered internally).
 * @param now Optional current time (for testing).
 */
export function computeGoalProgress(
  goal: Goal,
  sessions: WorkoutSession[],
  now: Date = new Date()
): GoalProgress {
  const relevantSessions = filterSessionsByTimeFrame(sessions, goal.timeFrame, now);

  let current = 0;

  switch (goal.type) {
    case "volume": {
      for (const session of relevantSessions) {
        for (const ex of session.exercises) {
          // If exercise-specific, skip non-matching exercises.
          if (goal.exerciseId && String(ex.exerciseId) !== String(goal.exerciseId)) continue;
          for (const set of ex.sets) {
            if (!set.completed || !countsInVolume(set.setType)) continue;
            current += set.weight * set.reps;
          }
        }
      }
      break;
    }

    case "1rm": {
      let bestE1RM = 0;
      for (const session of relevantSessions) {
        for (const ex of session.exercises) {
          if (goal.exerciseId && String(ex.exerciseId) !== String(goal.exerciseId)) continue;
          for (const set of ex.sets) {
            if (!set.completed || !countsForPR(set.setType)) continue;
            const e1rm = set.estimated1RM ?? estimateOneRepMax(set.weight, set.reps);
            if (e1rm > bestE1RM) bestE1RM = e1rm;
          }
        }
      }
      current = bestE1RM;
      break;
    }

    case "reps": {
      for (const session of relevantSessions) {
        for (const ex of session.exercises) {
          if (goal.exerciseId && String(ex.exerciseId) !== String(goal.exerciseId)) continue;
          for (const set of ex.sets) {
            if (!set.completed || !countsInVolume(set.setType)) continue;
            current += set.reps;
          }
        }
      }
      break;
    }

    case "workouts": {
      // Count sessions. If exercise-specific, only count sessions that
      // include the target exercise.
      if (goal.exerciseId) {
        current = relevantSessions.filter((s) =>
          s.exercises.some(
            (ex) => String(ex.exerciseId) === String(goal.exerciseId) &&
              ex.sets.some((set) => set.completed)
          )
        ).length;
      } else {
        current = relevantSessions.length;
      }
      break;
    }
  }

  const target = goal.targetValue;
  const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const achieved = current >= target && target > 0;

  return {
    goal,
    current,
    target,
    percent,
    achieved,
    currentLabel: formatGoalValue(goal.type, current),
    targetLabel: formatGoalValue(goal.type, target),
  };
}

/**
 * Compute progress for multiple goals in batch.
 * More efficient than calling computeGoalProgress in a loop because
 * the sessions array is filtered once per time frame.
 */
export function computeAllGoalProgress(
  goals: Goal[],
  sessions: WorkoutSession[],
  now: Date = new Date()
): GoalProgress[] {
  return goals.map((goal) => computeGoalProgress(goal, sessions, now));
}
