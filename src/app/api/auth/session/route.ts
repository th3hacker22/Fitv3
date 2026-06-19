import { NextRequest, NextResponse } from "next/server";
import { signJwt } from "@/lib/jwt";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { uid } = await req.json();
    if (!uid) {
      return NextResponse.json({ error: "Missing uid" }, { status: 400 });
    }
    // Auto-create PublicProfile on first login (supports guest users)
    await prisma.publicProfile.upsert({
      where: { uid },
      update: {},
      create: {
        uid,
        displayName: uid.startsWith("local-guest-") ? "Guest" : uid.replace(/^local-user-/, ""),
      },
    });

    const token = await signJwt(uid);

    const response = NextResponse.json({ success: true });
    response.cookies.set("pulse_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days (matches JWT expiry)
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
