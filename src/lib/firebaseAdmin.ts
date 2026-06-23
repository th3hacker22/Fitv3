import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

let authInstance: ReturnType<typeof getAuth> | null = null;

function loadServiceAccount(): Record<string, unknown> {
  const envVar = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (envVar) return JSON.parse(envVar);

  const candidates = [
    process.env.SERVICE_ACCOUNT_PATH,
    "service-account.json",
    join(process.cwd(), "service-account.json"),
  ];

  for (const p of candidates) {
    if (!p) continue;
    try {
      if (existsSync(p)) return JSON.parse(readFileSync(p, "utf-8"));
    } catch {}
  }

  throw new Error(
    "Firebase Admin credentials not found. Set FIREBASE_SERVICE_ACCOUNT env var or create service-account.json."
  );
}

function getAdminAuth(): ReturnType<typeof getAuth> {
  if (authInstance) return authInstance;
  if (getApps().length) {
    authInstance = getAuth();
    return authInstance;
  }
  const serviceAccount = loadServiceAccount();
  initializeApp({ credential: cert(serviceAccount) });
  authInstance = getAuth();
  return authInstance;
}

export { getAdminAuth };
