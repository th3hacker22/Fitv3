import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { useNavigate } from "@tanstack/react-router";
import {
  Play, Save, RefreshCw, Activity, Target, Dumbbell,
  Sparkles, Loader2, AlertTriangle, X, ChevronRight, Check
} from "lucide-react";

import { useGeneratorStore } from "@/store/useGeneratorStore";
import { useExerciseStore } from "@/store/useExerciseStore";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useToastStore } from "@/store/useToastStore";
import AnatomyMap from "@/components/AnatomyMap";
import { getMuscleIdsForExercise } from "@/utils/muscleMapper";
import { getAlternativeExercises } from "@/services/exerciseService";
import { generateProgram } from "@/services/workoutGenerator";

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}

export default function WorkoutResultView() {
  const profile = useGeneratorStore();
  const { exercises } = useExerciseStore();
  const startWorkout = useWorkoutStore((s) => s.startWorkout);
  const navigate = useNavigate();

  const [activeDayIdx, setActiveDayIdx] = useState(0);
  const [shufflingExIdx, setShufflingExIdx] = useState<number | null>(null);
  const [dismissedWarnings, setDismissedWarnings] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Backwards compatibility
  const hasProgram = !!profile.program;
  const hasRoutine = !!profile.routine;

  const currentDay = hasProgram ? profile.program!.weeklyDays[activeDayIdx] : null;
  const displayExercises = hasProgram ? currentDay!.exercises : (hasRoutine ? profile.routine!.exercises : []);

  if (!hasProgram && !hasRoutine) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <p className="text-text-muted">No routine found. Please generate one first.</p>
      </div>
    );
  }

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
    await new Promise(r => setTimeout(r, 600)); // visual feel
    profile.regenerateSeed();
    profile.setProgram(generateProgram(exercises, { ...profile, generatorSeed: Math.random() }));
    setIsRegenerating(false);
  };

  const handleStartWorkout = async () => {
    const ids = displayExercises.map(e => e.exercise.id);
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
          <p className="text-sm font-medium text-text-muted mt-1">
            {hasProgram ? profile.program!.summary : "Review your workout."}
          </p>
        </div>

        {/* Warnings */}
        {hasProgram && profile.program!.warnings.length > 0 && !dismissedWarnings && (
          <div className="relative p-4 rounded-xl border border-warning/30 bg-warning/10 text-sm">
            <button onClick={() => setDismissedWarnings(true)} className="absolute top-3 right-3 text-warning/70 hover:text-warning">
              <X className="w-4 h-4" />
            </button>
            <div className="flex gap-2 text-warning font-bold items-center mb-2 uppercase tracking-wide text-xs">
              <AlertTriangle className="w-4 h-4" /> Important Constraints
            </div>
            <ul className="list-disc pl-5 space-y-1 text-warning/90 font-medium">
              {profile.program!.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
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
                    : "border-transparent text-text-muted hover:text-text-primary hover:bg-bg-elevated/50"
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
              <span className="text-xs font-bold text-text-muted uppercase tracking-widest bg-bg-elevated px-3 py-1 rounded">
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
                    <img src={item.exercise.gifUrl} alt={item.exercise.name} className="h-full w-full object-cover mix-blend-multiply" />
                  </div>

                  <div className="flex flex-col min-w-0 flex-1 justify-center">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {hasProgram && (
                          <span className="text-[9px] font-black uppercase tracking-widest text-primary/80 mb-0.5 block">
                            {'role' in item ? (item as any).role : "Exercise"}
                          </span>
                        )}
                        <h3 className="truncate text-sm md:text-base font-bold text-text-primary capitalize leading-tight">
                          {item.exercise.name}
                        </h3>
                      </div>
                      
                      <button
                        onClick={() => handleShuffle(i, item.exercise.id)}
                        disabled={shufflingExIdx === i}
                        className="group shrink-0 p-2 rounded-lg bg-bg-elevated/50 text-text-muted hover:bg-bg-elevated hover:text-text-primary transition-colors disabled:opacity-50"
                      >
                        <RefreshCw className={cn("h-4 w-4", shufflingExIdx === i && "animate-spin text-primary")} />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-[11px] font-bold uppercase tracking-wider text-text-muted">
                      <span className="text-primary-light">{item.exercise.target}</span>
                      <span className="opacity-30">•</span>
                      <span>{item.sets} Sets × {item.reps}</span>
                      {item.restSeconds ? (
                        <>
                          <span className="opacity-30">•</span>
                          <span>{item.restSeconds}s Rest</span>
                        </>
                      ) : null}
                      {'tempo' in item && (item as any).tempo ? (
                        <>
                          <span className="opacity-30">•</span>
                          <span>{(item as any).tempo}</span>
                        </>
                      ) : null}
                    </div>

                    {'note' in item && (item as any).note && (
                      <p className="mt-2 text-[11px] text-text-muted/80 italic leading-snug border-l border-primary/30 pl-2">
                        {(item as any).note}
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
             <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-1">Progression Model</h3>
             <p className="text-sm font-medium text-text-secondary leading-relaxed">{profile.program!.progressionModel}</p>
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
                <p className="text-xs font-semibold text-text-muted">
                  {uniqueMuscleCount} Muscle groups
                </p>
              </div>
            </div>
          </div>

          {/* Compact Anatomy Map */}
          <div className="mb-6 rounded-3xl bg-bg-elevated/30 p-2 border border-border/50 min-h-[300px]">
             <h3 className="text-center text-[10px] font-bold text-text-muted tracking-widest uppercase mb-2">Day {activeDayIdx + 1} Targets</h3>
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
                onClick={() => {
                  useToastStore.getState().addToast("success", "Saved this day to your routines.");
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
                  icon={isRegenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
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
