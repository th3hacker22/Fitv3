"use client";
import { create } from "zustand";
import type { Exercise } from "@/types/exercise";
import {
  fetchExercisesFromGitHub,
  filterExercises,
  invalidateSearchIndex,
  type ExerciseFilters,
} from "@/services/exerciseService";
import { db } from "@/db";

import { exerciseArabicMap } from "@/utils/exerciseTranslations";

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
  setFilter: <K extends keyof ExerciseFilters>(key: K, value: ExerciseFilters[K]) => void;
  clearFilters: () => void;
  getExerciseById: (id: string) => Exercise | undefined;
  addCustomExercise: (exercise: Omit<Exercise, "id" | "isCustom">) => Promise<void>;
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
        // Enrich with nameAr
        exercises.forEach((e) => {
          e.nameAr = exerciseArabicMap[e.name.toLowerCase()] || e.nameAr;
        });
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
          console.log(`Seeded ${exercises.length} exercises into IndexedDB database.`);
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
  addCustomExercise: async (newEx) => {
    try {
      const customEx: Exercise = {
        ...newEx,
        id: "custom_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9),
        isCustom: true,
        imageUrl: newEx.imageUrl || "/images/custom-exercise.jpg",
        gifUrl: newEx.gifUrl || "",
      };

      await db.exercises_v2.add(customEx);

      const exercises = [customEx, ...get().exercises];
      // Invalidate the search index so the new exercise is discoverable
      invalidateSearchIndex();
      set({
        exercises,
        filteredExercises: filterExercises(exercises, get().filters),
      });
    } catch (error) {
      console.error("Failed to add custom exercise:", error);
      const { useToastStore } = await import("@/store/useToastStore");
      useToastStore.getState().addToast("error", "Failed to save custom exercise.");
    }
  },
}));
