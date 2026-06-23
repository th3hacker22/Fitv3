"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { WorkoutProgram, WorkoutRoutine } from "../services/workoutGenerator";
import type { Exercise } from "@/types/exercise";

export interface GeneratorProfile {
  // Demographics & body
  gender: "male" | "female" | null;
  age: number;
  heightCm: number;
  weightKg: number;
  bodyFatLevel: "low" | "medium" | "high" | "unknown" | null;

  // Experience
  fitnessLevel: "Novice" | "Beginner" | "Intermediate" | "Advanced" | null;
  trainingYears: number;

  // Goal & Emphasis
  goal: "Strength" | "Hypertrophy" | "Fat Loss" | "Endurance" | "General Fitness" | "Recomp" | null;
  priorityMuscles: string[];
  physiqueFocus: "balanced" | "upper" | "lower" | "push" | "pull" | "glutes" | "arms" | "core";

  // Schedule & Logistics
  daysPerWeek: 2 | 3 | 4 | 5 | 6;
  sessionLengthMin: 30 | 45 | 60 | 75 | 90;
  equipment: string[];
  location: "home" | "gym" | "outdoor";

  // Health / safety
  injuries: string[];
  medicalCautions: string[];
  mobilityLimited: boolean;

  // Preferences
  intensityStyle: "straight sets" | "supersets" | "circuits";
  includeCardio: boolean;
  includeWarmup: boolean;
  includeCoreFinisher: boolean;
  avoidExercises: string[];
  repBiasOverride?: "low" | "moderate" | "high" | null;

  // State
  routine: WorkoutRoutine | null;
  program: WorkoutProgram | null;
  generatorSeed: number;
}

interface GeneratorStore extends GeneratorProfile {
  updateProfile: (updates: Partial<GeneratorProfile>) => void;
  toggleEquipment: (item: string) => void;
  toggleMuscle: (muscle: string) => void;
  setRoutine: (routine: WorkoutRoutine) => void;
  setProgram: (program: WorkoutProgram) => void;
  swapExercise: (index: number, newExercise: WorkoutRoutine["exercises"][number]) => void;
  swapProgramExercise: (dayIndex: number, exerciseIndex: number, newExercise: Exercise) => void;
  reset: () => void;
  regenerateSeed: () => void;
}

const initialState: Omit<
  GeneratorProfile,
  keyof Pick<GeneratorStore, "routine" | "program" | "generatorSeed">
> = {
  gender: null,
  age: 25,
  heightCm: 175,
  weightKg: 70,
  bodyFatLevel: null,
  fitnessLevel: null,
  trainingYears: 1,
  goal: null,
  priorityMuscles: [],
  physiqueFocus: "balanced",
  daysPerWeek: 3,
  sessionLengthMin: 45,
  equipment: [],
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
};

export const useGeneratorStore = create<GeneratorStore>()(
  persist(
    (set) => ({
      ...initialState,
      routine: null,
      program: null,
      generatorSeed: Math.random(),

      updateProfile: (updates) => set((state) => ({ ...state, ...updates })),

      toggleEquipment: (item) =>
        set((state) => ({
          equipment: state.equipment.includes(item)
            ? state.equipment.filter((i) => i !== item)
            : [...state.equipment, item],
        })),

      toggleMuscle: (muscle) =>
        set((state) => ({
          priorityMuscles: state.priorityMuscles.includes(muscle)
            ? state.priorityMuscles.filter((m) => m !== muscle)
            : [...state.priorityMuscles, muscle],
          // Keep backwards compatibility for old selectedMuscles name if needed
        })),

      setRoutine: (routine) => set({ routine }),
      setProgram: (program) => set({ program }),

      swapExercise: (index, newExercise) =>
        set((state) => {
          if (!state.routine) return state;
          const newExercises = [...state.routine.exercises];
          newExercises[index] = newExercise;
          return { routine: { ...state.routine, exercises: newExercises } };
        }),

      swapProgramExercise: (dayIndex, exerciseIndex, newExercise) =>
        set((state) => {
          if (!state.program) return state;
          const newProgram = { ...state.program };
          const newWeeklyDays = [...newProgram.weeklyDays];
          const newDay = { ...newWeeklyDays[dayIndex] };
          const newExercises = [...newDay.exercises];
          newExercises[exerciseIndex] = { ...newExercises[exerciseIndex], exercise: newExercise };
          newDay.exercises = newExercises;
          newWeeklyDays[dayIndex] = newDay;
          newProgram.weeklyDays = newWeeklyDays;
          return { program: newProgram };
        }),

      reset: () => set({ ...initialState, routine: null, program: null }),
      regenerateSeed: () => set({ generatorSeed: Math.random() }),
    }),
    {
      name: "pulse-generator",
    }
  )
);
