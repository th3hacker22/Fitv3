import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/authServer";
import { serverErrorResponse } from "@/lib/validation";
import { parseQueryParams } from "@/lib/apiSchemas";
import { followingQuerySchema } from "./schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Return an array of UIDs the caller is following.
// Query: ?uid=<ignored>&includeProfiles=true
//
// SECURITY: The `uid` query param is intentionally IGNORED to prevent IDOR /
// PII enumeration. The caller's own session UID (callerUid) is always used,
// so an authenticated user can only ever read their own following list.
export async function GET(req: NextRequest) {
  try {
    // ── Authentication: require valid session ──
    const { uid: callerUid, response: authResponse } = await requireUser(req);
    if (!callerUid) return authResponse!;

    const parsed = parseQueryParams(req, followingQuerySchema);
    if (!parsed.success) return parsed.response;
    const { includeProfiles } = parsed.data;

    if (includeProfiles) {
      const follows = await prisma.follow.findMany({
        where: { followerUid: callerUid },
        include: { following: true },
      });
      const profiles = follows.map((f) => ({
        uid: f.following.uid,
        displayName: f.following.displayName,
        photoURL: f.following.photoURL,
      }));
      return NextResponse.json(profiles);
    }

    const follows = await prisma.follow.findMany({
      where: { followerUid: callerUid },
      select: { followingUid: true },
    });

    const following = follows.map((f) => f.followingUid);
    return NextResponse.json(following);
  } catch (error) {
    console.error("social/following GET failed:", error);
    return serverErrorResponse();
  }
}
