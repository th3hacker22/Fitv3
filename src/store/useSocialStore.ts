import { create } from "zustand";
import {
  socialService,
  FeedPost,
  PublicProfile,
} from "@/services/socialService";

interface SocialState {
  following: string[];
  feed: FeedPost[];
  searchResults: PublicProfile[];
  isLoading: boolean;
  isSearching: boolean;
  loadFollowing: (uid: string) => Promise<void>;
  loadFeed: () => Promise<void>;
  searchUsers: (query: string) => Promise<void>;
  follow: (currentUid: string, targetUid: string) => Promise<void>;
  unfollow: (currentUid: string, targetUid: string) => Promise<void>;
  giveKudos: (postId: string) => Promise<void>;
  publishSession: (
    uid: string,
    name: string,
    photoURL: string | null,
    summary: {
      workoutTitle: string;
      duration: number;
      totalVolume: number;
      exercisesCount: number;
    },
  ) => Promise<void>;
  clearState: () => void;
}

export const useSocialStore = create<SocialState>((set, get) => ({
  following: [],
  feed: [],
  searchResults: [],
  isLoading: false,
  isSearching: false,

  loadFollowing: async (uid) => {
    try {
      const list = await socialService.getFollowingList(uid);
      set({ following: list });
    } catch (e) {
      console.error("Failed to load following list:", e);
    }
  },

  loadFeed: async () => {
    set({ isLoading: true });
    try {
      const list = get().following;
      const posts = await socialService.getFeed(list);
      set({ feed: posts });
    } catch (e) {
      console.error("Failed to load feed:", e);
    } finally {
      set({ isLoading: false });
    }
  },

  searchUsers: async (query) => {
    if (!query.trim()) {
      set({ searchResults: [] });
      return;
    }
    set({ isSearching: true });
    try {
      const results = await socialService.searchUsers(query);
      set({ searchResults: results });
    } catch (e) {
      console.error("Failed to search users:", e);
    } finally {
      set({ isSearching: false });
    }
  },

  follow: async (currentUid, targetUid) => {
    try {
      await socialService.followUser(currentUid, targetUid);
      const newFollowing = [...get().following, targetUid];
      set({ following: newFollowing });
      await get().loadFeed();
    } catch (e) {
      console.error("Failed to follow target:", e);
    }
  },

  unfollow: async (currentUid, targetUid) => {
    try {
      await socialService.unfollowUser(currentUid, targetUid);
      const newFollowing = get().following.filter((uid) => uid !== targetUid);
      set({ following: newFollowing });
      set({ feed: get().feed.filter((post) => post.authorUid !== targetUid) });
    } catch (e) {
      console.error("Failed to unfollow target:", e);
    }
  },

  giveKudos: async (postId) => {
    try {
      const feed = get().feed;
      // Optimistic update
      set({
        feed: feed.map((p) =>
          p.id === postId ? { ...p, kudosCount: p.kudosCount + 1 } : p,
        ),
      });
      await socialService.addKudos(postId);
    } catch (e) {
      console.error("Failed to give kudos:", e);
      // Revert optimism if needed (skipped for simplicity)
    }
  },

  publishSession: async (uid, name, photoURL, summary) => {
    try {
      await socialService.publishWorkout({
        authorUid: uid,
        authorName: name,
        authorPhotoURL: photoURL,
        workoutTitle: summary.workoutTitle,
        duration: summary.duration,
        totalVolume: summary.totalVolume,
        exercisesCount: summary.exercisesCount,
      });
    } catch (e) {
      console.error("Failed to publish workout:", e);
    }
  },

  clearState: () => {
    set({ following: [], feed: [], searchResults: [] });
  },
}));
