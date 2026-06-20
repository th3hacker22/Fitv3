import { NextRequest } from "next/server";
import { verifyJwt, type JwtPayload } from "./jwt";
import { errorResponse } from "./validation";

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
    const payload: JwtPayload = await verifyJwt(token);
    return { uid: payload.uid, response: null };
  } catch {
    return {
      uid: null,
      response: errorResponse("Invalid or expired session. Please sign in again.", 401),
    };
  }
}
