import { Exercise } from "@/types/exercise";
import { getMuscleIdsForExercise } from "@/utils/muscleMapper";
import { GeneratorProfile } from "@/store/useGeneratorStore";

// --- Types ---

export interface ProgramExercise {
  exercise: Exercise;
  sets: number;
  reps: string;
  restSeconds: number;
  tempo?: string;
  role: "compound" | "isolation" | "warmup" | "core" | "cardio";
  note?: string;
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

// Simple PRNG: mulberry32
function mulberry32(a: number) {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = Math.imul(31, hash) + str.charCodeAt(i) | 0;
  }
  return hash;
}

const isCompound = (exercise: Exercise): boolean => {
  const name = exercise.name.toLowerCase();
  const ckw = ["squat","press","deadlift","row","pullup","pull-up","chinup","chin-up","lunge","dip","clean","snatch","pushup","push-up"];
  if (ckw.some(kw => name.includes(kw))) return true;

  const target = exercise.target.toLowerCase();
  const ct = ["quads","glutes","hamstrings","lats","upper back","pectorals"];
  if (ct.includes(target) && ["barbell","body weight","kettlebell","dumbbell","cable","machine"].some(eq => exercise.equipment.toLowerCase().includes(eq))) {
    const ikw = ["curl","extension","raise","fly","kickback","crunch","shrug"];
    if (!ikw.some(kw => name.includes(kw))) return true;
  }
  return false;
};

const isContraindicated = (exercise: Exercise, injuries: string[]): boolean => {
  if (injuries.length === 0 || injuries.includes("none")) return false;
  const name = exercise.name.toLowerCase();
  const target = exercise.target.toLowerCase();
  
  if (injuries.includes("lower back")) {
    if (name.includes("deadlift") || name.includes("good morning") || name.includes("bent over")) return true;
  }
  if (injuries.includes("knee")) {
    if (name.includes("lunge") || name.includes("jump") || name.includes("extension") || name.includes("squat")) return true;
  }
  if (injuries.includes("shoulder")) {
    if (name.includes("upright row") || name.includes("behind neck") || name.includes("dip")) return true;
  }
  if (injuries.includes("elbow") || injuries.includes("wrist")) {
    if (name.includes("skullcrusher") || (name.includes("curl") && exercise.equipment === "barbell")) return true;
  }
  if (injuries.includes("neck")) {
    if (name.includes("neck") || name.includes("shrug")) return true;
  }
  if (injuries.includes("hip") || injuries.includes("ankle")) {
    if (name.includes("jump") || name.includes("box jump")) return true;
  }
  return false;
};

// --- Main Engine ---

export const generateProgram = (exercises: Exercise[], profile: GeneratorProfile): WorkoutProgram => {
  const prng = mulberry32(hashString(JSON.stringify(profile)) + profile.generatorSeed * 1000000);
  const nextRand = () => prng();
  const shuffle = <T>(arr: T[]): T[] => {
    let m = arr.length, t, i;
    while (m) {
      i = Math.floor(nextRand() * m--);
      t = arr[m];
      arr[m] = arr[i];
      arr[i] = t;
    }
    return arr;
  };

  const warnings: string[] = [];
  
  // Step 1: Base stats & recovery
  const isNovice = profile.trainingYears < 0.5 || profile.fitnessLevel === "Novice";
  const isAdvanced = profile.trainingYears > 5 || profile.fitnessLevel === "Advanced";
  
  let recoveryScore = 3; 
  if (profile.age > 50) recoveryScore--;
  if (isAdvanced) recoveryScore++;
  if (profile.daysPerWeek >= 5) recoveryScore--;
  if (profile.medicalCautions.length > 0) recoveryScore--;
  recoveryScore = Math.max(1, Math.min(5, recoveryScore));

  const goal = profile.goal || "Hypertrophy";
  
  // Step 2: Split design based on days
  let splitPlan: string[][] = []; // each element is an array of focus target parts
  let title = "";
  
  if (profile.daysPerWeek === 2) {
    title = "2-Day Full Body";
    splitPlan = [["Full Body"], ["Full Body"]];
  } else if (profile.daysPerWeek === 3) {
    if (profile.fitnessLevel === "Advanced" || profile.fitnessLevel === "Intermediate") {
      title = "3-Day PPL";
      splitPlan = [["Push", "Chest", "Shoulders", "Triceps"], ["Pull", "Back", "Biceps"], ["Legs", "Quads", "Hamstrings", "Glutes", "Calves"]];
    } else {
      title = "3-Day Full Body";
      splitPlan = [["Full Body"], ["Full Body"], ["Full Body"]];
    }
  } else if (profile.daysPerWeek === 4) {
    if (profile.physiqueFocus === "push" || profile.physiqueFocus === "pull" || profile.physiqueFocus === "arms") {
      title = "4-Day PPL + Upper";
      splitPlan = [["Push", "Chest", "Shoulders", "Triceps"], ["Pull", "Back", "Biceps"], ["Legs", "Quads", "Hamstrings"], ["Upper", "Chest", "Back", "Arms"]];
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
    splitPlan.forEach(p => { if (p.includes("Lower") || p.includes("Legs")) p.push("Glutes"); });
  }

  // Step 4: Exercise Pool filtering
  let pool = exercises.filter(e => {
    // Exclude avoided
    if (profile.avoidExercises.includes(e.id)) return false;
    // Equipment
    if (profile.equipment.length > 0 && !profile.equipment.includes("Full Gym")) {
      const eq = e.equipment.toLowerCase();
      // Relaxed match
      let match = false;
      if (profile.equipment.includes("Bodyweight") && eq.includes("body weight")) match = true;
      if (profile.equipment.includes("Dumbbells") && (eq.includes("dumbbell") || eq.includes("kettlebell"))) match = true;
      if (profile.equipment.includes("Barbell") && eq.includes("barbell")) match = true;
      if (profile.equipment.includes("Machines") && (eq.includes("machine") || eq.includes("smith") || eq.includes("leverage"))) match = true;
      if (profile.equipment.includes("Cables") && eq.includes("cable")) match = true;
      if (profile.equipment.includes("Bands") && eq.includes("band")) match = true;
      if (!match) return false;
    } else if (profile.location === "home" && profile.equipment.length === 0) {
      if (!e.equipment.toLowerCase().includes("body weight")) return false;
    }
    return true;
  });

  // Contraindications fallback pattern
  const safePool = pool.filter(e => !isContraindicated(e, profile.injuries));
  if (safePool.length >= pool.length * 0.2) {
    pool = safePool;
    if (profile.injuries.length > 0 && profile.injuries[0] !== "none") {
      warnings.push(`Filtered out exercises that commonly aggravate: ${profile.injuries.join(', ')}.`);
    }
  } else {
    warnings.push("Too few exercises remain after injury filters. Please exercise caution.");
  }
  
  if (profile.medicalCautions.length > 0) {
    warnings.push(`Given your medical conditions (${profile.medicalCautions.join(', ')}), keep intensity moderate, avoid valsalva maneuver, and prioritize safety.`);
  }

  // Fallback if pool is too tiny
  if (pool.length < 5) pool = exercises;

  // Step 5: Day builds
  const weeklyDays: ProgramDay[] = [];
  const usedExerciseIds = new Set<string>();

  splitPlan.forEach((focusTargets, dayIndex) => {
    const dayExList: ProgramExercise[] = [];
    
    // Determine number of exercises based on session length ~ (len / 10)
    let targetExCount = Math.max(3, Math.min(8, Math.floor(profile.sessionLengthMin / 8)));
    
    // Day pool heuristic matching
    const dayPool = shuffle([...pool]);
    const scoreEx = (e: Exercise) => {
      let score = 0;
      const bp = e.bodyPart.toLowerCase();
      const tg = e.target.toLowerCase();
      const mus = getMuscleIdsForExercise(e.target, e.secondaryMuscles);
      
      const strFocus = focusTargets.map(f => f.toLowerCase()).join(" ");
      if (strFocus.includes("full body")) score += 5;
      else {
        if (strFocus.includes(bp) || strFocus.includes(tg)) score += 10;
        if (strFocus.includes("push") && (tg.includes("chest") || tg.includes("triceps") || tg.includes("delts"))) score += 10;
        if (strFocus.includes("pull") && (tg.includes("back") || tg.includes("biceps") || tg.includes("lats") || bp.includes("back"))) score += 10;
        if (strFocus.includes("legs") && (bp.includes("leg") || tg.includes("glutes") || tg.includes("calves"))) score += 10;
        if (strFocus.includes("upper") && (bp.includes("chest") || bp.includes("back") || bp.includes("arm") || bp.includes("shoulder") || bp.includes("neck"))) score += 10;
        if (strFocus.includes("lower") && (bp.includes("leg") || tg.includes("glutes") || tg.includes("calves"))) score += 10;
        if (strFocus.includes("glutes") && tg.includes("glutes")) score += 15;
      }
      
      if (profile.priorityMuscles.some(pm => mus.includes(pm))) score += 5;
      if (profile.mobilityLimited && e.equipment.includes("machine")) score += 3;
      if (usedExerciseIds.has(e.id)) score -= 15;
      
      return score;
    };

    dayPool.sort((a,b) => scoreEx(b) - scoreEx(a));
    
    // Try to pick compounds first
    const compPool = dayPool.filter(isCompound);
    const isoPool = dayPool.filter(e => !isCompound(e));
    
    let compoundsAdded = 0;
    while(compoundsAdded < 2 && compPool.length > 0) {
      const e = compPool.shift();
      if (e && scoreEx(e) > -5) {
        dayExList.push({ exercise: e, sets: 0, reps: "", restSeconds: 0, role: "compound" });
        usedExerciseIds.add(e.id);
        compoundsAdded++;
      } else break;
    }
    
    while(dayExList.length < targetExCount && (compPool.length > 0 || isoPool.length > 0)) {
      const p = (isoPool.length > 0 && nextRand() > 0.3) ? isoPool : compPool;
      const e = p.shift();
      if (e) {
        dayExList.push({ exercise: e, sets: 0, reps: "", restSeconds: 0, role: "isolation" });
        usedExerciseIds.add(e.id);
      }
    }
    
    if (profile.includeCoreFinisher && dayExList.length < targetExCount + 1) {
      const cores = shuffle(pool.filter(e => e.bodyPart.toLowerCase() === "waist"));
      if (cores.length > 0) {
        dayExList.push({ exercise: cores[0], sets: 0, reps: "", restSeconds: 0, role: "core" });
      }
    }

    if (profile.includeCardio && dayExList.length < targetExCount + 2) {
      const cardio = shuffle(pool.filter(e => e.bodyPart.toLowerCase() === "cardio"));
      if (cardio.length > 0) {
        dayExList.push({ exercise: cardio[0], sets: 1, reps: "10-20 min", restSeconds: 0, role: "cardio" });
      }
    }

    // Default fallback if a day is empty
    if (dayExList.length === 0) {
      dayExList.push({ exercise: pool[0], sets: 3, reps: "10", restSeconds: 60, role: "isolation" });
    }

    // Step 6: Sets / Reps
    let totalMins = 0;
    dayExList.forEach(pe => {
      let sets = 3;
      let reps = "8-12";
      let rest = 90;
      let tempo = "2-0-1";
      
      const repBias = profile.repBiasOverride || (goal === "Strength" ? "low" : (goal === "Hypertrophy" || goal === "Recomp" ? "moderate" : "high"));
      if (repBias === "low") { reps = "3-6"; rest = 180; }
      else if (repBias === "moderate") { reps = pe.role === "compound" ? "6-8" : "10-15"; }
      else { reps = pe.role === "compound" ? "10-12" : "15-20"; rest = 60; }

      if (pe.role === "compound") sets = recoveryScore < 3 ? 3 : 4;
      if (pe.role === "isolation") sets = recoveryScore < 3 ? 2 : 3;
      if (pe.role === "core") { sets = 3; reps = "15-25"; rest = 45; }
      
      pe.sets = sets;
      pe.reps = reps;
      pe.restSeconds = rest;
      pe.tempo = tempo;
      
      if (goal === "Strength" && pe.role === "compound") pe.note = "Focus on explosive concentric, leave 1-2 reps in the tank.";
      
      totalMins += (sets * (45 + rest)) / 60;
    });

    weeklyDays.push({
      name: `Day ${dayIndex + 1} — ${focusTargets[0]}`,
      focus: focusTargets,
      exercises: dayExList,
      estimatedMinutes: Math.round(totalMins + 5) // +5 warmup buffer
    });
  });

  const prog = isNovice ? "Linear Progression: Add a small amount of weight each session when you can comfortably hit the top of the rep range."
             : "Double Progression: Work up to the top of your rep range across all sets. Once achieved, increase weight slightly and restart at the bottom of the rep range.";

  if (warnings.length === 0) warnings.push("Always consult a physical therapist before beginning a new strenuous routine.");             

  return {
    title,
    summary: `A ${profile.daysPerWeek}-day ${goal.toLowerCase()} focused program customized for your experience level.`,
    weeklyDays,
    progressionModel: prog,
    warnings
  };
};

export const generateWorkout = (
  exercises: Exercise[],
  state: {
    gender: any;
    age: number;
    goal: any;
    fitnessLevel: any;
    equipment: string[];
    selectedMuscles: string[]; // backward compat map to priorityMuscles
  }
): WorkoutRoutine => {
  // Translate old state to new profile to reuse engine, return day 1
  const profile: GeneratorProfile = {
    gender: state.gender, age: state.age, heightCm: 175, weightKg: 70, bodyFatLevel: null,
    fitnessLevel: state.fitnessLevel, trainingYears: state.fitnessLevel === "Advanced" ? 5 : 1,
    goal: state.goal, priorityMuscles: state.selectedMuscles || [], physiqueFocus: "balanced",
    daysPerWeek: 3, sessionLengthMin: 45, equipment: state.equipment || [], location: "gym",
    injuries: ["none"], medicalCautions: [], mobilityLimited: false, intensityStyle: "straight sets",
    includeCardio: false, includeWarmup: true, includeCoreFinisher: false, avoidExercises: [],
    repBiasOverride: null, routine: null, program: null, generatorSeed: Math.random()
  };
  
  const prog = generateProgram(exercises, profile);
  const day1 = prog.weeklyDays[0].exercises.map(e => ({
    exercise: e.exercise,
    sets: e.sets,
    reps: e.reps,
    restSeconds: e.restSeconds,
    progression: prog.progressionModel
  }));
  
  return { exercises: day1 };
};
