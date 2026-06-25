/**
 * Muscle Recovery Tracker (A3: volume + intensity aware).
 *
 * Calculates per-muscle recovery status (0-100%) based on THREE factors:
 *   1. TIME since the muscle was last trained.
 *   2. VOLUME (sets × weight × reps) of that last session relative to the
 *      user's own rolling average — a heavier-than-average session taxes the
 *      muscle more and slows recovery.
 *   3. INTENSITY (average RPE of completed sets) — high-RPE sets cause more
 *      muscle damage and central fatigue, extending recovery.
 *
 * Effective recovery time:
 *   effectiveHours = baseHours × loadFactor
 *   where loadFactor ∈ [LOAD_FACTOR_MIN, LOAD_FACTOR_MAX] and is a pure
 *   function of (sessionVolume, avgRPE, userAvgVolume).
 *
 * Status bands (UNCHANGED from the time-only version so the AnatomyMap
 * heatmap colors stay consistent):
 *  - 0-33%: Just trained (red) — needs rest
 *  - 34-66%: Recovering (yellow) — can train but submaximal
 *  - 67-100%: Recovered (green) — ready to train
 *
 * Scientific references:
 *  - Muscle damage scales with volume and intensity (Schoenfeld & Contreras
 *    2013, "Muscle activation and hypertrophy").
 *  - Higher RPE (RIR-based) correlates with greater acute fatigue and
 *    delayed recovery (Helms et al. 2018, "RPE in resistance training").
 *  - Large muscles recover slower than small muscles (generic consensus,
 *    ~48h vs ~24h — see Lookup table below).
 */

import type { WorkoutSession } from "@/db/schema";
import { getMuscleIdsForExercise } from "@/utils/muscleMapper";
import type { Exercise } from "@/types/exercise";

// ────────────────────────────────────────────────────────────────────────────
// Tunable constants — exposed at the top of the file so they can be adjusted
// without hunting through the function body. All values are empirically
// chosen to keep loadFactor in a sane range ([0.85, 1.5]); they are NOT
// meant to be biologically precise — the goal is relative differentiation
// between light and heavy sessions.
// ────────────────────────────────────────────────────────────────────────────

/**
 * Multiplier applied per RPE point above 7 (the "moderate" baseline).
 * RPE 8 → +0.05, RPE 9 → +0.10, RPE 10 → +0.15.
 * Cap at RPE 10 so the bump saturates. Reference: Helms 2018.
 */
const RPE_LOAD_BUMP_PER_POINT = 0.05;

/** RPE at which no extra load factor is applied (moderate intensity). */
const RPE_BASELINE = 7;

/**
 * Multiplier applied when sessionVolume equals the user's rolling average.
 * A 1.5× average session → +0.15 volume bump (0.5 above average × 0.30/point).
 * A 0.5× average session → −0.15 (light day, faster recovery).
 */
const VOLUME_LOAD_BUMP_PER_AVG_RATIO_POINT = 0.30;

/**
 * Floor for the load factor. Even a very light session still needs at least
 * 85% of the base recovery time (recovery is never FASTER than baseline).
 */
const LOAD_FACTOR_MIN = 0.85;

/**
 * Ceiling for the load factor. A brutally heavy session caps at 1.5× base
 * recovery so a 48h muscle doesn't suddenly need 96h+ (which would make the
 * muscle permanently "recovering" in a high-frequency program).
 */
const LOAD_FACTOR_MAX = 1.5;

/** Default average RPE when the user never logs RPE (treat as moderate). */
const DEFAULT_AVG_RPE = 7;

/** Default volume used as the user average when there's <2 sessions of history. */
const DEFAULT_USER_AVG_VOLUME = 3000; // kg-reps; ~3 sets × 100kg × 10 reps

// ── Recovery time by muscle group (in hours) ──
// Unchanged from the original time-only version. These are the BASE hours;
// the effective hours = base × loadFactor.
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
  /** Effective hours needed for full recovery (base × loadFactor). */
  recoveryHours: number;
  /** Base recovery hours for this muscle (time-only, before loadFactor). */
  baseRecoveryHours: number;
  /** Multiplier applied to base hours (1.0 = average session). */
  loadFactor: number;
  /** Total volume (kg-reps) of the most recent session that hit this muscle. */
  lastSessionVolume: number | null;
  /** Average RPE of completed sets in the most recent session hitting this muscle. */
  lastSessionAvgRPE: number | null;
  /** Status label. */
  status: "just-trained" | "recovering" | "recovered" | "never-trained";
  /** Human-readable text like "Recovering · 18h left". */
  label: string;
}

/**
 * Per-muscle training data extracted from sessions for the last session that
 * hit each muscle. Used internally by calculateMuscleRecovery and exposed
 * for testing.
 */
interface MuscleTrainingDatum {
  lastTrained: number;
  sessionVolume: number;
  avgRPE: number;
  rpeSetCount: number;
}

/**
 * Aggregate per-muscle training data from completed sessions.
 *
 * For each muscle, finds the most-recent session that targeted it and
 * computes:
 *   - sessionVolume: Σ (weight × reps) of completed sets in exercises that
 *     hit this muscle (in the most-recent session only).
 *   - avgRPE: mean RPE of those completed sets (RPE-missing sets excluded
 *     from the average; if no sets had RPE, falls back to DEFAULT_AVG_RPE).
 *
 * Also computes the user's rolling average volume per session across ALL
 * completed sessions (for load-factor normalization).
 */
function aggregateMuscleData(
  sessions: WorkoutSession[],
  exercises: Exercise[]
): { muscleData: Map<string, MuscleTrainingDatum>; userAvgVolume: number } {
  const exerciseMap = new Map<string, Exercise>();
  for (const e of exercises) {
    exerciseMap.set(String(e.id), e);
  }

  const completed = sessions.filter((s) => s.completed === true && !s.isFreeze);

  // User's average session volume (across all completed sessions).
  const sessionVolumes: number[] = [];

  // Per-muscle: track the most-recent session's volume + RPE.
  const muscleData = new Map<string, MuscleTrainingDatum>();

  // Sort sessions newest-first so we can early-break once all known muscles
  // have been seen. This converts the worst case from O(S×E×sets×muscleIds)
  // to O(S_seen × E × sets × muscleIds) where S_seen is typically <5.
  const sortedSessions = [...completed].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Track which muscles we've already found the most-recent session for.
  const seenMuscles = new Set<string>();

  for (const session of sortedSessions) {
    const sessionTime = new Date(session.date).getTime();

    // Per-session: accumulate volume + RPE per muscle so we only record the
    // muscle's data once per session (even if multiple exercises hit it).
    const sessionMuscleData = new Map<
      string,
      { volume: number; rpeSum: number; rpeCount: number }
    >();

    let totalSessionVolume = 0;

    for (const ex of session.exercises) {
      const exerciseDef = exerciseMap.get(String(ex.exerciseId));
      if (!exerciseDef) continue;

      const muscleIds = getMuscleIdsForExercise(
        exerciseDef.target,
        exerciseDef.secondaryMuscles
      );
      if (muscleIds.length === 0) continue;

      for (const set of ex.sets) {
        if (!set.completed) continue;
        const setVolume = set.weight * set.reps;
        totalSessionVolume += setVolume;

        for (const muscleId of muscleIds) {
          const existing = sessionMuscleData.get(muscleId) ?? {
            volume: 0,
            rpeSum: 0,
            rpeCount: 0,
          };
          existing.volume += setVolume;
          if (typeof set.rpe === "number" && set.rpe > 0) {
            existing.rpeSum += set.rpe;
            existing.rpeCount += 1;
          }
          sessionMuscleData.set(muscleId, existing);
        }
      }
    }

    if (totalSessionVolume > 0) {
      sessionVolumes.push(totalSessionVolume);
    }

    // Record this session's per-muscle data. Since we iterate newest-first,
    // the FIRST session that hits a muscle is its most-recent — we skip
    // writing if the muscle was already seen (older session).
    for (const [muscleId, data] of sessionMuscleData) {
      if (seenMuscles.has(muscleId)) continue;
      seenMuscles.add(muscleId);
      muscleData.set(muscleId, {
        lastTrained: sessionTime,
        sessionVolume: data.volume,
        avgRPE:
          data.rpeCount > 0
            ? data.rpeSum / data.rpeCount
            : DEFAULT_AVG_RPE,
        rpeSetCount: data.rpeCount,
      });
    }

    // Early break: if we've found data for all known muscles, no need to
    // iterate older sessions. The number of known muscles is the size of
    // the RECOVERY_HOURS lookup table (~40). Once seenMuscles covers all
    // of them, further sessions can't add new data.
    if (seenMuscles.size >= Object.keys(RECOVERY_HOURS).length) break;
  }

  const userAvgVolume =
    sessionVolumes.length >= 2
      ? sessionVolumes.reduce((a, b) => a + b, 0) / sessionVolumes.length
      : DEFAULT_USER_AVG_VOLUME;

  return { muscleData, userAvgVolume };
}

/**
 * Compute the load factor that scales the base recovery hours.
 *
 *   loadFactor = 1
 *             + volumeBump     // relative to the user's average session volume
 *             + rpeBump        // relative to RPE 7 (moderate) baseline
 *
 * Bumps can be negative (light session / low RPE → faster recovery), but the
 * total is clamped to [LOAD_FACTOR_MIN, LOAD_FACTOR_MAX].
 *
 * Pure function — exported for unit testing.
 *
 * @param sessionVolume Volume (kg-reps) of the most-recent session hitting
 *   this muscle. 0 means "no data" → treated as average (loadFactor = 1).
 * @param avgRPE Average RPE of completed sets in that session. Falls back to
 *   DEFAULT_AVG_RPE (7) when undefined/NaN.
 * @param userAvgVolume The user's rolling average session volume (for
 *   normalization). Falls back to DEFAULT_USER_AVG_VOLUME.
 */
export function computeLoadFactor(
  sessionVolume: number,
  avgRPE: number | undefined,
  userAvgVolume: number
): number {
  // ── Volume bump ──
  // volumeRatio = sessionVolume / userAvgVolume
  // volumeBump = (volumeRatio - 1) × VOLUME_LOAD_BUMP_PER_AVG_RATIO_POINT
  // A session at 2× average → +0.30; at 0.5× average → −0.15.
  const safeAvg = userAvgVolume > 0 ? userAvgVolume : DEFAULT_USER_AVG_VOLUME;
  const volumeRatio = sessionVolume > 0 ? sessionVolume / safeAvg : 1;
  const volumeBump = (volumeRatio - 1) * VOLUME_LOAD_BUMP_PER_AVG_RATIO_POINT;

  // ── RPE bump ──
  // Only bumps UP when RPE > baseline; low RPE doesn't speed recovery below
  // the base (the LOAD_FACTOR_MIN floor already protects against that).
  const rpe = typeof avgRPE === "number" && !isNaN(avgRPE) ? avgRPE : DEFAULT_AVG_RPE;
  const rpeExcess = Math.max(0, rpe - RPE_BASELINE);
  const rpeBump = rpeExcess * RPE_LOAD_BUMP_PER_POINT;

  // Clamp to [LOAD_FACTOR_MIN, LOAD_FACTOR_MAX].
  const raw = 1 + volumeBump + rpeBump;
  return Math.max(LOAD_FACTOR_MIN, Math.min(LOAD_FACTOR_MAX, raw));
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
  const { muscleData, userAvgVolume } = aggregateMuscleData(sessions, exercises);

  // Build recovery status for ALL known muscles
  const result = new Map<string, MuscleRecoveryStatus>();
  const allMuscleIds = new Set<string>([
    ...muscleData.keys(),
    ...Object.keys(RECOVERY_HOURS),
    // Add common muscle IDs that might not be in RECOVERY_HOURS
    "upper-chest", "mid-lower-chest",
    "front-delt", "lateral-delt", "post-delt", "lat-delt-back",
    "biceps-long", "biceps-short",
    "triceps-long", "triceps-lat", "triceps-med",
    "outer-quad", "rectus-femoris", "vmo",
    "medial-ham", "lateral-ham",
    "glute-max", "glute-med",
    "upper-abs", "lower-abs", "obliques",
    "upper-traps", "traps-mid", "lower-traps", "traps-back",
    "lower-back",
    "lats",
    "gastrocnemius", "gastroc-back", "soleus", "soleus-back",
    "forearm-ext", "forearm-flex", "forearm-ext-back", "forearm-flex-back",
    "adductors", "tibialis", "neck", "neck-back",
  ]);

  for (const muscleId of allMuscleIds) {
    const datum = muscleData.get(muscleId);
    const baseRecoveryHours = RECOVERY_HOURS[muscleId] || DEFAULT_RECOVERY_HOURS;

    if (!datum) {
      result.set(muscleId, {
        muscleId,
        recoveryPercent: 100,
        hoursSinceTrained: null,
        recoveryHours: baseRecoveryHours,
        baseRecoveryHours,
        loadFactor: 1,
        lastSessionVolume: null,
        lastSessionAvgRPE: null,
        status: "never-trained",
        label: "Not trained yet",
      });
      continue;
    }

    // ── A3: load factor scales the base recovery hours ──
    const loadFactor = computeLoadFactor(
      datum.sessionVolume,
      datum.avgRPE,
      userAvgVolume
    );
    const recoveryHours = baseRecoveryHours * loadFactor;

    const hoursSince = (now - datum.lastTrained) / (1000 * 60 * 60);
    const recoveryPercent = Math.min(
      100,
      Math.round((hoursSince / recoveryHours) * 100)
    );

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
      recoveryHours: Math.round(recoveryHours * 10) / 10,
      baseRecoveryHours,
      loadFactor: Math.round(loadFactor * 100) / 100,
      lastSessionVolume: Math.round(datum.sessionVolume),
      lastSessionAvgRPE: Math.round(datum.avgRPE * 10) / 10,
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
