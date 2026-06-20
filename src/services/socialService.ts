"use client";
/**
 * socialService — thin client wrapper for the social API routes.
 * The store calls the API directly; this module is kept for compatibility.
 */
import { useAuthStore } from "@/store/useAuthStore";

export type { PublicProfile, FeedPost, Comment } from "@/store/useSocialStore";

export const socialService = {
  async updatePublicProfile(uid: string, displayName: string, photoURL: string | null) {
    try {
      const user = useAuthStore.getState().user;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (user) {
        headers["x-user-uid"] = user.uid;
        headers["x-user-name"] = user.displayName || "Athlete";
      }
      await fetch(`/api/social/profile`, {
        method: "POST",
        headers,
        body: JSON.stringify({ uid, displayName, photoURL }),
      });
    } catch (e) {
      console.error("updatePublicProfile failed:", e);
    }
  },
};
