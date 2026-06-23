import { NextRequest } from "next/server";
import { errorResponse } from "./validation";
import { getAdminAuth } from "./firebaseAdmin";

export function getTokenFromCookie(req: NextRequest): string | null {
  return req.cookies.get("pulse_session")?.value ?? null;
}

export async function requireUser(
  req: NextRequest
): Promise<{ uid: string; response: null } | { uid: null; response: Response }> {
  const token = getTokenFromCookie(req);
  if (!token) {
    return {
      uid: null,
      response: errorResponse("Authentication required. Please sign in.", 401),
    };
  }

  try {
    const adminAuth = getAdminAuth();
    // Use verifySessionCookie (not verifyIdToken) because the cookie now
    // contains a Firebase session cookie (7-day TTL), not a raw ID token (1-hour TTL).
    // The second argument `true` enables revocation checking.
    const decoded = await adminAuth.verifySessionCookie(token, true);
    return { uid: decoded.uid, response: null };
  } catch {
    return {
      uid: null,
      response: errorResponse("Invalid or expired session. Please sign in again.", 401),
    };
  }
}
