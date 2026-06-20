import { db, type WorkoutSession } from "../schema";

export async function getWorkoutSession(id: string): Promise<WorkoutSession | undefined> {
  return db.workoutSessions.get(id);
}

export async function addWorkoutSession(session: WorkoutSession): Promise<string> {
  return db.workoutSessions.add(session);
}

export async function updateWorkoutSession(
  id: string,
  changes: Partial<WorkoutSession>
): Promise<number> {
  return db.workoutSessions.update(id, changes);
}

export async function deleteWorkoutSession(id: string): Promise<void> {
  await db.workoutSessions.delete(id);
}

export async function getAllWorkoutSessions(): Promise<WorkoutSession[]> {
  return db.workoutSessions.toArray();
}

export async function getCompletedWorkoutSessions(): Promise<WorkoutSession[]> {
  return db.workoutSessions.filter((s) => s.completed === true).toArray();
}
