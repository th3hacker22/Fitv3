import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  validateId,
  validateDisplayName,
  validateOptionalUrl,
  serverErrorResponse,
} from "@/lib/validation";
import { requireUser } from "@/lib/authServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ProfileBody {
  uid: string;
  displayName: string;
  photoURL?: string | null;
}

// Upsert a PublicProfile (used by the social store whenever the local
// user's profile changes — display name, avatar, etc.).
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ProfileBody;

    // ── Input validation ──
    const uid = validateId(body.uid);
    const displayName = validateDisplayName(body.displayName);
    const photoURL = validateOptionalUrl(body.photoURL);

    if (!uid || !displayName) {
      return NextResponse.json(
        { error: "Missing or invalid uid or displayName" },
        { status: 400 }
      );
    }

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
