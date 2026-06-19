"use client";
import { useState, useEffect } from "react";
import { useSyncStore } from "@/store/useSyncStore";
import { formatDistanceToNow } from "date-fns";

export function useCloudSyncState() {
  const status = useSyncStore((s) => s.status);
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt);
  const [isOnline, setIsOnline] = useState(
    typeof window !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const getHumanReadableTime = () => {
    if (!lastSyncedAt) return "Local mode";
    try {
      const distance = formatDistanceToNow(new Date(lastSyncedAt), { addSuffix: true });
      return `Synced ${distance}`;
    } catch {
      return "Synced recently";
    }
  };

  return {
    isOnline,
    status,
    lastSyncedText: getHumanReadableTime(),
  };
}
