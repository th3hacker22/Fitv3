import { create } from "zustand";
import type { Exercise } from "@/types/exercise";
import {
  fetchExercisesFromGitHub,
  filterExercises,
  type ExerciseFilters,
} from "@/services/exerciseService";
import { db } from "@/db";

interface ExerciseState {
  // Data
  exercises: Exercise[];
  filteredExercises: Exercise[];
  isLoading: boolean;
  error: string | null;

  // Filters
  filters: ExerciseFilters;

  // Actions
  loadExercises: () => Promise<void>;
  setFilter: (key: keyof ExerciseFilters, value: any) => void;
  clearFilters: () => void;
  getExerciseById: (id: string) => Exercise | undefined;
}

export const useExerciseStore = create<ExerciseState>((set, get) => ({
  exercises: [],
  filteredExercises: [],
  isLoading: false,
  error: null,
  filters: {},

  loadExercises: async () => {
    // Don't reload if already loaded
    if (get().exercises.length > 0) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      // 1. Try to load from IndexedDB first
      const count = await db.exercises_v2.count();
      if (count > 0) {
        console.log("Loading exercises from IndexedDB database...");
        const exercises = await db.exercises_v2.toArray();
        set({
          exercises,
          filteredExercises: exercises,
          isLoading: false,
        });
        return;
      }

      // 2. If not in IndexedDB, fetch from GitHub
      const exercises = await fetchExercisesFromGitHub();

      // 3. Seed the local IndexedDB database for offline usage and persistent storage
      if (exercises && exercises.length > 0) {
        try {
          // Add to DB bulk
          await db.exercises_v2.bulkPut(exercises);
          console.log(
            `Seeded ${exercises.length} exercises into IndexedDB database.`,
          );
        } catch (dbError) {
          console.error("Failed to seed exercises to IndexedDB:", dbError);
        }
      }

      set({
        exercises,
        filteredExercises: exercises,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: "Failed to load exercises. Please try again.",
        isLoading: false,
      });
    }
  },

  setFilter: (key, value) => {
    const { exercises, filters } = get();
    const newFilters = { ...filters, [key]: value };

    set({
      filters: newFilters,
      filteredExercises: filterExercises(exercises, newFilters),
    });
  },

  clearFilters: () => {
    const { exercises } = get();
    set({
      filters: {},
      filteredExercises: exercises,
    });
  },

  getExerciseById: (id) => {
    return get().exercises.find((e) => e.id === id);
  },
}));
