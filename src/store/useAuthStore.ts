"use client";
import { create } from "zustand";

export interface LocalUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

interface AuthState {
  user: LocalUser | null;
  isLoading: boolean;
  setUser: (user: LocalUser | null) => void;
  setLoading: (isLoading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),
}));

let isInitialized = false;

/**
 * Initialize auth listener. In this Next.js port there is no Firebase, so we
 * simply restore a locally-saved user from localStorage. The app is offline-first.
 */
export function initAuthListener() {
  if (isInitialized) return;
  isInitialized = true;

  if (typeof window !== "undefined") {
    const savedLocalUser = localStorage.getItem("local_user");
    if (savedLocalUser) {
      try {
        const parsed = JSON.parse(savedLocalUser) as LocalUser;
        useAuthStore.getState().setUser(parsed);

        // Sync the secure HttpOnly session cookie with the server in the background
        fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid: parsed.uid }),
        }).catch((err) => console.error("Failed to sync session cookie on startup:", err));
      } catch (err) {
        console.error("Failed to parse saved local user:", err);
      }
    }
    useAuthStore.getState().setLoading(false);
  }
}
