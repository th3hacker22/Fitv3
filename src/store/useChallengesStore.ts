"use client";
import { create } from "zustand";
import { useAuthStore } from "@/store/useAuthStore";

export interface Challenge {
  id: string;
  title: string;
  description: string;
  goalKg: number;
  startDate: string;
  endDate: string;
  createdAt?: string;
}

export interface Participation {
  userId: string;
  userName: string;
  userPhotoURL: string | null;
  progressKg: number;
  completed: boolean;
  completedAt?: string;
  joinedAt: string;
}

interface ChallengesState {
  activeChallenges: Challenge[];
  userParticipations: Record<string, Participation>;
  leaderboards: Record<string, Participation[]>;
  isLoading: boolean;
  fetchActiveChallenges: () => Promise<void>;
  joinChallenge: (challengeId: string) => Promise<void>;
  fetchUserProgress: (challengeId: string) => Promise<void>;
  fetchLeaderboard: (challengeId: string) => Promise<void>;
  /**
   * Sync local workout volume to all joined challenges (called after finishing a workout).
   * The `sessionId` parameter is an idempotency key — replays for the same session
   * are skipped, preventing double-counting from network retries / replays.
   */
  syncWorkoutVolume: (totalVolume: number, sessionId?: string) => Promise<void>;
}

export const useChallengesStore = create<ChallengesState>((set, get) => ({
  activeChallenges: [],
  userParticipations: {},
  leaderboards: {},
  isLoading: false,

  fetchActiveChallenges: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch(`/api/challenges`);
      if (!res.ok) {
        set({ activeChallenges: [] });
        return;
      }
      const list = (await res.json()) as Challenge[];
      set({ activeChallenges: list });
    } catch (e) {
      console.error("Failed to fetch active challenges:", e);
    } finally {
      set({ isLoading: false });
    }
  },

  joinChallenge: async (challengeId) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    try {
      const res = await fetch(`/api/challenges/${challengeId}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-name": user.displayName || "Unknown Athlete",
        },
        body: JSON.stringify({
          userId: user.uid,
          userName: user.displayName || "Unknown Athlete",
          userPhotoURL: user.photoURL || null,
        }),
      });
      if (!res.ok) return;
      const participation = (await res.json()) as Participation;
      set((state) => ({
        userParticipations: {
          ...state.userParticipations,
          [challengeId]: participation,
        },
      }));
      await get().fetchLeaderboard(challengeId);
    } catch (e) {
      console.error("Failed to join challenge:", e);
    }
  },

  fetchUserProgress: async (challengeId) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    try {
      const res = await fetch(
        `/api/challenges/${challengeId}/progress?userId=${encodeURIComponent(user.uid)}`
      );
      if (!res.ok) return;
      const data = (await res.json()) as Participation | null;
      set((state) => {
        const next = { ...state.userParticipations };
        if (data) {
          next[challengeId] = data;
        } else {
          delete next[challengeId];
        }
        return { userParticipations: next };
      });
    } catch (e) {
      console.error("Failed to fetch user progress:", e);
    }
  },

  fetchLeaderboard: async (challengeId) => {
    try {
      const res = await fetch(`/api/challenges/${challengeId}/leaderboard`);
      if (!res.ok) return;
      const list = (await res.json()) as Participation[];
      set((state) => ({
        leaderboards: { ...state.leaderboards, [challengeId]: list },
      }));
    } catch (e) {
      console.error("Failed to fetch leaderboard:", e);
    }
  },

  syncWorkoutVolume: async (totalVolume, sessionId) => {
    if (totalVolume <= 0) return;
    const user = useAuthStore.getState().user;
    if (!user) return;

    // ── Idempotency check: skip if this session was already synced ──
    // Prevents double-counting from network retries or component re-mounts.
    if (sessionId) {
      if (syncedSessionIds.has(sessionId)) {
        console.log(`[challengesStore] session ${sessionId} already synced, skipping`);
        return;
      }
      syncedSessionIds.add(sessionId);
      // Cap the set size to avoid unbounded memory growth over a long session
      if (syncedSessionIds.size > 100) {
        const first = syncedSessionIds.values().next().value;
        if (first) syncedSessionIds.delete(first);
      }
    }

    try {
      await fetch(`/api/challenges/sync-volume`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: user.uid, totalVolume, sessionId }),
      });
      // Refresh progress for all active challenges the user has joined.
      const { activeChallenges, userParticipations } = get();
      await Promise.all(
        activeChallenges
          .filter((c) => userParticipations[c.id])
          .map((c) => get().fetchUserProgress(c.id))
      );
    } catch (e) {
      // On failure, remove from synced set so a retry can succeed
      if (sessionId) syncedSessionIds.delete(sessionId);
      console.error("Failed to sync workout volume:", e);
    }
  },
}));

// ── Module-scope idempotency set (survives React re-renders) ──
const syncedSessionIds = new Set<string>();
