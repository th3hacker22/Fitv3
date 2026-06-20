import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serverErrorResponse } from "@/lib/validation";
import { requireUser } from "@/lib/authServer";
import { parseRequestBody } from "@/lib/apiSchemas";
import { feedPostSchema } from "./schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET — return the 50 most recent feed posts (createdAt desc).
// Requires authentication to prevent public scraping.
export async function GET(req: NextRequest) {
  try {
    // ── Authentication: require valid session ──
    const { uid, response: authResponse } = await requireUser(req);
    if (!uid) return authResponse!;

    const posts = await prisma.feedPost.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json(
      posts.map((p) => ({
        id: p.id,
        authorUid: p.authorUid,
        authorName: p.authorName,
        authorPhotoURL: p.authorPhotoURL,
        workoutTitle: p.workoutTitle,
        duration: p.duration,
        totalVolume: p.totalVolume,
        exercisesCount: p.exercisesCount,
        kudosCount: p.kudosCount,
        commentCount: p.commentCount,
        createdAt: p.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error("social/feed GET failed:", error);
    return serverErrorResponse();
  }
}

// POST — upsert the author's PublicProfile (FK requirement) in a transaction,
// then create the FeedPost and return it.
export async function POST(req: NextRequest) {
  try {
    const parsed = await parseRequestBody(req, feedPostSchema);
    if (!parsed.success) return parsed.response;
    const { authorUid, authorName, authorPhotoURL, workoutTitle, duration, totalVolume, exercisesCount } = parsed.data;

    // Verify JWT and prevent impersonation
    const auth = await requireUser(req);
    if (auth.uid === null) return auth.response;
    const callerUid = auth.uid;
    if (authorUid !== callerUid) {
      return NextResponse.json(
        { error: "Cannot publish as a different user" },
        { status: 403 }
      );
    }

    // Transaction: upsert profile + create post atomically
    const post = await prisma.$transaction(async (tx) => {
      await tx.publicProfile.upsert({
        where: { uid: authorUid },
        update: { displayName: authorName, photoURL: authorPhotoURL },
        create: { uid: authorUid, displayName: authorName, photoURL: authorPhotoURL },
      });

      return tx.feedPost.create({
        data: {
          authorUid,
          authorName,
          authorPhotoURL,
          workoutTitle,
          duration,
          totalVolume,
          exercisesCount,
        },
      });
    });

    return NextResponse.json({
      id: post.id,
      authorUid: post.authorUid,
      authorName: post.authorName,
      authorPhotoURL: post.authorPhotoURL,
      workoutTitle: post.workoutTitle,
      duration: post.duration,
      totalVolume: post.totalVolume,
      exercisesCount: post.exercisesCount,
      kudosCount: post.kudosCount,
      commentCount: post.commentCount,
      createdAt: post.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("social/feed POST failed:", error);
    return serverErrorResponse();
  }
}
