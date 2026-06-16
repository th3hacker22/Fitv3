import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import {
  ArrowLeft,
  ChevronRight,
  Lightbulb,
  Play,
  Dumbbell,
  Target,
  Zap,
} from "lucide-react";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useExerciseStore } from "@/store/useExerciseStore";
import { getAlternativeExercises } from "@/services/exerciseService";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { getMuscleIdsForExercise } from "@/utils/muscleMapper";
import AnatomyMap from "@/components/AnatomyMap";

export default function ExerciseDetailPage() {
  const { exerciseId } = useParams({ from: "/exercises/$exerciseId" });
  const navigate = useNavigate();
  const startWorkout = useWorkoutStore((s) => s.startWorkout);
  const { exercises, loadExercises, isLoading } = useExerciseStore();
  const [showGif, setShowGif] = useState(false);

  // Load exercises if not loaded
  useEffect(() => {
    loadExercises();
  }, [loadExercises]);

  const exercise = exercises.find((e) => e.id === exerciseId);
  const alternatives = exercise
    ? getAlternativeExercises(exercises, exerciseId, 3)
    : [];

  // ── Loading State ──
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Link
          to="/exercises"
          className="inline-flex items-center gap-1 text-sm text-text-secondary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  // ── Not Found ──
  if (!exercise) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <Dumbbell className="h-16 w-16 text-text-muted" />
        <p className="text-lg font-bold text-text-primary">
          Exercise Not Found
        </p>
        <Link
          to="/exercises"
          className="flex items-center gap-2 text-sm text-primary hover:text-primary-hover"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Exercises
        </Link>
      </div>
    );
  }

  // ── Handle Start Workout ──
  const handleStartWorkout = async () => {
    const sessionId = await startWorkout([exercise.id]);
    navigate({ to: "/workout/$sessionId", params: { sessionId } });
  };

  return (
    <div className="space-y-6">
      {/* ── Back Button ── */}
      <Link
        to="/exercises"
        className="inline-flex items-center gap-2 text-sm font-medium text-text-secondary transition-colors hover:text-primary uppercase tracking-wide"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      {/* ── Exercise Visual (Image/GIF Toggle) ── */}
      <motion.div
        className="glass-card relative overflow-hidden rounded-[--radius-card]"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="relative aspect-video overflow-hidden bg-bg-elevated w-full">
          {/* Main Image/GIF */}
          <img
            src={showGif ? exercise.gifUrl : exercise.imageUrl}
            alt={exercise.name}
            className="image-overlay h-full w-full object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />

          {/* Fallback */}
          <div className="absolute inset-0 -z-10 flex items-center justify-center">
            <Dumbbell className="h-20 w-20 text-text-muted/20" />
          </div>

          {/* Toggle Button */}
          <button
            onClick={() => setShowGif(!showGif)}
            className="absolute bottom-4 left-4 flex items-center gap-2 rounded-xl bg-bg/90 px-4 py-2 text-xs font-semibold text-text-primary backdrop-blur-sm transition-colors hover:bg-bg border border-border/50"
          >
            {showGif ? (
              <>
                <span>View Image</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-primary text-primary" />
                <span>View Animation</span>
              </>
            )}
          </button>

          {/* Equipment Badge */}
          <div className="absolute top-4 right-4">
            <span className="rounded-full bg-primary/20 px-3 py-1 text-xs font-semibold text-primary backdrop-blur-sm capitalize border border-primary/20">
              {exercise.equipment}
            </span>
          </div>
        </div>
      </motion.div>

      {/* ── Exercise Info ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <h1 className="text-2xl font-bold text-text-primary capitalize tracking-wide">
          {exercise.name}
        </h1>
        <p className="mt-1 text-sm text-text-muted capitalize">
          {exercise.bodyPart}
        </p>
      </motion.div>

      {/* ── Tags ── */}
      <motion.div
        className="flex flex-wrap gap-2"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        <div className="glass-card flex items-center gap-2 rounded-full px-3 py-1.5 border border-border/50">
          <Dumbbell className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium text-text-secondary capitalize">
            {exercise.equipment}
          </span>
        </div>
        <div className="glass-card flex items-center gap-2 rounded-full px-3 py-1.5 border border-border/50">
          <Target className="h-4 w-4 text-success" />
          <span className="text-xs font-medium text-text-secondary capitalize">
            {exercise.target}
          </span>
        </div>
      </motion.div>

      {/* ── Muscles ── */}
      <motion.div
        className="space-y-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <h2 className="flex items-center gap-2 text-base font-bold text-text-primary uppercase tracking-wider">
          <Zap className="h-5 w-5 text-warning" />
          Target Muscles
        </h2>
        <div className="glass-card rounded-[--radius-card] p-4 flex flex-col items-center">
          <div className="flex flex-col gap-2 w-full mb-4">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider text-center">
              Primary Muscle
            </h3>
            <div className="flex justify-center">
              <span className="rounded-full bg-primary/15 px-3 py-1.5 text-xs font-bold text-primary-light capitalize border border-primary/20">
                {exercise.target}
              </span>
            </div>

            {exercise.secondaryMuscles.length > 0 && (
              <>
                <h3 className="mt-2 text-xs font-semibold text-text-muted uppercase tracking-wider text-center">
                  Secondary Muscles
                </h3>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {exercise.secondaryMuscles.slice(0, 3).map((muscle) => (
                    <span
                      key={muscle}
                      className="rounded-full bg-bg-elevated px-2.5 py-1 text-[10px] font-medium text-text-secondary capitalize border border-border/50"
                    >
                      {muscle}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="w-full max-w-sm mt-4 p-4 rounded-xl bg-bg-elevated/50">
            <AnatomyMap
              readOnly
              highlightedMuscles={getMuscleIdsForExercise(exercise.target, [])}
              secondaryHighlightedMuscles={getMuscleIdsForExercise(
                "",
                exercise.secondaryMuscles,
              )}
            />
          </div>
        </div>
      </motion.div>

      {/* ── Instructions ── */}
      <motion.div
        className="space-y-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25 }}
      >
        <h2 className="flex items-center gap-2 text-base font-bold text-text-primary uppercase tracking-wider">
          <Lightbulb className="h-5 w-5 text-warning" />
          Execution Guide
        </h2>
        <div className="space-y-3">
          {exercise.instructionSteps.map((step, index) => (
            <motion.div
              key={index}
              className="glass-card flex items-start gap-4 rounded-[--radius-card] p-4"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + index * 0.05 }}
            >
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary border border-primary/20">
                {index + 1}
              </div>
              <p className="text-sm leading-relaxed text-text-secondary pt-0.5">
                {step}
              </p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── Alternative Exercises ── */}
      {alternatives.length > 0 && (
        <motion.div
          className="space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
        >
          <h2 className="text-base font-bold text-text-primary uppercase tracking-wider">
            Similar Exercises
          </h2>
          <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-5 px-5 pb-2 pt-1">
            {alternatives.map((alt) => (
              <Link
                key={alt.id}
                to="/exercises/$exerciseId"
                params={{ exerciseId: alt.id }}
                className="flex-shrink-0 w-36"
              >
                <div className="glass-card rounded-[--radius-card] overflow-hidden transition-all duration-300 hover:ring-1 hover:ring-primary/30 active:scale-[0.97]">
                  <div className="aspect-square bg-bg-elevated w-full">
                    <img
                      src={alt.imageUrl}
                      alt={alt.name}
                      className="image-overlay h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-medium text-text-primary line-clamp-2 capitalize">
                      {alt.name}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Start Workout Button ── */}
      <motion.div
        className="pb-8 pt-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
      >
        <Button
          onClick={handleStartWorkout}
          variant="primary"
          className="w-full py-4 text-base tracking-wider uppercase"
        >
          <Play className="h-5 w-5 fill-current" />
          Start Workout
          <ChevronRight className="h-5 w-5 ml-auto opacity-50" />
        </Button>
      </motion.div>
    </div>
  );
}
