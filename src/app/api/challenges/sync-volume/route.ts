import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/authServer";
import { parseRequestBody } from "@/lib/apiSchemas";
import { syncVolumeBodySchema } from "./schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/challenges/sync-volume
// For every active Participation belonging to userId that has not yet
// completed, add totalVolume to progressKg atomically. If the goal is met,
// mark the participation as completed (only on the false→true transition).
// Uses sessionId for server-side idempotency to prevent double-counting.
export async function POST(req: NextRequest) {
  try {
    const parsed = await parseRequestBody(req, syncVolumeBodySchema);
    if (!parsed.success) return parsed.response;
    const { userId, totalVolume, sessionId } = parsed.data;

    // Prevent impersonation: the body's userId must match the caller's session UID.
    const auth = await requireUser(req);
    if (auth.uid === null) return auth.response;
    const callerUid = auth.uid;
    if (userId !== callerUid) {
      return NextResponse.json(
        { error: "Cannot sync volume for another user" },
        { status: 403 }
      );
    }

    // Schema already enforces 0 <= totalVolume <= 1e9; no runtime clamp needed.
    if (totalVolume <= 0) {
      return NextResponse.json({ ok: true, updated: 0 });
    }

    // Fetch all in-progress participations along with the goal from the
    // challenge so we can decide completion in a single pass.
    const participations = await prisma.participation.findMany({
      where: { userId, completed: false },
      include: { challenge: { select: { goalKg: true } } },
    });

    let updated = 0;
    // Use a transaction so all updates are atomic — concurrent sync-volume
    // calls can no longer interleave and lose increments.
    await prisma.$transaction(async (tx) => {
      for (const p of participations) {
        if (sessionId) {
          // Check if this workout session has already been synced for this participation
          const existingSync = await tx.syncedWorkoutSession.findUnique({
            where: {
              participationId_sessionId: {
                participationId: p.id,
                sessionId,
              },
            },
          });
          if (existingSync) {
            // Already synced, skip this participation to prevent double-counting
            continue;
          }
        }

        // Atomic increment avoids the lost-update race that the previous
        // read-modify-write pattern suffered from.
        const updatedRow = await tx.participation.update({
          where: { id: p.id },
          data: {
            progressKg: { increment: totalVolume },
          },
          select: { progressKg: true },
        });

        // Record the sync to prevent double-counting in future calls
        if (sessionId) {
          await tx.syncedWorkoutSession.create({
            data: {
              participationId: p.id,
              sessionId,
            },
          });
        }

        // Only set completed + completedAt on the false→true transition.
        // Previously completedAt was overwritten on every call that crossed
        // the goal, silently rewriting completion history.
        if (updatedRow.progressKg >= p.challenge.goalKg && !p.completed) {
          await tx.participation.update({
            where: { id: p.id },
            data: {
              completed: true,
              completedAt: new Date(),
            },
          });
        }
        updated += 1;
      }
    });

    return NextResponse.json({ ok: true, updated });
  } catch (error) {
    console.error("challenges/sync-volume POST failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
