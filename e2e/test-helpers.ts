import { test as base, expect } from "@playwright/test";

// Firebase Auth Emulator is expected at localhost:9099.
// Start it before E2E: `firebase emulators:start --only auth`
// In CI, the e2e job starts it (see S3-T05 ci.yml).
const EMULATOR_HOST = "127.0.0.1:9099";

/**
 * Create a test user in the Firebase Auth Emulator via the REST API.
 * Returns the uid + idToken.
 */
export async function createTestUser(
  email: string,
  password: string
): Promise<{ uid: string; idToken: string }> {
  const res = await fetch(
    `http://${EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=any`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  const data = await res.json();
  return { uid: data.localId, idToken: data.idToken };
}

/**
 * Mint a session cookie from the emulator's idToken by calling our own
 * /api/auth/session endpoint (which calls firebase-admin createSessionCookie).
 * The firebase-admin SDK must be pointed at the emulator via FIREBASE_AUTH_EMULATOR_HOST.
 */
export async function mintSessionCookie(
  page: import("@playwright/test").Page,
  idToken: string
): Promise<string> {
  const res = await page.request.post("/api/auth/session", {
    data: { idToken },
  });
  expect(res.ok()).toBeTruthy();
  const setCookie = res.headers()["set-cookie"] || "";
  const match = setCookie.match(/pulse_session=([^;]+)/);
  return match ? match[1] : "";
}

/**
 * Set the pulse_session cookie on the page context so authenticated
 * API calls + requireUser work.
 */
export async function setSessionCookie(
  page: import("@playwright/test").Page,
  cookieValue: string
): Promise<void> {
  await page.context().addCookies([
    {
      name: "pulse_session",
      value: cookieValue,
      domain: "localhost",
      path: "/",
    },
  ]);
}

/**
 * Clear Dexie (PulseDB) to ensure no state leaks between tests.
 */
export async function clearDexie(
  page: import("@playwright/test").Page
): Promise<void> {
  await page.evaluate(() => {
    return new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase("PulseDB");
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  });
}

// Extend the test fixture with a pre-authenticated page
export const test = base.extend<{
  authedPage: import("@playwright/test").Page;
}>({
  authedPage: async ({ page }, use) => {
    const { idToken } = await createTestUser(
      `test-${Date.now()}@example.com`,
      "testpass123"
    );
    const cookie = await mintSessionCookie(page, idToken);
    await setSessionCookie(page, cookie);
    // Playwright fixture teardown callback — not a React Hook. The react-hooks
    // plugin misfires because the param is named `use`. Safe to disable here.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page);
  },
});

export { expect };
