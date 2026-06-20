import { db, type Routine } from "../schema";

export async function getRoutine(id: string): Promise<Routine | undefined> {
  return db.routines.get(id);
}

export async function addRoutine(routine: Routine): Promise<string> {
  return db.routines.add(routine);
}

export async function updateRoutine(id: string, changes: Partial<Routine>): Promise<number> {
  return db.routines.update(id, changes);
}

export async function deleteRoutine(id: string): Promise<void> {
  await db.routines.delete(id);
}

export async function getAllRoutines(): Promise<Routine[]> {
  return db.routines.toArray();
}
