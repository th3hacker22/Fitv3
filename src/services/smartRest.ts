/**
 * Smart Rest Timer Calculator.
 *
 * Suggests rest duration based on:
 * 1. Exercise role (compound needs more rest than isolation)
 * 2. Last set RPE (higher RPE = more rest)
 * 3. Goal (strength needs more rest than hypertrophy)
 *
 * Based on Schoenfeld's rest interval research (2016):
 *  - Strength: 3-5 min for compounds
 *  - Hypertrophy: 1-2 min (can go down to 60s for isolations)
 *  - Endurance: 30-60s
 */

export interface SmartRestInput {
  /** Exercise role from the generator. */
  role?: "compound" | "isolation" | "warmup" | "core" | "cardio";
  /** RPE of the just-completed set (1-10). 0 = not recorded. */
  lastSetRPE?: number;
  /** User's primary goal. */
  goal?: string;
  /** Default rest from user settings (fallback). */
  defaultRest?: number;
}

export interface SmartRestRecommendation {
  /** Suggested rest in seconds. */
  seconds: number;
  /** Human-readable reason. */
  reason: string;
  /** Quick-adjust presets. */
  presets: { label: string; delta: number }[];
}

export function suggestRestDuration(input: SmartRestInput): SmartRestRecommendation {
  const { role = "isolation", lastSetRPE = 0, goal = "Hypertrophy", defaultRest = 90 } = input;

  // Base rest by role × goal
  let baseSeconds: number;
  const reasonParts: string[] = [];

  const goalLower = goal.toLowerCase();
  const isStrength = goalLower.includes("strength");
  const isEndurance = goalLower.includes("endurance");

  if (role === "compound") {
    if (isStrength) {
      baseSeconds = 180; // 3 min
      reasonParts.push("Compound · Strength");
    } else if (isEndurance) {
      baseSeconds = 60;
      reasonParts.push("Compound · Endurance");
    } else {
      baseSeconds = 120; // 2 min
      reasonParts.push("Compound · Hypertrophy");
    }
  } else if (role === "isolation") {
    if (isStrength) {
      baseSeconds = 120;
      reasonParts.push("Isolation · Strength");
    } else if (isEndurance) {
      baseSeconds = 45;
      reasonParts.push("Isolation · Endurance");
    } else {
      baseSeconds = 75;
      reasonParts.push("Isolation · Hypertrophy");
    }
  } else if (role === "core") {
    baseSeconds = 45;
    reasonParts.push("Core");
  } else if (role === "cardio") {
    baseSeconds = 30;
    reasonParts.push("Cardio");
  } else {
    baseSeconds = defaultRest;
    reasonParts.push("Default");
  }

  // RPE adjustment: +15s per RPE above 7
  if (lastSetRPE > 0) {
    if (lastSetRPE >= 10) {
      baseSeconds += 60;
      reasonParts.push(`RPE ${lastSetRPE} (max effort)`);
    } else if (lastSetRPE >= 9) {
      baseSeconds += 30;
      reasonParts.push(`RPE ${lastSetRPE}`);
    } else if (lastSetRPE >= 8) {
      baseSeconds += 15;
      reasonParts.push(`RPE ${lastSetRPE}`);
    } else {
      reasonParts.push(`RPE ${lastSetRPE} (easy)`);
    }
  }

  // Cap at 5 minutes
  baseSeconds = Math.min(300, Math.max(30, baseSeconds));

  return {
    seconds: baseSeconds,
    reason: reasonParts.join(" · "),
    presets: [
      { label: "-15s", delta: -15 },
      { label: "+15s", delta: 15 },
      { label: "+30s", delta: 30 },
      { label: "+60s", delta: 60 },
    ],
  };
}

/**
 * RPE color mapping for UI.
 * Returns a Tailwind class string for the RPE input border/bg.
 */
export function rpeColorClass(rpe: string | number | undefined): string {
  const r = typeof rpe === "string" ? parseFloat(rpe) : rpe;
  if (!r || isNaN(r) || r <= 0) return "";
  if (r <= 7) return "border-success/40 bg-success/5 text-success"; // easy — green
  if (r === 8) return "border-warning/40 bg-warning/5 text-warning"; // moderate — yellow
  if (r === 9) return "border-orange-500/40 bg-orange-500/5 text-orange-500"; // hard — orange
  return "border-danger/40 bg-danger/5 text-danger"; // RPE 10 — red (max effort)
}

/**
 * Get a text label for an RPE value.
 */
export function rpeLabel(rpe: string | number | undefined): string {
  const r = typeof rpe === "string" ? parseFloat(rpe) : rpe;
  if (!r || isNaN(r) || r <= 0) return "";
  if (r <= 5) return "Very easy";
  if (r <= 7) return "Easy";
  if (r === 8) return "Moderate";
  if (r === 9) return "Hard";
  return "Max effort";
}
