import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/authServer";
import { parseRequestBody, parseQueryParams } from "@/lib/apiSchemas";
import { commentCreateSchema, commentDeleteSchema, commentsQuerySchema } from "./schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const parsed = parseQueryParams(req, commentsQuerySchema);
    if (!parsed.success) return parsed.response;
    const { postId } = parsed.data;

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
    const parsed = await parseRequestBody(req, commentCreateSchema);
    if (!parsed.success) return parsed.response;
    const { postId, text } = parsed.data;
    // text is already trimmed + capped at 500 chars by the schema.
    const author = await readAuthor(req);

    if (author.authResponse) {
      return author.authResponse;
    }

    const comment = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const c = await tx.comment.create({
        data: {
          postId,
          authorUid: author.uid!,
          authorName: author.name,
          authorPhotoURL: author.photoURL,
          text,
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
    const parsed = await parseRequestBody(req, commentDeleteSchema);
    if (!parsed.success) return parsed.response;
    const { postId, commentId } = parsed.data;

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

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
