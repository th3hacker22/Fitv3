import Dexie, { type Table } from "dexie";
import type { Exercise } from "@/types/exercise";
import { registerMigrations } from "./migrations";

// ── Workout Types ──
export interface WorkoutSession {
  id: string;
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
  supersetId?: string;
}

export interface ExerciseSetData {
  weight: number;
  reps: number;
  rpe?: number;
  completed: boolean;
  estimated1RM?: number;
  setType?: "normal" | "warmup" | "drop_set";
}

// ── Body Measurement Types ──
export interface BodyMeasurement {
  id: string;
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

// ── Progress Photo Types ──
export interface ProgressPhoto {
  id: string;
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
  id: string;
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
  id: string;
  name: string;
  exercises: RoutineExercise[];
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
}

// ── Nutrition Types ──
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

// ── Achievement Types ──
export interface UnlockedAchievement {
  id: string;
  achievementId: string;
  unlockedAt: string;
  deleted?: boolean;
}

// ── Learning Loop (Exercise Feedback) Types ──
// Behavioral feedback recorded per (exerciseId, action, timestamp).
// Aggregated by src/services/learningLoop.ts into a per-exercise preference score
// that feeds back into the workout generator's scoring function.
export type ExerciseFeedbackAction =
  | "completed"
  | "skipped"
  | "swapped"
  | "incomplete";

export interface ExerciseFeedbackEntry {
  id?: number; // auto-increment
  exerciseId: string;
  exerciseName: string;
  action: ExerciseFeedbackAction;
  timestamp: number; // epoch ms — indexed for lookback queries
  sessionId?: string; // optional — which workout session triggered this
  note?: string;
}

// ── Database Class ──
export class PulseDB extends Dexie {
  exercises_v2!: Table<Exercise>;
  workoutSessions!: Table<WorkoutSession>;
  bodyMeasurements!: Table<BodyMeasurement>;
  progressPhotos!: Table<ProgressPhoto>;
  userProfile!: Table<UserProfile>;
  routines!: Table<Routine>;
  foodEntries!: Table<FoodEntry>;
  nutritionGoals!: Table<NutritionGoal>;
  unlockedAchievements!: Table<UnlockedAchievement>;
  exerciseFeedback!: Table<ExerciseFeedbackEntry>;

  constructor() {
    super("PulseDB");
    registerMigrations(this);
  }
}

export const db = new PulseDB();

// Handle schema errors safely without deleting user data
db.open().catch(async (err) => {
  if (err.name === "UpgradeError") {
    console.error(
      "Database schema mismatch detected. Local data is preserved. Error details:",
      err
    );
    if (typeof window !== "undefined" && window.alert) {
      window.alert(
        "A database schema mismatch was detected. To protect your data, it was not reset. Please contact support."
      );
    }
  } else {
    console.error("Failed to open DB:", err);
  }
});
