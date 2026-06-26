"use client";
import { useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useSyncStore } from "@/store/useSyncStore";
import { useToastStore } from "@/store/useToastStore";
import { syncAll } from "@/lib/syncEngine";

/**
 * Background Sync Hook.
 *
 * Calls syncAll (which returns a SyncResult) and updates the UI stores
 * based on the result. This is where the lib→store boundary lives —
 * syncEngine.ts itself is a pure library that doesn't import stores.
 */
export function useBackgroundSync() {
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) return;

    const doSync = async () => {
      const result = await syncAll(user.uid);
      useSyncStore.getState().setStatus(result.status);
      if (result.lastSyncedAt) {
        useSyncStore.getState().setLastSyncedAt(result.lastSyncedAt);
      }
      if (result.status === "error") {
        useToastStore.getState().addToast("error", "Sync failed.");
      }
    };

    // Initial sync on login/mount
    doSync().catch(console.error);

    const intervalId = setInterval(() => {
      doSync().catch(console.error);
    }, 5 * 60 * 1000);

    const handleOnline = () => doSync().catch(console.error);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        doSync().catch(console.error);
      }
    };

    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user]);
}
