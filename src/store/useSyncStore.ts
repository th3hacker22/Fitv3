"use client";
import { create } from "zustand";

export type SyncStatus = "idle" | "syncing" | "error";

interface SyncState {
  status: SyncStatus;
  lastSyncedAt: string | null;
  setStatus: (status: SyncStatus) => void;
  setLastSyncedAt: (time: string | null) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  status: "idle",
  lastSyncedAt:
    typeof window !== "undefined" ? localStorage.getItem("pulse_last_synced_at") : null,
  setStatus: (status) => set({ status }),
  setLastSyncedAt: (time) => {
    if (time && typeof window !== "undefined") {
      localStorage.setItem("pulse_last_synced_at", time);
    }
    set({ lastSyncedAt: time });
  },
}));
