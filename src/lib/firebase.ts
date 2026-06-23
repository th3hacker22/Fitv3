"use client";
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  type Auth,
} from "firebase/auth";
import { getStorage, type FirebaseStorage } from "firebase/storage";

/**
 * Firebase client SDK bootstrap.
 *
 * This app is **offline-first** — Dexie/IndexedDB is the source of truth and
 * the core workout-tracking flow must work with zero backend configuration.
 * Firebase Auth + Storage are only used for the optional social/cloud features
 * (feed, challenges, avatar sync, progress-photo upload).
 *
 * When the `NEXT_PUBLIC_FIREBASE_*` env vars are not configured (e.g. local dev
 * without a Firebase project, CI, or air-gapped deployments), we must NOT call
 * `initializeApp()` with an empty config — doing so makes the subsequent
 * `getAuth()` throw `auth/invalid-api-key` at module-load time, which crashes
 * the whole app because `useAuthStore` imports this module at the top of the
 * component tree (`page.tsx` → `Layout` → `useAuthStore` → here).
 *
 * So we detect missing config and export `null` for `auth` / `storage` /
 * `googleProvider`. Every consumer must check `isFirebaseConfigured` (or
 * null-check the imported handle) before touching these objects.
 */

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/**
 * True only when every value required by Firebase Auth is present and non-empty.
 * `storageBucket` is intentionally not required here because Storage is an
 * optional feature — Auth is the gate for the social layer.
 */
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId,
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let storage: FirebaseStorage | null = null;
let googleProvider: GoogleAuthProvider | null = null;

if (isFirebaseConfigured && !getApps().length) {
  app = initializeApp(firebaseConfig);
} else if (isFirebaseConfigured && getApps().length) {
  app = getApps()[0];
}

if (app) {
  auth = getAuth(app);
  storage = getStorage(app);
  googleProvider = new GoogleAuthProvider();
}

export { auth, storage, googleProvider };
