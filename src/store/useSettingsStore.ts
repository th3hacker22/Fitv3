"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "dark" | "light" | "system";

export interface SettingsStore {
  ramadanMode: boolean;
  toggleRamadanMode: () => void;
  restDuration: number;
  setRestDuration: (seconds: number) => void;
  weightUnit: "kg" | "lbs";
  setWeightUnit: (unit: "kg" | "lbs") => void;
  notificationsEnabled: boolean;
  toggleNotifications: () => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  workoutReminders: boolean;
  toggleWorkoutReminders: () => void;
  setWorkoutReminders: (enabled: boolean) => void;
  soundEnabled: boolean;
  toggleSound: () => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ramadanMode: false,
      toggleRamadanMode: () => set((state) => ({ ramadanMode: !state.ramadanMode })),
      restDuration: 60,
      setRestDuration: (seconds) => set({ restDuration: seconds }),
      weightUnit: "kg",
      setWeightUnit: (unit) => set({ weightUnit: unit }),
      notificationsEnabled: false,
      toggleNotifications: () =>
        set((state) => ({ notificationsEnabled: !state.notificationsEnabled })),
      setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
      workoutReminders: true,
      toggleWorkoutReminders: () =>
        set((state) => ({ workoutReminders: !state.workoutReminders })),
      setWorkoutReminders: (enabled) => set({ workoutReminders: enabled }),
      soundEnabled: true,
      toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
      theme: "system",
      setTheme: (theme) => set({ theme }),
    }),
    { name: "pulse-settings" }
  )
);
