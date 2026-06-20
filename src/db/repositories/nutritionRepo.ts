import { db, type FoodEntry, type NutritionGoal, type UnlockedAchievement } from "../schema";

// ── Food Entries CRUD ──
export async function getFoodEntry(id: string): Promise<FoodEntry | undefined> {
  return db.foodEntries.get(id);
}

export async function addFoodEntry(entry: FoodEntry): Promise<string> {
  return db.foodEntries.add(entry);
}

export async function updateFoodEntry(id: string, changes: Partial<FoodEntry>): Promise<number> {
  return db.foodEntries.update(id, changes);
}

export async function deleteFoodEntry(id: string): Promise<void> {
  await db.foodEntries.delete(id);
}

export async function getAllFoodEntries(): Promise<FoodEntry[]> {
  return db.foodEntries.toArray();
}

// ── Nutrition Goals CRUD ──
export async function getNutritionGoal(id: string): Promise<NutritionGoal | undefined> {
  return db.nutritionGoals.get(id);
}

export async function addNutritionGoal(goal: NutritionGoal): Promise<string> {
  return db.nutritionGoals.add(goal);
}

export async function updateNutritionGoal(
  id: string,
  changes: Partial<NutritionGoal>
): Promise<number> {
  return db.nutritionGoals.update(id, changes);
}

export async function deleteNutritionGoal(id: string): Promise<void> {
  await db.nutritionGoals.delete(id);
}

export async function getAllNutritionGoals(): Promise<NutritionGoal[]> {
  return db.nutritionGoals.toArray();
}

// ── Unlocked Achievements CRUD ──
export async function getUnlockedAchievement(id: string): Promise<UnlockedAchievement | undefined> {
  return db.unlockedAchievements.get(id);
}

export async function addUnlockedAchievement(achievement: UnlockedAchievement): Promise<string> {
  return db.unlockedAchievements.add(achievement);
}

export async function updateUnlockedAchievement(
  id: string,
  changes: Partial<UnlockedAchievement>
): Promise<number> {
  return db.unlockedAchievements.update(id, changes);
}

export async function deleteUnlockedAchievement(id: string): Promise<void> {
  await db.unlockedAchievements.delete(id);
}

export async function getAllUnlockedAchievements(): Promise<UnlockedAchievement[]> {
  return db.unlockedAchievements.toArray();
}
