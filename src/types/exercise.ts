// ── Exercise Types from hasaneyldrm/exercises-dataset ──

export interface ExerciseRaw {
  id: string;
  name: string;
  category: string;
  body_part: string;
  equipment: string;
  instructions: {
    en: string;
    tr: string;
  };
  instruction_steps?: {
    en: string[];
    tr: string[];
  };
  muscle_group: string;
  secondary_muscles: string[];
  target: string;
  image: string;
  gif_url: string;
  created_at: string;
}

export interface Exercise {
  id: string;
  name: string;
  category: string;
  bodyPart: string;
  equipment: string;
  instructions: string;
  instructionSteps: string[];
  muscleGroup: string;
  secondaryMuscles: string[];
  target: string;
  imageUrl: string;
  gifUrl: string;
}

// ── Base URL for media ──
export const MEDIA_BASE_URL =
  "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main";

// ── Transform raw exercise to our format ──
export function transformExercise(raw: ExerciseRaw): Exercise {
  return {
    id: raw.id,
    name: raw.name,
    category: raw.category,
    bodyPart: raw.body_part,
    equipment: raw.equipment,
    instructions: raw.instructions.en,
    instructionSteps: raw.instruction_steps?.en || [raw.instructions.en],
    muscleGroup: raw.muscle_group,
    secondaryMuscles: raw.secondary_muscles,
    target: raw.target,
    imageUrl: `${MEDIA_BASE_URL}/${raw.image}`,
    gifUrl: `${MEDIA_BASE_URL}/${raw.gif_url}`,
  };
}
