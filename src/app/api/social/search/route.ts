import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateString, serverErrorResponse } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Search PublicProfile by displayName containing q.
// SQLite's default collation is BINARY (case-sensitive), so we use
// Prisma's `mode: "insensitive"` which generates a LOWER() comparison
// to make the search case-insensitive.
// Query: ?q=<searchQuery>
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawQ = searchParams.get("q");

    // Validate and cap query length to prevent abuse.
    const q = validateString(rawQ, 100);
    if (!q) {
      return NextResponse.json([]);
    }

    const profiles = await prisma.publicProfile.findMany({
      where: {
        displayName: { contains: q },
      },
      take: 20,
      select: {
        uid: true,
        displayName: true,
        photoURL: true,
      },
    });

    return NextResponse.json(
      profiles.map((p) => ({
        uid: p.uid,
        displayName: p.displayName,
        photoURL: p.photoURL,
      }))
    );
  } catch (error) {
    console.error("social/search GET failed:", error);
    return serverErrorResponse();
  }
}
