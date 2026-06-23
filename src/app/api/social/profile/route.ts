import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serverErrorResponse } from "@/lib/validation";
import { requireUser } from "@/lib/authServer";
import { parseRequestBody } from "@/lib/apiSchemas";
import { profileBodySchema } from "./schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Upsert a PublicProfile (used by the social store whenever the local
// user's profile changes — display name, avatar, etc.).
export async function POST(req: NextRequest) {
  try {
    const parsed = await parseRequestBody(req, profileBodySchema);
    if (!parsed.success) return parsed.response;
    const { uid, displayName, photoURL } = parsed.data;

    // Verify JWT and prevent impersonation
    const auth = await requireUser(req);
    if (auth.uid === null) return auth.response;
    const callerUid = auth.uid;
    if (uid !== callerUid) {
      return NextResponse.json(
        { error: "Cannot modify another user's profile" },
        { status: 403 }
      );
    }

    const profile = await prisma.publicProfile.upsert({
      where: { uid },
      update: { displayName, photoURL },
      create: { uid, displayName, photoURL },
    });

    return NextResponse.json({
      uid: profile.uid,
      displayName: profile.displayName,
      photoURL: profile.photoURL,
    });
  } catch (error) {
    console.error("social/profile POST failed:", error);
    return serverErrorResponse();
  }
}
