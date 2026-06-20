/**
 * ACWR-based Fatigue Management Engine.
 *
 * Implements the Acute:Chronic Workload Ratio (Gabbett 2016) — the gold
 * standard for injury-risk assessment in sports science.
 *
 * Acute load  = sum of training volume over the last 7 days
 * Chronic load = average weekly volume over the last 28 days
 *               (i.e., total 28-day volume / 4)
 *
 * ACWR = acute / chronic
 *
 * - ACWR > 1.5  → high injury risk → deload (volume × 0.6)
 * - ACWR 1.3-1.5 → moderate risk → reduce 20%
 * - ACWR 0.8-1.3 → optimal zone → normal volume
 * - ACWR < 0.8  → detraining risk → can push +10%
 */

import type { WorkoutSession } from "@/db/schema";
import type { GeneratorProfile } from "@/store/useGeneratorStore";

// ── Types ──

export interface FatigueAssessment {
  /** ACWR value (acute:chronic workload ratio). 0 if no history. */
  acwr: number;
  /** Acute load (7-day volume in kg). */
  acuteLoad: number;
  /** Chronic load (28-day average weekly volume in kg). */
  chronicLoad: number;
  /** 1-5 readiness score (5 = fully recovered, 1 = highly fatigued). */
  fatigueScore: number;
  /** True if deload week is strongly recommended. */
  shouldDeload: boolean;
  /** Multiplier to apply to prescribed sets (0.6 = -40%, 1.0 = normal, 1.1 = +10%). */
  volumeAdjustment: number;
  /** Human-readable recommendation. */
  recommendation: string;
  /** Per-muscle fatigue: muscle → 7-day volume. */
  muscleGroupVolume: Record<string, number>;
  /** Days since last rest day. */
  daysSinceRest: number;
}

// ── Helpers ──

/** Local date key (YYYY-MM-DD in local time, NOT UTC). */
function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Calculate the volume of a single completed session (kg). */
function sessionVolume(s: WorkoutSession): number {
  return s.exercises.reduce(
    (exAcc, ex) =>
      exAcc +
      ex.sets
        .filter((set) => set.completed)
        .reduce((setAcc, set) => setAcc + set.weight * set.reps, 0),
    0
  );
}

/** Per-muscle volume of a completed session. */
function sessionMuscleVolume(
  s: WorkoutSession,
  exerciseMap: Map<string, { muscleGroup: string }>
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const ex of s.exercises) {
    const def = exerciseMap.get(String(ex.exerciseId));
    if (!def) continue;
    const vol = ex.sets
      .filter((set) => set.completed)
      .reduce((acc, set) => acc + set.weight * set.reps, 0);
    out[def.muscleGroup] = (out[def.muscleGroup] || 0) + vol;
  }
  return out;
}

// ── Main: Assess Fatigue from session history ──

/**
 * Build a FatigueAssessment from the user's completed workout sessions.
 *
 * @param sessions All completed sessions (newest first or oldest first — both work, we sort).
 * @param profile Generator profile (for age/medical modifiers).
 * @param exerciseMap Optional Map<exerciseId, {muscleGroup}> for per-muscle breakdown.
 */
export function assessFatigueACWR(
  sessions: WorkoutSession[],
  profile: GeneratorProfile,
  exerciseMap?: Map<string, { muscleGroup: string }>
): FatigueAssessment {
  const completed = sessions
    .filter((s) => s.completed === true && !s.isFreeze)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // ── Acute (7-day) and Chronic (28-day) loads ──
  const now = Date.now();
  const SEVEN_DAYS = 7 * 86400000;
  const TWENTY_EIGHT_DAYS = 28 * 86400000;

  let acuteLoad = 0;
  let chronicLoadTotal = 0;
  const muscleGroupVolume: Record<string, number> = {};

  for (const s of completed) {
    const t = new Date(s.date).getTime();
    const ageMs = now - t;
    if (ageMs < 0) continue; // future session, skip
    const vol = sessionVolume(s);
    if (ageMs <= SEVEN_DAYS) {
      acuteLoad += vol;
      // Per-muscle breakdown for acute window
      if (exerciseMap) {
        const mv = sessionMuscleVolume(s, exerciseMap);
        for (const [k, v] of Object.entries(mv)) {
          muscleGroupVolume[k] = (muscleGroupVolume[k] || 0) + v;
        }
      }
    }
    if (ageMs <= TWENTY_EIGHT_DAYS) {
      chronicLoadTotal += vol;
    }
  }

  const chronicLoad = chronicLoadTotal / 4; // average weekly
  const acwr = chronicLoad > 0 ? acuteLoad / chronicLoad : 0;

  // ── Days since last rest day ──
  // A "rest day" = a calendar day with no completed session.
  const trainingDates = new Set(
    completed
      .filter((s) => now - new Date(s.date).getTime() <= SEVEN_DAYS)
      .map((s) => localDateKey(new Date(s.date)))
  );
  let daysSinceRest = 0;
  for (let i = 0; i < 14; i++) {
    const d = new Date(now - i * 86400000);
    if (!trainingDates.has(localDateKey(d))) {
      daysSinceRest = i;
      break;
    }
    if (i === 13) daysSinceRest = 14; // no rest in 2 weeks
  }

  // ── Compute readiness score (1-5) ──
  let score = 3; // baseline "normal"
  // Positive factors (recovery)
  if (acwr > 0 && acwr < 0.8) score += 1; // detraining → well-recovered
  if (daysSinceRest === 0) score += 1; // rested today or yesterday
  // Negative factors (fatigue)
  if (acwr > 1.5) score -= 2;
  else if (acwr > 1.3) score -= 1;
  if (daysSinceRest >= 7) score -= 1; // graduated, NO double-count
  else if (daysSinceRest >= 5) score -= 0; // minor warning only
  // Age modifier
  if (profile.age > 50) score -= 1;
  if (profile.age > 65) score -= 1;
  // Medical cautions
  if (profile.medicalCautions.length > 0) score -= 1;
  // High frequency
  if (profile.daysPerWeek >= 5) score -= 1;

  score = Math.max(1, Math.min(5, Math.round(score)));

  // ── Determine volume adjustment & deload ──
  let volumeAdjustment = 1.0;
  let shouldDeload = false;
  let recommendation = "";

  if (acwr > 1.5 || score <= 1) {
    volumeAdjustment = 0.6;
    shouldDeload = true;
    recommendation = `⚠️ High fatigue (ACWR ${acwr.toFixed(2)}). Deload week recommended — reduce volume by 40%.`;
  } else if (acwr > 1.3 || score <= 2) {
    volumeAdjustment = 0.8;
    recommendation = `Moderate fatigue (ACWR ${acwr.toFixed(2)}). Reduce volume by 20% this session.`;
  } else if (acwr > 0 && acwr < 0.8 && score >= 4) {
    volumeAdjustment = 1.1;
    recommendation = `Well recovered (ACWR ${acwr.toFixed(2)}). You can push 10% more volume today.`;
  } else if (acwr === 0) {
    recommendation = "No recent training data — starting fresh with normal volume.";
  } else {
    recommendation = `Optimal zone (ACWR ${acwr.toFixed(2)}). Standard volume.`;
  }

  return {
    acwr: Math.round(acwr * 100) / 100,
    acuteLoad: Math.round(acuteLoad),
    chronicLoad: Math.round(chronicLoad),
    fatigueScore: score,
    shouldDeload,
    volumeAdjustment,
    recommendation,
    muscleGroupVolume,
    daysSinceRest,
  };
}
