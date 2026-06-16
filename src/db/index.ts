import Dexie, { type Table } from "dexie";
import type { Exercise } from "@/types/exercise";
import { uid } from "@/utils/id";

// ── Workout Types ──
export interface WorkoutSession {
  id: string; // Changed from id?: number
  name: string;
  date: string;
  duration: number;
  exercises: WorkoutExerciseData[];
  notes?: string;
  completed: boolean;
  isFreeze?: boolean;
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
}

export interface WorkoutExerciseData {
  exerciseId: string | number;
  exerciseName: string;
  notes?: string;
  sets: ExerciseSetData[];
}

export interface ExerciseSetData {
  weight: number;
  reps: number;
  rpe?: number;
  completed: boolean;
}

// ── Body Measurement Types ──
export interface BodyMeasurement {
  id: string; // Changed from id?: number
  date: string;
  weight?: number; // kg
  bodyFat?: number; // percentage
  waist?: number; // cm
  chest?: number; // cm
  arms?: number; // cm
  notes?: string;
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
}

// ── Progress Photo Types (Blob stored in IndexedDB) ──
export interface ProgressPhoto {
  id: string; // Changed from id?: number
  date: string;
  type: "front" | "side" | "back";
  imageBlob: Blob;
  thumbnailBlob?: Blob;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  deleted?: boolean;
}

// ── User Profile ──
export interface UserProfile {
  id: string; // Changed from id?: number
  name: string;
  weight?: number;
  height?: number;
  goal?: string;
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
}

// ── Routine Types ──
export interface RoutineExercise {
  exerciseId: string | number;
  exerciseName: string;
  targetSets: number;
  targetReps: number;
  restTimer: number;
  isSupersetWithNext?: boolean;
  order: number;
  imageUrl?: string;
  equipment?: string;
}

export interface Routine {
  id: string; // Changed from id?: number
  name: string;
  exercises: RoutineExercise[];
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
}

export interface FoodEntry {
  id: string;
  date: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
}

export interface NutritionGoal {
  id: string;
  dailyCalories: number;
  protein: number;
  carbs: number;
  fat: number;
  updatedAt: string;
  deleted?: boolean;
}

export interface UnlockedAchievement {
  id: string;
  achievementId: string;
  unlockedAt: string;
  deleted?: boolean;
}

// ── Database Class ──
class PulseDB extends Dexie {
  exercises_v2!: Table<Exercise>;
  workoutSessions!: Table<WorkoutSession>;
  bodyMeasurements!: Table<BodyMeasurement>;
  progressPhotos!: Table<ProgressPhoto>;
  userProfile!: Table<UserProfile>;
  routines!: Table<Routine>;
  foodEntries!: Table<FoodEntry>;
  nutritionGoals!: Table<NutritionGoal>;
  unlockedAchievements!: Table<UnlockedAchievement>;

  constructor() {
    super("PulseDB");

    this.version(4).stores({
      exercises_v2: "id, category, muscleGroup",
      workoutSessions: "++id, date, completed",
      bodyMeasurements: "++id, date",
      progressPhotos: "++id, date, type",
      userProfile: "++id",
      routines: "++id, name",
    });

    this.version(5)
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
              // For Dexie, modifying primary key requires delete and add
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

    this.version(6)
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

    this.version(8).stores({
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
  }
}

export const db = new PulseDB();

// Handle schema errors by resetting the local DB
db.open().catch(async (err) => {
  if (err.name === "UpgradeError") {
    console.warn(
      "Database schema change detected. Resetting local database...",
    );
    await db.delete();
    window.location.reload();
  } else {
    console.error("Failed to open DB:", err);
  }
});

// ── Note: Exercises are now loaded from GitHub API via exerciseService.ts ──
// No more local seeding needed

// ── Analytics Helpers ──

// Get workout streak (consecutive days)
export async function getWorkoutStreak(): Promise<number> {
  const sessions = await db.workoutSessions
    .where("completed")
    .equals(1)
    .toArray();

  if (sessions.length === 0) return 0;

  // Get unique dates (YYYY-MM-DD)
  const dates = [...new Set(sessions.map((s) => s.date.split("T")[0]))].sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime(),
  );

  if (dates.length === 0) return 0;

  // Check if today or yesterday is in the list
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  if (dates[0] !== today && dates[0] !== yesterday) return 0;

  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const curr = new Date(dates[i - 1]);
    const prev = new Date(dates[i]);
    const diffDays = (curr.getTime() - prev.getTime()) / 86400000;

    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

// Get Personal Records for each exercise
export async function getPersonalRecords(): Promise<
  {
    exerciseId: string | number;
    exerciseName: string;
    maxWeight: number;
    date: string;
  }[]
> {
  const sessions = await db.workoutSessions
    .where("completed")
    .equals(1)
    .toArray();

  const records: Map<
    string | number,
    { exerciseName: string; maxWeight: number; date: string }
  > = new Map();

  for (const session of sessions) {
    for (const ex of session.exercises) {
      const maxSetWeight = Math.max(...ex.sets.map((s) => s.weight));
      const current = records.get(ex.exerciseId);

      if (!current || maxSetWeight > current.maxWeight) {
        records.set(ex.exerciseId, {
          exerciseName: ex.exerciseName,
          maxWeight: maxSetWeight,
          date: session.date,
        });
      }
    }
  }

  return Array.from(records.entries()).map(([exerciseId, data]) => ({
    exerciseId,
    ...data,
  }));
}

// Get weekly volume (total weight lifted per week)
export async function getWeeklyVolume(
  weeks: number = 8,
): Promise<{ week: string; volume: number }[]> {
  const sessions = await db.workoutSessions
    .where("completed")
    .equals(1)
    .toArray();

  const weeklyData: Map<string, number> = new Map();

  // Initialize last N weeks
  for (let i = 0; i < weeks; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i * 7);
    const weekKey = getWeekKey(date);
    weeklyData.set(weekKey, 0);
  }

  // Sum volumes
  for (const session of sessions) {
    const sessionDate = new Date(session.date);
    const weekKey = getWeekKey(sessionDate);

    if (weeklyData.has(weekKey)) {
      const volume = session.exercises.reduce((acc, ex) => {
        return (
          acc + ex.sets.reduce((setAcc, s) => setAcc + s.weight * s.reps, 0)
        );
      }, 0);
      weeklyData.set(weekKey, (weeklyData.get(weekKey) || 0) + volume);
    }
  }

  return Array.from(weeklyData.entries())
    .map(([week, volume]) => ({ week, volume }))
    .reverse();
}

// Get weekly tonnage (volume)
export async function getWeeklyTonnage(
  weeks: number = 4,
): Promise<{ week: string; tonnage: number }[]> {
  const sessions = await db.workoutSessions
    .where("completed")
    .equals(1)
    .toArray();

  const weeklyData: Map<string, number> = new Map();

  for (let i = 0; i < weeks; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i * 7);
    const weekKey = getWeekKey(date);
    weeklyData.set(weekKey, 0);
  }

  for (const session of sessions) {
    const sessionDate = new Date(session.date);
    const weekKey = getWeekKey(sessionDate);

    if (weeklyData.has(weekKey)) {
      const volume = session.exercises.reduce((acc, ex) => {
        return (
          acc + ex.sets.reduce((setAcc, s) => setAcc + s.weight * s.reps, 0)
        );
      }, 0);
      weeklyData.set(weekKey, (weeklyData.get(weekKey) || 0) + volume);
    }
  }

  return Array.from(weeklyData.entries())
    .map(([week, tonnage]) => ({ week, tonnage }))
    .reverse();
}

// Get exercise progress over time
export async function getExerciseProgress(
  exerciseId: string | number,
): Promise<{ date: string; maxWeight: number }[]> {
  const sessions = await db.workoutSessions
    .where("completed")
    .equals(1)
    .toArray();

  const progress: { date: string; maxWeight: number }[] = [];

  for (const session of sessions) {
    const ex = session.exercises.find(
      (e) => String(e.exerciseId) === String(exerciseId),
    );
    if (ex && ex.sets.length > 0) {
      const maxWeight = Math.max(...ex.sets.map((s) => s.weight));
      progress.push({
        date: session.date.split("T")[0],
        maxWeight,
      });
    }
  }

  return progress.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
}

// Get estimated 1RM progress for an exercise
export async function getEstimated1RM(
  exerciseId: string | number,
): Promise<{ date: string; e1rm: number }[]> {
  const sessions = await db.workoutSessions
    .where("completed")
    .equals(1)
    .toArray();

  const progress: { date: string; e1rm: number }[] = [];

  for (const session of sessions) {
    const ex = session.exercises.find(
      (e) => String(e.exerciseId) === String(exerciseId),
    );
    if (ex && ex.sets.length > 0) {
      const bestE1rm = Math.max(
        ...ex.sets
          .filter((s) => s.completed)
          .map((s) => s.weight * (1 + s.reps / 30)),
      );
      if (bestE1rm > 0) {
        progress.push({
          date: session.date.split("T")[0],
          e1rm: Math.round(bestE1rm * 10) / 10,
        });
      }
    }
  }

  return progress.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
}

// Get muscle groups volume breakdown
export async function getMuscleGroupStats(
  exercises: Exercise[],
): Promise<{ muscle: string; volume: number }[]> {
  const sessions = await db.workoutSessions
    .where("completed")
    .equals(1)
    .toArray();

  const muscleData: Map<string, number> = new Map();

  for (const session of sessions) {
    for (const ex of session.exercises) {
      // Find exercise details to get muscle group
      const exerciseDef = exercises.find(
        (e) => String(e.id) === String(ex.exerciseId),
      );
      if (!exerciseDef) continue;

      const muscle = exerciseDef.muscleGroup;
      const volume = ex.sets
        .filter((s) => s.completed)
        .reduce((sum, s) => sum + s.weight * s.reps, 0);

      muscleData.set(muscle, (muscleData.get(muscle) || 0) + volume);
    }
  }

  return Array.from(muscleData.entries())
    .map(([muscle, volume]) => ({ muscle, volume }))
    .sort((a, b) => b.volume - a.volume);
}

// Get total stats
export async function getTotalStats() {
  const sessions = await db.workoutSessions
    .where("completed")
    .equals(1)
    .toArray();

  const validSessions = sessions.filter((s) => !s.isFreeze);

  const totalWorkouts = validSessions.length;
  const totalVolume = validSessions.reduce((acc, s) => {
    return (
      acc +
      s.exercises.reduce((exAcc, ex) => {
        return (
          exAcc +
          ex.sets.reduce((setAcc, set) => setAcc + set.weight * set.reps, 0)
        );
      }, 0)
    );
  }, 0);
  const totalDuration = validSessions.reduce((acc, s) => acc + s.duration, 0);

  return { totalWorkouts, totalVolume, totalDuration };
}

// Helper: Get week key (e.g., "W1", "W2")
function getWeekKey(date: Date): string {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / 86400000);
  const weekNum = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return `W${weekNum}`;
}
