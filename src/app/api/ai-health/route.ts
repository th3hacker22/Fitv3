import { NextResponse } from "next/server";
import { aiRouter } from "@/server/aiProviders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/ai-health — returns available AI providers
export async function GET() {
  return NextResponse.json({
    status: "ok",
    availableProviders: aiRouter.getAvailableProviders(),
    timestamp: new Date().toISOString(),
  });
}
