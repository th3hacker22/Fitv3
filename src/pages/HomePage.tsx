import { useState, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Flame,
  Target,
  TrendingUp,
  ChevronRight,
  Zap,
  Dumbbell,
  Clock,
  Plus,
  Play,
  Trash2,
  Copy,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { getWorkoutStreak, getTotalStats, db } from "@/db";
import { useRoutineStore } from "@/store/useRoutineStore";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useExerciseStore } from "@/store/useExerciseStore";
import { useAchievementsStore } from "@/store/useAchievementsStore";
import AchievementBadge from "@/components/AchievementBadge";
import { DataEmptyState } from "@/components/ui/DataEmptyState";
import { Button } from "@/components/ui/Button";
import { ACHIEVEMENTS } from "@/data/achievements";
import {
  routineTemplates,
  buildTemplateRoutine,
} from "@/data/routineTemplates";
import { uid } from "@/utils/id";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const },
  }),
};

export default function HomePage() {
  const navigate = useNavigate();
  const [streak, setStreak] = useState(0);
  const [totalStats, setTotalStats] = useState({
    totalWorkouts: 0,
    totalVolume: 0,
    totalDuration: 0,
  });
  const [recentWorkouts, setRecentWorkouts] = useState<
    { id: string; name: string; date: string; exerciseCount: number }[]
  >([]);

  const routines = useRoutineStore((s) => s.routines);
  const loadRoutines = useRoutineStore((s) => s.loadRoutines);
  const deleteRoutine = useRoutineStore((s) => s.deleteRoutine);
  const saveRoutine = useRoutineStore((s) => s.saveRoutine);
  const startWorkout = useWorkoutStore((s) => s.startWorkout);
  const user = useAuthStore((s) => s.user);

  const exercises = useExerciseStore((s) => s.exercises);
  const loadExercises = useExerciseStore((s) => s.loadExercises);

  const { newlyUnlocked, clearNewlyUnlocked } = useAchievementsStore();

  useEffect(() => {
    loadRoutines();
    loadExercises();
  }, [loadRoutines, loadExercises]);

  useEffect(() => {
    async function loadData() {
      const [streakData, statsData, sessions] = await Promise.all([
        getWorkoutStreak(),
        getTotalStats(),
        db.workoutSessions.orderBy("date").reverse().limit(3).toArray(),
      ]);

      setStreak(streakData);
      setTotalStats(statsData);
      setRecentWorkouts(
        sessions.map((s) => ({
          id: s.id,
          name: s.name,
          date: s.date,
          exerciseCount: s.exercises.length,
        })),
      );
    }
    loadData();
  }, []);

  const formatVolume = (kg: number) => {
    if (kg >= 1000) return `${(kg / 1000).toFixed(1)}`;
    return `${kg}`;
  };

  const templateImages: Record<string, string> = {
    "Push Day (PPL)": "/images/push-day.jpg",
    "Pull Day (PPL)": "/images/pull-day.jpg",
    "Legs Day (PPL)": "/images/legs-day.jpg",
    "Full Body Foundational": "/images/full-body.jpg",
  };

  const quickStats = [
    {
      label: "Streak",
      value: streak.toString(),
      unit: "Days",
      icon: Flame,
      color: "text-warning",
      bg: "bg-warning/10",
    },
    {
      label: "Workouts",
      value: totalStats.totalWorkouts.toString(),
      unit: "Sessions",
      icon: Target,
      color: "text-primary",
      bg: "bg-primary-muted",
    },
    {
      label: "Volume",
      value: formatVolume(totalStats.totalVolume),
      unit: totalStats.totalVolume >= 1000 ? "Ton" : "Kg",
      icon: TrendingUp,
      color: "text-success",
      bg: "bg-success/10",
    },
  ];

  return (
    <div className="space-y-8">
      {/* ── Hero Welcome Card ── */}
      <motion.div
        className="relative overflow-hidden rounded-[--radius-card] border border-border"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={0}
      >
        <img
          src="/images/hero-athlete.jpg"
          alt="Athlete lifting dumbbells in the gym"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/80 to-bg/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-bg/70 to-transparent" />

        <div className="relative z-10 p-6 pt-24 sm:pt-32">
          <div className="mb-2 flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-primary">
              Welcome to Pulse
            </span>
          </div>
          <h1 className="mb-2 text-2xl font-bold text-text-primary text-balance">
            {totalStats.totalWorkouts > 0
              ? "Keep Pushing Forward!"
              : "Start Your Fitness Journey"}
          </h1>
          <p className="mb-5 max-w-md text-sm leading-relaxed text-text-secondary">
            {totalStats.totalWorkouts > 0
              ? `You've crushed ${totalStats.totalWorkouts} workouts so far. Keep it up!`
              : "Track workouts, crush goals, and monitor progress — all in one place."}
          </p>
          <Button
            variant="primary"
            className="w-max"
            onClick={() => navigate({ to: "/exercises" })}
          >
            Start Workout Now
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>

      {/* ── Newly Unlocked Achievements Toast ── */}
      {newlyUnlocked.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="glass-card flex flex-col gap-3 rounded-[--radius-card] p-4 border border-primary/40 bg-primary/5"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-primary uppercase tracking-wider">
              Achievement Unlocked!
            </h3>
            <button
              onClick={clearNewlyUnlocked}
              className="text-text-muted hover:text-text-primary"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {newlyUnlocked.map((id) => {
              const ach = ACHIEVEMENTS.find((a) => a.id === id);
              if (!ach) return null;
              return (
                <AchievementBadge
                  key={id}
                  title={ach.title}
                  description={ach.description}
                  iconName={ach.iconName}
                  isUnlocked={true}
                  animate={true}
                />
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ── Quick Stats Grid ── */}
      <motion.div
        className="grid grid-cols-3 gap-3"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={1}
      >
        {quickStats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div
              key={i}
              className="glass-card flex flex-col items-center justify-center rounded-[--radius-card] p-3 text-center"
            >
              <div className={cn("mb-2 rounded-full p-2", stat.bg)}>
                <Icon className={cn("h-5 w-5", stat.color)} />
              </div>
              <p className="text-lg font-bold text-text-primary leading-none">
                {stat.value}
              </p>
              <p className="text-[10px] text-text-muted uppercase tracking-wider mt-1">
                {stat.label}
              </p>
            </div>
          );
        })}
      </motion.div>

      {/* ── Active Challenge ── */}
      <motion.div
        className="glass-card rounded-[--radius-card] p-4 flex items-center justify-between border-l-2 border-l-warning"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={2}
      >
        <div className="flex items-center gap-3">
          <div className="bg-warning/20 p-2 rounded-xl">
            <Target className="w-6 h-6 text-warning" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider">
              Active Challenge
            </h4>
            <p className="text-sm font-medium text-text-primary truncate max-w-[180px] sm:max-w-xs block">
              Reach 100 total workouts (Centurion)
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-lg font-bold text-warning">
            {totalStats.totalWorkouts}
            <span className="text-xs text-text-muted">/100</span>
          </span>
        </div>
      </motion.div>

      {/* ── AI Workout Generator ── */}
      <motion.div
        className="glass-card flex items-center justify-between rounded-[--radius-card] p-6 bg-gradient-to-r from-primary/20 to-transparent border border-primary/20"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={3}
      >
        <div className="flex gap-4 items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/20">
            <Zap className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">
              AI Workout Generator
            </h3>
            <p className="text-xs text-text-secondary mt-1">
              Get a custom plan in seconds
            </p>
          </div>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => navigate({ to: "/wizard" })}
        >
          Try Now
        </Button>
      </motion.div>

      {/* ── Custom Routines ── */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={4}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-text-primary uppercase tracking-wider">
            Custom Routines
          </h2>
          <Link
            to="/builder"
            className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-hover uppercase tracking-wider"
          >
            <Plus className="h-3 w-3" />
            Build New
          </Link>
        </div>

        {routines.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {routines.map((routine, idx) => (
              <motion.div
                key={routine.id}
                className="glass-card flex flex-col gap-3 rounded-[--radius-card] p-4 relative group"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 + idx * 0.1 }}
              >
                <button
                  onClick={() => deleteRoutine(routine.id, user?.uid)}
                  className="absolute top-3 right-3 p-1.5 rounded-md bg-danger/10 text-danger opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                  title="Delete Routine"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <div className="flex items-start justify-between">
                  <div className="pr-8">
                    <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">
                      {routine.name}
                    </h3>
                    <p className="text-xs text-text-muted mt-1">
                      {routine.exercises.length} Exercises
                    </p>
                  </div>
                </div>

                <Button
                  onClick={async () => {
                    const ids = routine.exercises.map((ex) =>
                      String(ex.exerciseId),
                    );
                    const sessionId = await startWorkout(ids);
                    navigate({
                      to: `/workout/$sessionId`,
                      params: { sessionId },
                    });
                  }}
                  variant="primary"
                  className="w-full mt-2"
                  icon={<Play className="h-4 w-4" />}
                >
                  Start
                </Button>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="mb-6">
            <DataEmptyState
              icon={Plus}
              title="No custom routines yet"
              description="Create your first routine to quick-start your workouts."
              actionLabel="Create Routine"
              onAction={() => navigate({ to: "/builder" })}
            />
          </div>
        )}

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-text-primary uppercase tracking-wider">
            Templates
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {routineTemplates.map((template, idx) => (
            <motion.div
              key={template.name}
              className="glass-card overflow-hidden rounded-[--radius-card] flex flex-col"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 + idx * 0.1 }}
            >
              <div className="relative h-28 w-full overflow-hidden">
                <img
                  src={templateImages[template.name] ?? "/images/full-body.jpg"}
                  alt={template.name}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-bg-card via-bg-card/40 to-transparent" />
                <h3 className="absolute bottom-2 left-4 right-4 text-sm font-bold text-text-primary uppercase tracking-wider">
                  {template.name}
                </h3>
              </div>
              <div className="flex flex-1 flex-col p-4">
                <p className="flex-1 text-xs text-text-muted">
                  {template.description}
                </p>
                <Button
                  onClick={async () => {
                    if (exercises.length === 0) return;
                    const generated = buildTemplateRoutine(template, exercises);
                    await saveRoutine(
                      {
                        id: uid(),
                        name: generated.name,
                        exercises: generated.exercises,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                      },
                      user?.uid,
                    );
                  }}
                  variant="outline"
                  className="w-full mt-4"
                  icon={<Copy className="h-4 w-4" />}
                >
                  Add to My Routines
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── Recent Activity ── */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={5}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-text-primary uppercase tracking-wider">
            Recent Activity
          </h2>
          {recentWorkouts.length > 0 && (
            <Link
              to="/stats"
              className="text-xs font-medium text-primary hover:text-primary-hover uppercase tracking-wider"
            >
              View All
            </Link>
          )}
        </div>

        {recentWorkouts.length > 0 ? (
          <div className="space-y-3">
            {recentWorkouts.map((workout, idx) => (
              <motion.div
                key={workout.id}
                className="glass-card flex flex-row items-center gap-3 rounded-[--radius-card] p-4"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + idx * 0.1 }}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-muted shrink-0">
                  <Dumbbell className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-text-primary truncate">
                    {workout.name}
                  </p>
                  <p className="text-xs text-text-muted">
                    {workout.exerciseCount} Exercises •{" "}
                    {new Date(workout.date).toLocaleDateString("en-US", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </div>
                <Clock className="h-4 w-4 text-text-muted shrink-0" />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="glass-card flex flex-col items-center justify-center gap-3 rounded-[--radius-card] border border-dashed border-border py-12">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-bg-elevated">
              <Target className="h-7 w-7 text-text-muted" />
            </div>
            <p className="text-sm font-medium text-text-muted">
              No Workouts Yet
            </p>
            <p className="text-xs text-text-muted text-center max-w-[200px]">
              Start your first workout and it will appear here
            </p>
          </div>
        )}
      </motion.div>

      {/* ── Quick Links ── */}
      <motion.div
        className="grid grid-cols-2 gap-3 pb-8"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={6}
      >
        <Link
          to="/stats"
          className="glass-card flex flex-col items-center gap-3 rounded-[--radius-card] p-4 transition-colors hover:bg-bg-elevated"
        >
          <TrendingUp className="h-6 w-6 text-success" />
          <span className="text-sm font-medium text-text-primary tracking-wide">
            Statistics
          </span>
        </Link>
        <Link
          to="/body"
          className="glass-card flex flex-col items-center gap-3 rounded-[--radius-card] p-4 transition-colors hover:bg-bg-elevated"
        >
          <Target className="h-6 w-6 text-warning" />
          <span className="text-sm font-medium text-text-primary tracking-wide">
            Body Metrics
          </span>
        </Link>
      </motion.div>
    </div>
  );
}
