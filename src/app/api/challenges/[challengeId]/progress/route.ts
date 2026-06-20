import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateId, serverErrorResponse } from "@/lib/validation";
import { requireUser } from "@/lib/authServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/challenges/[challengeId]/progress?userId=<userId>
// Return the Participation for (challengeId, userId) or null if not
// joined yet. Returns 404 if the challenge doesn't exist.
// Requires authentication to prevent PII leakage.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ challengeId: string }> }
) {
  try {
    // ── Authentication: require valid session ──
    const { uid: callerUid, response: authResponse } = await requireUser(req);
    if (!callerUid) return authResponse!;

    const { challengeId } = await params;
    const { searchParams } = new URL(req.url);
    const rawUserId = searchParams.get("userId");

    const userId = validateId(rawUserId);
    if (!userId) {
      return NextResponse.json(
        { error: "Missing or invalid userId query parameter" },
        { status: 400 }
      );
    }

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
        challengeId_userId: { challengeId, userId },
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
