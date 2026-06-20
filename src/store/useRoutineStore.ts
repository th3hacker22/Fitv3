"use client";
import { create } from "zustand";
import { db, type Routine } from "@/db";
import { pushToCloud } from "@/lib/syncEngine";

interface RoutineState {
  routines: Routine[];
  isLoading: boolean;
  loadRoutines: () => Promise<void>;
  saveRoutine: (routine: Routine, userId?: string) => Promise<void>;
  deleteRoutine: (id: string, userId?: string) => Promise<void>;
}

export const useRoutineStore = create<RoutineState>((set) => ({
  routines: [],
  isLoading: false,

  loadRoutines: async () => {
    set({ isLoading: true });
    try {
      const routines = await db.routines.toArray();
      const nonDeleted = routines.filter((r) => !r.deleted);
      nonDeleted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      set({ routines: nonDeleted, isLoading: false });
    } catch (error) {
      console.error("Failed to load routines:", error);
      set({ isLoading: false });
    }
  },

  saveRoutine: async (routine, userId) => {
    try {
      await db.routines.put({
        ...routine,
        updatedAt: new Date().toISOString(),
      });
      const routines = await db.routines.toArray();
      const nonDeleted = routines.filter((r) => !r.deleted);
      nonDeleted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      set({ routines: nonDeleted });

      if (userId) {
        pushToCloud(userId).catch(console.error);
      }
    } catch (error) {
      console.error("Failed to save routine:", error);
    }
  },

  deleteRoutine: async (id, userId) => {
    try {
      const routine = await db.routines.get(id);
      if (routine) {
        routine.deleted = true;
        routine.updatedAt = new Date().toISOString();
        await db.routines.put(routine);

        const routines = await db.routines.toArray();
        const nonDeleted = routines.filter((r) => !r.deleted);
        nonDeleted.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        set({ routines: nonDeleted });

        if (userId) {
          pushToCloud(userId).catch(console.error);
        }
      }
    } catch (error) {
      console.error("Failed to delete routine:", error);
    }
  },
}));
