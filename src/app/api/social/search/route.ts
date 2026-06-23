import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serverErrorResponse } from "@/lib/validation";
import { requireUser } from "@/lib/authServer";
import { parseQueryParams } from "@/lib/apiSchemas";
import { searchQuerySchema } from "./schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Search PublicProfile by displayName containing q (case-insensitive).
// SQLite's default collation is BINARY (case-sensitive) and does NOT support
// Prisma's `mode: "insensitive"` option (that's PostgreSQL/MongoDB only).
// We use a parameterized raw query with LOWER() on both sides to achieve
// case-insensitive contains matching safely (no SQL injection).
// Query: ?q=<searchQuery>
// Requires authentication to prevent public user enumeration.
export async function GET(req: NextRequest) {
  try {
    const { response: authResponse } = await requireUser(req);
    if (authResponse) return authResponse;

    const parsed = parseQueryParams(req, searchQuerySchema);
    if (!parsed.success) return parsed.response;
    const q = parsed.data.q;
    if (!q) {
      return NextResponse.json([]);
    }

    const profiles = await prisma.$queryRaw<
      Array<{ uid: string; displayName: string; photoURL: string | null }>
    >`SELECT uid, displayName, photoURL FROM PublicProfile WHERE LOWER(displayName) LIKE LOWER(${"%" + q + "%"}) LIMIT 20`;

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
