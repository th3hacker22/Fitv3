import { db, type WorkoutSession } from "./schema";
import type { Exercise } from "@/types/exercise";
import { estimateOneRepMax } from "@/utils/fitnessMath";
import { countsInVolume, countsForPR } from "@/config/setTypes";

// Helper: Get completed sessions from cache or indexed query.
// Uses the `date` index via .orderBy("date") so we don't do a full-table scan.
// The `.filter()` for `completed` is still needed (IndexedDB can't index booleans),
// but it runs on the index-ordered collection, not an unindexed scan.
async function getCompletedSessions(
  preloadedSessions?: WorkoutSession[]
): Promise<WorkoutSession[]> {
  if (preloadedSessions) {
    return preloadedSessions.filter((s) => s.completed === true);
  }
  // Use the indexed `date` field to avoid a full table scan.
  // .orderBy("date") uses the index; .filter() then narrows by boolean.
  return db.workoutSessions.orderBy("date").filter((s) => s.completed === true).toArray();
}

// Helper: Get week key prefixed with year (e.g., "2025-W03") so weeks don't
// collide across years. Previously `W1` of 2024 was indistinguishable from
// `W1` of 2025, causing stale weekly-volume buckets to be merged.
function getWeekKey(date: Date): string {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / 86400000);
  const weekNum = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return `${date.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

// Helper: Local-date key (YYYY-MM-DD) in the user's LOCAL timezone — NOT UTC.
// Fixes timezone bug where workouts done late evening local-time were bucketed
// into the next UTC day, breaking streak detection for non-UTC users.
function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Helper: Whole calendar days between two Dates, robust to DST transitions.
// Computing ms-delta/86400000 with strict === 1 comparison breaks twice a year
// when a DST jump makes the gap 23 or 25 hours. We midnight-truncate both dates
// first, then round to absorb any sub-hour drift.
function calendarDaysBetween(a: Date, b: Date): number {
  const aMid = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const bMid = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((aMid - bMid) / 86400000);
}

// Helper: Common calculation for weekly tonnage/volume
function calculateWeeklyTonnageRaw(weeks: number, sessions: WorkoutSession[]): Map<string, number> {
  const weeklyData = new Map<string, number>();
  for (let i = 0; i < weeks; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i * 7);
    weeklyData.set(getWeekKey(date), 0);
  }
  for (const session of sessions) {
    const weekKey = getWeekKey(new Date(session.date));
    if (weeklyData.has(weekKey)) {
      const vol = session.exercises.reduce(
        (acc, ex) =>
          acc +
          ex.sets.reduce((setAcc, s) => setAcc + (countsInVolume(s.setType) ? s.weight * s.reps : 0), 0),
        0
      );
      weeklyData.set(weekKey, (weeklyData.get(weekKey) || 0) + vol);
    }
  }
  return weeklyData;
}

// Get workout streak (consecutive days)
export async function getWorkoutStreak(preloadedSessions?: WorkoutSession[]): Promise<number> {
  const sessions = await getCompletedSessions(preloadedSessions);
  if (sessions.length === 0) return 0;

  // Normalize session dates to local YYYY-MM-DD keys so a workout logged at
  // 11pm local on Monday isn't bucketed into Tuesday (UTC).
  const dates = [...new Set(sessions.map((s) => localDateKey(new Date(s.date))))].sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );
  if (dates.length === 0) return 0;

  const today = localDateKey();
  const yesterday = localDateKey(new Date(Date.now() - 86400000));
  if (dates[0] !== today && dates[0] !== yesterday) return 0;

  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    // Use calendar-day comparison (DST-safe) instead of raw ms delta.
    const diffDays = calendarDaysBetween(new Date(dates[i - 1]), new Date(dates[i]));
    if (diffDays === 1) streak++;
    else break;
  }
  return streak;
}

// Get Personal Records for each exercise
export async function getPersonalRecords(preloadedSessions?: WorkoutSession[]) {
  const sessions = await getCompletedSessions(preloadedSessions);
  const records = new Map<
    string | number,
    {
      exerciseName: string;
      maxWeight: number;
      max1RM: number;
      weight: number;
      reps: number;
      date: string;
    }
  >();

  for (const session of sessions) {
    for (const ex of session.exercises) {
      // PR-eligible sets: completed AND countsForPR(setType).
      // Excludes warmup, drop, failure, negative, partial, back-off, myo-rep.
      const prEligibleSets = ex.sets.filter((s) => s.completed && countsForPR(s.setType));
      if (prEligibleSets.length === 0) continue;

      let bestSet1RM = 0,
        bestSetWeight = 0,
        bestSetReps = 0;
      for (const s of prEligibleSets) {
        const e1rm = s.estimated1RM ?? estimateOneRepMax(s.weight, s.reps);
        if (e1rm > bestSet1RM) {
          bestSet1RM = e1rm;
          bestSetWeight = s.weight;
          bestSetReps = s.reps;
        }
      }
      if (bestSet1RM <= 0) continue;

      const current = records.get(ex.exerciseId);
      if (!current || bestSet1RM > current.max1RM) {
        records.set(ex.exerciseId, {
          exerciseName: ex.exerciseName,
          maxWeight: bestSetWeight,
          max1RM: bestSet1RM,
          weight: bestSetWeight,
          reps: bestSetReps,
          date: session.date,
        });
      }
    }
  }

  return Array.from(records.entries()).map(([exerciseId, data]) => ({ exerciseId, ...data }));
}

// Get weekly volume (total weight lifted per week)
export async function getWeeklyVolume(weeks: number = 8, preloadedSessions?: WorkoutSession[]) {
  const sessions = await getCompletedSessions(preloadedSessions);
  const data = calculateWeeklyTonnageRaw(weeks, sessions);
  return Array.from(data.entries())
    .map(([week, volume]) => ({ week, volume }))
    .reverse();
}

// Get weekly tonnage (volume)
export async function getWeeklyTonnage(weeks: number = 4, preloadedSessions?: WorkoutSession[]) {
  const sessions = await getCompletedSessions(preloadedSessions);
  const data = calculateWeeklyTonnageRaw(weeks, sessions);
  return Array.from(data.entries())
    .map(([week, tonnage]) => ({ week, tonnage }))
    .reverse();
}

// Get exercise progress over time
export async function getExerciseProgress(
  exerciseId: string | number,
  preloadedSessions?: WorkoutSession[]
) {
  const sessions = await getCompletedSessions(preloadedSessions);
  const progress: { date: string; maxWeight: number }[] = [];

  for (const session of sessions) {
    const ex = session.exercises.find((e) => String(e.exerciseId) === String(exerciseId));
    if (ex && ex.sets.length > 0) {
      progress.push({
        date: session.date.split("T")[0],
        maxWeight: Math.max(...ex.sets.map((s) => s.weight)),
      });
    }
  }
  return progress.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

// Get estimated 1RM progress for an exercise
export async function getEstimated1RM(
  exerciseId: string | number,
  preloadedSessions?: WorkoutSession[]
) {
  const sessions = await getCompletedSessions(preloadedSessions);
  const progress: { date: string; e1rm: number }[] = [];

  for (const session of sessions) {
    const ex = session.exercises.find((e) => String(e.exerciseId) === String(exerciseId));
    if (ex && ex.sets.length > 0) {
      let bestE1rm = 0;
      for (const s of ex.sets) {
        // Only PR-eligible sets count toward the e1RM progression trend.
        if (!s.completed || !countsForPR(s.setType)) continue;
        const e1rm = estimateOneRepMax(s.weight, s.reps);
        if (e1rm > bestE1rm) bestE1rm = e1rm;
      }
      if (bestE1rm > 0) {
        progress.push({
          date: session.date.split("T")[0],
          e1rm: Math.round(bestE1rm * 10) / 10,
        });
      }
    }
  }
  return progress.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

// Get muscle groups volume breakdown.
// Builds a Map<exerciseId, Exercise> ONCE before iterating sessions, turning
// the previous O(S × E) linear scan (2.4M comparisons for 500 sessions × ~100
// exercises) into O(S + E). Volume still only counts completed sets.
export async function getMuscleGroupStats(
  exercises: Exercise[],
  preloadedSessions?: WorkoutSession[]
) {
  const sessions = await getCompletedSessions(preloadedSessions);
  const muscleData = new Map<string, number>();

  // Build index once: O(E) instead of O(S*E)
  const exerciseMap = new Map<string, Exercise>();
  for (const e of exercises) {
    exerciseMap.set(String(e.id), e);
  }

  for (const session of sessions) {
    for (const ex of session.exercises) {
      const exerciseDef = exerciseMap.get(String(ex.exerciseId));
      if (!exerciseDef) continue;
      const volume = ex.sets
        .filter((s) => s.completed && countsInVolume(s.setType))
        .reduce((sum, s) => sum + s.weight * s.reps, 0);
      muscleData.set(
        exerciseDef.muscleGroup,
        (muscleData.get(exerciseDef.muscleGroup) || 0) + volume
      );
    }
  }

  return Array.from(muscleData.entries())
    .map(([muscle, volume]) => ({ muscle, volume }))
    .sort((a, b) => b.volume - a.volume);
}

// Get total stats
export async function getTotalStats(preloadedSessions?: WorkoutSession[]) {
  const sessions = await getCompletedSessions(preloadedSessions);
  const validSessions = sessions.filter((s) => !s.isFreeze);
  const totalWorkouts = validSessions.length;
  // Only count COMPLETED sets toward total volume. Previously skipped/un-checked
  // sets were included, inflating volume for abandoned or partially-finished
  // sessions.
  const totalVolume = validSessions.reduce(
    (acc, s) =>
      acc +
      s.exercises.reduce(
        (exAcc, ex) =>
          exAcc +
          ex.sets
            .filter((set) => set.completed && countsInVolume(set.setType))
            .reduce((setAcc, set) => setAcc + set.weight * set.reps, 0),
        0
      ),
    0
  );
  const totalDuration = validSessions.reduce((acc, s) => acc + s.duration, 0);

  return { totalWorkouts, totalVolume, totalDuration };
}

// ────────────────────────────────────────────────────────────────────────────
// Monthly calendar analytics (B2)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Per-day activity summary for a single calendar day. Used by CalendarPage
 * to shade day cells and by DaySessionsDrawer to show the day's breakdown.
 */
export interface DayActivitySummary {
  /** Local date key YYYY-MM-DD (NOT UTC) — matches the streak helper. */
  dateKey: string;
  /** Number of completed (non-freeze) sessions on this day. */
  sessionCount: number;
  /** Total volume (kg-reps) on this day, respecting countsInVolume. */
  volume: number;
  /** Total duration in seconds across all sessions on this day. */
  duration: number;
  /** Number of distinct exercises trained. */
  exerciseCount: number;
  /** Whether the day has any activity (convenience flag for the grid). */
  isActive: boolean;
}

/**
 * Get all completed workout sessions that fall within a given calendar month.
 *
 * Month is 0-indexed (0 = January, 11 = December) to match JavaScript's Date.
 * Uses local-timezone date keys (YYYY-MM-DD) so a workout logged at 11pm local
 * on Jan 31 isn't bucketed into Feb 1 (UTC) — DST-safe, consistent with
 * getWorkoutStreak.
 *
 * Pure data fetch — callers decide how to render. Tested in isolation.
 *
 * @param year  Full year (e.g. 2026).
 * @param month 0-11.
 * @param preloadedSessions Optional preloaded list (skips the Dexie query).
 */
export async function getSessionsByMonth(
  year: number,
  month: number,
  preloadedSessions?: WorkoutSession[]
): Promise<WorkoutSession[]> {
  // Month boundaries in LOCAL time (not UTC). DST-safe: we midnight-truncate
  // both edges, which handles the 23/25-hour day edge cases.
  const startOfMonth = new Date(year, month, 1, 0, 0, 0, 0);
  const startOfNextMonth = new Date(year, month + 1, 1, 0, 0, 0, 0);

  if (preloadedSessions) {
    // Fast path: filter in-memory from already-loaded sessions.
    return preloadedSessions.filter((s) => {
      if (!s.completed || s.isFreeze) return false;
      const d = new Date(s.date);
      return d >= startOfMonth && d < startOfNextMonth;
    });
  }

  // Indexed query: use the `date` index with .between() to avoid full-table scan.
  // Dexie's .between() is inclusive on both ends by default, so we use
  // { includeLower: true, includeUpper: false } to get [startOfMonth, startOfNextMonth).
  return db.workoutSessions
    .where("date")
    .between(startOfMonth.toISOString(), startOfNextMonth.toISOString(), true, false)
    .filter((s) => s.completed === true && !s.isFreeze)
    .toArray();
}

/**
 * Build a per-day activity summary for an entire month.
 *
 * Returns a Map keyed by local date (YYYY-MM-DD) → DayActivitySummary.
 * Days with no sessions are omitted from the map (callers treat missing keys
 * as inactive). Freeze sessions are excluded (consistent with streak/volume).
 *
 * @param year  Full year.
 * @param month 0-11.
 * @param preloadedSessions Optional preloaded list.
 */
export async function getMonthActivitySummary(
  year: number,
  month: number,
  preloadedSessions?: WorkoutSession[]
): Promise<Map<string, DayActivitySummary>> {
  const monthSessions = await getSessionsByMonth(year, month, preloadedSessions);
  const result = new Map<string, DayActivitySummary>();

  for (const session of monthSessions) {
    if (session.isFreeze) continue;
    const dateKey = localDateKey(new Date(session.date));

    const existing = result.get(dateKey);
    const sessionVolume = session.exercises.reduce(
      (exAcc, ex) =>
        exAcc +
        ex.sets
          .filter((set) => set.completed && countsInVolume(set.setType))
          .reduce((setAcc, set) => setAcc + set.weight * set.reps, 0),
      0
    );
    const exerciseCount = new Set(
      session.exercises
        .filter((ex) => ex.sets.some((set) => set.completed))
        .map((ex) => String(ex.exerciseId))
    ).size;

    if (existing) {
      existing.sessionCount += 1;
      existing.volume += sessionVolume;
      existing.duration += session.duration;
      existing.exerciseCount += exerciseCount;
      existing.isActive = true;
    } else {
      result.set(dateKey, {
        dateKey,
        sessionCount: 1,
        volume: sessionVolume,
        duration: session.duration,
        exerciseCount,
        isActive: true,
      });
    }
  }

  return result;
}

