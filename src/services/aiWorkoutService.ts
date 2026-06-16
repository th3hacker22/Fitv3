import { GoogleGenAI, Type } from "@google/genai";
import { type Exercise } from "@/types/exercise";
import { type WorkoutRoutine, generateWorkout } from "./workoutGenerator";

// WARNING: Client-side Gemini API key exposure is insecure for production.
// This is done here explicitly per the prompt instructions. In a real-world application,
// this logic must be moved to a secure server-side endpoint (/api/generate-workout)
// rather than importing the key directly in the Vite client.
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

export const isAiEnabled = Boolean(apiKey);
const ai = isAiEnabled ? new GoogleGenAI({ apiKey }) : null;

// The schema matching WorkoutRoutine slightly simplified for AI response
const workoutSchema = {
  type: Type.OBJECT,
  properties: {
    exercises: {
      type: Type.ARRAY,
      description: "List of exercises in the workout plan",
      items: {
        type: Type.OBJECT,
        properties: {
          exerciseId: {
            type: Type.STRING,
            description:
              "ID of the exercise. MUST exactly match one from the provided list.",
          },
          sets: { type: Type.INTEGER, description: "Number of sets" },
          reps: {
            type: Type.STRING,
            description: "Number of reps (e.g. '8-12' or '5')",
          },
          restSeconds: {
            type: Type.INTEGER,
            description: "Rest time in seconds between sets",
          },
          progression: {
            type: Type.STRING,
            description: "Short tip on progression or form for this exercise",
          },
        },
        required: ["exerciseId", "sets", "reps", "restSeconds"],
      },
    },
  },
  required: ["exercises"],
};

export async function generateWorkoutAI(
  prompt: string,
  state: {
    gender: "male" | "female" | null;
    age: number;
    goal: "Strength" | "Hypertrophy" | "Weight Loss" | null;
    fitnessLevel: "Novice" | "Beginner" | "Advanced" | null;
    equipment: string[];
    selectedMuscles: string[];
  },
  availableExercises: Exercise[],
): Promise<WorkoutRoutine> {
  if (!isAiEnabled || !ai) {
    console.warn(
      "AI is not enabled (missing VITE_GEMINI_API_KEY). Falling back to standard generator.",
    );
    return generateWorkout(availableExercises, state);
  }

  try {
    const minimalExercises = availableExercises.map((e) => ({
      id: e.id,
      name: e.name,
      target: e.target,
      equipment: e.equipment,
    }));

    const systemPrompt = `You are an expert fitness coach. Your task is to generate a workout plan based on user requests.
The user profile is: ${state.age}yo ${state.gender}, level: ${state.fitnessLevel}, goal: ${state.goal}.
Equipment available: ${state.equipment.join(", ")}.
Target muscles: ${state.selectedMuscles.join(", ")}.

IMPORTANT: You must ONLY output JSON.
IMPORTANT: The 'exerciseId' field in the JSON MUST exactly match the 'id' field from one of the exercises in the list below.
Do not invent any exercises that are not in this list.

List of available exercises (ID: Name - Target - Equipment):
${minimalExercises.map((e) => `${e.id}: ${e.name} - ${e.target} - ${e.equipment}`).join("\n")}
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: workoutSchema,
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response text from Gemini");

    const parsed = JSON.parse(text);
    if (!parsed.exercises || !Array.isArray(parsed.exercises)) {
      throw new Error("Invalid format from Gemini");
    }

    // Map AI response IDs back to real Exercise objects
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
    console.error(
      "AI Workout Generation failed. Falling back to algorithmic generator. Error:",
      error,
    );
    return generateWorkout(availableExercises, state);
  }
}

export async function refineWorkoutAI(
  currentRoutine: WorkoutRoutine,
  instruction: string,
  availableExercises: Exercise[],
  state: {
    gender: "male" | "female" | null;
    age: number;
    goal: "Strength" | "Hypertrophy" | "Weight Loss" | null;
    fitnessLevel: "Novice" | "Beginner" | "Advanced" | null;
    equipment: string[];
    selectedMuscles: string[];
  },
): Promise<WorkoutRoutine> {
  if (!isAiEnabled || !ai) {
    throw new Error("AI is not enabled. Cannot refine workout.");
  }

  try {
    const minimalExercises = availableExercises.map((e) => ({
      id: e.id,
      name: e.name,
      target: e.target,
      equipment: e.equipment,
    }));

    const currentRoutineText = currentRoutine.exercises
      .map(
        (e) =>
          `- ${e.exercise.name} (ID: ${e.exercise.id}), ${e.sets} sets x ${e.reps} reps`,
      )
      .join("\n");

    const systemPrompt = `You are an expert fitness coach refining an existing workout plan.
The user profile is: ${state.age}yo ${state.gender}, level: ${state.fitnessLevel}, goal: ${state.goal}.

Current Workout Plan:
${currentRoutineText}

User's Modification Request:
"${instruction}"

IMPORTANT: You must ONLY output JSON.
IMPORTANT: Modify the workout according to the request. The 'exerciseId' field in the JSON MUST exactly match the 'id' field from one of the exercises in the list below. Do not invent exercises.

List of available exercises:
${minimalExercises.map((e) => `${e.id}: ${e.name} - ${e.target} - ${e.equipment}`).join("\n")}
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: instruction,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: workoutSchema,
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response text from Gemini");

    const parsed = JSON.parse(text);
    if (!parsed.exercises || !Array.isArray(parsed.exercises)) {
      throw new Error("Invalid format from Gemini");
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
          progression: aiEx.progression || "Focus on form.",
        });
      }
    }

    if (resolvedExercises.length === 0) {
      throw new Error("No valid exercises matched from AI response.");
    }

    return { exercises: resolvedExercises };
  } catch (error) {
    console.error("AI Workout Refinement failed:", error);
    throw error;
  }
}
