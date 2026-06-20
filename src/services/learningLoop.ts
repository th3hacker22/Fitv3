/**
 * Learning Loop — Personalization via behavioral tracking.
 *
 * Tracks how the user INTERACTS with generated programs:
 * - Skips: exercises prescribed but never started (negative signal)
 * - Swaps: exercises replaced via the "shuffle" button (negative signal)
 * - Completions: exercises performed with all sets completed (positive signal)
 * - Failures: exercises performed but with incomplete sets (mixed signal)
 *
 * These signals feed back into the generator's scoring function so that
 * exercises the user dislikes gradually get de-prioritized, and exercises
 * they love get boosted.
 *
 * Storage: IndexedDB (Dexie) — a new table `exerciseFeedback` with one row
 * per (exerciseId, action, timestamp). The engine aggregates these into
 * a per-exercise "preference score".
 */

import { db } from "@/db";
import type { WorkoutSession } from "@/db/schema";

// ── Types ──

export type FeedbackAction = "completed" | "skipped" | "swapped" | "incomplete";

export interface ExerciseFeedbackEntry {
  id?: number; // auto-increment
  exerciseId: string;
  exerciseName: string;
  action: FeedbackAction;
  timestamp: number; // epoch ms
  sessionId?: string; // optional — which session triggered this
  note?: string;
}

export interface ExercisePreferenceScore {
  exerciseId: string;
  /** -100 (strongly disliked) to +100 (loved). 0 = neutral / no data. */
  score: number;
  /** Total times this exercise was prescribed or performed. */
  samples: number;
  /** Breakdown by action. */
  completed: number;
  skipped: number;
  swapped: number;
  incomplete: number;
  /** Completion rate 0-1 (completed / (completed + skipped + swapped + incomplete)). */
  completionRate: number;
  /** True if we have enough samples (≥3) to trust the score. */
  confident: boolean;
}

export interface LearningLoopSummary {
  /** Per-exercise preference scores, keyed by exerciseId. */
  preferences: Map<string, ExercisePreferenceScore>;
  /** Exercises the user clearly dislikes (score < -20 AND confident). */
  disliked: ExercisePreferenceScore[];
  /** Exercises the user loves (score > 20 AND confident). */
  loved: ExercisePreferenceScore[];
  /** Average completion rate across all tracked exercises. */
  avgCompletionRate: number;
}

// ── Recording actions ──

/**
 * Record that the user completed (or partially completed) an exercise.
 * Called after a workout session is saved.
 */
export async function recordCompletion(
  exerciseId: string,
  exerciseName: string,
  allSetsCompleted: boolean,
  sessionId?: string
): Promise<void> {
  const action: FeedbackAction = allSetsCompleted ? "completed" : "incomplete";
  await recordFeedback(exerciseId, exerciseName, action, sessionId);
}

/**
 * Record that the user skipped an exercise (prescribed but never started).
 *
 * The optional `note` carries the user-selected reason (e.g. "too-tired",
 * "equipment-busy", "pain", "dont-like", "time", or a free-text note for
 * "other"). This is fed back into the Learning Loop so the workout generator
 * can de-prioritise exercises the user consistently dislikes.
 */
export async function recordSkip(
  exerciseId: string,
  exerciseName: string,
  sessionId?: string,
  note?: string
): Promise<void> {
  await recordFeedback(exerciseId, exerciseName, "skipped", sessionId, note);
}

/** Record that the user swapped an exercise for an alternative. */
export async function recordSwap(
  exerciseId: string,
  exerciseName: string,
  sessionId?: string,
  note?: string
): Promise<void> {
  await recordFeedback(exerciseId, exerciseName, "swapped", sessionId, note);
}

async function recordFeedback(
  exerciseId: string,
  exerciseName: string,
  action: FeedbackAction,
  sessionId?: string,
  note?: string
): Promise<void> {
  try {
    const entry: ExerciseFeedbackEntry = {
      exerciseId,
      exerciseName,
      action,
      timestamp: Date.now(),
      sessionId,
      note,
    };
    // Dexie table 'exerciseFeedback' must be defined in the schema.
    // We use .put() with auto-increment id.
    await db.exerciseFeedback?.add(entry);
  } catch (err) {
    // Non-fatal — learning loop is best-effort
    console.warn("[learningLoop] Failed to record feedback:", err);
  }
}

// ── Aggregating preferences ──

/**
 * Build a LearningLoopSummary from the feedback history.
 * Looks back up to `lookbackDays` (default 90) of feedback entries.
 *
 * Scoring formula:
 *   completed: +10
 *   incomplete: -3
 *   skipped:   -15
 *   swapped:   -20
 *   score = sum, clamped to [-100, +100]
 *
 *   completionRate = completed / (completed + skipped + swapped + incomplete)
 *
 *   confident = samples >= 3
 */
export async function buildLearningLoopSummary(
  lookbackDays = 90
): Promise<LearningLoopSummary> {
  const cutoff = Date.now() - lookbackDays * 86400000;
  let entries: ExerciseFeedbackEntry[] = [];
  try {
      entries = await db.exerciseFeedback?.where("timestamp")?.above(cutoff)?.toArray() ?? [];
  } catch {
    // Table might not exist yet — return empty summary
  }

  const byExercise = new Map<string, ExercisePreferenceScore>();

  for (const entry of entries) {
    let score = byExercise.get(entry.exerciseId);
    if (!score) {
      score = {
        exerciseId: entry.exerciseId,
        score: 0,
        samples: 0,
        completed: 0,
        skipped: 0,
        swapped: 0,
        incomplete: 0,
        completionRate: 0,
        confident: false,
      };
      byExercise.set(entry.exerciseId, score);
    }
    score.samples++;
    switch (entry.action) {
      case "completed":
        score.completed++;
        score.score += 10;
        break;
      case "incomplete":
        score.incomplete++;
        score.score -= 3;
        break;
      case "skipped":
        score.skipped++;
        score.score -= 15;
        break;
      case "swapped":
        score.swapped++;
        score.score -= 20;
        break;
    }
  }

  // Finalize: clamp score, compute completionRate, set confident flag
  const preferences = new Map<string, ExercisePreferenceScore>();
  let totalCompletion = 0;
  let totalSamples = 0;
  for (const [id, score] of byExercise) {
    score.score = Math.max(-100, Math.min(100, score.score));
    const denom = score.completed + score.skipped + score.swapped + score.incomplete;
    score.completionRate = denom > 0 ? score.completed / denom : 0;
    score.confident = score.samples >= 3;
    preferences.set(id, score);
    if (denom > 0) {
      totalCompletion += score.completionRate;
      totalSamples++;
    }
  }

  const disliked = Array.from(preferences.values())
    .filter((s) => s.confident && s.score < -20)
    .sort((a, b) => a.score - b.score);
  const loved = Array.from(preferences.values())
    .filter((s) => s.confident && s.score > 20)
    .sort((a, b) => b.score - a.score);
  const avgCompletionRate = totalSamples > 0 ? totalCompletion / totalSamples : 0;

  return {
    preferences,
    disliked,
    loved,
    avgCompletionRate,
  };
}

// ── Auto-recording from saved sessions ──

/**
 * Analyze a saved workout session and record feedback for each exercise.
 * - Exercises IN the session with all sets completed → "completed"
 * - Exercises IN the session with some sets not completed → "incomplete"
 * - (Skips/swaps are recorded separately by the UI when the user acts)
 */
export async function recordFeedbackFromSession(
  session: WorkoutSession
): Promise<void> {
  for (const ex of session.exercises) {
    const completedSets = ex.sets.filter((s) => s.completed).length;
    const totalSets = ex.sets.length;
    const allCompleted = completedSets === totalSets && totalSets > 0;
    await recordCompletion(
      String(ex.exerciseId),
      ex.exerciseName,
      allCompleted,
      session.id
    );
  }
}

// ── Scoring helper for the generator ──

/**
 * Returns a score adjustment (typically -20 to +20) for an exercise based on
 * the user's learning-loop preferences. Used by workoutGenerator's scoreEx().
 *
 * - Loved exercises (score > 20): +8 to +15 boost
 * - Disliked exercises (score < -20): -10 to -25 penalty
 * - Below-MEV completion rate (< 0.5): -8 penalty
 * - Neutral / no data: 0
 */
export function getPreferenceAdjustment(
  exerciseId: string,
  summary: LearningLoopSummary
): number {
  const pref = summary.preferences.get(exerciseId);
  if (!pref || !pref.confident) return 0;

  let adj = 0;
  // Linear mapping: score / 100 * 15, clamped
  adj += (pref.score / 100) * 15;

  // Extra penalty for low completion rate even if score is borderline
  if (pref.completionRate < 0.5 && pref.samples >= 3) {
    adj -= 8;
  }

  return Math.max(-25, Math.min(20, Math.round(adj)));
}
