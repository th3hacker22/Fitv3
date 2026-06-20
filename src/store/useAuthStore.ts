"use client";
import { create } from "zustand";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

export interface LocalUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
}

interface AuthState {
  user: LocalUser | null;
  isLoading: boolean;
  emailVerificationNeeded: boolean;
  setUser: (user: LocalUser | null) => void;
  setLoading: (isLoading: boolean) => void;
  setEmailVerificationNeeded: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  emailVerificationNeeded: false,
  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),
  setEmailVerificationNeeded: (v) => set({ emailVerificationNeeded: v }),
}));

let isInitialized = false;

export function initAuthListener() {
  if (isInitialized) return;
  isInitialized = true;

  if (typeof window !== "undefined") {
    onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        if (!firebaseUser.emailVerified) {
          useAuthStore.getState().setEmailVerificationNeeded(true);
          useAuthStore.getState().setLoading(false);
          return;
        }
        const mapped: LocalUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          emailVerified: firebaseUser.emailVerified,
        };
        useAuthStore.getState().setUser(mapped);
        useAuthStore.getState().setEmailVerificationNeeded(false);

        const idToken = await firebaseUser.getIdToken();
        fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        }).catch((err) => console.error("Failed to sync session cookie:", err));
      } else {
        useAuthStore.getState().setUser(null);
      }
      useAuthStore.getState().setLoading(false);
    });
  }
}

export async function logoutUser() {
  await fetch("/api/auth/session", { method: "DELETE" }).catch(() => {});
  await firebaseSignOut(auth);
}
