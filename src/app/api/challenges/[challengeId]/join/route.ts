import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { handlePrismaError } from "@/lib/validation";
import { parseRequestBody, parsePathParam } from "@/lib/apiSchemas";
import { requireUser } from "@/lib/authServer";
import { joinBodySchema } from "./schema";
import { challengeIdParamSchema } from "../../schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/challenges/[challengeId]/join
// Upsert a Participation for (challengeId, userId). New participations
// start with progressKg=0 and completed=false.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ challengeId: string }> }
) {
  try {
    const { challengeId: rawChallengeId } = await params;
    const pathParsed = parsePathParam(rawChallengeId, challengeIdParamSchema);
    if (!pathParsed.success) return pathParsed.response;
    const challengeId = pathParsed.data;

    const parsed = await parseRequestBody(req, joinBodySchema);
    if (!parsed.success) return parsed.response;
    const { userId, userName, userPhotoURL } = parsed.data;

    // Prevent impersonation: body userId must match the caller's uid.
    const auth = await requireUser(req);
    if (auth.uid === null) return auth.response;
    const callerUid = auth.uid;
    if (userId !== callerUid) {
      return NextResponse.json(
        { error: "Cannot join a challenge on behalf of another user" },
        { status: 403 }
      );
    }

    // Verify the challenge exists (otherwise FK constraint throws → 500).
    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
      select: { id: true },
    });
    if (!challenge) {
      return NextResponse.json(
        { error: "Challenge not found" },
        { status: 404 }
      );
    }

    const participation = await prisma.participation.upsert({
      where: {
        challengeId_userId: { challengeId, userId },
      },
      update: {
        userName,
        userPhotoURL,
      },
      create: {
        challengeId,
        userId,
        userName,
        userPhotoURL,
        progressKg: 0,
        completed: false,
      },
    });

    return NextResponse.json({
      userId: participation.userId,
      userName: participation.userName,
      userPhotoURL: participation.userPhotoURL,
      progressKg: participation.progressKg,
      completed: participation.completed,
      completedAt: participation.completedAt
        ? participation.completedAt.toISOString()
        : null,
      joinedAt: participation.joinedAt.toISOString(),
    });
  } catch (error) {
    console.error("challenges/[challengeId]/join POST failed:", error);
    return handlePrismaError(error);
  }
}
