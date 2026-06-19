"use client";
import { useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { syncAll } from "@/lib/syncEngine";

export function useBackgroundSync() {
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) return;

    // Initial sync on login/mount (local-mode no-op, just stamps lastSyncedAt)
    syncAll(user.uid).catch(console.error);

    const intervalId = setInterval(() => {
      syncAll(user.uid).catch(console.error);
    }, 5 * 60 * 1000);

    const handleOnline = () => syncAll(user.uid).catch(console.error);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncAll(user.uid).catch(console.error);
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
