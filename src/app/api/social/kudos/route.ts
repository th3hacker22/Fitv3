import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { handlePrismaError } from "@/lib/validation";
import { requireUser } from "@/lib/authServer";
import { parseRequestBody } from "@/lib/apiSchemas";
import { kudosBodySchema } from "./schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Toggle kudos on a feed post.
// Uses an upsert on @@unique([postId, userId]) to ensure one kudos per user per post.
// If the kudos record is created → increment feedPost.kudosCount (add kudos).
// If the kudos record already exists → delete it and decrement (remove kudos).
// Returns the new kudosCount and whether the user has kudosed (true/false).
export async function POST(req: NextRequest) {
  try {
    // Require authentication
    const { uid, response: authResponse } = await requireUser(req);
    if (!uid) return authResponse!;

    const parsed = await parseRequestBody(req, kudosBodySchema);
    if (!parsed.success) return parsed.response;
    const { postId: id } = parsed.data;

    // Check if the user already kudosed'd this post
    const existing = await prisma.kudos.findUnique({
      where: { postId_userId: { postId: id, userId: uid } },
    });

    if (existing) {
      // User already kudosed → remove kudos (toggle off)
      await prisma.$transaction([
        prisma.kudos.delete({
          where: { postId_userId: { postId: id, userId: uid } },
        }),
        prisma.feedPost.update({
          where: { id },
          data: { kudosCount: { decrement: 1 } },
          select: { kudosCount: true },
        }),
      ]);

      const post = await prisma.feedPost.findUnique({
        where: { id },
        select: { kudosCount: true },
      });

      return NextResponse.json({
        ok: true,
        kudosCount: Math.max(0, post?.kudosCount ?? 0),
        kudosed: false,
      });
    } else {
      // User hasn't kudosed → add kudos (toggle on)
      await prisma.$transaction([
        prisma.kudos.create({
          data: { postId: id, userId: uid },
        }),
        prisma.feedPost.update({
          where: { id },
          data: { kudosCount: { increment: 1 } },
          select: { kudosCount: true },
        }),
      ]);

      const post = await prisma.feedPost.findUnique({
        where: { id },
        select: { kudosCount: true },
      });

      return NextResponse.json({
        ok: true,
        kudosCount: post?.kudosCount ?? 0,
        kudosed: true,
      });
    }
  } catch (error) {
    console.error("social/kudos POST failed:", error);
    return handlePrismaError(error);
  }
}
