import { create } from "zustand";
import { db } from "@/db";
import type { WorkoutSession } from "@/db";
import type { Exercise } from "@/types/exercise";
import { useAuthStore } from "@/store/useAuthStore";
import { useSocialStore } from "@/store/useSocialStore";
import { useAchievementsStore } from "@/store/useAchievementsStore";
import { useToastStore } from "@/store/useToastStore";
import { pushToCloud } from "@/lib/syncEngine";
import { uid } from "@/utils/id";
import { playWorkoutStartSound, playWorkoutStopSound } from "@/utils/audio";

// ── Helpers ──

// ── Get exercises from cache ──
function getCachedExercises(): Exercise[] {
  try {
    const cached = localStorage.getItem("pulse_exercises_cache");
    if (cached) return JSON.parse(cached);
  } catch {
    /* ignore */
  }
  return [];
}

// ── Types ──
export interface WorkoutSet {
  id: string;
  weight: string;
  reps: string;
  rpe?: string;
  completed: boolean;
  previousWeight?: number;
  previousReps?: number;
}

export interface WorkoutExerciseItem {
  id: string;
  exerciseId: string;
  exerciseName: string;
  exerciseNameEn: string;
  muscleGroup: string;
  equipment: string;
  tips: string[];
  imageUrl: string;
  gifUrl: string;
  target: string;
  secondaryMuscles: string[];
  notes?: string;
  sets: WorkoutSet[];
}

export interface ActiveWorkout {
  id: string;
  exercises: WorkoutExerciseItem[];
  startedAt: number;
}

// ── Ghost Logging: Get last session data for an exercise ──
async function getLastExerciseData(
  exerciseId: string,
): Promise<{ weight: number; reps: number }[] | null> {
  try {
    // Optimization: Order by date descending and take last 10, then filter
    const sessions = await db.workoutSessions
      .where("completed")
      .equals(1)
      .reverse()
      .limit(10)
      .toArray();

    for (const session of sessions) {
      const ex = session.exercises.find(
        (e) => String(e.exerciseId) === String(exerciseId),
      );
      if (ex && ex.sets.length > 0) {
        return ex.sets.map((s) => ({ weight: s.weight, reps: s.reps }));
      }
    }
  } catch {
    /* DB might be empty */
  }
  return null;
}

// ── Build an exercise item with ghost data from previous sessions ──
async function buildExerciseItem(
  exerciseId: string,
): Promise<WorkoutExerciseItem | null> {
  const exercises = getCachedExercises();
  const exercise = exercises.find((e) => e.id === exerciseId);
  if (!exercise) return null;

  const previousSets = await getLastExerciseData(exerciseId);

  const initialSetCount = 3;
  const sets: WorkoutSet[] = Array.from(
    { length: initialSetCount },
    (_, i) => ({
      id: uid(),
      weight: "",
      reps: "",
      completed: false,
      previousWeight: previousSets?.[i]?.weight,
      previousReps: previousSets?.[i]?.reps,
    }),
  );

  return {
    id: uid(),
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    exerciseNameEn: exercise.name,
    muscleGroup: exercise.muscleGroup,
    equipment: exercise.equipment,
    tips: exercise.instructionSteps.slice(0, 3),
    imageUrl: exercise.imageUrl,
    gifUrl: exercise.gifUrl,
    target: exercise.target,
    secondaryMuscles: exercise.secondaryMuscles,
    sets,
  };
}

// ── Store Interface ──
interface WorkoutState {
  activeWorkout: ActiveWorkout | null;
  restTimerActive: boolean;

  // Actions
  startWorkout: (exerciseIds: string[]) => Promise<string>;
  replaceExercise: (
    exerciseIndex: number,
    newExerciseId: string,
  ) => Promise<void>;
  addSet: (exerciseIndex: number) => void;
  removeSet: (exerciseIndex: number, setId: string) => void;
  setExerciseNotes: (exerciseIndex: number, notes: string) => void;
  updateSet: (
    exerciseIndex: number,
    setId: string,
    updates: Partial<Pick<WorkoutSet, "weight" | "reps" | "rpe">>,
  ) => void;
  toggleSetComplete: (exerciseIndex: number, setId: string) => void;
  dismissRestTimer: () => void;
  finishWorkout: (shareToFeed?: boolean) => Promise<void>;
  cancelWorkout: () => void;
}

// ── Store ──
export const useWorkoutStore = create<WorkoutState>((set, get) => ({
  activeWorkout: null,
  restTimerActive: false,

  // ── Start a new workout session ──
  startWorkout: async (exerciseIds) => {
    const id = uid();
    const exercises: WorkoutExerciseItem[] = [];

    for (const exId of exerciseIds) {
      const item = await buildExerciseItem(exId);
      if (item) exercises.push(item);
    }

    set({
      activeWorkout: { id, exercises, startedAt: Date.now() },
      restTimerActive: false,
    });

    playWorkoutStartSound();

    return id;
  },

  // ── Replace exercise with an alternative (Shuffle) ──
  replaceExercise: async (exerciseIndex, newExerciseId) => {
    const { activeWorkout } = get();
    if (!activeWorkout) return;

    const newItem = await buildExerciseItem(newExerciseId);
    if (!newItem) return;

    const exercises = [...activeWorkout.exercises];
    exercises[exerciseIndex] = newItem;

    set({ activeWorkout: { ...activeWorkout, exercises } });
  },

  // ── Add a new set to an exercise ──
  addSet: (exerciseIndex) => {
    const { activeWorkout } = get();
    if (!activeWorkout) return;

    const exercises = [...activeWorkout.exercises];
    const exercise = exercises[exerciseIndex];
    const lastSet = exercise.sets[exercise.sets.length - 1];

    exercises[exerciseIndex] = {
      ...exercise,
      sets: [
        ...exercise.sets,
        {
          id: uid(),
          weight: lastSet?.weight || "",
          reps: lastSet?.reps || "",
          rpe: lastSet?.rpe || "",
          completed: false,
          previousWeight: lastSet?.previousWeight,
          previousReps: lastSet?.previousReps,
        },
      ],
    };

    set({ activeWorkout: { ...activeWorkout, exercises } });
  },

  // ── Remove a set from an exercise ──
  removeSet: (exerciseIndex, setId) => {
    const { activeWorkout } = get();
    if (!activeWorkout) return;

    const exercises = [...activeWorkout.exercises];
    const exercise = exercises[exerciseIndex];

    exercises[exerciseIndex] = {
      ...exercise,
      sets: exercise.sets.filter((s) => s.id !== setId),
    };

    set({ activeWorkout: { ...activeWorkout, exercises } });
  },

  // ── Set exercise notes ──
  setExerciseNotes: (exerciseIndex, notes) => {
    const { activeWorkout } = get();
    if (!activeWorkout) return;

    const exercises = [...activeWorkout.exercises];
    exercises[exerciseIndex] = {
      ...exercises[exerciseIndex],
      notes,
    };

    set({ activeWorkout: { ...activeWorkout, exercises } });
  },

  // ── Update weight/reps for a specific set ──
  updateSet: (exerciseIndex, setId, updates) => {
    const { activeWorkout } = get();
    if (!activeWorkout) return;

    const exercises = [...activeWorkout.exercises];
    const exercise = exercises[exerciseIndex];

    exercises[exerciseIndex] = {
      ...exercise,
      sets: exercise.sets.map((s) =>
        s.id === setId ? { ...s, ...updates } : s,
      ),
    };

    set({ activeWorkout: { ...activeWorkout, exercises } });
  },

  // ── Toggle set completion ──
  toggleSetComplete: (exerciseIndex, setId) => {
    const { activeWorkout } = get();
    if (!activeWorkout) return;

    const exercises = [...activeWorkout.exercises];
    const exercise = exercises[exerciseIndex];
    const targetSet = exercise.sets.find((s) => s.id === setId);
    if (!targetSet) return;

    const wasCompleted = targetSet.completed;

    exercises[exerciseIndex] = {
      ...exercise,
      sets: exercise.sets.map((s) =>
        s.id === setId ? { ...s, completed: !s.completed } : s,
      ),
    };

    set({
      activeWorkout: { ...activeWorkout, exercises },
      restTimerActive: !wasCompleted ? true : get().restTimerActive,
    });
  },

  // ── Rest Timer ──
  dismissRestTimer: () => set({ restTimerActive: false }),

  // ── Finish workout & save to Dexie ──
  finishWorkout: async (shareToFeed?: boolean) => {
    const { activeWorkout } = get();
    if (!activeWorkout) return;

    try {
      const duration = Math.floor(
        (Date.now() - activeWorkout.startedAt) / 1000,
      );

      const session: WorkoutSession = {
        id: uid(),
        name: `Pulse Workout ${new Date().toLocaleDateString("en-US")}`,
        date: new Date().toISOString(),
        duration,
        exercises: activeWorkout.exercises
          .filter((e) => e.sets.some((s) => s.completed))
          .map((e) => ({
            exerciseId: e.exerciseId,
            exerciseName: e.exerciseName,
            notes: e.notes,
            sets: e.sets
              .filter((s) => s.completed)
              .map((s) => ({
                weight: Number(s.weight) || 0,
                reps: Number(s.reps) || 0,
                rpe: s.rpe ? Number(s.rpe) : undefined,
                completed: true,
              })),
          })),
        completed: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.workoutSessions.add(session);

      const user = useAuthStore.getState().user;

      // Evaluate achievements
      useAchievementsStore
        .getState()
        .evaluateAchievements(user?.uid || undefined)
        .catch(console.error);

      if (user) {
        pushToCloud(user.uid).catch(console.error);
        if (shareToFeed) {
          const totalVolume = session.exercises.reduce(
            (sum, ex) =>
              sum +
              ex.sets.reduce((sSum, set) => sSum + set.weight * set.reps, 0),
            0,
          );
          useSocialStore
            .getState()
            .publishSession(
              user.uid,
              user.displayName || "Unknown Athlete",
              user.photoURL,
              {
                workoutTitle: session.name,
                duration: session.duration,
                exercisesCount: session.exercises.length,
                totalVolume,
              },
            )
            .catch(console.error);
        }
      }

      set({ activeWorkout: null, restTimerActive: false });
      playWorkoutStopSound();
      useToastStore
        .getState()
        .addToast("success", "Workout saved successfully!");
    } catch (error) {
      console.error("Failed to save workout session:", error);
      useToastStore
        .getState()
        .addToast("error", "Failed to save workout. Please try again.");
    }
  },

  // ── Cancel workout without saving ──
  cancelWorkout: () => {
    set({ activeWorkout: null, restTimerActive: false });
    playWorkoutStopSound();
  },
}));
