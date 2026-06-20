import { db, type WorkoutSession } from "./schema";
import type { Exercise } from "@/types/exercise";
import { estimateOneRepMax } from "@/utils/fitnessMath";

// Helper: Get completed sessions from cache or indexed query
async function getCompletedSessions(
  preloadedSessions?: WorkoutSession[]
): Promise<WorkoutSession[]> {
  // NOTE: We avoid .where("completed").equals(true) because IndexedDB cannot
  // index boolean values — it throws "IDBKeyRange: The parameter is not a valid key."
  // Use .filter() instead, which is a collection scan but correct.
  return preloadedSessions
    ? preloadedSessions.filter((s) => s.completed === true)
    : db.workoutSessions.filter((s) => s.completed === true).toArray();
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
        (acc, ex) => acc + ex.sets.reduce((setAcc, s) => setAcc + s.weight * s.reps, 0),
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
      const completedSets = ex.sets.filter((s) => s.completed);
      if (completedSets.length === 0) continue;

      let bestSet1RM = 0,
        bestSetWeight = 0,
        bestSetReps = 0;
      for (const s of completedSets) {
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
        if (!s.completed) continue;
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
        .filter((s) => s.completed)
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
            .filter((set) => set.completed)
            .reduce((setAcc, set) => setAcc + set.weight * set.reps, 0),
        0
      ),
    0
  );
  const totalDuration = validSessions.reduce((acc, s) => acc + s.duration, 0);

  return { totalWorkouts, totalVolume, totalDuration };
}
