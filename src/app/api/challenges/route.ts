import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serverErrorResponse } from "@/lib/validation";
import { requireUser } from "@/lib/authServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Default seeded challenges. IDs are stable so participations remain
// consistent across requests.
const DEFAULT_CHALLENGES = [
  {
    id: "centurion_volume",
    title: "Centurion Volume Challenge",
    description: "Lift a total of 10,000 kg in workouts to prove your base strength and endurance.",
    goalKg: 10000,
  },
  {
    id: "iron_titan",
    title: "Iron Titan Challenge",
    description: "Push your limits and accumulate a whopping 50,000 kg of total volume.",
    goalKg: 50000,
  },
  {
    id: "hypertrophy_hero",
    title: "Hypertrophy Hero",
    description: "The ultimate volume test. Accumulate 100,000 kg of total volume.",
    goalKg: 100000,
  },
] as const;

// GET — return all currently-active challenges. If none exist in the
// active date window, seed the default three first (in a transaction),
// then return the active set.
//
// SECURITY: Authentication is required so the auto-seed transaction (which
// performs DB writes) never runs for anonymous callers. Returns 401 if no
// valid session is present.
export async function GET(req: NextRequest) {
  try {
    // ── Authentication: require valid session ──
    const { uid: callerUid, response: authResponse } = await requireUser(req);
    if (!callerUid) return authResponse!;

    const now = new Date().toISOString();

    const activeCount = await prisma.challenge.count({
      where: {
        startDate: { lte: now },
        endDate: { gte: now },
      },
    });

    if (activeCount === 0) {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      // Seed all defaults in a single transaction (atomic, no partial state).
      await prisma.$transaction(
        DEFAULT_CHALLENGES.map((c) =>
          prisma.challenge.upsert({
            where: { id: c.id },
            update: {
              title: c.title,
              description: c.description,
              goalKg: c.goalKg,
              startDate,
              endDate,
            },
            create: {
              id: c.id,
              title: c.title,
              description: c.description,
              goalKg: c.goalKg,
              startDate,
              endDate,
            },
          })
        )
      );
    }

    const challenges = await prisma.challenge.findMany({
      where: {
        startDate: { lte: now },
        endDate: { gte: now },
      },
      orderBy: { goalKg: "asc" },
    });

    return NextResponse.json(
      challenges.map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        goalKg: c.goalKg,
        startDate: c.startDate,
        endDate: c.endDate,
      }))
    );
  } catch (error) {
    console.error("challenges GET failed:", error);
    return serverErrorResponse();
  }
}
