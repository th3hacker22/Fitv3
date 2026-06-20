/**
 * Deload Week Auto-Scheduling Engine.
 *
 * A "deload week" is a planned recovery phase where volume and intensity are
 * reduced by ~40% to allow fatigue to dissipate and supercompensation to occur.
 *
 * Triggers (any one is sufficient):
 * 1. TIME-BASED: 4-6 weeks since the last deload (planned, proactive)
 * 2. ACWR-BASED: ACWR > 1.5 (reactive — already in the fatigue engine, but
 *    we surface it here for the scheduler)
 * 3. PERFORMANCE-BASED: e1RM has decreased for 2+ consecutive sessions on
 *    multiple exercises (regression trend)
 *
 * Default cadence: every 5 weeks (range 4-6). Users aged 50+ get every 4 weeks.
 *
 * During a deload week:
 * - Sets reduced by 40% (e.g., 4 → 2-3)
 * - Intensity reduced by 10-15% (RPE cap at 7)
 * - Exercise selection: same movements, simpler variations
 * - No PR attempts
 */

import type { WorkoutSession } from "@/db/schema";
import type { GeneratorProfile } from "@/store/useGeneratorStore";
import type { FatigueAssessment } from "./fatigueEngine";
import type { ExerciseHistoryEntry } from "./overloadEngine";

// ── Types ──

export type DeloadTrigger = "time-based" | "acwr-based" | "performance-based" | "none";

export interface DeloadRecommendation {
  /** True if a deload is recommended this week. */
  shouldDeload: boolean;
  /** Which trigger fired (highest-priority first). */
  trigger: DeloadTrigger;
  /** How many weeks since the last deload (or since training start). */
  weeksSinceLastDeload: number;
  /** Recommended deload duration in weeks (usually 1, sometimes 2 for severe fatigue). */
  deloadDurationWeeks: number;
  /** Volume multiplier to apply (0.6 = reduce 40%). */
  volumeMultiplier: number;
  /** Intensity cap (RPE) — don't exceed this during deload. */
  rpeCap: number;
  /** Human-readable explanation. */
  explanation: string;
}

// ── Constants ──

const STANDARD_DELOAD_INTERVAL_WEEKS = 5; // average of 4-6
const MIN_DELOAD_INTERVAL_WEEKS = 4;
const OLDER_USER_DELOAD_INTERVAL_WEEKS = 4; // age 50+

// ── Detect last deload from session history ──
// A deload session is heuristically detected as: volume < 60% of the user's
// 4-week average volume, AND at least 3 exercises performed (so it's a real
// session, not a rest day).

function detectLastDeloadDate(sessions: WorkoutSession[]): Date | null {
  if (sessions.length < 5) return null;

  const completed = sessions
    .filter((s) => s.completed === true && !s.isFreeze)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (completed.length < 5) return null;

  // Compute per-session volume
  const sessionVolumes = completed.map((s) => ({
    date: new Date(s.date),
    volume: s.exercises.reduce(
      (exAcc, ex) =>
        exAcc + ex.sets.filter((set) => set.completed).reduce((a, set) => a + set.weight * set.reps, 0),
      0
    ),
    exerciseCount: s.exercises.length,
  }));

  // Compute rolling 4-week average volume (excluding the current session)
  for (let i = sessionVolumes.length - 1; i >= 4; i--) {
    const window = sessionVolumes.slice(Math.max(0, i - 4), i);
    const avgVolume = window.reduce((sum, sv) => sum + sv.volume, 0) / window.length;
    const current = sessionVolumes[i];
    if (
      current.exerciseCount >= 3 &&
      current.volume < avgVolume * 0.6 // 40%+ volume drop
    ) {
      return current.date;
    }
  }

  return null;
}

// ── Detect performance regression ──
// True if 2+ exercises show a "decreasing" trend in the last 2 weeks.

function detectPerformanceRegression(
  history: Map<string, ExerciseHistoryEntry>
): { regression: boolean; affectedExercises: string[] } {
  const now = Date.now();
  const TWO_WEEKS_MS = 14 * 86400000;
  const affected: string[] = [];

  for (const [id, entry] of history) {
    if (entry.trend !== "decreasing") continue;
    const sessionAge = now - new Date(entry.lastDate).getTime();
    if (sessionAge <= TWO_WEEKS_MS) {
      affected.push(id);
    }
  }

  return {
    regression: affected.length >= 2,
    affectedExercises: affected,
  };
}

// ── Main: assess deload need ──

export function assessDeloadNeed(
  sessions: WorkoutSession[],
  profile: GeneratorProfile,
  fatigue?: FatigueAssessment,
  exerciseHistory?: Map<string, ExerciseHistoryEntry>
): DeloadRecommendation {
  const lastDeload = detectLastDeloadDate(sessions);
  const now = new Date();

  // Weeks since last deload (or since first session if never deloaded)
  const referenceDate = lastDeload ?? (sessions.length > 0
    ? new Date(sessions[sessions.length - 1].date)
    : now);
  const weeksSinceLastDeload = Math.max(
    0,
    Math.floor((now.getTime() - referenceDate.getTime()) / (7 * 86400000))
  );

  // Determine the deload interval based on age
  const intervalWeeks = profile.age >= 50 ? OLDER_USER_DELOAD_INTERVAL_WEEKS : STANDARD_DELOAD_INTERVAL_WEEKS;

  // ── Check triggers (priority: ACWR > performance > time) ──
  // ACWR-based (reactive)
  if (fatigue && fatigue.shouldDeload) {
    return {
      shouldDeload: true,
      trigger: "acwr-based",
      weeksSinceLastDeload,
      deloadDurationWeeks: 1,
      volumeMultiplier: 0.6,
      rpeCap: 7,
      explanation: `ACWR is ${fatigue.acwr.toFixed(2)} (>1.5) — high injury risk. Deload week recommended immediately.`,
    };
  }

  // Performance-based (2+ exercises regressing)
  if (exerciseHistory) {
    const perfCheck = detectPerformanceRegression(exerciseHistory);
    if (perfCheck.regression) {
      return {
        shouldDeload: true,
        trigger: "performance-based",
        weeksSinceLastDeload,
        deloadDurationWeeks: 1,
        volumeMultiplier: 0.7,
        rpeCap: 7,
        explanation: `Performance regression detected on ${perfCheck.affectedExercises.length} exercises. Deload week recommended to allow recovery.`,
      };
    }
  }

  // Time-based (planned, proactive)
  if (weeksSinceLastDeload >= intervalWeeks) {
    const isOlder = profile.age >= 50;
    return {
      shouldDeload: true,
      trigger: "time-based",
      weeksSinceLastDeload,
      deloadDurationWeeks: 1,
      volumeMultiplier: 0.6,
      rpeCap: 7,
      explanation: `It's been ${weeksSinceLastDeload} weeks since your last deload (recommended every ${intervalWeeks} weeks${isOlder ? " for age 50+" : ""}). Plan a deload week.`,
    };
  }

  // No deload needed
  const weeksUntilNext = intervalWeeks - weeksSinceLastDeload;
  return {
    shouldDeload: false,
    trigger: "none",
    weeksSinceLastDeload,
    deloadDurationWeeks: 0,
    volumeMultiplier: 1.0,
    rpeCap: 10,
    explanation: `Next planned deload in ${weeksUntilNext} week${weeksUntilNext === 1 ? "" : "s"}.`,
  };
}
