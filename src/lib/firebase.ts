"use client";
/**
 * firebase.ts shim — Next.js port runs WITHOUT Firebase.
 * Auth is local-only (localStorage); AI workout generation uses an API route
 * with z-ai-web-dev-sdk; social/challenges use Prisma API routes.
 *
 * These exports are kept as null/no-op so legacy imports compile, but the app
 * always takes the "local mode" code paths.
 */
export const auth = null;
export const db = null;
export const functions = null;
export const googleProvider = null;

export type FirebaseUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
};
