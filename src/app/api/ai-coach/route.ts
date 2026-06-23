import { NextRequest, NextResponse } from "next/server";
import { aiRouter } from "@/server/aiProviders";
import { serverErrorResponse } from "@/lib/validation";
import { parseRequestBody } from "@/lib/apiSchemas";
import { requireUser } from "@/lib/authServer";
import { assessFatigueACWR } from "@/services/fatigueEngine";
import { computeMuscleVolumeStatus, buildExerciseHistory } from "@/services/overloadEngine";
import { assessDeloadNeed } from "@/services/deloadEngine";
import type { WorkoutSession } from "@/db/schema";
import type { GeneratorProfile } from "@/store/useGeneratorStore";
import { coachRequestSchema, type CoachRequest } from "./schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    // ── Authentication: require valid session ──
    const { uid, response: authResponse } = await requireUser(req);
    if (!uid) return authResponse!;

    const bodyParsed = await parseRequestBody(req, coachRequestSchema);
    if (!bodyParsed.success) return bodyParsed.response;
    const body: CoachRequest = bodyParsed.data;

    // userPrompt is optional; default if absent.
    const userPrompt = body.userPrompt || "Generate my next workout";

    // ── Build comprehensive system prompt ──
    const systemPrompt = buildCoachPrompt(body);
    const exerciseList = body.exercises
      .slice(0, 200) // cap to avoid token overflow
      .map((e) => `${e.id} | ${e.name} | ${e.target} | ${e.equipment} | ${e.bodyPart}`)
      .join("\n");

    const fullSystem = `${systemPrompt}

AVAILABLE EXERCISES (ID | Name | Target | Equipment | BodyPart):
${exerciseList}

OUTPUT FORMAT: JSON only, no markdown. Schema:
{
  "analysis": {
    "strengths": ["..."],
    "weaknesses": ["..."],
    "volumeTrend": "...",
    "recommendation": "..."
  },
  "exercises": [
    {
      "exerciseId": "MUST match an ID from the list above",
      "sets": 3,
      "reps": "8-12",
      "restSeconds": 90,
      "progression": "tip text",
      "previousWeight": 50,
      "suggestedWeight": 52.5,
      "rationale": "why this exercise was chosen"
    }
  ]
}`;

    // ── Call AI router ──
    let result;
    try {
      result = await aiRouter.generate(fullSystem, userPrompt);
    } catch {
      // All AI providers failed — return error, client falls back to heuristic
      console.error("[ai-coach] All AI providers failed");
      return NextResponse.json(
        {
          error: "AI service unavailable",
          fallback: true,
        },
        { status: 503 }
      );
    }

    // Validate JSON
    let parsed;
    try {
      // Strip markdown fences if present
      let text = result.text.trim();
      if (text.startsWith("```")) {
        text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
      }
      parsed = JSON.parse(text);
    } catch {
      console.error("[ai-coach] AI returned invalid JSON");
      return NextResponse.json(
        { error: "AI returned invalid JSON", fallback: true },
        { status: 502 }
      );
    }

    return NextResponse.json({
      text: result.text,
      provider: result.provider,
      fallback: false,
    });
  } catch (error) {
    console.error("[ai-coach] POST failed:", error);
    return serverErrorResponse();
  }
}

// ── Build the comprehensive coach prompt ──
function buildCoachPrompt(data: CoachRequest): string {
  const { profile, recentSessions, personalRecords, analytics } = data;

  // ── Analyze recent training ──
  const recentMuscles = new Map<string, number>();
  const recentExercises = new Map<string, { weight: number; reps: number; date: string }>();

  for (const session of recentSessions.slice(0, 10)) {
    for (const ex of session.exercises) {
      const completedSets = ex.sets.filter((s) => s.completed);
      if (completedSets.length === 0) continue;

      // Track exercise → last performance
      const bestSet = completedSets.reduce((best, s) =>
        s.weight * s.reps > best.weight * best.reps ? s : best
      );
      recentExercises.set(ex.exerciseName, {
        weight: bestSet.weight,
        reps: bestSet.reps,
        date: session.date,
      });

      // Track muscle volume (use exercise name as proxy)
      const volume = completedSets.reduce((sum, s) => sum + s.weight * s.reps, 0);
      recentMuscles.set(ex.exerciseName, (recentMuscles.get(ex.exerciseName) || 0) + volume);
    }
  }

  // Identify neglected muscle groups
  const topExercises = Array.from(recentMuscles.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, vol]) => `  - ${name}: ${vol}kg total`);

  // Personal records summary
  const prSummary = personalRecords
    .slice(0, 5)
    .map((pr) => `  - ${pr.exerciseName}: ${pr.maxWeight}kg (est 1RM: ${pr.max1RM}kg)`)
    .join("\n");

  // Muscle group balance
  const muscleBalance = analytics.muscleGroupStats
    .slice(0, 8)
    .map((m) => `  - ${m.muscle}: ${m.volume}kg`)
    .join("\n");

  // Weekly tonnage trend
  const tonnageTrend = analytics.weeklyTonnage
    .slice(-4)
    .map((w) => `  - ${w.week}: ${w.tonnage}kg`)
    .join("\n");

  // ── ACWR Fatigue Analysis (sports-science based) ──
  // Transform recentSessions back into a shape assessFatigueACWR can consume.
  // The client sends simplified sessions; we reconstruct WorkoutSession-like objects.
  const sessionsForEngine = recentSessions.map((s) => ({
    date: s.date,
    completed: s.completed,
    isFreeze: false,
    duration: s.duration,
    exercises: s.exercises.map((e) => ({
      exerciseId: e.exerciseId,
      exerciseName: e.exerciseName,
      sets: e.sets.map((set) => ({
        weight: set.weight,
        reps: set.reps,
        completed: set.completed,
      })),
    })),
  })) as unknown as WorkoutSession[];

  // Build exerciseMap from the exercises list passed in the request
  const exerciseMap = new Map<string, { muscleGroup: string }>();
  for (const e of data.exercises) {
    exerciseMap.set(String(e.id), { muscleGroup: e.bodyPart });
  }

  // Synthesize a minimal profile for the engine (only the fields it reads)
  const engineProfile = {
    age: profile.age,
    medicalCautions: profile.medicalCautions,
    daysPerWeek: profile.daysPerWeek,
  } as GeneratorProfile;

  const fatigue = assessFatigueACWR(sessionsForEngine, engineProfile, exerciseMap);

  const fatigueSection = `
═══ FATIGUE STATUS (ACWR — Acute:Chronic Workload Ratio) ═══
- Acute load (7-day volume): ${fatigue.acuteLoad}kg
- Chronic load (28-day avg weekly): ${fatigue.chronicLoad}kg
- ACWR: ${fatigue.acwr || "N/A"} ${
    fatigue.acwr > 1.5 ? "⚠️ HIGH INJURY RISK" :
    fatigue.acwr > 1.3 ? "⚠️ elevated risk" :
    fatigue.acwr > 0 && fatigue.acwr < 0.8 ? "detrained — can push" :
    fatigue.acwr > 0 ? "optimal zone" : ""
  }
- Readiness score: ${fatigue.fatigueScore}/5 (5 = fully recovered)
- Days since rest: ${fatigue.daysSinceRest}
- Recommendation: ${fatigue.recommendation}
- Volume multiplier: ${fatigue.volumeAdjustment}× (apply to prescribed sets)
${fatigue.shouldDeload ? "\n⚠️ DELOAD WEEK RECOMMENDED — reduce volume 40%, focus on technique." : ""}
`.trim();

  // ── Per-muscle MEV/MAV status ──
  const trainingLevel = (profile.fitnessLevel?.toLowerCase() ?? "beginner") as "novice" | "beginner" | "intermediate" | "advanced";
  const muscleStatus = computeMuscleVolumeStatus(
    sessionsForEngine,
    exerciseMap,
    trainingLevel
  );
  const belowMEV = muscleStatus.filter((m) => m.status === "below-mev");
  const aboveMAV = muscleStatus.filter((m) => m.status === "above-mav");

  const mevMavSection = `
═══ PER-MUSCLE VOLUME STATUS (MEV/MAV — sets/week) ═══
${belowMEV.length > 0 ? `BELOW MEV (prioritize these muscles):
${belowMEV.map((m) => `  - ${m.muscle}: ${m.weeklySets} sets (MEV: ${m.mev})`).join("\n")}` : "  All trained muscles are above MEV."}
${aboveMAV.length > 0 ? `\nABOVE MAV (reduce volume for these):
${aboveMAV.map((m) => `  - ${m.muscle}: ${m.weeklySets} sets (MAV: ${m.mav})`).join("\n")}` : ""}
`.trim();

  // ── Deload Week assessment ──
  // Build exercise history for performance-regression detection
  const exerciseHistory = buildExerciseHistory(sessionsForEngine as unknown as WorkoutSession[]);
  const deloadRec = assessDeloadNeed(
    sessionsForEngine as unknown as WorkoutSession[],
    engineProfile as unknown as GeneratorProfile,
    fatigue,
    exerciseHistory
  );

  const deloadSection = `
═══ DELOAD WEEK STATUS ═══
- Trigger: ${deloadRec.trigger}
- Should deload: ${deloadRec.shouldDeload ? "YES" : "no"}
- Weeks since last deload: ${deloadRec.weeksSinceLastDeload}
${deloadRec.shouldDeload ? `- Volume multiplier: ${deloadRec.volumeMultiplier}× (reduce sets by ${Math.round((1 - deloadRec.volumeMultiplier) * 100)}%)
- RPE cap: ${deloadRec.rpeCap} (no PR attempts)
- Reason: ${deloadRec.explanation}` : `- ${deloadRec.explanation}`}
`.trim();

  return `You are an expert AI fitness coach with deep knowledge of exercise science, progressive overload, and program design. Your job is to analyze the user's COMPLETE fitness data and generate a personalized workout plan.

═══ USER PROFILE ═══
- Age: ${profile.age}, Gender: ${profile.gender || "unspecified"}
- Height: ${profile.heightCm}cm, Weight: ${profile.weightKg}kg
- Body Fat Level: ${profile.bodyFatLevel || "unknown"}
- Experience: ${profile.fitnessLevel} (${profile.trainingYears} years training)
- Primary Goal: ${profile.goal}
- Schedule: ${profile.daysPerWeek} days/week, ${profile.sessionLengthMin} min/session
- Equipment: ${profile.equipment.join(", ") || "none specified"}
- Priority Muscles: ${profile.priorityMuscles.join(", ") || "none specified"}
- Physique Focus: ${profile.physiqueFocus}
- Workout Style: ${profile.intensityStyle}

═══ SAFETY CONSTRAINTS (CRITICAL) ═══
- Injuries to avoid aggravating: ${profile.injuries.filter((i) => i !== "none").join(", ") || "none"}
- Medical conditions: ${profile.medicalCautions.join(", ") || "none"}
- Mobility limited: ${profile.mobilityLimited ? "YES — prefer machine-based and seated exercises" : "no"}

═══ TRAINING HISTORY (Last ${recentSessions.length} sessions) ═══
Total workouts completed: ${analytics.totalWorkouts}
Current streak: ${analytics.streak} days
Total volume lifted: ${analytics.totalVolume}kg
Total training time: ${Math.floor(analytics.totalDuration / 60)}h ${analytics.totalDuration % 60}m

Recent exercises performed (top 5 by volume):
${topExercises.join("\n") || "  No recent training data"}

Last performance per exercise (for progressive overload):
${Array.from(recentExercises.entries())
  .slice(0, 10)
  .map(([name, data]) => `  - ${name}: ${data.weight}kg × ${data.reps} reps (on ${data.date.split("T")[0]})`)
  .join("\n") || "  No recent performance data"}

═══ PERSONAL RECORDS ═══
${prSummary || "  No PRs recorded yet"}

═══ MUSCLE GROUP BALANCE (all-time) ═══
${muscleBalance || "  No data"}

═══ WEEKLY TONNAGE TREND (last 4 weeks) ═══
${tonnageTrend || "  No data"}

${fatigueSection}

${mevMavSection}

${deloadSection}

═══ YOUR TASK ═══
Analyze ALL the data above and generate ONE workout session that:

1. ADDRESSES WEAKNESSES: Identify muscle groups that haven't been trained recently or are underdeveloped. Prioritize these in today's workout. Pay special attention to muscles flagged "BELOW MEV" above.

2. IMPLEMENTS PROGRESSIVE OVERLOAD: For each exercise the user has done before, suggest a weight that's 2.5-5% higher than their last session (if they completed all sets). If they're new to an exercise, suggest a conservative starting weight.

3. RESPECTS FATIGUE & DELOAD: Scale total volume by the ACWR volume multiplier (${fatigue.volumeAdjustment}×). ${deloadRec.shouldDeload ? `⚠️ A DELOAD WEEK IS RECOMMENDED (${deloadRec.trigger}) — reduce sets by ${Math.round((1 - deloadRec.volumeMultiplier) * 100)}%, cap RPE at ${deloadRec.rpeCap}, and avoid PR attempts. Use lighter loads and focus on technique.` : "If well-recovered (ACWR < 0.8), you may push 10% more volume."}

4. RESPECTS CONSTRAINTS: Never include exercises that aggravate the user's injuries. If mobility is limited, prefer machines over free weights.

5. MATCHES THE TIME BUDGET: ${profile.sessionLengthMin} minutes. Estimate ~5 min per set (including rest). Select 4-7 exercises.

6. BALANCES THE WORKOUT: Start with compound movements, then isolation work. Match the user's intensity style (${profile.intensityStyle}).

7. GOAL-SPECIFIC REP RANGES:
   - Strength: 3-6 reps, 180s rest
   - Hypertrophy: 6-12 reps, 90s rest
   - Fat Loss: 12-20 reps, 60s rest
   - Endurance: 15-25 reps, 45s rest

8. Include a "rationale" field for each exercise explaining WHY it was chosen based on the user's data.

9. Include "previousWeight" and "suggestedWeight" for exercises the user has done before (progressive overload). For new exercises, set previousWeight to null and suggest a conservative starting weight.

Generate the workout plan as JSON matching the output format specified.`;
}
