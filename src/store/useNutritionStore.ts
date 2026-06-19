"use client";
import { create } from "zustand";
import { db, type FoodEntry, type NutritionGoal } from "@/db";
import { pushToCloud } from "@/lib/syncEngine";
import { uid } from "@/utils/id";

interface NutritionState {
  entries: FoodEntry[];
  goal: NutritionGoal | null;
  isLoading: boolean;
  loadEntries: (date: string) => Promise<void>;
  loadGoal: () => Promise<void>;
  addFoodEntry: (
    entry: Omit<FoodEntry, "id" | "createdAt" | "updatedAt">,
    userId?: string
  ) => Promise<void>;
  deleteFoodEntry: (id: string, userId?: string) => Promise<void>;
  setGoal: (goal: Omit<NutritionGoal, "id" | "updatedAt">, userId?: string) => Promise<void>;
}

export const useNutritionStore = create<NutritionState>((set) => ({
  entries: [],
  goal: null,
  isLoading: false,

  loadEntries: async (date) => {
    set({ isLoading: true });
    try {
      const entries = await db.foodEntries.where("date").equals(date).toArray();
      set({ entries: entries.filter((e) => !e.deleted), isLoading: false });
    } catch (error) {
      console.error("Failed to load food entries:", error);
      set({ isLoading: false });
    }
  },

  loadGoal: async () => {
    try {
      const goals = await db.nutritionGoals.toArray();
      const nonDeleted = goals.filter((g) => !g.deleted);
      if (nonDeleted.length > 0) {
        set({ goal: nonDeleted[0] });
      } else {
        set({ goal: null });
      }
    } catch (error) {
      console.error("Failed to load nutrition goal:", error);
    }
  },

  addFoodEntry: async (entry, userId) => {
    try {
      const now = new Date().toISOString();
      const newEntry: FoodEntry = {
        ...entry,
        id: uid(),
        createdAt: now,
        updatedAt: now,
        deleted: false,
      };
      await db.foodEntries.add(newEntry);

      set((state) => ({
        entries: [...state.entries, newEntry],
      }));

      if (userId) {
        pushToCloud(userId).catch(console.error);
      }
    } catch (error) {
      console.error("Failed to add food entry:", error);
    }
  },

  deleteFoodEntry: async (id, userId) => {
    try {
      const entry = await db.foodEntries.get(id);
      if (entry) {
        entry.deleted = true;
        entry.updatedAt = new Date().toISOString();
        await db.foodEntries.put(entry);

        set((state) => ({
          entries: state.entries.filter((e) => e.id !== id),
        }));

        if (userId) {
          pushToCloud(userId).catch(console.error);
        }
      }
    } catch (error) {
      console.error("Failed to delete food entry:", error);
    }
  },

  setGoal: async (goalArgs, userId) => {
    try {
      const now = new Date().toISOString();
      const existing = await db.nutritionGoals.toArray();

      let updatedGoal: NutritionGoal;

      if (existing.length > 0) {
        updatedGoal = { ...existing[0], ...goalArgs, updatedAt: now };
        await db.nutritionGoals.put(updatedGoal);
      } else {
        updatedGoal = {
          ...goalArgs,
          id: uid(),
          updatedAt: now,
          deleted: false,
        };
        await db.nutritionGoals.add(updatedGoal);
      }

      set({ goal: updatedGoal });

      if (userId) {
        pushToCloud(userId).catch(console.error);
      }
    } catch (error) {
      console.error("Failed to set nutrition goal:", error);
    }
  },
}));
