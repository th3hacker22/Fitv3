import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateId, handlePrismaError } from "@/lib/validation";
import { requireUser } from "@/lib/authServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface KudosBody {
  postId: string;
}

// Increment kudosCount on a feed post atomically, then return the new
// value so the client can reflect it immediately.
export async function POST(req: NextRequest) {
  try {
    // Require authentication
    const auth = await requireUser(req);
    if (auth.uid === null) return auth.response;

    const { postId } = (await req.json()) as KudosBody;

    const id = validateId(postId);
    if (!id) {
      return NextResponse.json({ error: "Missing or invalid postId" }, { status: 400 });
    }

    const updated = await prisma.feedPost.update({
      where: { id },
      data: { kudosCount: { increment: 1 } },
      select: { kudosCount: true },
    });

    return NextResponse.json({ ok: true, kudosCount: updated.kudosCount });
  } catch (error) {
    console.error("social/kudos POST failed:", error);
    // P2025 (record not found) → 404, otherwise → 500
    return handlePrismaError(error);
  }
}
