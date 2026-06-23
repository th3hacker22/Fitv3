import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serverErrorResponse } from "@/lib/validation";
import { requireUser } from "@/lib/authServer";
import { parseRequestBody } from "@/lib/apiSchemas";
import { followBodySchema } from "./schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Upsert placeholder PublicProfiles for both sides (foreign-key safety),
// then create the Follow relationship — all in a transaction.
export async function POST(req: NextRequest) {
  try {
    const parsed = await parseRequestBody(req, followBodySchema);
    if (!parsed.success) return parsed.response;
    const { currentUid: follower, targetUid: following } = parsed.data;

    if (follower === following) {
      return NextResponse.json(
        { error: "Cannot follow yourself" },
        { status: 400 }
      );
    }

    // Prevent impersonation: currentUid must match the caller's uid.
    const auth = await requireUser(req);
    if (auth.uid === null) return auth.response;
    const callerUid = auth.uid;
    if (follower !== callerUid) {
      return NextResponse.json(
        { error: "Cannot follow on behalf of another user" },
        { status: 403 }
      );
    }

    // Transaction: upsert both profiles + create follow atomically.
    await prisma.$transaction([
      prisma.publicProfile.upsert({
        where: { uid: follower },
        update: {},
        create: { uid: follower, displayName: "Athlete" },
      }),
      prisma.publicProfile.upsert({
        where: { uid: following },
        update: {},
        create: { uid: following, displayName: "Athlete" },
      }),
      prisma.follow.upsert({
        where: {
          followerUid_followingUid: { followerUid: follower, followingUid: following },
        },
        update: {},
        create: { followerUid: follower, followingUid: following },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("social/follow POST failed:", error);
    return serverErrorResponse();
  }
}

// Remove the Follow relationship if it exists.
export async function DELETE(req: NextRequest) {
  try {
    const parsed = await parseRequestBody(req, followBodySchema);
    if (!parsed.success) return parsed.response;
    const { currentUid: follower, targetUid: following } = parsed.data;

    // Prevent impersonation
    const auth = await requireUser(req);
    if (auth.uid === null) return auth.response;
    const callerUid = auth.uid;
    if (follower !== callerUid) {
      return NextResponse.json(
        { error: "Cannot unfollow on behalf of another user" },
        { status: 403 }
      );
    }

    await prisma.follow.deleteMany({
      where: { followerUid: follower, followingUid: following },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("social/follow DELETE failed:", error);
    return serverErrorResponse();
  }
}
