"use client";
import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "@/router-shim";
import { motion } from "framer-motion";
import { Button } from "@/components/ui-custom/Button";
import {
  ArrowLeft,
  ChevronRight,
  Lightbulb,
  Play,
  Dumbbell,
  Target,
  Zap,
  LineChart as ChartIcon,
} from "lucide-react";
import ExerciseVideoPlayer from "@/components/exercise/ExerciseVideoPlayer";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useTranslation } from "react-i18next";
import { useExerciseStore } from "@/store/useExerciseStore";
import { getAlternativeExercises } from "@/services/exerciseService";
import { SkeletonCard } from "@/components/ui-custom/Skeleton";
import { getMuscleIdsForExercise } from "@/utils/muscleMapper";
import AnatomyMap from "@/components/AnatomyMap";
import { db } from "@/db/index";
import { estimateOneRepMax } from "@/utils/fitnessMath";
import { useThemeColors } from "@/hooks/useThemeColors";
import { cn } from "@/utils/cn";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";

export default function ExerciseDetailPage() {
  const { t, i18n } = useTranslation();
  const { exerciseId } = useParams({ from: "/exercises/$exerciseId" });
  const navigate = useNavigate();
  const startWorkout = useWorkoutStore((s) => s.startWorkout);
  // Individual selectors instead of bare store subscription
  const exercises = useExerciseStore((s) => s.exercises);
  const loadExercises = useExerciseStore((s) => s.loadExercises);
  const isLoading = useExerciseStore((s) => s.isLoading);
  const colors = useThemeColors();
  const [metric, setMetric] = useState<"e1rm" | "volume">("e1rm");
  const [progressData, setProgressData] = useState<
    { date: string; e1rm: number; volume: number }[]
  >([]);

  // Load exercises if not loaded
  useEffect(() => {
    loadExercises();
  }, [loadExercises]);

  // Load progress history
  useEffect(() => {
    async function loadProgress() {
      if (!exerciseId) return;
      const sessions = await db.workoutSessions
        .filter((s) => s.completed === true && !s.isFreeze)
        .toArray();

      const data = sessions
        .map((session) => {
          const ex = session.exercises.find((e) => String(e.exerciseId) === String(exerciseId));
          if (!ex) return null;

          let bestE1rm = 0;
          let totalVolume = 0;

          for (const s of ex.sets) {
            if (!s.completed) continue;
            totalVolume += s.weight * s.reps;
            const e1rm = estimateOneRepMax(s.weight, s.reps);
            if (e1rm > bestE1rm) bestE1rm = e1rm;
          }

          if (bestE1rm === 0 && totalVolume === 0) return null;

          return {
            date: session.date.split("T")[0],
            e1rm: Math.round(bestE1rm * 10) / 10,
            volume: totalVolume,
          };
        })
        .filter(Boolean) as { date: string; e1rm: number; volume: number }[];

      data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setProgressData(data);
    }
    loadProgress();
  }, [exerciseId]);

  const exercise = exercises.find((e) => e.id === exerciseId);
  const alternatives = exercise ? getAlternativeExercises(exercises, exerciseId, 3) : [];

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
        <Dumbbell className="h-16 w-16 text-text-secondary" />
        <p className="text-lg font-bold text-text-primary">Exercise Not Found</p>
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
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        {t("back")}
      </Link>

      {/* ── Exercise Visual (Image/GIF/Video via ExerciseVideoPlayer) ── */}
      <motion.div
        className="glass-card relative overflow-hidden rounded-[--radius-card]"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <ExerciseVideoPlayer
          exerciseName={exercise.name}
          imageUrl={exercise.imageUrl}
          gifUrl={exercise.gifUrl}
          variant="detail"
          className="image-overlay w-full"
        />

        {/* Equipment Badge */}
        <div className="absolute top-4 end-4 z-10">
          <span className="rounded-full bg-primary/20 px-3 py-1 text-xs font-semibold text-primary backdrop-blur-sm capitalize border border-primary/20">
            {exercise.equipment}
          </span>
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
        <p className="mt-1 text-sm text-text-secondary capitalize">{exercise.bodyPart}</p>
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
          {t("target_muscles")}
        </h2>
        <div className="glass-card rounded-[--radius-card] p-4 flex flex-col items-center">
          <div className="flex flex-col gap-2 w-full mb-4">
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider text-center">
              {t("primary_muscle")}
            </h3>
            <div className="flex justify-center">
              <span className="rounded-full bg-primary/15 px-3 py-1.5 text-xs font-bold text-primary-light capitalize border border-primary/20">
                {exercise.target}
              </span>
            </div>

            {exercise.secondaryMuscles.length > 0 && (
              <>
                <h3 className="mt-2 text-xs font-semibold text-text-secondary uppercase tracking-wider text-center">
                  {t("secondary_muscles_label")}
                </h3>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {exercise.secondaryMuscles.slice(0, 3).map((muscle) => (
                    <span
                      key={muscle}
                      className="rounded-full bg-bg-elevated px-2.5 py-1 text-xs font-medium text-text-secondary capitalize border border-border/50"
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
              secondaryHighlightedMuscles={getMuscleIdsForExercise("", exercise.secondaryMuscles)}
            />
          </div>
        </div>
      </motion.div>

      {/* ── Progressive Overload ── */}
      {progressData.length > 0 && (
        <motion.div
          className="space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.22 }}
        >
          <h2 className="flex items-center gap-2 text-base font-bold text-text-primary uppercase tracking-wider">
            <ChartIcon className="h-5 w-5 text-primary" />
            {t("progressive_overload")}
          </h2>
          <div className="glass-card rounded-[--radius-card] p-5 border border-border/50">
            <div className="flex justify-between items-center mb-6">
              <span className="text-xs font-black text-text-secondary uppercase tracking-wider">
                {t("performance_analytics")}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setMetric("e1rm")}
                  className={cn(
                    "min-h-11 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all active:scale-95",
                    metric === "e1rm"
                      ? "bg-primary/20 text-primary border-primary/40"
                      : "bg-bg-elevated text-text-secondary border-transparent"
                  )}
                >
                  e1RM
                </button>
                <button
                  onClick={() => setMetric("volume")}
                  className={cn(
                    "min-h-11 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all active:scale-95",
                    metric === "volume"
                      ? "bg-primary/20 text-primary border-primary/40"
                      : "bg-bg-elevated text-text-secondary border-transparent"
                  )}
                >
                  {t("volume")}
                </button>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={progressData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.border} opacity={0.3} />
                  <XAxis dataKey="date" stroke={colors.textMuted} fontSize={10} tickLine={false} />
                  <YAxis
                    stroke={colors.textMuted}
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    domain={["auto", "auto"]}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      borderRadius: "12px",
                      color: colors.text,
                      fontSize: "11px",
                    }}
                    labelStyle={{ fontWeight: "bold", marginBottom: "4px" }}
                  />
                  <Line
                    type="monotone"
                    dataKey={metric}
                    name={metric === "e1rm" ? "Estimated 1RM (kg)" : "Total Volume (kg)"}
                    stroke={colors.primary}
                    strokeWidth={3}
                    dot={{ fill: colors.primary, r: 4 }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Instructions ── */}
      <motion.div
        className="space-y-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25 }}
      >
        <h2 className="flex items-center gap-2 text-base font-bold text-text-primary uppercase tracking-wider">
          <Lightbulb className="h-5 w-5 text-warning" />
          {t("execution_guide")}
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
              <p className="text-sm leading-relaxed text-text-secondary pt-0.5">{step}</p>
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
            {t("similar_exercises")}
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
          {t("start_workout_now")}
          <ChevronRight className="h-5 w-5 ml-auto opacity-50 rtl:rotate-180" />
        </Button>
      </motion.div>
    </div>
  );
}
