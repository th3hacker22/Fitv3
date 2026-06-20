import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { requireUser } from "@/lib/authServer";
import { parseRequestBody } from "@/lib/apiSchemas";
import { structuredRequestBodySchema } from "./schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // ── Authentication: require valid session ──
    const { uid, response: authResponse } = await requireUser(req);
    if (!uid) return authResponse!;

    // Strict schema rejects unknown keys (prompt, systemInstruction) declaratively.
    const parsed = await parseRequestBody(req, structuredRequestBodySchema);
    if (!parsed.success) return parsed.response;
    const { goal, age, gender, fitnessLevel, equipment, selectedMuscles } = parsed.data;

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenRouter API Key not configured. Using standard generator." },
        { status: 200 }
      );
    }

    const client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: apiKey,
      defaultHeaders: {
        "HTTP-Referer": "http://localhost:3000", // Required by OpenRouter
        "X-Title": "Pulse Fitness App", // Required by OpenRouter
      }
    });

    // Server-constructed system instructions (enforcing strict JSON output)
    const systemInstruction = `You are an expert fitness coach. Generate a personalized workout routine based on the user's demographic and physical goals.
You must respond with ONLY valid JSON (no markdown, no code fences) matching this schema:
{
  "exercises": [
    {
      "exerciseId": "string (MUST correspond to a valid exercise)",
      "sets": number,
      "reps": "string (e.g. 8-12)",
      "restSeconds": number,
      "progression": "string (coaching tip for progression)"
    }
  ]
}`;

    // Server-constructed user prompt based on client-provided structured parameters
    const prompt = `Generate a workout routine for a user with the following profile:
- Age: ${age ?? "unknown"}
- Gender: ${gender || "not specified"}
- Goal: ${goal || "General Fitness"}
- Fitness Level: ${fitnessLevel || "Beginner"}
- Available Equipment: ${equipment && equipment.length > 0 ? equipment.join(", ") : "none"}
- Target Muscle Groups: ${selectedMuscles && selectedMuscles.length > 0 ? selectedMuscles.join(", ") : "any"}

Recommend 3-5 exercises. Recommend realistic set and rep schemes based on the goal. Return only the JSON object.`;

    const model = process.env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct:free";

    const completion = await client.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: prompt },
      ],
    });

    let text = completion.choices[0]?.message?.content || "";

    // Strip markdown code fences if the model added them despite instructions.
    text = text.trim();
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    }

    if (!text) {
      return NextResponse.json(
        { error: "No response text from AI" },
        { status: 502 }
      );
    }

    return NextResponse.json({ text });
  } catch (error: unknown) {
    console.error("AI workout API failed:", error);
    
    // Check if OpenRouter returned a 429 (Rate limit) or 500 (Internal error)
    const err = error as { status?: number; message?: string };
    const status = err?.status;
    const isRateLimitOrServerError = status === 429 || status === 500 || (typeof status === "number" && status >= 500);

    if (isRateLimitOrServerError) {
      return NextResponse.json(
        { error: "OpenRouter rate limit or server error. Please try again in a moment." },
        { status: 200 }
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Failed to generate workout: " + message },
      { status: 500 }
    );
  }
}

