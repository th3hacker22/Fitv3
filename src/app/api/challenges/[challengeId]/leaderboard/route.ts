import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serverErrorResponse } from "@/lib/validation";
import { requireUser } from "@/lib/authServer";
import { parsePathParam } from "@/lib/apiSchemas";
import { challengeIdParamSchema } from "../../schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/challenges/[challengeId]/leaderboard
// Return Participations for the challenge with progress > 0, sorted by
// progressKg desc, top 100. Returns 404 if the challenge doesn't exist.
// Requires authentication to prevent public scraping of participant PII.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ challengeId: string }> }
) {
  try {
    const { response: authResponse } = await requireUser(req);
    if (authResponse) return authResponse;

    const { challengeId: rawChallengeId } = await params;
    const pathParsed = parsePathParam(rawChallengeId, challengeIdParamSchema);
    if (!pathParsed.success) return pathParsed.response;
    const challengeId = pathParsed.data;

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

    // Filter out zero-progress joiners so the leaderboard only shows
    // participants who have actually logged volume.
    const participations = await prisma.participation.findMany({
      where: { challengeId, progressKg: { gt: 0 } },
      orderBy: { progressKg: "desc" },
      take: 100,
    });

    return NextResponse.json(
      participations.map((p: { userId: string; userName: string; userPhotoURL: string | null; progressKg: number; completed: boolean; completedAt: Date | null; joinedAt: Date }) => ({
        userId: p.userId,
        userName: p.userName,
        userPhotoURL: p.userPhotoURL,
        progressKg: p.progressKg,
        completed: p.completed,
        completedAt: p.completedAt ? p.completedAt.toISOString() : null,
        joinedAt: p.joinedAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error("challenges/[challengeId]/leaderboard GET failed:", error);
    return serverErrorResponse();
  }
}
