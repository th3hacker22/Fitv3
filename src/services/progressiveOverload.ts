export interface ExerciseHistoryPoint {
  date: string;
  weight: number;
  reps: number;
  rpe?: number;
  setsCompleted: number;
  setsTargeted: number;
  estimated1RM: number;
}

export interface OverloadRecommendation {
  ready: boolean;
  readinessSignal: "introduce" | "advance" | "hold" | "deload";
  previousWeight: number | null;
  suggestedWeight: number;
  suggestedReps?: number;
  incrementPct: number;
  exerciseId?: string;
}

export function pickProgressionModel(trainingYears: number, fitnessLevel: string | null): string {
  if (fitnessLevel === "Advanced" || trainingYears > 5) {
    return "block-periodization";
  }
  if (trainingYears >= 1.5) {
    return "weekly-undulating";
  }
  return "linear";
}

function sortHistoryNewestFirst(history: ExerciseHistoryPoint[]): ExerciseHistoryPoint[] {
  return [...history]
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const timeA = new Date(a.item.date).getTime();
      const timeB = new Date(b.item.date).getTime();
      if (timeA !== timeB) return timeB - timeA;
      return b.index - a.index;
    })
    .map((x) => x.item);
}

export function analyzeExerciseProgress(history: ExerciseHistoryPoint[]) {
  if (!history || history.length === 0) {
    return {
      lastSession: null,
      beatCount: 0,
      completionRatio: 0,
      avgRpe: null,
      streakBeatTarget: false,
    };
  }

  const sorted = sortHistoryNewestFirst(history);
  const lastSession = sorted[0];

  let totalCompleted = 0;
  let totalTargeted = 0;
  let rpeSum = 0;
  let rpeCount = 0;

  sorted.forEach((h) => {
    totalCompleted += h.setsCompleted || 0;
    totalTargeted += h.setsTargeted || 0;
    if (h.rpe !== undefined && h.rpe !== null && !isNaN(h.rpe)) {
      rpeSum += h.rpe;
      rpeCount++;
    }
  });

  const completionRatio = totalTargeted > 0 ? totalCompleted / totalTargeted : 0;
  const avgRpe = rpeCount > 0 ? rpeSum / rpeCount : null;

  // Count consecutive sessions starting from the most recent where reps >= 12
  let beatCount = 0;
  for (const h of sorted) {
    if (h.reps >= 12) {
      beatCount++;
    } else {
      break;
    }
  }

  const streakBeatTarget = beatCount >= 3;

  return {
    lastSession,
    beatCount,
    completionRatio,
    avgRpe,
    streakBeatTarget,
  };
}

const roundWeight = (w: number) => Math.round(w * 4) / 4;

export function recommendOverload(params: {
  history: ExerciseHistoryPoint[];
  model: string;
  age: number;
  bodyweightKg: number;
  exerciseCategory: string;
  targetReps: number;
  exerciseId?: string;
}): OverloadRecommendation {
  const { history, model, age, bodyweightKg, exerciseCategory, targetReps, exerciseId } = params;

  if (!history || history.length === 0) {
    // Introduce conservative weight
    let suggestedWeight = 20; // default empty barbell
    if (exerciseCategory.toLowerCase() === "bodyweight") {
      suggestedWeight = 0;
    } else if (exerciseCategory.toLowerCase() === "dumbbell") {
      suggestedWeight = 10;
    } else {
      // Barbell or machine: conservative well below bodyweight
      suggestedWeight = Math.max(20, roundWeight(bodyweightKg * 0.3));
    }

    return {
      ready: true,
      readinessSignal: "introduce",
      previousWeight: null,
      suggestedWeight,
      suggestedReps: exerciseCategory.toLowerCase() === "bodyweight" ? 10 : undefined,
      incrementPct: 0,
      exerciseId,
    };
  }

  const progress = analyzeExerciseProgress(history);
  const lastSession = progress.lastSession!;
  const prevWeight = lastSession.weight;

  // 1. Deload detection
  if (
    (progress.avgRpe !== null && progress.avgRpe >= 9) ||
    progress.completionRatio < 0.7
  ) {
    let deloadWeight = prevWeight;
    if (exerciseCategory.toLowerCase() !== "bodyweight" && prevWeight > 0) {
      deloadWeight = roundWeight(prevWeight * 0.9);
    }

    return {
      ready: true,
      readinessSignal: "deload",
      previousWeight: prevWeight,
      suggestedWeight: deloadWeight,
      suggestedReps: exerciseCategory.toLowerCase() === "bodyweight" ? Math.max(5, lastSession.reps - 2) : undefined,
      incrementPct: -0.1,
      exerciseId,
    };
  }

  // 2. Advance detection (consecutive beat range >= 3)
  const sortedHistory = sortHistoryNewestFirst(history);

  let targetBeatCount = 0;
  for (const h of sortedHistory) {
    if (h.reps >= targetReps) {
      targetBeatCount++;
    } else {
      break;
    }
  }
  const canAdvance = targetBeatCount >= 3;

  if (canAdvance) {
    let incrementPct = 0.025; // default 2.5% for linear
    if (model === "weekly-undulating") {
      incrementPct = 0.0125; // WUP has smaller step
    }

    // Age caps
    if (age >= 55) {
      incrementPct = Math.min(incrementPct, 0.0125);
    } else if (age >= 41) {
      incrementPct = Math.min(incrementPct, 0.02);
    }

    let suggestedWeight = prevWeight;
    let suggestedReps = lastSession.reps;

    if (exerciseCategory.toLowerCase() === "bodyweight" && prevWeight === 0) {
      suggestedReps = lastSession.reps + 2;
    } else {
      suggestedWeight = roundWeight(prevWeight * (1 + incrementPct));
    }

    return {
      ready: true,
      readinessSignal: "advance",
      previousWeight: prevWeight,
      suggestedWeight,
      suggestedReps: exerciseCategory.toLowerCase() === "bodyweight" ? suggestedReps : undefined,
      incrementPct,
      exerciseId,
    };
  }

  // 3. Hold
  return {
    ready: true,
    readinessSignal: "hold",
    previousWeight: prevWeight,
    suggestedWeight: prevWeight,
    suggestedReps: exerciseCategory.toLowerCase() === "bodyweight" ? lastSession.reps : undefined,
    incrementPct: 0,
    exerciseId,
  };
}

export function formatOverloadForPrompt(recs: OverloadRecommendation[]): string {
  if (!recs || recs.length === 0) return "";
  return recs
    .map((r) => {
      const prev = r.previousWeight !== null ? `${r.previousWeight}kg` : "none";
      const sug = r.suggestedWeight > 0 ? `${r.suggestedWeight}kg` : "bodyweight";
      return `${r.exerciseId || "unknown"}: previous ${prev}, suggested ${sug} (${r.readinessSignal})`;
    })
    .join("\n");
}
