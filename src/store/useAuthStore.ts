"use client";
import { create } from "zustand";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { auth, isFirebaseConfigured } from "@/lib/firebase";

export interface LocalUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  /**
   * True when the user is a synthetic local guest (Firebase Auth not
   * configured). Used by the UI to show an "offline mode" badge and by
   * social/upload flows to gracefully skip server calls.
   */
  isGuest?: boolean;
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

/** Stable local guest identity for offline-only mode (Firebase not configured). */
const GUEST_UID = "local-guest";

function makeGuestUser(): LocalUser {
  return {
    uid: GUEST_UID,
    email: null,
    displayName: "Guest",
    photoURL: null,
    emailVerified: true,
    isGuest: true,
  };
}

/** Public escape hatch — lets AuthPage offer a "Continue offline" button. */
export function continueAsGuest() {
  useAuthStore.getState().setUser(makeGuestUser());
  useAuthStore.getState().setLoading(false);
}

export function initAuthListener() {
  if (isInitialized) return;
  isInitialized = true;

  // Offline-first: when Firebase isn't configured (no NEXT_PUBLIC_FIREBASE_*
  // env vars), there's no auth listener to register. Instead of leaving the
  // user null (which the redirect gate in `page.tsx` would interpret as
  // "must go to auth" and trap them on a broken login screen), we auto-create
  // a local guest user so the app is immediately usable. All workout data
  // flows to Dexie/IndexedDB under this guest uid.
  if (!isFirebaseConfigured || !auth) {
    useAuthStore.getState().setUser(makeGuestUser());
    useAuthStore.getState().setLoading(false);
    return;
  }

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
  // Always clear the session cookie best-effort (no-op if Firebase is off).
  await fetch("/api/auth/session", { method: "DELETE" }).catch(() => {});
  if (!auth) return;
  await firebaseSignOut(auth);
}
