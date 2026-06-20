"use client";
import { create } from "zustand";
import { useAuthStore } from "@/store/useAuthStore";

/** Build headers for auth-gated write operations.
 *  User identity is verified server-side via the session cookie —
 *  do NOT send x-user-name or x-user-photo (they were spoofable). */
function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...extra };
  return headers;
}

export interface PublicProfile {
  uid: string;
  displayName: string;
  photoURL: string | null;
}

export interface FeedPost {
  id: string;
  authorUid: string;
  authorName: string;
  authorPhotoURL: string | null;
  workoutTitle: string;
  duration: number;
  totalVolume: number;
  exercisesCount: number;
  kudosCount: number;
  commentCount: number;
  createdAt: string;
}

export interface Comment {
  id: string;
  authorUid: string;
  authorName: string;
  authorPhotoURL: string | null;
  text: string;
  createdAt: string;
}

interface SocialState {
  following: string[];
  followingProfiles: PublicProfile[];
  feed: FeedPost[];
  searchResults: PublicProfile[];
  commentsByPost: Record<string, Comment[]>;
  kudsedPostIds: Set<string>;
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
    }
  ) => Promise<void>;
  loadComments: (postId: string) => Promise<void>;
  addComment: (postId: string, text: string) => Promise<void>;
  deleteComment: (postId: string, commentId: string) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
  clearState: () => void;
}

export const useSocialStore = create<SocialState>((set, get) => ({
  following: [],
  followingProfiles: [],
  feed: [],
  searchResults: [],
  commentsByPost: {},
  kudsedPostIds: new Set<string>(),
  isLoading: false,
  isSearching: false,

  loadFollowing: async (uid) => {
    try {
      const res = await fetch(`/api/social/following?uid=${encodeURIComponent(uid)}&includeProfiles=true`);
      if (!res.ok) return;
      const list = (await res.json()) as PublicProfile[];
      set({
        following: list.map((p) => p.uid),
        followingProfiles: list,
      });
    } catch (e) {
      console.error("Failed to load following list:", e);
    }
  },

  loadFeed: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch(`/api/social/feed`);
      if (!res.ok) {
        set({ feed: [] });
        return;
      }
      const posts = (await res.json()) as FeedPost[];
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
      const res = await fetch(
        `/api/social/search?q=${encodeURIComponent(query)}`
      );
      if (!res.ok) {
        set({ searchResults: [] });
        return;
      }
      const results = (await res.json()) as PublicProfile[];
      set({ searchResults: results });
    } catch (e) {
      console.error("Failed to search users:", e);
    } finally {
      set({ isSearching: false });
    }
  },

  follow: async (currentUid, targetUid) => {
    try {
      await fetch(`/api/social/follow`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ currentUid, targetUid }),
      });
      await get().loadFollowing(currentUid);
      await get().loadFeed();
    } catch (e) {
      console.error("Failed to follow target:", e);
    }
  },

  unfollow: async (currentUid, targetUid) => {
    try {
      await fetch(`/api/social/follow`, {
        method: "DELETE",
        headers: authHeaders(),
        body: JSON.stringify({ currentUid, targetUid }),
      });
      set({
        following: get().following.filter((uid) => uid !== targetUid),
        followingProfiles: get().followingProfiles.filter((p) => p.uid !== targetUid),
        feed: get().feed.filter((post) => post.authorUid !== targetUid),
      });
    } catch (e) {
      console.error("Failed to unfollow target:", e);
    }
  },

  giveKudos: async (postId) => {
    const feed = get().feed;
    const kudsedPostIds = new Set(get().kudsedPostIds);
    const hasKudsed = kudsedPostIds.has(postId);

    // Optimistic update: toggle count + toggle set
    const newCount = hasKudsed
      ? Math.max(0, (feed.find((p) => p.id === postId)?.kudosCount ?? 1) - 1)
      : (feed.find((p) => p.id === postId)?.kudosCount ?? 0) + 1;

    if (hasKudsed) {
      kudsedPostIds.delete(postId);
    } else {
      kudsedPostIds.add(postId);
    }

    set({
      feed: feed.map((p) =>
        p.id === postId ? { ...p, kudosCount: newCount } : p
      ),
      kudsedPostIds,
    });

    try {
      const res = await fetch(`/api/social/kudos`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ postId }),
      });
      if (!res.ok) {
        // Revert on failure
        const revertedIds = new Set(get().kudsedPostIds);
        if (hasKudsed) revertedIds.add(postId);
        else revertedIds.delete(postId);
        set({
          feed: get().feed.map((p) =>
            p.id === postId
              ? { ...p, kudosCount: hasKudsed ? newCount + 1 : Math.max(0, newCount - 1) }
              : p
          ),
          kudsedPostIds: revertedIds,
        });
        return;
      }
      // Sync with server response
      const data = await res.json();
      if (data.kudosCount !== undefined) {
        set({
          feed: get().feed.map((p) =>
            p.id === postId ? { ...p, kudosCount: data.kudosCount } : p
          ),
        });
      }
    } catch (e) {
      console.error("Failed to toggle kudos:", e);
      // Revert on network error
      const revertedIds = new Set(get().kudsedPostIds);
      if (hasKudsed) revertedIds.add(postId);
      else revertedIds.delete(postId);
      set({
        feed: get().feed.map((p) =>
          p.id === postId
            ? { ...p, kudosCount: hasKudsed ? newCount + 1 : Math.max(0, newCount - 1) }
            : p
        ),
        kudsedPostIds: revertedIds,
      });
    }
  },

  publishSession: async (uid, name, photoURL, summary) => {
    try {
      await fetch(`/api/social/feed`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          authorUid: uid,
          authorName: name,
          authorPhotoURL: photoURL,
          ...summary,
        }),
      });
    } catch (e) {
      console.error("Failed to publish workout:", e);
    }
  },

  loadComments: async (postId) => {
    try {
      const res = await fetch(`/api/social/comments?postId=${encodeURIComponent(postId)}`);
      if (!res.ok) return;
      const comments = (await res.json()) as Comment[];
      set((state) => ({
        commentsByPost: { ...state.commentsByPost, [postId]: comments },
      }));
    } catch (e) {
      console.error("Error loading comments:", e);
    }
  },

  addComment: async (postId, text) => {
    try {
      await fetch(`/api/social/comments`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ postId, text }),
      });
      set((state) => ({
        feed: state.feed.map((post) =>
          post.id === postId
            ? { ...post, commentCount: (post.commentCount || 0) + 1 }
            : post
        ),
      }));
      await get().loadComments(postId);
    } catch (e) {
      console.error("Failed to add comment:", e);
      throw e;
    }
  },

  deleteComment: async (postId, commentId) => {
    try {
      const res = await fetch(`/api/social/comments`, {
        method: "DELETE",
        headers: authHeaders(),
        body: JSON.stringify({ postId, commentId }),
      });
      // If the server rejected (403/404), don't optimistically decrement.
      if (!res.ok) {
        throw new Error(`Delete failed: ${res.status}`);
      }
      set((state) => ({
        feed: state.feed.map((post) =>
          post.id === postId
            ? { ...post, commentCount: Math.max(0, (post.commentCount || 0) - 1) }
            : post
        ),
      }));
      await get().loadComments(postId);
    } catch (e) {
      console.error("Failed to delete comment:", e);
      throw e;
    }
  },

  deletePost: async (postId) => {
    try {
      const res = await fetch(`/api/social/posts`, {
        method: "DELETE",
        headers: authHeaders(),
        body: JSON.stringify({ postId }),
      });
      if (!res.ok) {
        throw new Error(`Delete failed: ${res.status}`);
      }
      // Optimistically remove from feed
      set((state) => ({
        feed: state.feed.filter((p) => p.id !== postId),
      }));
    } catch (e) {
      console.error("Failed to delete post:", e);
      throw e;
    }
  },

  clearState: () => {
    set({ following: [], followingProfiles: [], feed: [], searchResults: [], commentsByPost: {}, kudsedPostIds: new Set<string>() });
  },
}));
