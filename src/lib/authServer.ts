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
    const decoded = await adminAuth.verifyIdToken(token);
    return { uid: decoded.uid, response: null };
  } catch {
    return {
      uid: null,
      response: errorResponse("Invalid or expired session. Please sign in again.", 401),
    };
  }
}
