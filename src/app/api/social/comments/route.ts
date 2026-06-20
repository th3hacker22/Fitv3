import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/authServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CommentCreateBody {
  postId: string;
  text: string;
}

interface CommentDeleteBody {
  postId: string;
  commentId: string;
}

// Verify the caller's session and fetch their profile from the database.
// NEVER trust client-supplied x-user-name or x-user-photo headers.
async function readAuthor(req: NextRequest) {
  const { uid: verifiedUid, response: authResponse } = await requireUser(req);
  if (!verifiedUid) {
    return { uid: null as string | null, name: "", photoURL: null as string | null, authResponse };
  }

  // Fetch the user's profile from the database — do NOT trust client headers
  const profile = await prisma.publicProfile.findUnique({
    where: { uid: verifiedUid },
    select: { displayName: true, photoURL: true },
  });

  const name = profile?.displayName || "Athlete";
  const photoURL = profile?.photoURL || null;

  return { uid: verifiedUid, name, photoURL, authResponse: null as Response | null };
}

// GET — list comments for a post, oldest first.
// Query: ?postId=<postId>
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const postId = searchParams.get("postId");

    if (!postId) {
      return NextResponse.json(
        { error: "Missing postId query parameter" },
        { status: 400 }
      );
    }

    const comments = await prisma.comment.findMany({
      where: { postId },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(
      comments.map((c) => ({
        id: c.id,
        authorUid: c.authorUid,
        authorName: c.authorName,
        authorPhotoURL: c.authorPhotoURL,
        text: c.text,
        createdAt: c.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error("social/comments GET failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST — create a comment and bump commentCount on the post.
// Author identity is fetched from PublicProfile by callerUid (never from headers).
// Wrapped in a transaction so the comment + count are atomic.
export async function POST(req: NextRequest) {
  try {
    const { postId, text } = (await req.json()) as CommentCreateBody;

    if (!postId || !text?.trim()) {
      return NextResponse.json(
        { error: "Missing postId or text" },
        { status: 400 }
      );
    }

    // Cap text length to prevent abuse.
    const trimmedText = text.trim().slice(0, 500);
    const author = await readAuthor(req);

    if (author.authResponse) {
      return author.authResponse;
    }

    const comment = await prisma.$transaction(async (tx) => {
      const c = await tx.comment.create({
        data: {
          postId,
          authorUid: author.uid!,
          authorName: author.name,
          authorPhotoURL: author.photoURL,
          text: trimmedText,
        },
      });
      await tx.feedPost.update({
        where: { id: postId },
        data: { commentCount: { increment: 1 } },
      });
      return c;
    });

    return NextResponse.json({
      id: comment.id,
      authorUid: comment.authorUid,
      authorName: comment.authorName,
      authorPhotoURL: comment.authorPhotoURL,
      text: comment.text,
      createdAt: comment.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("social/comments POST failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE — remove a comment (ownership-scoped) and decrement commentCount.
// The caller must be the comment's author (verified via x-user-uid header).
// Wrapped in a transaction so delete + decrement are atomic.
export async function DELETE(req: NextRequest) {
  try {
    const { postId, commentId } = (await req.json()) as CommentDeleteBody;

    if (!postId || !commentId) {
      return NextResponse.json(
        { error: "Missing postId or commentId" },
        { status: 400 }
      );
    }

    const { uid: callerUid, authResponse } = await readAuthor(req);

    if (authResponse) {
      return authResponse;
    }

    // Verify the comment exists, belongs to the caller, and belongs to the
    // claimed post. Previously anyone could delete any comment by id (IDOR).
    const existing = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { authorUid: true, postId: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Comment not found" },
        { status: 404 }
      );
    }

    if (existing.postId !== postId) {
      return NextResponse.json(
        { error: "Comment does not belong to this post" },
        { status: 403 }
      );
    }

    if (existing.authorUid !== callerUid!) {
      return NextResponse.json(
        { error: "You can only delete your own comments" },
        { status: 403 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.comment.delete({ where: { id: commentId } });
      // Decrement but never below 0.
      const updated = await tx.feedPost.update({
        where: { id: postId },
        data: { commentCount: { decrement: 1 } },
        select: { commentCount: true },
      });
      if (updated.commentCount < 0) {
        await tx.feedPost.update({
          where: { id: postId },
          data: { commentCount: 0 },
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("social/comments DELETE failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
