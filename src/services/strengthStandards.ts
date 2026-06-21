/**
 * Strength Standards
 *
 * Classifies a user's strength level based on the ratio of their estimated
 * 1-Repetition Maximum (1RM) to their bodyweight. Uses established
 * strength standards adapted from exrx.net and Symmetric Strength.
 *
 * Levels: Novice → Beginner → Intermediate → Advanced → Elite
 *
 * The ratio thresholds differ by exercise type because compound lifts
 * (squat, deadlift, bench press) allow much higher absolute loads than
 * isolation exercises (curl, lateral raise).
 */

export type StrengthLevel = "Novice" | "Beginner" | "Intermediate" | "Advanced" | "Elite";

export interface StrengthClassification {
  level: StrengthLevel;
  /** 1RM / bodyweight ratio */
  ratio: number;
  /** Color class for the badge (Tailwind) */
  colorClass: string;
  /** Background class for the badge */
  bgClass: string;
  /** Border class for the badge */
  borderClass: string;
}

/**
 * Ratio thresholds per exercise category.
 * Each entry is the MINIMUM ratio to reach that level.
 *
 * Based on exrx.net strength standards, simplified to 4 compound categories
 * + a general fallback for isolation/accessory work.
 *
 * For bodyweight exercises, ratio = 1RM / bodyweight still works because
 * the 1RM includes bodyweight (e.g., pull-up 1RM = bodyweight + added weight).
 */
const STANDARDS: Record<string, Record<StrengthLevel, number>> = {
  // Squat / Leg Press category
  squat: {
    Novice: 0.6,
    Beginner: 0.9,
    Intermediate: 1.2,
    Advanced: 1.7,
    Elite: 2.2,
  },
  // Deadlift category (highest ratios)
  deadlift: {
    Novice: 0.8,
    Beginner: 1.2,
    Intermediate: 1.6,
    Advanced: 2.2,
    Elite: 2.8,
  },
  // Bench Press / Chest Press category
  bench: {
    Novice: 0.5,
    Beginner: 0.75,
    Intermediate: 1.0,
    Advanced: 1.4,
    Elite: 1.8,
  },
  // Overhead Press / Shoulder Press category
  press: {
    Novice: 0.35,
    Beginner: 0.5,
    Intermediate: 0.7,
    Advanced: 1.0,
    Elite: 1.3,
  },
  // General / isolation (curls, extensions, raises, etc.)
  general: {
    Novice: 0.15,
    Beginner: 0.25,
    Intermediate: 0.35,
    Advanced: 0.5,
    Elite: 0.65,
  },
};

const LEVEL_STYLES: Record<StrengthLevel, { color: string; bg: string; border: string }> = {
  Novice: { color: "text-text-muted", bg: "bg-bg-elevated", border: "border-border" },
  Beginner: { color: "text-success", bg: "bg-success/10", border: "border-success/30" },
  Intermediate: { color: "text-info", bg: "bg-info/10", border: "border-info/30" },
  Advanced: { color: "text-secondary", bg: "bg-secondary/10", border: "border-secondary/30" },
  Elite: { color: "text-warning", bg: "bg-warning/10", border: "border-warning/30" },
};

/**
 * Categorize an exercise into a strength standard category.
 */
function categorizeExercise(exerciseName: string): keyof typeof STANDARDS {
  const name = exerciseName.toLowerCase();

  if (name.includes("deadlift") || name.includes("romanian") || name.includes("rdl")) {
    return "deadlift";
  }
  if (name.includes("squat") || name.includes("leg press") || name.includes("lunge")) {
    return "squat";
  }
  if (name.includes("bench") || name.includes("chest press") || name.includes("dip")) {
    return "bench";
  }
  if (
    name.includes("overhead press") ||
    name.includes("shoulder press") ||
    name.includes("military press") ||
    name.includes("push press")
  ) {
    return "press";
  }
  return "general";
}

/**
 * Classify a user's strength level for a given exercise.
 *
 * @param oneRepMax Estimated 1RM in kg
 * @param bodyweight User's bodyweight in kg
 * @param exerciseName Name of the exercise (for categorization)
 * @returns StrengthClassification with level + styling
 */
export function classifyStrength(
  oneRepMax: number,
  bodyweight: number,
  exerciseName: string
): StrengthClassification {
  if (bodyweight <= 0 || oneRepMax <= 0) {
    return {
      level: "Novice" as StrengthLevel,
      ratio: 0,
      colorClass: LEVEL_STYLES.Novice.color,
      bgClass: LEVEL_STYLES.Novice.bg,
      borderClass: LEVEL_STYLES.Novice.border,
    };
  }

  const ratio = oneRepMax / bodyweight;
  const category = categorizeExercise(exerciseName);
  const thresholds = STANDARDS[category];

  let level: StrengthLevel = "Novice";
  if (ratio >= thresholds.Elite) level = "Elite";
  else if (ratio >= thresholds.Advanced) level = "Advanced";
  else if (ratio >= thresholds.Intermediate) level = "Intermediate";
  else if (ratio >= thresholds.Beginner) level = "Beginner";
  else level = "Novice";

  const styles = LEVEL_STYLES[level];

  return {
    level,
    ratio: Math.round(ratio * 100) / 100,
    colorClass: styles.color,
    bgClass: styles.bg,
    borderClass: styles.border,
  };
}
