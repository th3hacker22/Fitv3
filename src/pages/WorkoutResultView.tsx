"use client";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui-custom/Button";
import { useNavigate } from "@/router-shim";
import {
  Play,
  Save,
  RefreshCw,
  Activity,
  Target,
  Dumbbell,
  Sparkles,
  Loader2,
  AlertTriangle,
  X,
  ChevronRight,
  Check,
  ArrowUp,
  ArrowDown,
  Plus,
  Minus,
  TrendingUp,
  AlertCircle,
} from "lucide-react";

import { useGeneratorStore } from "@/store/useGeneratorStore";
import { useExerciseStore } from "@/store/useExerciseStore";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useToastStore } from "@/store/useToastStore";
import { useRoutineStore } from "@/store/useRoutineStore";
import { useAuthStore } from "@/store/useAuthStore";
import { uid } from "@/utils/id";
import AnatomyMap from "@/components/AnatomyMap";
import type { WorkoutSession } from "@/db/schema";
import type { LearningLoopSummary } from "@/services/learningLoop";
import { getMuscleIdsForExercise } from "@/utils/muscleMapper";
import { getAlternativeExercises } from "@/services/exerciseService";
import { generateProgram, type ProgramExercise } from "@/services/workoutGenerator";

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}

/**
 * Progressive Overload chip — renders a small badge that summarises the
 * progression strategy chosen for an exercise (e.g. +2.5kg, Hold, +Reps,
 * New, deload delta). Shown next to the exercise name on each card.
 */
function ProgressiveOverloadChip({ item }: { item: ProgramExercise }) {
  const strategy = item.overloadStrategy;
  if (!strategy) return null;

  // New exercise — no history yet
  if (strategy === "new-exercise") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-primary border border-primary/20">
        <Sparkles className="h-2.5 w-2.5" /> New
      </span>
    );
  }

  // Deload — show the weight drop (negative delta)
  if (strategy === "deload") {
    const delta =
      item.previousWeight && item.suggestedWeight
        ? Math.round((item.suggestedWeight - item.previousWeight) * 10) / 10
        : 0;
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-danger/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-danger border border-danger/20">
        <ArrowDown className="h-2.5 w-2.5" /> {delta}kg
      </span>
    );
  }

  // Hold — plateau or max-effort maintenance
  if (strategy === "hold") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-warning border border-warning/20">
        <Minus className="h-2.5 w-2.5" /> Hold
      </span>
    );
  }

  // Add reps — keep weight, push reps up
  if (strategy === "add-reps") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-success border border-success/20">
        <Plus className="h-2.5 w-2.5" /> +Reps
      </span>
    );
  }

  // Increase weight — show positive delta
  if (
    strategy === "increase-weight" &&
    item.previousWeight &&
    item.suggestedWeight
  ) {
    const delta =
      Math.round((item.suggestedWeight - item.previousWeight) * 10) / 10;
    if (delta > 0) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-success border border-success/20">
          <ArrowUp className="h-2.5 w-2.5" /> +{delta}kg
        </span>
      );
    }
  }

  return null;
}

export default function WorkoutResultView() {
  const profile = useGeneratorStore();
  const { exercises } = useExerciseStore();
  const startWorkout = useWorkoutStore((s) => s.startWorkout);
  const saveRoutine = useRoutineStore((s) => s.saveRoutine);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const [activeDayIdx, setActiveDayIdx] = useState(0);
  const [shufflingExIdx, setShufflingExIdx] = useState<number | null>(null);
  const [dismissedWarnings, setDismissedWarnings] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Backwards compatibility
  const hasProgram = !!profile.program;
  const hasRoutine = !!profile.routine;

  const currentDay = hasProgram ? profile.program!.weeklyDays[activeDayIdx] : null;
  const displayExercises = hasProgram
    ? currentDay!.exercises
    : hasRoutine
      ? profile.routine!.exercises
      : [];

  // Calculate highlighted muscles for the currently displayed day
  const { highlightedMuscles, secondaryHighlightedMuscles } = useMemo(() => {
    const main = new Set<string>();
    const secondary = new Set<string>();

    displayExercises.forEach((item) => {
      const ms = getMuscleIdsForExercise(item.exercise.target, []);
      const sec = getMuscleIdsForExercise("", item.exercise.secondaryMuscles);
      ms.forEach((m) => main.add(m));
      sec.forEach((m) => secondary.add(m));
    });

    return {
      highlightedMuscles: Array.from(main),
      secondaryHighlightedMuscles: Array.from(secondary),
    };
  }, [displayExercises]);

  if (!hasProgram && !hasRoutine) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <p className="text-text-secondary">No routine found. Please generate one first.</p>
      </div>
    );
  }

  const uniqueMuscleCount = new Set([...highlightedMuscles, ...secondaryHighlightedMuscles]).size;

  const handleShuffle = (idx: number, currentId: string) => {
    setShufflingExIdx(idx);
    setTimeout(() => {
      const currentIdsInRoutine = new Set(displayExercises.map((e) => e.exercise.id));
      const alts = getAlternativeExercises(exercises, currentId, 10);
      const nextEx = alts.find((a) => !currentIdsInRoutine.has(a.id));

      if (nextEx) {
        if (hasProgram) {
          profile.swapProgramExercise(activeDayIdx, idx, nextEx);
        } else {
          profile.swapExercise(idx, { ...profile.routine!.exercises[idx], exercise: nextEx });
        }
      }
      setShufflingExIdx(null);
    }, 400);
  };

  const handleRegenerate = async () => {
    if (!hasProgram) return;
    setIsRegenerating(true);
    await new Promise((r) => setTimeout(r, 600)); // visual feel
    profile.regenerateSeed();

    // Fetch raw sessions so the ACWR + RPE engines can personalize the program.
    let rawSessions: WorkoutSession[] = [];
    try {
      const { db } = await import("@/db");
      rawSessions = await db.workoutSessions
        .filter((s) => s.completed === true)
        .reverse()
        .limit(30)
        .toArray();
    } catch (dbErr) {
      console.warn("Could not load raw sessions for regenerate:", dbErr);
    }
    const exerciseMap = new Map(exercises.map((e) => [String(e.id), e]));

    // ── Load Learning Loop preferences ──
    let learningLoop: LearningLoopSummary | undefined = undefined;
    try {
      const { buildLearningLoopSummary } = await import("@/services/learningLoop");
      learningLoop = await buildLearningLoopSummary(90);
    } catch (llErr) {
      console.warn("Could not load learning loop summary:", llErr);
    }

    profile.setProgram(
      generateProgram(
        exercises,
        { ...profile, generatorSeed: Math.random() },
        { sessions: rawSessions, exerciseMap, learningLoop }
      )
    );
    setIsRegenerating(false);
  };

  const handleStartWorkout = async () => {
    const ids = displayExercises.map((e) => e.exercise.id);
    try {
      const sessionId = await startWorkout(ids);
      navigate({ to: "/workout/$sessionId", params: { sessionId } });
    } catch (e) {
      useToastStore.getState().addToast("error", "Failed to start workout.");
    }
  };

  return (
    <motion.div
      className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-6 lg:flex-row"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* LEFT COLUMN */}
      <div className="flex-1 space-y-6">
        {/* Header & Meta */}
        <div>
          <h1 className="text-2xl font-black uppercase italic tracking-tight text-text-primary md:text-3xl">
            {hasProgram ? profile.program!.title : "Generated Routine"}
          </h1>
          <p className="text-sm font-medium text-text-secondary mt-1">
            {hasProgram ? profile.program!.summary : "Review your workout."}
          </p>
        </div>

        {/* Warnings */}
        {hasProgram && profile.program!.warnings.length > 0 && !dismissedWarnings && (
          <div className="relative p-4 rounded-xl border border-warning/30 bg-warning/10 text-sm">
            <button
              onClick={() => setDismissedWarnings(true)}
              className="absolute top-3 right-3 text-warning/70 hover:text-warning"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex gap-2 text-warning font-bold items-center mb-2 uppercase tracking-wide text-xs">
              <AlertTriangle className="w-4 h-4" /> Important Constraints
            </div>
            <ul className="list-disc pl-5 space-y-1 text-warning/90 font-medium">
              {profile.program!.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Deload Week Banner */}
        {hasProgram && profile.program!.deloadRecommendation?.shouldDeload && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-2xl border border-warning/40 bg-gradient-to-br from-warning/15 to-warning/5 p-5"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-warning/20 text-warning">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-black uppercase tracking-wider text-warning">
                  🔄 Deload Week Recommended
                </h3>
                <p className="mt-1 text-xs text-text-secondary leading-relaxed">
                  {profile.program!.deloadRecommendation.explanation}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-lg bg-warning/15 px-2.5 py-1 text-xs font-bold text-warning">
                    Volume: −
                    {Math.round(
                      (1 - profile.program!.deloadRecommendation.volumeMultiplier) *
                        100
                    )}
                    %
                  </span>
                  <span className="rounded-lg bg-warning/15 px-2.5 py-1 text-xs font-bold text-warning">
                    RPE Cap: {profile.program!.deloadRecommendation.rpeCap}
                  </span>
                  <span className="rounded-lg bg-warning/15 px-2.5 py-1 text-xs font-bold text-warning">
                    Trigger: {profile.program!.deloadRecommendation.trigger}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Day Selector (Program Only) */}
        {hasProgram && profile.program!.weeklyDays.length > 1 && (
          <div className="flex overflow-x-auto gap-2 pb-2 no-scrollbar border-b border-border/50">
            {profile.program!.weeklyDays.map((day, idx) => (
              <button
                key={idx}
                onClick={() => setActiveDayIdx(idx)}
                className={cn(
                  "px-4 py-3 rounded-t-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors border-b-2",
                  activeDayIdx === idx
                    ? "border-primary text-primary bg-primary/5"
                    : "border-transparent text-text-secondary hover:text-text-primary hover:bg-bg-elevated/50"
                )}
              >
                Day {idx + 1}
              </button>
            ))}
          </div>
        )}

        {/* Exercises List */}
        <div>
          {hasProgram && (
            <div className="flex items-center justify-between mb-4 mt-2">
              <h2 className="text-lg font-black uppercase tracking-tight text-text-primary">
                {currentDay!.name}
              </h2>
              <span className="text-xs font-bold text-text-secondary uppercase tracking-widest bg-bg-elevated px-3 py-1 rounded">
                ~{currentDay!.estimatedMinutes} Min
              </span>
            </div>
          )}

          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {displayExercises.map((item, i) => (
                <motion.div
                  key={`${item.exercise.id}-${i}`}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card flex items-stretch gap-4 rounded-2xl border border-border p-3 shadow-lg"
                >
                  <div className="h-[80px] w-[80px] shrink-0 overflow-hidden rounded-xl bg-white mt-1">
                    <img
                      src={item.exercise.gifUrl}
                      alt={item.exercise.name}
                      className="h-full w-full object-cover mix-blend-multiply"
                    />
                  </div>

                  <div className="flex flex-col min-w-0 flex-1 justify-center">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {hasProgram && (
                          <span className="text-xs font-black uppercase tracking-widest text-primary/80 mb-0.5 block">
                            {"role" in item ? ((item as Record<string, unknown>).role as string) : "Exercise"}
                          </span>
                        )}
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="truncate text-sm md:text-base font-bold text-text-primary capitalize leading-tight">
                            {item.exercise.name}
                          </h3>
                          {(item as ProgramExercise).overloadStrategy && (
                            <ProgressiveOverloadChip item={item as ProgramExercise} />
                          )}
                          {(item as ProgramExercise).overloadStrategy === "hold" && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-warning/90 border border-warning/15"
                              title="Plateau detected — progress has stalled. Try a variation or deload."
                            >
                              <AlertCircle className="h-2.5 w-2.5" /> Plateau
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => handleShuffle(i, item.exercise.id)}
                        disabled={shufflingExIdx === i}
                        className="group shrink-0 p-2 rounded-lg bg-bg-elevated/50 text-text-secondary hover:bg-bg-elevated hover:text-text-primary transition-colors disabled:opacity-50"
                      >
                        <RefreshCw
                          className={cn(
                            "h-4 w-4",
                            shufflingExIdx === i && "animate-spin text-primary"
                          )}
                        />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-xs font-bold uppercase tracking-wider text-text-secondary">
                      <span className="text-primary-light">{item.exercise.target}</span>
                      <span className="opacity-30">•</span>
                      <span>
                        {item.sets} Sets × {item.reps}
                      </span>
                      {item.restSeconds ? (
                        <>
                          <span className="opacity-30">•</span>
                          <span>{item.restSeconds}s Rest</span>
                        </>
                      ) : null}
                      {"tempo" in item && (item as Record<string, unknown>).tempo ? (
                        <>
                          <span className="opacity-30">•</span>
                          <span>{(item as Record<string, unknown>).tempo as string}</span>
                        </>
                      ) : null}
                    </div>

                    {(item as ProgramExercise).progressionTip && (
                      <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-primary/5 px-2.5 py-1.5 border border-primary/10">
                        <TrendingUp className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                        <p className="text-[11px] text-text-secondary leading-snug">
                          {(item as ProgramExercise).progressionTip}
                        </p>
                      </div>
                    )}

                    {"note" in item && (item as Record<string, unknown>).note && (
                      <p className="mt-2 text-xs text-text-secondary italic leading-snug border-l border-primary/30 pl-2">
                        {(item as Record<string, unknown>).note as string}
                      </p>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {hasProgram && (
          <div className="bg-bg-elevated/40 border border-border rounded-xl p-4 mt-6">
            <h3 className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-1">
              Progression Model
            </h3>
            <p className="text-sm font-medium text-text-secondary leading-relaxed">
              {profile.program!.progressionModel}
            </p>
          </div>
        )}
      </div>

      {/* RIGHT COLUMN */}
      <div className="w-full lg:w-[400px] shrink-0">
        <motion.div
          className="glass-card sticky top-6 rounded-[2rem] border border-border p-6 shadow-2xl"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="mb-6 flex items-center justify-between border-b border-border/50 pb-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary">
                <Target className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-black uppercase italic tracking-tight text-text-primary">
                  {hasProgram ? currentDay!.name : "Session"}
                </h2>
                <p className="text-xs font-semibold text-text-secondary">
                  {uniqueMuscleCount} Muscle groups
                </p>
              </div>
            </div>
          </div>

          {/* Compact Anatomy Map */}
          <div className="mb-6 rounded-3xl bg-bg-elevated/30 p-2 border border-border/50 min-h-[300px]">
            <h3 className="text-center text-xs font-bold text-text-secondary tracking-widest uppercase mb-2">
              Day {activeDayIdx + 1} Targets
            </h3>
            <AnatomyMap
              readOnly
              highlightedMuscles={highlightedMuscles}
              secondaryHighlightedMuscles={secondaryHighlightedMuscles}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            <Button
              className="w-full py-4 text-sm font-black uppercase tracking-wider"
              variant="primary"
              onClick={handleStartWorkout}
            >
              <Play className="h-5 w-5 fill-black" /> Start Day {activeDayIdx + 1}
            </Button>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                className="w-full py-4 text-xs font-bold uppercase tracking-wider bg-bg-elevated/50 text-text-secondary hover:text-text-primary"
                icon={<Save className="h-3.5 w-3.5" />}
                onClick={async () => {
                  if (displayExercises.length === 0) return;
                  const routineExercises = displayExercises.map((item, idx) => {
                    const repStr = item.reps || "10";
                    const repNum = parseInt(repStr.split("-")[0]) || 10;
                    return {
                      exerciseId: item.exercise.id,
                      exerciseName: item.exercise.name,
                      targetSets: item.sets,
                      targetReps: repNum,
                      restTimer: item.restSeconds || 90,
                      order: idx,
                      imageUrl: item.exercise.imageUrl || item.exercise.gifUrl,
                      equipment: item.exercise.equipment,
                    };
                  });

                  const routineName = hasProgram
                    ? `${profile.program!.title} - ${currentDay!.name}`
                    : "AI Generated Routine";

                  try {
                    await saveRoutine(
                      {
                        id: uid(),
                        name: routineName,
                        exercises: routineExercises,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                      },
                      user?.uid
                    );
                    useToastStore
                      .getState()
                      .addToast("success", "Saved routine to Custom Routines!");
                  } catch (e) {
                    useToastStore.getState().addToast("error", "Failed to save routine.");
                  }
                }}
              >
                Save
              </Button>

              {hasProgram && (
                <Button
                  variant="outline"
                  onClick={handleRegenerate}
                  disabled={isRegenerating}
                  className="w-full py-4 text-xs font-bold uppercase tracking-wider border-border/50"
                  icon={
                    isRegenerating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )
                  }
                >
                  {isRegenerating ? "Regen..." : "Regen"}
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
