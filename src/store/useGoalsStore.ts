"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { db, type Goal, type GoalType, type GoalTimeFrame } from "@/db/schema";
import { uid } from "@/utils/id";
import {
  getAllGoals,
  addGoal,
  updateGoal,
  softDeleteGoal,
} from "@/db/repositories/goalRepo";
import { pushToCloud } from "@/lib/syncEngine";
import { useAuthStore } from "@/store/useAuthStore";

interface GoalsState {
  goals: Goal[];
  isLoading: boolean;
  loadGoals: () => Promise<void>;
  createGoal: (input: {
    type: GoalType;
    targetValue: number;
    exerciseId?: string;
    exerciseName?: string;
    timeFrame: GoalTimeFrame;
  }) => Promise<void>;
  editGoal: (id: string, changes: Partial<Goal>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  markAchieved: (id: string) => Promise<void>;
}

export const useGoalsStore = create<GoalsState>()(
  persist(
    (set) => ({
      goals: [],
      isLoading: false,

      loadGoals: async () => {
        set({ isLoading: true });
        try {
          const goals = await getAllGoals();
          set({ goals, isLoading: false });
        } catch {
          set({ isLoading: false });
        }
      },

      createGoal: async (input) => {
        const now = new Date().toISOString();
        const goal: Goal = {
          id: uid(),
          type: input.type,
          targetValue: input.targetValue,
          exerciseId: input.exerciseId,
          exerciseName: input.exerciseName,
          timeFrame: input.timeFrame,
          achieved: false,
          createdAt: now,
          updatedAt: now,
        };
        await addGoal(goal);
        set((state) => ({ goals: [...state.goals, goal] }));
        pushToCloud(useAuthStore.getState().user?.uid ?? "").catch(() => {});
      },

      editGoal: async (id, changes) => {
        const now = new Date().toISOString();
        const updated = { ...changes, updatedAt: now };
        await updateGoal(id, updated);
        set((state) => ({
          goals: state.goals.map((g) => (g.id === id ? { ...g, ...updated } : g)),
        }));
        pushToCloud(useAuthStore.getState().user?.uid ?? "").catch(() => {});
      },

      deleteGoal: async (id) => {
        await softDeleteGoal(id);
        set((state) => ({
          goals: state.goals.filter((g) => g.id !== id),
        }));
        pushToCloud(useAuthStore.getState().user?.uid ?? "").catch(() => {});
      },

      markAchieved: async (id) => {
        const now = new Date().toISOString();
        await updateGoal(id, { achieved: true, achievedAt: now, updatedAt: now });
        set((state) => ({
          goals: state.goals.map((g) =>
            g.id === id ? { ...g, achieved: true, achievedAt: now } : g
          ),
        }));
      },
    }),
    {
      name: "pulse-goals",
      partialize: (state) => ({ goals: state.goals }),
    }
  )
);
