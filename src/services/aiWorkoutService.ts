"use client";
import { type Exercise } from "@/types/exercise";
import { type WorkoutRoutine, generateWorkout, type WorkoutProgram } from "./workoutGenerator";
import { useToastStore } from "@/store/useToastStore";
import type { WorkoutSession } from "@/db/schema";

export const isAiEnabled = true;

// ── Types ──
export interface AIWorkoutProfile {
  gender: "male" | "female" | null;
  age: number;
  goal: string | null;
  fitnessLevel: string | null;
  trainingYears: number;
  equipment: string[];
  priorityMuscles: string[];
  physiqueFocus: string;
  injuries: string[];
  medicalCautions: string[];
  mobilityLimited: boolean;
  daysPerWeek: number;
  sessionLengthMin: number;
  intensityStyle: string;
  includeCardio: boolean;
  includeWarmup: boolean;
  includeCoreFinisher: boolean;
  bodyFatLevel: string | null;
  heightCm: number;
  weightKg: number;
}

export interface RecentSessionData {
  date: string;
  name: string;
  exercises: Array<{
    exerciseId: string;
    exerciseName: string;
    sets: Array<{ weight: number; reps: number; completed: boolean }>;
  }>;
  duration: number;
  completed: boolean;
}

export interface AnalyticsSummary {
  streak: number;
  totalWorkouts: number;
  totalVolume: number;
  totalDuration: number;
  muscleGroupStats: Array<{ muscle: string; volume: number }>;
  weeklyTonnage: Array<{ week: string; tonnage: number }>;
}

export interface AICoachRequest {
  profile: AIWorkoutProfile;
  recentSessions: RecentSessionData[];
  personalRecords: Array<{
    exerciseId: string;
    exerciseName: string;
    maxWeight: number;
    max1RM: number;
    date: string;
  }>;
  analytics: AnalyticsSummary;
  exercises: Array<{
    id: string;
    name: string;
    target: string;
    equipment: string;
    bodyPart: string;
  }>;
  userPrompt?: string;
}

/**
 * Generate a workout using the AI Coach endpoint.
 * Passes the user's COMPLETE data: profile, workout history, PRs, analytics.
 * Falls back to the heuristic generator if AI is unavailable.
 */
export async function generateWorkoutAICoach(
  profile: AIWorkoutProfile,
  availableExercises: Exercise[],
  userData: {
    recentSessions: RecentSessionData[];
    personalRecords: Array<{
      exerciseId: string;
      exerciseName: string;
      maxWeight: number;
      max1RM: number;
      date: string;
    }>;
    analytics: AnalyticsSummary;
  },
  userPrompt?: string,
  /** Optional raw sessions for the ACWR + RPE engines (used in fallback). */
  engineSessions?: WorkoutSession[]
): Promise<{ routine: WorkoutRoutine; provider: string; analysis?: unknown }> {
  // Offline check — throw so the caller's catch block can build a program
  // with the full GeneratorProfile + sessions (not the legacy minimal state).
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    useToastStore.getState().addToast("error", "AI requires internet connection");
    throw new Error("Offline — AI coach unavailable");
  }

  // Build the request body with full user data
  const requestBody: AICoachRequest = {
    profile,
    recentSessions: userData.recentSessions,
    personalRecords: userData.personalRecords,
    analytics: userData.analytics,
    exercises: availableExercises.map((e) => ({
      id: e.id,
      name: e.name,
      target: e.target,
      equipment: e.equipment,
      bodyPart: e.bodyPart,
    })),
    userPrompt,
  };

  const res = await fetch("/api/ai-coach", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    if (errData.fallback) {
      useToastStore.getState().addToast("info", "AI service busy — used standard generator");
    }
    throw new Error(`AI coach API returned ${res.status}`);
  }

  const data = (await res.json()) as {
    text: string;
    provider: string;
    fallback?: boolean;
  };

  if (!data.text) throw new Error("No response text from AI");

  // Parse JSON
  let text = data.text.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  }

  const parsed = JSON.parse(text);
  if (!parsed.exercises || !Array.isArray(parsed.exercises)) {
    throw new Error("Invalid format from AI");
  }

  // Resolve exerciseIds to full Exercise objects
  const resolvedExercises = [];
  for (const aiEx of parsed.exercises) {
    const realEx = availableExercises.find((e) => e.id === aiEx.exerciseId);
    if (realEx) {
      resolvedExercises.push({
        exercise: realEx,
        sets: aiEx.sets || 3,
        reps: aiEx.reps || "8-12",
        restSeconds: aiEx.restSeconds || 90,
        progression: aiEx.progression || aiEx.rationale || "Focus on form.",
      });
    }
  }

  if (resolvedExercises.length === 0) {
    throw new Error("No valid exercises matched from AI response");
  }

  if (data.fallback) {
    useToastStore.getState().addToast("info", "AI service busy — used standard generator");
  }

  return {
    routine: { exercises: resolvedExercises },
    provider: data.provider,
    analysis: parsed.analysis,
  };
}

export async function generateWorkoutAI(
  state: {
    gender: "male" | "female" | null;
    age: number;
    goal: string | null;
    fitnessLevel: string | null;
    equipment: string[];
    selectedMuscles: string[];
  },
  availableExercises: Exercise[]
): Promise<WorkoutRoutine> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    useToastStore.getState().addToast("error", "AI requires internet connection");
    return generateWorkout(availableExercises, state);
  }

  try {
    const res = await fetch(`/api/ai-workout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        goal: state.goal,
        age: state.age,
        gender: state.gender,
        fitnessLevel: state.fitnessLevel,
        equipment: state.equipment,
        selectedMuscles: state.selectedMuscles,
      }),
    });

    if (!res.ok) throw new Error(`AI workout API returned ${res.status}`);

    const data = (await res.json()) as { text?: string; error?: string };
    if (data.error) {
      useToastStore.getState().addToast("error", data.error);
      return generateWorkout(availableExercises, state);
    }
    
    const text = data.text;
    if (!text) throw new Error("No response text from AI");

    const parsed = JSON.parse(text);
    if (!parsed.exercises || !Array.isArray(parsed.exercises)) {
      throw new Error("Invalid format from AI");
    }

    const resolvedExercises = [];
    for (const aiEx of parsed.exercises) {
      const realEx = availableExercises.find((e) => e.id === aiEx.exerciseId);
      if (realEx) {
        resolvedExercises.push({
          exercise: realEx,
          sets: aiEx.sets || 3,
          reps: aiEx.reps || "8-12",
          restSeconds: aiEx.restSeconds || 90,
          progression: aiEx.progression || "Focus on form and slow negative.",
        });
      }
    }

    if (resolvedExercises.length === 0) {
      throw new Error("No valid exercises matched from AI response.");
    }

    return { exercises: resolvedExercises };
  } catch (error) {
    console.error("AI Workout Generation failed. Falling back:", error);
    useToastStore.getState().addToast("error", "AI service unavailable, using standard generator");
    return generateWorkout(availableExercises, state);
  }
}

export async function refineWorkoutAI(
  _currentRoutine: WorkoutRoutine,
  _instruction: string,
  _availableExercises: Exercise[],
  _state: {
    gender: "male" | "female" | null;
    age: number;
    goal: string | null;
    fitnessLevel: string | null;
    equipment: string[];
    selectedMuscles: string[];
  }
): Promise<WorkoutRoutine> {
  throw new Error("AI refine not implemented in this build.");
}
