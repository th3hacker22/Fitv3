import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/authServer";
import { parseRequestBody } from "@/lib/apiSchemas";
import { postDeleteSchema } from "./schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DELETE — remove a feed post (ownership-scoped).
// Only the post author can delete their own post.
export async function DELETE(req: NextRequest) {
  try {
    const parsed = await parseRequestBody(req, postDeleteSchema);
    if (!parsed.success) return parsed.response;
    const { postId } = parsed.data;

    // Read author UID from JWT cookie
    const auth = await requireUser(req);
    if (auth.uid === null) return auth.response;
    const uid = auth.uid;

    // Verify ownership: only the author can delete
    const post = await prisma.feedPost.findUnique({
      where: { id: postId },
      select: { authorUid: true },
    });

    if (!post) {
      return NextResponse.json(
        { error: "Post not found" },
        { status: 404 }
      );
    }

    if (post.authorUid !== uid) {
      return NextResponse.json(
        { error: "You can only delete your own posts" },
        { status: 403 }
      );
    }

    // Delete the post (cascade will handle related kudos + comments)
    await prisma.feedPost.delete({
      where: { id: postId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("social/posts DELETE failed:", error);
    return NextResponse.json(
      { error: "Failed to delete post" },
      { status: 500 }
    );
  }
}
