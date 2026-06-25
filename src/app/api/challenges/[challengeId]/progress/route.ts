import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serverErrorResponse } from "@/lib/validation";
import { parseQueryParams, parsePathParam } from "@/lib/apiSchemas";
import { requireUser } from "@/lib/authServer";
import { progressQuerySchema } from "./schema";
import { challengeIdParamSchema } from "../../schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/challenges/[challengeId]/progress?userId=<ignored>
// Return the caller's own Participation for (challengeId, callerUid) or
// null if not joined yet. Returns 404 if the challenge doesn't exist.
//
// SECURITY: The `userId` query param is intentionally IGNORED to prevent
// IDOR / PII leakage. The caller's own session UID (callerUid) is always
// used, so an authenticated user can only ever read their own progress.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ challengeId: string }> }
) {
  try {
    // ── Authentication: require valid session ──
    const { uid: callerUid, response: authResponse } = await requireUser(req);
    if (!callerUid) return authResponse!;

    const { challengeId: rawChallengeId } = await params;
    const pathParsed = parsePathParam(rawChallengeId, challengeIdParamSchema);
    if (!pathParsed.success) return pathParsed.response;
    const challengeId = pathParsed.data;

    // Validate the query shape for forward-compat (the userId field is
    // accepted but intentionally NOT read — callerUid is used instead).
    const queryParsed = parseQueryParams(req, progressQuerySchema);
    if (!queryParsed.success) return queryParsed.response;

    // Verify the challenge exists.
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

    const participation = await prisma.participation.findUnique({
      where: {
        challengeId_userId: { challengeId, userId: callerUid },
      },
    });

    if (!participation) {
      return NextResponse.json(null);
    }

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
    console.error("challenges/[challengeId]/progress GET failed:", error);
    return serverErrorResponse();
  }
}
