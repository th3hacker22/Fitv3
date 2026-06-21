import { Exercise } from "@/types/exercise";
import { getMuscleIdsForExercise } from "@/utils/muscleMapper";
import { GeneratorProfile } from "@/store/useGeneratorStore";
import type { WorkoutSession } from "@/db/schema";
import {
  assessFatigueACWR,
  type FatigueAssessment,
} from "./fatigueEngine";
import {
  buildExerciseHistory,
  calculateProgressiveOverloadRPE,
  computeMuscleVolumeStatus,
  type ExerciseHistoryEntry,
  type MuscleVolumeStatus,
  type OverloadRecommendation,
} from "./overloadEngine";
import {
  classifyMovementPattern,
  areAntagonisticPatterns,
  type MovementPattern,
} from "./movementPatterns";
import {
  assessDeloadNeed,
  type DeloadRecommendation,
} from "./deloadEngine";
import {
  detectRotationNeeds,
  type VariationRecommendation,
} from "./variationEngine";
import { optimizeExerciseOrder } from "./exerciseOrderingEngine";
import {
  getPreferenceAdjustment,
  type LearningLoopSummary,
} from "./learningLoop";

// --- Types ---

export interface ProgramExercise {
  exercise: Exercise;
  sets: number;
  reps: string;
  restSeconds: number;
  tempo?: string;
  role: "compound" | "isolation" | "warmup" | "core" | "cardio";
  note?: string;
  // ── Progressive Overload fields ──
  previousWeight?: number | null;
  previousReps?: number | null;
  suggestedWeight?: number | null;
  suggestedReps?: string | null;
  progressionTip?: string;
  overloadStrategy?: OverloadRecommendation["strategy"];
  // ── Metadata ──
  movementPattern?: MovementPattern;
  isSupersetWithNext?: boolean;
}

// Re-export for backward compat (engines own the canonical types now)
export type { ExerciseHistoryEntry } from "./overloadEngine";

// ── Legacy FatigueData (deprecated — use FatigueAssessment via sessions) ──
// Kept for backward compatibility with any external callers.
export interface FatigueData {
  weeklyVolume: number;
  weeklySessions: number;
  avgSessionDuration: number;
  daysSinceRest: number;
  muscleGroupVolume: Record<string, number>;
}

export interface ProgramDay {
  name: string;
  focus: string[];
  exercises: ProgramExercise[];
  estimatedMinutes: number;
}

export interface WorkoutProgram {
  title: string;
  summary: string;
  weeklyDays: ProgramDay[];
  progressionModel: string;
  warnings: string[];
  // ── AI Coach / analytics payload ──
  fatigueAssessment?: FatigueAssessment;
  muscleVolumeStatus?: MuscleVolumeStatus[];
  deloadRecommendation?: DeloadRecommendation;
  variationRecommendations?: VariationRecommendation[];
}

export interface WorkoutRoutine {
  exercises: {
    exercise: Exercise;
    sets: number;
    reps: string;
    restSeconds?: number;
    progression?: string;
  }[];
}

// --- Utils ---

// Simple PRNG: mulberry32 — used for deterministic shuffle.
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  return hash;
}

const isCompound = (exercise: Exercise): boolean => {
  const name = exercise.name.toLowerCase();
  const ckw = [
    "squat",
    "press",
    "deadlift",
    "row",
    "pullup",
    "pull-up",
    "chinup",
    "chin-up",
    "lunge",
    "dip",
    "clean",
    "snatch",
    "pushup",
    "push-up",
  ];
  if (ckw.some((kw) => name.includes(kw))) return true;

  const target = exercise.target.toLowerCase();
  const ct = ["quads", "glutes", "hamstrings", "lats", "upper back", "pectorals"];
  if (
    ct.includes(target) &&
    ["barbell", "body weight", "kettlebell", "dumbbell", "cable", "machine"].some((eq) =>
      exercise.equipment.toLowerCase().includes(eq)
    )
  ) {
    const ikw = ["curl", "extension", "raise", "fly", "kickback", "crunch", "shrug"];
    if (!ikw.some((kw) => name.includes(kw))) return true;
  }
  return false;
};

const isContraindicated = (exercise: Exercise, injuries: string[]): boolean => {
  if (injuries.length === 0 || injuries.includes("none")) return false;
  const name = exercise.name.toLowerCase();
  const target = exercise.target.toLowerCase();

  if (injuries.includes("lower back")) {
    if (name.includes("deadlift") || name.includes("good morning") || name.includes("bent over"))
      return true;
  }
  if (injuries.includes("knee")) {
    if (
      name.includes("lunge") ||
      name.includes("jump") ||
      name.includes("extension") ||
      name.includes("squat")
    )
      return true;
  }
  if (injuries.includes("shoulder")) {
    if (name.includes("upright row") || name.includes("behind neck") || name.includes("dip"))
      return true;
  }
  if (injuries.includes("elbow") || injuries.includes("wrist")) {
    if (
      name.includes("skullcrusher") ||
      (name.includes("curl") && exercise.equipment === "barbell")
    )
      return true;
  }
  if (injuries.includes("neck")) {
    if (name.includes("neck") || name.includes("shrug")) return true;
  }
  if (injuries.includes("hip") || injuries.includes("ankle")) {
    if (name.includes("jump") || name.includes("box jump")) return true;
  }
  return false;
};

// ── Exercise pairing: auto-create supersets ──
// FIXED: now routes through getMuscleIdsForExercise + movement patterns
// (was: substring includes on exercise.target — missed real antagonists)
// FIXED: respects explicit intensityStyle === "supersets"
function shouldSuperset(
  ex1: ProgramExercise,
  ex2: ProgramExercise,
  sessionLengthMin: number,
  intensityStyle: GeneratorProfile["intensityStyle"]
): boolean {
  // User explicitly asked for supersets → don't short-circuit on session length
  if (intensityStyle !== "supersets" && sessionLengthMin >= 45) return false;

  // Never superset two compounds (safety + recovery)
  if (ex1.role === "compound" || ex2.role === "compound") return false;

  // Cardo / core never superset
  if (ex1.role === "cardio" || ex2.role === "cardio") return false;
  if (ex1.role === "core" || ex2.role === "core") return false;

  // Pattern-based antagonism (preferred — uses canonical classifier)
  const p1 = ex1.movementPattern ?? classifyMovementPattern(ex1.exercise);
  const p2 = ex2.movementPattern ?? classifyMovementPattern(ex2.exercise);
  if (p1 !== "other" && p2 !== "other" && areAntagonisticPatterns(p1, p2)) {
    return true;
  }

  // Fallback: muscle-ID based antagonism (broader match)
  const m1 = new Set(getMuscleIdsForExercise(ex1.exercise.target, ex1.exercise.secondaryMuscles));
  const m2 = new Set(getMuscleIdsForExercise(ex2.exercise.target, ex2.exercise.secondaryMuscles));

  // Antagonistic muscle families
  const antagonisticFamilies: Array<[Set<string>, Set<string>]> = [
    [
      new Set(["upper-chest", "mid-lower-chest"]),
      new Set(["lats", "traps-mid", "lower-traps"]),
    ],
    [new Set(["biceps-long", "biceps-short"]), new Set(["triceps-long", "triceps-lat", "triceps-med"])],
    [
      new Set(["outer-quad", "rectus-femoris", "vmo"]),
      new Set(["medial-ham", "lateral-ham"]),
    ],
    [
      new Set(["front-delt", "lateral-delt"]),
      new Set(["post-delt", "lat-delt-back"]),
    ],
  ];

  for (const [famA, famB] of antagonisticFamilies) {
    const aMatchesFamA = [...m1].some((m) => famA.has(m));
    const aMatchesFamB = [...m1].some((m) => famB.has(m));
    const bMatchesFamA = [...m2].some((m) => famA.has(m));
    const bMatchesFamB = [...m2].some((m) => famB.has(m));
    if ((aMatchesFamA && bMatchesFamB) || (aMatchesFamB && bMatchesFamA)) {
      return true;
    }
  }

  return false;
}

// --- Main Engine ---

export interface GenerateProgramOptions {
  /** Raw session history — preferred. Drives ACWR fatigue + RPE overload. */
  sessions?: WorkoutSession[];
  /** Optional exercise lookup map (for per-muscle volume). */
  exerciseMap?: Map<string, Exercise>;
  /** Legacy: pre-computed exercise history (deprecated — use sessions). */
  exerciseHistory?: Map<string, ExerciseHistoryEntry>;
  /** Legacy: pre-computed fatigue data (deprecated — use sessions). */
  fatigueData?: FatigueData;
  /** Learning Loop summary — drives per-exercise preference scoring. */
  learningLoop?: LearningLoopSummary;
}

export const generateProgram = (
  exercises: Exercise[],
  profile: GeneratorProfile,
  options?: GenerateProgramOptions
): WorkoutProgram => {
  const prng = mulberry32(hashString(JSON.stringify(profile)) + profile.generatorSeed * 1000000);
  const nextRand = () => prng();
  // Fisher-Yates shuffle (deterministic via PRNG seed).
  const shuffle = <T>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(nextRand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const warnings: string[] = [];

  // ── Build exerciseMap if not provided ──
  const exerciseMap = options?.exerciseMap ?? new Map(exercises.map((e) => [String(e.id), e]));

  // ── Build ExerciseHistory from sessions (RPE-aware) ──
  const exerciseHistory: Map<string, ExerciseHistoryEntry> =
    options?.exerciseHistory ??
    (options?.sessions ? buildExerciseHistory(options.sessions, exerciseMap) : new Map());

  // ── Fatigue Assessment: ACWR-based (preferred) or legacy ──
  let fatigue: FatigueAssessment;
  if (options?.sessions && options.sessions.length > 0) {
    fatigue = assessFatigueACWR(options.sessions, profile, exerciseMap);
  } else {
    // Legacy fallback — synthesize a minimal FatigueAssessment from old FatigueData
    const fd = options?.fatigueData;
    fatigue = synthesizeLegacyFatigue(fd, profile);
  }

  if (fatigue.shouldDeload || fatigue.fatigueScore <= 2) {
    warnings.push(fatigue.recommendation);
  }

  // ── Per-muscle MEV/MAV status ──
  const trainingLevel = (profile.fitnessLevel?.toLowerCase() ?? "beginner") as
    | "novice" | "beginner" | "intermediate" | "advanced";
  const muscleVolumeStatus = options?.sessions
    ? computeMuscleVolumeStatus(options.sessions, exerciseMap, trainingLevel)
    : [];
  const belowMEV = new Set(
    muscleVolumeStatus.filter((m) => m.recommendation === "prioritize").map((m) => m.muscle)
  );
  const aboveMAV = new Set(
    muscleVolumeStatus.filter((m) => m.recommendation === "reduce").map((m) => m.muscle)
  );

  // ── Deload Week Auto-Scheduling ──
  // Checks 3 triggers: time-based (4-6 weeks), ACWR-based (>1.5), performance-based (regression).
  const deloadRec = options?.sessions
    ? assessDeloadNeed(options.sessions, profile, fatigue, exerciseHistory)
    : null;
  let effectiveVolumeAdjustment = fatigue.volumeAdjustment;
  if (deloadRec?.shouldDeload) {
    // Deload overrides fatigue volume adjustment (deload is more conservative)
    effectiveVolumeAdjustment = Math.min(fatigue.volumeAdjustment, deloadRec.volumeMultiplier);
    warnings.push(`🔄 Deload Week: ${deloadRec.explanation}`);
  }

  // ── Exercise Variation Rotation ──
  // Detects exercises done for >= 4 consecutive weeks and suggests alternatives.
  const variationRecs = options?.sessions
    ? detectRotationNeeds(options.sessions, exercises, 4)
    : [];
  const rotationNeeded = new Set<string>();
  const rotationAlternatives = new Map<string, Exercise>();
  for (const rec of variationRecs) {
    rotationNeeded.add(rec.currentExerciseId);
    if (rec.suggestedAlternative) {
      rotationAlternatives.set(rec.currentExerciseId, rec.suggestedAlternative);
    }
  }

  // ── Learning Loop preferences ──
  const learningLoop = options?.learningLoop;

  // ── Recently-used exercise IDs (for novelty scoring) ──
  const recentlyUsedExerciseIds = new Set<string>();
  const lastTwoSessionExerciseIds = new Set<string>();
  if (options?.sessions) {
    const sorted = [...options.sessions]
      .filter((s) => s.completed === true)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    // Last 2 sessions → strong penalty
    sorted.slice(0, 2).forEach((s) =>
      s.exercises.forEach((ex) => lastTwoSessionExerciseIds.add(String(ex.exerciseId)))
    );
    // Last 5 sessions → mild penalty
    sorted.slice(0, 5).forEach((s) =>
      s.exercises.forEach((ex) => recentlyUsedExerciseIds.add(String(ex.exerciseId)))
    );
  }

  // Step 1: Base stats & recovery
  const isNovice = profile.trainingYears < 0.5 || profile.fitnessLevel === "Novice";
  const isAdvanced = profile.trainingYears > 5 || profile.fitnessLevel === "Advanced";

  let recoveryScore = fatigue.fatigueScore;
  if (isAdvanced) recoveryScore++;
  if (profile.daysPerWeek >= 5) recoveryScore--;
  if (profile.medicalCautions.length > 0) recoveryScore--;
  recoveryScore = Math.max(1, Math.min(5, recoveryScore));

  const goal = profile.goal || "Hypertrophy";

  // Step 2: Split design based on days
  let splitPlan: string[][] = [];
  let title = "";

  if (profile.daysPerWeek === 2) {
    title = "2-Day Full Body";
    splitPlan = [["Full Body"], ["Full Body"]];
  } else if (profile.daysPerWeek === 3) {
    if (profile.fitnessLevel === "Advanced" || profile.fitnessLevel === "Intermediate") {
      title = "3-Day PPL";
      splitPlan = [
        ["Push", "Chest", "Shoulders", "Triceps"],
        ["Pull", "Back", "Biceps"],
        ["Legs", "Quads", "Hamstrings", "Glutes", "Calves"],
      ];
    } else {
      title = "3-Day Full Body";
      splitPlan = [["Full Body"], ["Full Body"], ["Full Body"]];
    }
  } else if (profile.daysPerWeek === 4) {
    if (
      profile.physiqueFocus === "push" ||
      profile.physiqueFocus === "pull" ||
      profile.physiqueFocus === "arms"
    ) {
      title = "4-Day PPL + Upper";
      splitPlan = [
        ["Push", "Chest", "Shoulders", "Triceps"],
        ["Pull", "Back", "Biceps"],
        ["Legs", "Quads", "Hamstrings"],
        ["Upper", "Chest", "Back", "Arms"],
      ];
    } else {
      title = "4-Day Upper/Lower";
      splitPlan = [["Upper"], ["Lower"], ["Upper"], ["Lower"]];
    }
  } else if (profile.daysPerWeek === 5) {
    title = "5-Day PPL + Upper/Lower";
    splitPlan = [["Push"], ["Pull"], ["Legs"], ["Upper"], ["Lower"]];
  } else {
    title = "6-Day PPL";
    splitPlan = [["Push"], ["Pull"], ["Legs"], ["Push"], ["Pull"], ["Legs"]];
  }

  // Inject focus
  if (profile.physiqueFocus === "glutes") {
    splitPlan.forEach((p) => {
      if (p.includes("Lower") || p.includes("Legs")) p.push("Glutes");
    });
  }

  // Step 4: Exercise Pool filtering
  let pool = exercises.filter((e) => {
    if (profile.avoidExercises.includes(e.id)) return false;
    if (profile.equipment.length > 0 && !profile.equipment.includes("Full Gym")) {
      const eq = e.equipment.toLowerCase();
      let match = false;
      if (profile.equipment.includes("Bodyweight") && eq.includes("body weight")) match = true;
      if (
        profile.equipment.includes("Dumbbells") &&
        (eq.includes("dumbbell") || eq.includes("kettlebell"))
      )
        match = true;
      if (profile.equipment.includes("Barbell") && eq.includes("barbell")) match = true;
      if (
        profile.equipment.includes("Machines") &&
        (eq.includes("machine") || eq.includes("smith") || eq.includes("leverage"))
      )
        match = true;
      if (profile.equipment.includes("Cables") && eq.includes("cable")) match = true;
      if (profile.equipment.includes("Bands") && eq.includes("band")) match = true;
      if (!match) return false;
    } else if (profile.location === "home" && profile.equipment.length === 0) {
      if (!e.equipment.toLowerCase().includes("body weight")) return false;
    }
    return true;
  });

  // Contraindications fallback
  const safePool = pool.filter((e) => !isContraindicated(e, profile.injuries));
  if (safePool.length >= pool.length * 0.2) {
    pool = safePool;
    if (profile.injuries.length > 0 && profile.injuries[0] !== "none") {
      warnings.push(
        `Filtered out exercises that commonly aggravate: ${profile.injuries.join(", ")}.`
      );
    }
  } else {
    warnings.push("Too few exercises remain after injury filters. Please exercise caution.");
  }

  if (profile.medicalCautions.length > 0) {
    warnings.push(
      `Given your medical conditions (${profile.medicalCautions.join(", ")}), keep intensity moderate, avoid valsalva maneuver, and prioritize safety.`
    );
  }

  if (pool.length < 5) pool = exercises;

  // ── Track movement patterns used across the whole week (for balance) ──
  const weeklyPatternCount = new Map<MovementPattern, number>();
  const incrementPattern = (p: MovementPattern) =>
    weeklyPatternCount.set(p, (weeklyPatternCount.get(p) || 0) + 1);

  // Step 5: Day builds
  const weeklyDays: ProgramDay[] = [];
  const usedExerciseIds = new Set<string>();

  splitPlan.forEach((focusTargets, dayIndex) => {
    const dayExList: ProgramExercise[] = [];

    const targetExCount = Math.max(3, Math.min(8, Math.floor(profile.sessionLengthMin / 8)));

    const dayPool = shuffle(pool);

    // Movement pattern balance: which patterns are underrepresented so far this week?
    const underrepresentedPatterns = (): MovementPattern[] => {
      const allPatterns: MovementPattern[] = [
        "horizontal-push", "horizontal-pull",
        "vertical-push", "vertical-pull",
        "knee-extension", "hip-hinge",
      ];
      return allPatterns
        .map((p) => ({ p, c: weeklyPatternCount.get(p) || 0 }))
        .sort((a, b) => a.c - b.c)
        .slice(0, 3)
        .map((x) => x.p);
    };
    const prioritizedPatterns = new Set(underrepresentedPatterns());

    const scoreEx = (e: Exercise) => {
      let score = 0;
      const bp = e.bodyPart.toLowerCase();
      const tg = e.target.toLowerCase();
      const mus = getMuscleIdsForExercise(e.target, e.secondaryMuscles);

      const strFocus = focusTargets.map((f) => f.toLowerCase()).join(" ");
      if (strFocus.includes("full body")) score += 5;
      else {
        if (strFocus.includes(bp) || strFocus.includes(tg)) score += 10;
        if (
          strFocus.includes("push") &&
          (tg.includes("chest") || tg.includes("triceps") || tg.includes("delts"))
        )
          score += 10;
        if (
          strFocus.includes("pull") &&
          (tg.includes("back") ||
            tg.includes("biceps") ||
            tg.includes("lats") ||
            bp.includes("back"))
        )
          score += 10;
        if (
          strFocus.includes("legs") &&
          (bp.includes("leg") || tg.includes("glutes") || tg.includes("calves"))
        )
          score += 10;
        if (
          strFocus.includes("upper") &&
          (bp.includes("chest") ||
            bp.includes("back") ||
            bp.includes("arm") ||
            bp.includes("shoulder") ||
            bp.includes("neck"))
        )
          score += 10;
        if (
          strFocus.includes("lower") &&
          (bp.includes("leg") || tg.includes("glutes") || tg.includes("calves"))
        )
          score += 10;
        if (strFocus.includes("glutes") && tg.includes("glutes")) score += 15;
      }

      if (profile.priorityMuscles.some((pm) => mus.includes(pm))) score += 5;
      if (profile.mobilityLimited && e.equipment.includes("machine")) score += 3;
      if (usedExerciseIds.has(e.id)) score -= 15;

      // ── NEW: Per-muscle MEV/MAV awareness ──
      if (belowMEV.has(e.muscleGroup)) score += 8; // prioritize under-trained muscles
      if (aboveMAV.has(e.muscleGroup)) score -= 6; // avoid over-trained muscles

      // ── NEW: Exercise novelty scoring ──
      if (lastTwoSessionExerciseIds.has(String(e.id))) score -= 10; // done in last 2 sessions
      else if (recentlyUsedExerciseIds.has(String(e.id))) score -= 3; // done in last 5 sessions

      // ── NEW: Movement pattern balance ──
      const pattern = classifyMovementPattern(e);
      if (prioritizedPatterns.has(pattern)) score += 6;

      // ── NEW: Exercise variation rotation ──
      // Penalize exercises that have been done for >= 4 consecutive weeks.
      // The user's body has adapted; rotate to a variation.
      if (rotationNeeded.has(String(e.id))) score -= 12;

      // ── NEW: Learning Loop preference scoring ──
      // Boost loved exercises, penalize disliked ones based on past behavior.
      if (learningLoop) {
        score += getPreferenceAdjustment(String(e.id), learningLoop);
      }

      return score;
    };

    dayPool.sort((a, b) => scoreEx(b) - scoreEx(a));

    // Try to pick compounds first
    const compPool = dayPool.filter(isCompound);
    const isoPool = dayPool.filter((e) => !isCompound(e));

    let compoundsAdded = 0;
    while (compoundsAdded < 2 && compPool.length > 0) {
      const e = compPool.shift();
      if (e && scoreEx(e) > -5) {
        const pattern = classifyMovementPattern(e);
        dayExList.push({
          exercise: e,
          sets: 0,
          reps: "",
          restSeconds: 0,
          role: "compound",
          movementPattern: pattern,
        });
        incrementPattern(pattern);
        usedExerciseIds.add(e.id);
        compoundsAdded++;
      } else break;
    }

    while (dayExList.length < targetExCount && (compPool.length > 0 || isoPool.length > 0)) {
      const p = isoPool.length > 0 && nextRand() > 0.3 ? isoPool : compPool;
      const e = p.shift();
      if (e) {
        const pattern = classifyMovementPattern(e);
        dayExList.push({
          exercise: e,
          sets: 0,
          reps: "",
          restSeconds: 0,
          role: "isolation",
          movementPattern: pattern,
        });
        incrementPattern(pattern);
        usedExerciseIds.add(e.id);
      }
    }

    if (profile.includeCoreFinisher && dayExList.length < targetExCount + 1) {
      const cores = shuffle(pool.filter((e) => e.bodyPart.toLowerCase() === "waist"));
      if (cores.length > 0) {
        const pattern = classifyMovementPattern(cores[0]);
        dayExList.push({
          exercise: cores[0],
          sets: 0,
          reps: "",
          restSeconds: 0,
          role: "core",
          movementPattern: pattern,
        });
        incrementPattern(pattern);
      }
    }

    if (profile.includeCardio && dayExList.length < targetExCount + 2) {
      const cardio = shuffle(pool.filter((e) => e.bodyPart.toLowerCase() === "cardio"));
      if (cardio.length > 0) {
        dayExList.push({
          exercise: cardio[0],
          sets: 1,
          reps: "10-20 min",
          restSeconds: 0,
          role: "cardio",
        });
      }
    }

    // Default fallback if a day is empty
    if (dayExList.length === 0) {
      dayExList.push({
        exercise: pool[0],
        sets: 3,
        reps: "10",
        restSeconds: 60,
        role: "isolation",
      });
    }

    // Step 6: Sets / Reps
    let totalMins = 0;
    dayExList.forEach((pe) => {
      let sets = 3;
      let reps = "8-12";
      let rest = 90;
      const tempo =
        goal === "Strength"
          ? "2-1-X"
          : goal === "Hypertrophy" || goal === "Recomp"
            ? "3-1-1"
            : "2-0-1";

      const repBias =
        profile.repBiasOverride ||
        (goal === "Strength"
          ? "low"
          : goal === "Hypertrophy" || goal === "Recomp"
            ? "moderate"
            : "high");
      if (repBias === "low") {
        reps = "3-6";
        rest = 180;
      } else if (repBias === "moderate") {
        reps = pe.role === "compound" ? "6-8" : "10-15";
      } else {
        reps = pe.role === "compound" ? "10-12" : "15-20";
        rest = 60;
      }

      if (pe.role === "compound") sets = recoveryScore < 3 ? 3 : 4;
      if (pe.role === "isolation") sets = recoveryScore < 3 ? 2 : 3;
      if (pe.role === "core") {
        sets = 3;
        reps = "15-25";
        rest = 45;
      }

      pe.sets = sets;
      pe.reps = reps;
      pe.restSeconds = rest;
      pe.tempo = tempo;

      // ── Apply fatigue + deload volume adjustment ──
      // `effectiveVolumeAdjustment` combines ACWR fatigue with deload-week
      // multiplier (deload is more conservative and overrides fatigue).
      if (effectiveVolumeAdjustment < 1.0) {
        pe.sets = Math.max(2, Math.round(sets * effectiveVolumeAdjustment));
      } else if (effectiveVolumeAdjustment > 1.0) {
        pe.sets = Math.min(6, Math.round(sets * effectiveVolumeAdjustment));
      }

      // ── During deload, cap the RPE target in the note ──
      if (deloadRec?.shouldDeload && pe.role !== "cardio" && pe.role !== "core") {
        const existingNote = pe.note ? pe.note + " " : "";
        pe.note = `${existingNote}[DELOAD: keep RPE ≤ ${deloadRec.rpeCap}, no PR attempts.]`;
      }

      // ── Apply Progressive Overload (RPE-based) ──
      if (pe.role !== "cardio") {
        const history = exerciseHistory.get(String(pe.exercise.id));
        const overload = calculateProgressiveOverloadRPE(pe.exercise, history, goal);
        pe.previousWeight = overload.previousWeight;
        pe.previousReps = overload.previousReps;
        pe.suggestedWeight = overload.suggestedWeight;
        pe.suggestedReps = overload.suggestedReps;
        pe.progressionTip = overload.progressionTip;
        pe.overloadStrategy = overload.strategy;
      }

      if (goal === "Strength" && pe.role === "compound")
        pe.note = "Focus on explosive concentric, leave 1-2 reps in the tank.";

      totalMins += (pe.sets * (45 + rest)) / 60;
    });

    // ── Auto-create supersets ──
    // FIXED: respects intensityStyle === "supersets"
    if (profile.intensityStyle === "supersets" || profile.sessionLengthMin < 45) {
      for (let i = 0; i < dayExList.length - 1; i++) {
        if (
          shouldSuperset(
            dayExList[i],
            dayExList[i + 1],
            profile.sessionLengthMin,
            profile.intensityStyle
          )
        ) {
          dayExList[i].isSupersetWithNext = true;
        }
      }
    }

    // ── Exercise Ordering Intelligence Layer ──
    // Reorder exercises using training-science rules:
    // warm-ups first → compounds → accessories, push/pull alternation,
    // no same-muscle back-to-back, antagonistic pairs adjacent.
    const orderedExercises = optimizeExerciseOrder(dayExList);

    weeklyDays.push({
      name: `Day ${dayIndex + 1} — ${focusTargets[0]}`,
      focus: focusTargets,
      exercises: orderedExercises,
      estimatedMinutes: Math.round(totalMins + 5),
    });
  });

  const prog = isNovice
    ? "Linear Progression: Add a small amount of weight each session when you can comfortably hit the top of the rep range."
    : "Double Progression: Work up to the top of your rep range across all sets. Once achieved, increase weight slightly and restart at the bottom of the rep range.";

  if (warnings.length === 0)
    warnings.push("Always consult a physical therapist before beginning a new strenuous routine.");

  return {
    title,
    summary: `A ${profile.daysPerWeek}-day ${goal.toLowerCase()} focused program customized for your experience level.`,
    weeklyDays,
    progressionModel: prog,
    warnings,
    fatigueAssessment: fatigue,
    muscleVolumeStatus,
    deloadRecommendation: deloadRec ?? undefined,
    variationRecommendations: variationRecs,
  };
};

// ── Legacy fatigue synthesizer ──
// Used when caller passes the old FatigueData shape (no raw sessions).
function synthesizeLegacyFatigue(
  fd: FatigueData | undefined,
  profile: GeneratorProfile
): FatigueAssessment {
  if (!fd) {
    return {
      acwr: 0,
      acuteLoad: 0,
      chronicLoad: 0,
      fatigueScore: 3,
      shouldDeload: false,
      volumeAdjustment: 1.0,
      recommendation: "No recent training data — starting fresh with normal volume.",
      muscleGroupVolume: {},
      daysSinceRest: 0,
    };
  }

  // Rough ACWR approximation from legacy fields
  const expectedWeekly = profile.weightKg * 100 * profile.daysPerWeek;
  const acuteLoad = fd.weeklyVolume;
  const chronicLoad = expectedWeekly; // assume chronic ≈ expected
  const acwr = chronicLoad > 0 ? acuteLoad / chronicLoad : 0;

  let score = 3;
  if (fd.weeklyVolume > expectedWeekly * 1.5) score -= 2;
  else if (fd.weeklyVolume > expectedWeekly * 1.2) score -= 1;
  if (fd.weeklyVolume < expectedWeekly * 0.7) score += 1; // detraining → recovered
  if (fd.daysSinceRest >= 7) score -= 1; // FIXED: no double-count
  if (profile.age > 50) score -= 1;
  if (profile.medicalCautions.length > 0) score -= 1;
  score = Math.max(1, Math.min(5, score));

  const shouldDeload = score <= 1;
  let volumeAdjustment = 1.0;
  let recommendation = "";

  if (shouldDeload) {
    volumeAdjustment = 0.6;
    recommendation = "⚠️ High fatigue detected — deload week recommended. Reduce volume by 40%.";
  } else if (score <= 2) {
    volumeAdjustment = 0.8;
    recommendation = "Moderate fatigue — reduce volume by 20% this session.";
  } else if (score >= 4) {
    volumeAdjustment = 1.1;
    recommendation = "Well recovered — you can push 10% more volume today.";
  } else {
    recommendation = "Normal recovery — standard volume.";
  }

  return {
    acwr: Math.round(acwr * 100) / 100,
    acuteLoad,
    chronicLoad,
    fatigueScore: score,
    shouldDeload,
    volumeAdjustment,
    recommendation,
    muscleGroupVolume: fd.muscleGroupVolume || {},
    daysSinceRest: fd.daysSinceRest,
  };
}

export const generateWorkout = (
  exercises: Exercise[],
  state: {
    gender: "male" | "female" | null;
    age: number;
    goal: string | null;
    fitnessLevel: string | null;
    equipment: string[];
    selectedMuscles: string[]; // backward compat map to priorityMuscles
  }
): WorkoutRoutine => {
  const profile: GeneratorProfile = {
    gender: state.gender,
    age: state.age,
    heightCm: 175,
    weightKg: 70,
    bodyFatLevel: null,
    fitnessLevel: state.fitnessLevel as GeneratorProfile["fitnessLevel"],
    trainingYears: state.fitnessLevel === "Advanced" ? 5 : 1,
    goal: state.goal as GeneratorProfile["goal"],
    priorityMuscles: state.selectedMuscles || [],
    physiqueFocus: "balanced",
    daysPerWeek: 3,
    sessionLengthMin: 45,
    equipment: state.equipment || [],
    location: "gym",
    injuries: ["none"],
    medicalCautions: [],
    mobilityLimited: false,
    intensityStyle: "straight sets",
    includeCardio: false,
    includeWarmup: true,
    includeCoreFinisher: false,
    avoidExercises: [],
    repBiasOverride: null,
    routine: null,
    program: null,
    generatorSeed: Math.random(),
  };

  const prog = generateProgram(exercises, profile);
  const day1 = prog.weeklyDays[0].exercises.map((e) => ({
    exercise: e.exercise,
    sets: e.sets,
    reps: e.reps,
    restSeconds: e.restSeconds,
    progression: prog.progressionModel,
  }));

  return { exercises: day1 };
};
