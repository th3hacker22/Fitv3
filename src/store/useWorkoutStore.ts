"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { db, getPersonalRecords } from "@/db";
import type { WorkoutSession } from "@/db";
import type { Exercise } from "@/types/exercise";
import { useAuthStore } from "@/store/useAuthStore";
import { useSocialStore } from "@/store/useSocialStore";
import { useAchievementsStore } from "@/store/useAchievementsStore";
import { recordFeedbackFromSession } from "@/services/learningLoop";
import { useToastStore } from "@/store/useToastStore";
import { pushToCloud } from "@/lib/syncEngine";
import { uid } from "@/utils/id";
import { estimateOneRepMax } from "@/utils/fitnessMath";
import { voiceCoach } from "@/services/voiceCoach";
import { nextSetType, countsForPR, type SetType } from "@/config/setTypes";
import { suggestRestDuration } from "@/services/smartRest";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useGeneratorStore } from "@/store/useGeneratorStore";
import { buildSession, detectNewPRs, computeSessionVolume } from "@/services/workoutFinisher";

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

// ── Infer exercise "role" for the Smart Rest Timer ──
// Active workout items don't carry the generator's `role` field, so we infer it
// heuristically from name + target + muscleGroup. This drives the rest-duration
// suggestion in src/services/smartRest.ts (compound → longer rest than isolation).
export type ExerciseRole = "compound" | "isolation" | "warmup" | "core" | "cardio";

const COMPOUND_PATTERN =
  /\b(bench press|squat|deadlift|press|row|pull[- ]?up|chin[- ]?up|dip|lunge|front squat|back squat|sumo|romanian|\brdl\b|clean|snatch|jerk|thruster|push press|military press|overhead press|shoulder press|leg press|hip thrust|glute bridge|hack squat|bulgarian|step[- ]?up|kettlebell swing|farmer|carry)\b/i;
const CORE_PATTERN =
  /\b(crunch|sit[- ]?up|plank|leg raise|\bab[s]?\b|core|oblique|v[- ]?up|hanging leg|toe[- ]?touch|russian twist|cable woodchop|pallof)\b/i;
const CARDIO_PATTERN =
  /\b(cardio|run|jog|cycle|\bbike\b|rowing|row machine|jump|burpee|skip|elliptical|treadmill|step mill|stair|battle rope|mountain climber)\b/i;

function inferExerciseRole(exercise: WorkoutExerciseItem): ExerciseRole {
  const name = exercise.exerciseName || "";
  const target = exercise.target || "";
  const muscleGroup = exercise.muscleGroup || "";
  const combined = `${name} ${target} ${muscleGroup}`;

  if (CARDIO_PATTERN.test(combined) || muscleGroup.toLowerCase() === "cardio") {
    return "cardio";
  }
  if (CORE_PATTERN.test(combined) || muscleGroup.toLowerCase() === "core" || target.toLowerCase() === "abs") {
    return "core";
  }
  if (COMPOUND_PATTERN.test(combined)) {
    return "compound";
  }
  return "isolation";
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
  /**
   * Set variant — one of the 11 types from src/config/setTypes.ts.
   * Optional for backward compatibility with in-flight workouts persisted
   * to localStorage before this field existed. Defaults to "normal".
   */
  setType?: import("@/config/setTypes").SetType;
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
  isSupersetWithNext?: boolean;
}

export interface ActiveWorkout {
  id: string;
  exercises: WorkoutExerciseItem[];
  startedAt: number;
}

// ── Ghost Logging: Get last session data for an exercise ──
// Module-scope cache of the last 10 completed sessions, keyed by newest-first order.
// Avoids re-scanning the entire workoutSessions table on every exercise lookup
// (was: O(N) full-table scan × 6+ exercises per workout = thousands of rows).
let _recentSessionsCache: WorkoutSession[] | null = null;
let _recentSessionsCacheAt = 0;
const RECENT_SESSIONS_TTL_MS = 30_000; // 30s — fresh enough for ghost data during one workout build

async function getRecentCompletedSessions(limit = 10): Promise<WorkoutSession[]> {
  const now = Date.now();
  if (_recentSessionsCache && now - _recentSessionsCacheAt < RECENT_SESSIONS_TTL_MS) {
    return _recentSessionsCache.slice(0, limit);
  }
  try {
    // Use the indexed `date` field via .orderBy("date").reverse() to get
    // newest-first without a full-table scan. The .filter() for completed
    // is applied on the index-ordered collection.
    const sessions = await db.workoutSessions
      .orderBy("date")
      .reverse()
      .filter((s) => s.completed === true)
      .limit(limit)
      .toArray();
    _recentSessionsCache = sessions;
    _recentSessionsCacheAt = now;
    return sessions;
  } catch {
    return [];
  }
}

/** Invalidate the recent-sessions cache (call after saving a new session). */
export function invalidateRecentSessionsCache(): void {
  _recentSessionsCache = null;
  _recentSessionsCacheAt = 0;
}

async function getLastExerciseData(
  exerciseId: string
): Promise<{ weight: number; reps: number }[] | null> {
  try {
    const sessions = await getRecentCompletedSessions(10);
    for (const session of sessions) {
      const ex = session.exercises.find((e) => String(e.exerciseId) === String(exerciseId));
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
async function buildExerciseItem(exerciseId: string): Promise<WorkoutExerciseItem | null> {
  const exercises = getCachedExercises();
  let exercise = exercises.find((e) => e.id === exerciseId);

  if (!exercise) {
    try {
      exercise = await db.exercises_v2.get(exerciseId);
    } catch {
      /* ignore */
    }
  }

  if (!exercise) return null;

  const previousSets = await getLastExerciseData(exerciseId);

  const initialSetCount = 3;
  const sets: WorkoutSet[] = Array.from({ length: initialSetCount }, (_, i) => ({
    id: uid(),
    weight: "",
    reps: "",
    completed: false,
    previousWeight: previousSets?.[i]?.weight,
    previousReps: previousSets?.[i]?.reps,
  }));

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
  isWorkoutActive: boolean;
  restTimerActive: boolean;
  /**
   * Role of the exercise whose set just completed — drives the Smart Rest
   * Timer's suggested duration (compound → longer rest than isolation).
   * Inferred heuristically by `inferExerciseRole` since active-workout items
   * don't carry the generator's `role` field. Reset to undefined when the
   * timer is dismissed.
   */
  restTimerExerciseRole?: ExerciseRole;
  /**
   * RPE of the most-recently completed set (1-10, or 0/undefined if not recorded).
   * Higher RPE → longer suggested rest. Captured in `toggleSetComplete`.
   */
  restTimerLastRPE?: number;
  /**
   * Epoch-millis timestamp when the current rest period ends.
   * Timestamp-based (not counter-based) so the timer survives tab close /
   * page reload: on mount, remaining = max(0, restTimerEndTs - Date.now()).
   * Undefined when no rest is active.
   */
  restTimerEndTs?: number;
  /**
   * Total duration of the current rest period in seconds (the original
   * suggested value before any ±preset adjustments). Used as the
   * denominator for the progress ring and the 15s-warning threshold.
   */
  restTimerTotalDuration?: number;

  // Actions
  startWorkout: (
    exercisesOrIds: (string | { exerciseId: string | number; isSupersetWithNext?: boolean })[]
  ) => Promise<string>;
  resumeWorkout: () => void;
  replaceExercise: (exerciseIndex: number, newExerciseId: string) => Promise<void>;
  addSet: (exerciseIndex: number) => Promise<void>;
  removeSet: (exerciseIndex: number, setId: string) => void;
  setExerciseNotes: (exerciseIndex: number, notes: string) => void;
  updateSet: (
    exerciseIndex: number,
    setId: string,
    updates: Partial<Pick<WorkoutSet, "weight" | "reps" | "rpe">>
  ) => void;
  /**
   * Cycle the setType of a single set to the next value in SET_TYPES order.
   * Used by SetRow.tsx tap-to-cycle. See src/config/setTypes.ts.
   */
  cycleSetType: (exerciseIndex: number, setId: string) => void;
  /**
   * Set the setType of a single set to a specific value (no cycling).
   * Used by SetTypePicker — a bottom-sheet grid that lets the user pick any
   * of the 11 set types in one tap instead of cycling up to 10 times.
   */
  setSetType: (exerciseIndex: number, setId: string, type: SetType) => void;
  toggleSetComplete: (exerciseIndex: number, setId: string) => void;
  dismissRestTimer: () => void;
  /**
   * Adjust the active rest timer by ±delta seconds (preset buttons).
   * Shifts restTimerEndTs and bumps restTimerTotalDuration so the progress
   * ring stays proportional. No-op when no rest is active.
   */
  adjustRestTimer: (deltaSeconds: number) => void;
  finishWorkout: (shareToFeed?: boolean) => Promise<void>;
  cancelWorkout: () => void;
}

// ── Store ──
export const useWorkoutStore = create<WorkoutState>()(
  persist(
    (set, get) => ({
      activeWorkout: null,
      isWorkoutActive: false,
      restTimerActive: false,
      restTimerExerciseRole: undefined,
      restTimerLastRPE: undefined,
      restTimerEndTs: undefined,
      restTimerTotalDuration: undefined,

      // ── Start a new workout session ──
      startWorkout: async (exercisesOrIds) => {
        const id = uid();
        const exercises: WorkoutExerciseItem[] = [];

        for (const itemOrId of exercisesOrIds) {
          const isObj = typeof itemOrId === "object" && itemOrId !== null;
          const exId = String(isObj ? itemOrId.exerciseId : itemOrId);
          const isSuperset = isObj ? !!itemOrId.isSupersetWithNext : false;

          const item = await buildExerciseItem(exId);
          if (item) {
            item.isSupersetWithNext = isSuperset;
            exercises.push(item);
          }
        }

        set({
          activeWorkout: { id, exercises, startedAt: Date.now() },
          isWorkoutActive: true,
          restTimerActive: false,
          restTimerExerciseRole: undefined,
          restTimerLastRPE: undefined,
          restTimerEndTs: undefined,
          restTimerTotalDuration: undefined,
        });

        return id;
      },

      // ── Resume a saved workout session ──
      resumeWorkout: () => {
        set({ isWorkoutActive: true });
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
  addSet: async (exerciseIndex) => {
    const { activeWorkout } = get();
    if (!activeWorkout) return;

    const exercises = [...activeWorkout.exercises];
    const exercise = exercises[exerciseIndex];
    const lastSet = exercise.sets[exercise.sets.length - 1];

    const previousSets = await getLastExerciseData(exercise.exerciseId);
    const setIndex = exercise.sets.length;
    const ghostWeight = previousSets?.[setIndex]?.weight ?? lastSet?.previousWeight;
    const ghostReps = previousSets?.[setIndex]?.reps ?? lastSet?.previousReps;

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
          previousWeight: ghostWeight,
          previousReps: ghostReps,
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
      sets: exercise.sets.map((s) => (s.id === setId ? { ...s, ...updates } : s)),
    };

    set({ activeWorkout: { ...activeWorkout, exercises } });
  },

  // ── Cycle the setType of a set (tap-to-cycle in SetRow) ──
  cycleSetType: (exerciseIndex, setId) => {
    const { activeWorkout } = get();
    if (!activeWorkout) return;

    const exercises = [...activeWorkout.exercises];
    const exercise = exercises[exerciseIndex];
    if (!exercise) return;

    exercises[exerciseIndex] = {
      ...exercise,
      sets: exercise.sets.map((s) => {
        if (s.id !== setId) return s;
        const current = s.setType ?? "normal";
        return { ...s, setType: nextSetType(current) };
      }),
    };

    set({ activeWorkout: { ...activeWorkout, exercises } });
  },

  // ── Set the setType of a specific set (used by SetTypePicker) ──
  setSetType: (exerciseIndex, setId, type) => {
    const { activeWorkout } = get();
    if (!activeWorkout) return;

    const exercises = [...activeWorkout.exercises];
    const exercise = exercises[exerciseIndex];
    if (!exercise) return;

    exercises[exerciseIndex] = {
      ...exercise,
      sets: exercise.sets.map((s) => (s.id === setId ? { ...s, setType: type } : s)),
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

    // Phase 1 improvement: haptic feedback on set completion (short buzz when
    // marking a set done, lighter tick when un-completing).
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(!wasCompleted ? 30 : 10);
    }

    exercises[exerciseIndex] = {
      ...exercise,
      sets: exercise.sets.map((s) => (s.id === setId ? { ...s, completed: !s.completed } : s)),
    };

    // Smart Rest Timer inputs: when marking a set complete, capture the role
    // of the exercise + the just-completed set's RPE so the RestTimer can
    // compute a suggested duration via suggestRestDuration(). On un-complete
    // we leave the timer state untouched (timer is only dismissed manually).
    const willActivate = !wasCompleted;
    const roleForTimer = willActivate ? inferExerciseRole(exercise) : get().restTimerExerciseRole;
    const rpeForTimer = willActivate
      ? targetSet.rpe
        ? Number(targetSet.rpe) || 0
        : 0
      : get().restTimerLastRPE;

    // Compute the smart-rest duration HERE (in the store) so we can persist
    // the end timestamp. This makes the timer timestamp-based — it survives
    // tab close / page reload because restTimerEndTs is persisted.
    let endTs: number | undefined;
    let totalDuration: number | undefined;
    if (willActivate) {
      const settings = useSettingsStore.getState();
      const generator = useGeneratorStore.getState();
      const rec = suggestRestDuration({
        role: roleForTimer,
        lastSetRPE: rpeForTimer,
        goal: generator.goal || "Hypertrophy",
        defaultRest: settings.restDuration,
      });
      totalDuration = rec.seconds;
      endTs = Date.now() + rec.seconds * 1000;
    } else {
      // Preserve existing values on un-complete (timer is only dismissed manually).
      endTs = get().restTimerEndTs;
      totalDuration = get().restTimerTotalDuration;
    }

    set({
      activeWorkout: { ...activeWorkout, exercises },
      restTimerActive: willActivate ? true : get().restTimerActive,
      restTimerExerciseRole: roleForTimer,
      restTimerLastRPE: rpeForTimer,
      restTimerEndTs: endTs,
      restTimerTotalDuration: totalDuration,
    });

    // Voice Coach: encourage the user when a set is marked complete.
    // (No-op when the coach is disabled — see voiceCoach.setEnabled.)
    if (willActivate) {
      voiceCoach.speak("set_complete");
    }
  },

  // ── Rest Timer ──
  dismissRestTimer: () =>
    set({
      restTimerActive: false,
      restTimerExerciseRole: undefined,
      restTimerLastRPE: undefined,
      restTimerEndTs: undefined,
      restTimerTotalDuration: undefined,
    }),

  // ── Adjust rest timer by ±delta seconds (preset buttons) ──
  // Shifts the end timestamp so the countdown reflects the adjustment.
  // Also bumps totalDuration so the progress ring stays proportional.
  adjustRestTimer: (deltaSeconds) => {
    const { restTimerEndTs, restTimerTotalDuration } = get();
    if (restTimerEndTs == null) return;
    set({
      restTimerEndTs: restTimerEndTs + deltaSeconds * 1000,
      restTimerTotalDuration: Math.max(15, (restTimerTotalDuration ?? 0) + deltaSeconds),
    });
  },

  // ── Finish workout & save to Dexie ──
  // Decomposed into steps via src/services/workoutFinisher.ts:
  //   1. buildSession — pure: constructs WorkoutSession from active state
  //   2. persistSession — Dexie write + cache invalidation
  //   3. detectNewPRs — pure: compares session e1RM vs prior bests
  //   4. announcePRs — side effects: haptic, voice, notification, toast
  //   5. shareSession — social feed + challenge sync (with offline toast)
  finishWorkout: async (shareToFeed?: boolean) => {
    const { activeWorkout } = get();
    if (!activeWorkout) return;

    try {
      // ── Step 1: Build the session object (pure) ──
      const session = buildSession(activeWorkout.exercises, activeWorkout.startedAt);

      // ── Step 2: Persist to Dexie ──
      await db.workoutSessions.add(session);
      invalidateRecentSessionsCache();

      // ── Step 3: Learning Loop (fire-and-forget) ──
      recordFeedbackFromSession(session).catch((err) =>
        console.warn("[learningLoop] Failed to record session feedback:", err)
      );

      // ── Step 4: Detect new PRs (pure) + announce (side effects) ──
      let priorBests = new Map<string, number>();
      try {
        const records = await getPersonalRecords();
        priorBests = new Map(records.map((r) => [String(r.exerciseId), r.max1RM]));
      } catch {
        /* no prior history */
      }

      const prResult = detectNewPRs(session, priorBests);
      for (const pr of prResult.newPRs) {
        // Celebratory haptic
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate([30, 40, 30, 40, 60]);
        }
        // Voice Coach
        voiceCoach.speak("new_pr");
        // Push notification (lazy import)
        import("@/services/notificationService").then(({ sendPRNotification }) => {
          sendPRNotification(pr.exerciseName, pr.weight, pr.reps);
        }).catch(() => {});
        // Toast
        useToastStore.getState().addToast(
          "success",
          `New PR! ${pr.exerciseName}: ${pr.weight}kg x ${pr.reps} (Est. 1RM: ${pr.estimated1RM}kg)`
        );
      }

      // ── Step 5: Achievements + cloud sync + share (if user is authed) ──
      const user = useAuthStore.getState().user;
      useAchievementsStore
        .getState()
        .evaluateAchievements(user?.uid || undefined)
        .catch(console.error);

      if (user) {
        pushToCloud(user.uid).catch(console.error);

        const totalVolume = computeSessionVolume(session);

        if (shareToFeed) {
          useSocialStore
            .getState()
            .publishSession(user.uid, user.displayName || "Unknown Athlete", user.photoURL, {
              workoutTitle: session.name,
              duration: session.duration,
              exercisesCount: session.exercises.length,
              totalVolume,
            })
            .catch((err) => {
              console.error("Failed to share to feed:", err);
              useToastStore.getState().addToast(
                "info",
                "Workout saved locally. Share to feed will retry when online."
              );
            });
        }

        // Sync volume to active challenges
        import("@/store/useChallengesStore")
          .then(({ useChallengesStore }) =>
            useChallengesStore.getState().syncWorkoutVolume(totalVolume, session.id)
          )
          .catch((err) => {
            console.error("Failed to sync challenge volume:", err);
            useToastStore.getState().addToast(
              "info",
              "Challenge progress will sync when online."
            );
          });
      }

      // ── Reset workout state ──
      set({
        activeWorkout: null,
        isWorkoutActive: false,
        restTimerActive: false,
        restTimerExerciseRole: undefined,
        restTimerLastRPE: undefined,
        restTimerEndTs: undefined,
        restTimerTotalDuration: undefined,
      });
      useToastStore.getState().addToast("success", "Workout saved successfully!");
    } catch (error) {
      console.error("Failed to save workout session:", error);
      useToastStore.getState().addToast("error", "Failed to save workout. Please try again.");
    }
  },

  // ── Cancel workout without saving ──
  cancelWorkout: () => {
    set({
      activeWorkout: null,
      isWorkoutActive: false,
      restTimerActive: false,
      restTimerExerciseRole: undefined,
      restTimerLastRPE: undefined,
      restTimerEndTs: undefined,
      restTimerTotalDuration: undefined,
    });
  },
    }),
    {
      name: "pulse_workout_session",
      partialize: (state) => ({
        activeWorkout: state.activeWorkout,
        // Persist the rest-timer state so the timer survives tab close /
        // page reload. The timestamp-based approach (restTimerEndTs) means
        // on re-mount the component recomputes the remaining seconds from
        // restTimerEndTs - Date.now() — no drift, no lost countdown.
        restTimerActive: state.restTimerActive,
        restTimerExerciseRole: state.restTimerExerciseRole,
        restTimerLastRPE: state.restTimerLastRPE,
        restTimerEndTs: state.restTimerEndTs,
        restTimerTotalDuration: state.restTimerTotalDuration,
      }),
    }
  )
);
