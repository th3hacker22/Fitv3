import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebaseAdmin";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json();
    if (!idToken) {
      return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
    }

    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(idToken);
    const { uid, email, name, picture, email_verified } = decoded;
    if (!email_verified) {
      return NextResponse.json({ error: "Email not verified" }, { status: 403 });
    }

    const displayName = name || (email ? email.split("@")[0] : "Athlete");
    const photoURL = picture || null;

    await prisma.publicProfile.upsert({
      where: { uid },
      update: { displayName, photoURL },
      create: { uid, displayName, photoURL },
    });

    const response = NextResponse.json({ success: true });
    response.cookies.set("pulse_session", idToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch (error) {
    console.error("Session POST failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set("pulse_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
