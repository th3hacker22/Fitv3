import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Return an array of UIDs the given user is following.
// Query: ?uid=<followerUid>
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const uid = searchParams.get("uid");

    if (!uid) {
      return NextResponse.json(
        { error: "Missing uid query parameter" },
        { status: 400 }
      );
    }

    const includeProfiles = searchParams.get("includeProfiles") === "true";

    if (includeProfiles) {
      const follows = await prisma.follow.findMany({
        where: { followerUid: uid },
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
      where: { followerUid: uid },
      select: { followingUid: true },
    });

    const following = follows.map((f) => f.followingUid);
    return NextResponse.json(following);
  } catch (error) {
    console.error("social/following GET failed:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
