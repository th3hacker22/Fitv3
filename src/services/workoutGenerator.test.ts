import { describe, it, expect } from "vitest";
import type { Exercise } from "@/types/exercise";
import type { GeneratorProfile } from "@/store/useGeneratorStore";
import { generateProgram, generateWorkout } from "./workoutGenerator";

function ex(id: string, name: string, bodyPart: string, target: string, equipment = "barbell"): Exercise {
  return {
    id, name, category: "strength", bodyPart, equipment,
    instructions: "", instructionSteps: [], muscleGroup: target,
    secondaryMuscles: [], target, imageUrl: "", gifUrl: "",
  };
}

const POOL: Exercise[] = [
  ex("bench", "Barbell Bench Press", "chest", "pectorals"),
  ex("incline", "Incline Dumbbell Press", "chest", "pectorals", "dumbbell"),
  ex("fly", "Cable Fly", "chest", "pectorals", "cable"),
  ex("ohp", "Overhead Press", "shoulders", "delts"),
  ex("lateral", "Lateral Raise", "shoulders", "delts", "dumbbell"),
  ex("row", "Barbell Row", "back", "upper back"),
  ex("pulldown", "Lat Pulldown", "back", "lats", "cable"),
  ex("curl", "Dumbbell Curl", "upper arms", "biceps", "dumbbell"),
  ex("pushdown", "Triceps Pushdown", "upper arms", "triceps", "cable"),
  ex("squat", "Barbell Squat", "upper legs", "quads"),
  ex("rdl", "Romanian Deadlift", "upper legs", "hamstrings"),
  ex("calf", "Standing Calf Raise", "lower legs", "calves", "machine"),
  ex("plank", "Plank", "waist", "abs", "body weight"),
];

function buildProfile(overrides: Partial<GeneratorProfile> = {}): GeneratorProfile {
  return {
    gender: "male", age: 25, heightCm: 175, weightKg: 70, bodyFatLevel: null,
    fitnessLevel: "Intermediate", trainingYears: 2, goal: "Hypertrophy",
    priorityMuscles: [], physiqueFocus: "balanced", daysPerWeek: 3,
    sessionLengthMin: 60, equipment: [], location: "gym", injuries: ["none"],
    medicalCautions: [], mobilityLimited: false, intensityStyle: "straight sets",
    includeCardio: false, includeWarmup: true, includeCoreFinisher: false,
    avoidExercises: [], repBiasOverride: null, routine: null, program: null,
    generatorSeed: 0.42,
    ...overrides,
  };
}

describe("generateProgram", () => {
  it("is deterministic for the same profile and seed", () => {
    const a = generateProgram(POOL, buildProfile());
    const b = generateProgram(POOL, buildProfile());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("produces the requested number of training days", () => {
    expect(generateProgram(POOL, buildProfile({ daysPerWeek: 3 })).weeklyDays).toHaveLength(3);
    expect(generateProgram(POOL, buildProfile({ daysPerWeek: 5 })).weeklyDays).toHaveLength(5);
    expect(generateProgram(POOL, buildProfile({ daysPerWeek: 6 })).weeklyDays).toHaveLength(6);
  });

  it("assigns concrete sets, reps and rest to every exercise", () => {
    const program = generateProgram(POOL, buildProfile());
    const all = program.weeklyDays.flatMap((d) => d.exercises);
    expect(all.length).toBeGreaterThan(0);
    for (const pe of all) {
      expect(pe.sets).toBeGreaterThan(0);
      expect(pe.reps).not.toBe("");
      expect(pe.exercise).toBeTruthy();
    }
  });

  it("never includes avoided exercises", () => {
    const program = generateProgram(POOL, buildProfile({ avoidExercises: ["bench", "squat"] }));
    const ids = program.weeklyDays.flatMap((d) => d.exercises.map((e) => e.exercise.id));
    expect(ids).not.toContain("bench");
    expect(ids).not.toContain("squat");
  });

  it("uses lower rep ranges for a strength goal", () => {
    const program = generateProgram(POOL, buildProfile({ goal: "Strength" }));
    const compound = program.weeklyDays
      .flatMap((d) => d.exercises)
      .find((e) => e.role === "compound");
    expect(compound?.reps).toBe("3-6");
  });

  it("always returns at least one warning/disclaimer", () => {
    expect(generateProgram(POOL, buildProfile()).warnings.length).toBeGreaterThan(0);
  });

  it("estimates a positive session duration per day", () => {
    const program = generateProgram(POOL, buildProfile());
    for (const day of program.weeklyDays) {
      expect(day.estimatedMinutes).toBeGreaterThan(0);
    }
  });
});

describe("generateWorkout (legacy single-day adapter)", () => {
  it("returns a routine with at least one exercise", () => {
    const routine = generateWorkout(POOL, {
      gender: "male", age: 25, goal: "Hypertrophy",
      fitnessLevel: "Intermediate", equipment: [], selectedMuscles: [],
    });
    expect(routine.exercises.length).toBeGreaterThan(0);
    expect(routine.exercises[0].progression).toBeTruthy();
  });
});
