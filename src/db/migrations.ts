import type Dexie from "dexie";
import { uid } from "@/utils/id";

export function registerMigrations(db: Dexie) {
  db.version(4).stores({
    exercises_v2: "id, category, muscleGroup",
    workoutSessions: "++id, date, completed",
    bodyMeasurements: "++id, date",
    progressPhotos: "++id, date, type",
    userProfile: "++id",
    routines: "++id, name",
  });

  db.version(5)
    .stores({
      exercises_v2: "id, category, muscleGroup",
      workoutSessions: "++id, date, completed",
      bodyMeasurements: "++id, date",
      progressPhotos: "++id, date, type",
      userProfile: "++id",
      routines: "++id, name",
    })
    .upgrade(async (tx) => {
      const upgradeCollection = async (tableName: string) => {
        const collection = tx.table(tableName);
        const records = await collection.toArray();
        for (const record of records) {
          if (typeof record.id === "number") {
            await collection.delete(record.id);
            record.id = uid();
            await collection.add(record);
          }
        }
      };

      await upgradeCollection("workoutSessions");
      await upgradeCollection("bodyMeasurements");
      await upgradeCollection("progressPhotos");
      await upgradeCollection("userProfile");
      await upgradeCollection("routines");
    });

  db.version(6)
    .stores({
      exercises_v2: "id, category, muscleGroup",
      workoutSessions: "++id, date, completed, updatedAt, deleted",
      bodyMeasurements: "++id, date, updatedAt, deleted",
      progressPhotos: "++id, date, type, updatedAt, deleted",
      userProfile: "++id, updatedAt, deleted",
      routines: "++id, name, updatedAt, deleted",
    })
    .upgrade(async (tx) => {
      const time = new Date().toISOString();
      const upgradeColl = async (tableName: string) => {
        const collection = tx.table(tableName);
        await collection.toCollection().modify((item) => {
          if (!item.updatedAt) item.updatedAt = item.createdAt || time;
          if (item.deleted === undefined) item.deleted = false;
        });
      };
      await upgradeColl("workoutSessions");
      await upgradeColl("bodyMeasurements");
      await upgradeColl("userProfile");
      await upgradeColl("routines");
    });

  db.version(8).stores({
    exercises_v2: "id, category, muscleGroup",
    workoutSessions: "++id, date, completed, updatedAt, deleted",
    bodyMeasurements: "++id, date, updatedAt, deleted",
    progressPhotos: "++id, date, type, updatedAt, deleted",
    userProfile: "++id, updatedAt, deleted",
    routines: "++id, name, updatedAt, deleted",
    foodEntries: "id, date, mealType, updatedAt, deleted",
    nutritionGoals: "id, updatedAt, deleted",
    unlockedAchievements: "id, achievementId, updatedAt, deleted",
  });

  db.version(9).stores({
    exercises_v2: "id, category, muscleGroup, supersetId",
    workoutSessions: "++id, date, completed, updatedAt, deleted, supersetId",
    bodyMeasurements: "++id, date, updatedAt, deleted",
    progressPhotos: "++id, date, type, updatedAt, deleted",
    userProfile: "++id, updatedAt, deleted",
    routines: "++id, name, updatedAt, deleted",
    foodEntries: "id, date, mealType, updatedAt, deleted",
    nutritionGoals: "id, updatedAt, deleted",
    unlockedAchievements: "id, achievementId, updatedAt, deleted",
  });

  // ── Learning Loop ──
  // New table for per-exercise behavioral feedback (skips/swaps/completions).
  // No data migration needed — table starts empty. All existing stores are
  // re-declared verbatim because Dexie requires every version to list every
  // store (stores omitted from a later version are dropped).
  db.version(10).stores({
    exercises_v2: "id, category, muscleGroup, supersetId",
    workoutSessions: "++id, date, completed, updatedAt, deleted, supersetId",
    bodyMeasurements: "++id, date, updatedAt, deleted",
    progressPhotos: "++id, date, type, updatedAt, deleted",
    userProfile: "++id, updatedAt, deleted",
    routines: "++id, name, updatedAt, deleted",
    foodEntries: "id, date, mealType, updatedAt, deleted",
    nutritionGoals: "id, updatedAt, deleted",
    unlockedAchievements: "id, achievementId, updatedAt, deleted",
    exerciseFeedback: "++id, exerciseId, action, timestamp, sessionId",
  });

  // Version 11 – add imageUrl field for Firebase Storage-backed progress photos.
  // The schema string is unchanged (imageUrl is not a primary key or index);
  // existing blobs remain unchanged.
  db.version(11).stores({
    exercises_v2: "id, category, muscleGroup, supersetId",
    workoutSessions: "++id, date, completed, updatedAt, deleted, supersetId",
    bodyMeasurements: "++id, date, updatedAt, deleted",
    progressPhotos: "++id, date, type, updatedAt, deleted",
    userProfile: "++id, updatedAt, deleted",
    routines: "++id, name, updatedAt, deleted",
    foodEntries: "id, date, mealType, updatedAt, deleted",
    nutritionGoals: "id, updatedAt, deleted",
    unlockedAchievements: "id, achievementId, updatedAt, deleted",
    exerciseFeedback: "++id, exerciseId, action, timestamp, sessionId",
  });

  // Version 12 – add goals table (B3: Measurable Goals System).
  // Non-breaking: only adds a new table; existing tables are re-declared
  // unchanged (Dexie requires all stores to be re-declared per version).
  db.version(12).stores({
    exercises_v2: "id, category, muscleGroup, supersetId",
    workoutSessions: "++id, date, completed, updatedAt, deleted, supersetId",
    bodyMeasurements: "++id, date, updatedAt, deleted",
    progressPhotos: "++id, date, type, updatedAt, deleted",
    userProfile: "++id, updatedAt, deleted",
    routines: "++id, name, updatedAt, deleted",
    foodEntries: "id, date, mealType, updatedAt, deleted",
    nutritionGoals: "id, updatedAt, deleted",
    unlockedAchievements: "id, achievementId, updatedAt, deleted",
    exerciseFeedback: "++id, exerciseId, action, timestamp, sessionId",
    goals: "id, type, exerciseId, timeFrame, achieved, deleted, updatedAt",
  });
}
