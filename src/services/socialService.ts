"use client";
import { useAuthStore } from "@/store/useAuthStore";

export type { PublicProfile, FeedPost, Comment } from "@/store/useSocialStore";

export const socialService = {
  async updatePublicProfile(uid: string, displayName: string, photoURL: string | null) {
    try {
      await fetch(`/api/social/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, displayName, photoURL }),
      });
    } catch (e) {
      console.error("updatePublicProfile failed:", e);
    }
  },
};
