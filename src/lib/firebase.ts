import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Note: Firebase configuration is loaded from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  databaseId: import.meta.env.VITE_FIREBASE_DB_ID,
};

// Initialize only if keys exist, avoiding issues with partial configs
const app =
  firebaseConfig.apiKey && firebaseConfig.projectId
    ? initializeApp(firebaseConfig)
    : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app, firebaseConfig.databaseId) : null;
