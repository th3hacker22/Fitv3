import { db, type Goal } from "../schema";

/**
 * Goal Repository (B3).
 *
 * CRUD + soft-delete for the goals table. Follows the same pattern as
 * routineRepo.ts. Soft-delete sets `deleted = true` so synced copies
 * can replicate the deletion.
 */

export async function getGoal(id: string): Promise<Goal | undefined> {
  return db.goals.get(id);
}

export async function addGoal(goal: Goal): Promise<string> {
  return db.goals.add(goal);
}

export async function updateGoal(id: string, changes: Partial<Goal>): Promise<number> {
  return db.goals.update(id, changes);
}

export async function softDeleteGoal(id: string): Promise<void> {
  const now = new Date().toISOString();
  await db.goals.update(id, { deleted: true, updatedAt: now });
}

export async function getAllGoals(): Promise<Goal[]> {
  return db.goals.filter((g) => !g.deleted).toArray();
}

export async function getActiveGoals(): Promise<Goal[]> {
  return db.goals.filter((g) => !g.deleted && !g.achieved).toArray();
}
