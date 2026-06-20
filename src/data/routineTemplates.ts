import { type RoutineExercise } from "@/db";
import { type Exercise } from "@/types/exercise";
import { uid } from "@/utils/id";

export interface RoutineTemplate {
  name: string;
  description: string;
  matchers: {
    target: string[];
    equipment: string[];
    sets: number;
    reps: number;
  }[];
}

export const routineTemplates: RoutineTemplate[] = [
  {
    name: "Push Day (PPL)",
    description: "Chest, Shoulders, and Triceps focus.",
    matchers: [
      {
        target: ["pectorals"],
        equipment: ["barbell", "dumbbell"],
        sets: 3,
        reps: 10,
      },
      {
        target: ["pectorals"],
        equipment: ["dumbbell", "machine"],
        sets: 3,
        reps: 12,
      },
      { target: ["delts"], equipment: ["dumbbell"], sets: 3, reps: 12 },
      {
        target: ["triceps"],
        equipment: ["cable", "dumbbell"],
        sets: 3,
        reps: 12,
      },
    ],
  },
  {
    name: "Pull Day (PPL)",
    description: "Back, Biceps, and Forearms focus.",
    matchers: [
      {
        target: ["lats"],
        equipment: ["cable", "body weight"],
        sets: 3,
        reps: 10,
      },
      {
        target: ["upper back", "lats"],
        equipment: ["barbell", "dumbbell"],
        sets: 3,
        reps: 10,
      },
      {
        target: ["biceps"],
        equipment: ["dumbbell", "barbell"],
        sets: 3,
        reps: 12,
      },
      {
        target: ["biceps"],
        equipment: ["cable", "dumbbell"],
        sets: 3,
        reps: 15,
      },
    ],
  },
  {
    name: "Legs Day (PPL)",
    description: "Quads, Hamstrings, and Calves focus.",
    matchers: [
      { target: ["quads"], equipment: ["barbell"], sets: 4, reps: 8 },
      {
        target: ["hamstrings"],
        equipment: ["machine", "barbell"],
        sets: 3,
        reps: 10,
      },
      {
        target: ["quads"],
        equipment: ["machine", "dumbbell"],
        sets: 3,
        reps: 12,
      },
      {
        target: ["calves"],
        equipment: ["machine", "body weight"],
        sets: 4,
        reps: 15,
      },
    ],
  },
  {
    name: "Full Body Foundational",
    description: "Hits all major muscle groups.",
    matchers: [
      {
        target: ["quads"],
        equipment: ["barbell", "dumbbell"],
        sets: 3,
        reps: 10,
      },
      {
        target: ["pectorals"],
        equipment: ["barbell", "dumbbell"],
        sets: 3,
        reps: 10,
      },
      {
        target: ["lats"],
        equipment: ["cable", "body weight"],
        sets: 3,
        reps: 10,
      },
      {
        target: ["delts"],
        equipment: ["dumbbell", "barbell"],
        sets: 3,
        reps: 12,
      },
      {
        target: ["biceps"],
        equipment: ["dumbbell", "cable"],
        sets: 2,
        reps: 12,
      },
      {
        target: ["triceps"],
        equipment: ["cable", "dumbbell"],
        sets: 2,
        reps: 12,
      },
    ],
  },
];

export function buildTemplateRoutine(
  template: RoutineTemplate,
  allExercises: Exercise[]
): { name: string; exercises: RoutineExercise[] } {
  const exercisesToAdd: RoutineExercise[] = [];
  const usedExerciseIds = new Set<string>();

  for (let i = 0; i < template.matchers.length; i++) {
    const matcher = template.matchers[i];

    // Find matching exercise
    const match = allExercises.find(
      (ex) =>
        !usedExerciseIds.has(ex.id) &&
        matcher.target.some(
          (t) =>
            ex.target.toLowerCase().includes(t.toLowerCase()) ||
            ex.bodyPart.toLowerCase().includes(t.toLowerCase())
        ) &&
        matcher.equipment.some((e) => ex.equipment.toLowerCase().includes(e.toLowerCase()))
    );

    if (match) {
      usedExerciseIds.add(match.id);
      exercisesToAdd.push({
        exerciseId: match.id,
        exerciseName: match.name,
        targetSets: matcher.sets,
        targetReps: matcher.reps,
        restTimer: 60,
        isSupersetWithNext: false,
        order: i,
        imageUrl: match.imageUrl,
        equipment: match.equipment,
      });
    }
  }

  return {
    name: template.name,
    exercises: exercisesToAdd,
  };
}
