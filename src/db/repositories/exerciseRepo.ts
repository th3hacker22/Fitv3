import { db } from "../schema";
import type { Exercise } from "@/types/exercise";

export async function getExercise(id: string): Promise<Exercise | undefined> {
  return db.exercises_v2.get(id);
}

export async function addExercise(exercise: Exercise): Promise<string> {
  return db.exercises_v2.add(exercise);
}

export async function updateExercise(id: string, changes: Partial<Exercise>): Promise<number> {
  return db.exercises_v2.update(id, changes);
}

export async function deleteExercise(id: string): Promise<void> {
  await db.exercises_v2.delete(id);
}

export async function getAllExercises(): Promise<Exercise[]> {
  return db.exercises_v2.toArray();
}

export async function getExercisesByMuscleGroup(muscleGroup: string): Promise<Exercise[]> {
  return db.exercises_v2.where("muscleGroup").equals(muscleGroup).toArray();
}

export async function getExercisesByCategory(category: string): Promise<Exercise[]> {
  return db.exercises_v2.where("category").equals(category).toArray();
}
