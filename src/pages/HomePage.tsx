"use client";
import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "@/router-shim";
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
  Trophy,
  Snowflake,
  X,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { getWorkoutStreak, getTotalStats, db } from "@/db";
import { useRoutineStore } from "@/store/useRoutineStore";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useExerciseStore } from "@/store/useExerciseStore";
import { useAchievementsStore } from "@/store/useAchievementsStore";
import { useGeneratorStore } from "@/store/useGeneratorStore";
import { useChallengesStore } from "@/store/useChallengesStore";
import AchievementBadge from "@/components/AchievementBadge";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui-custom/Button";
import { ACHIEVEMENTS } from "@/data/achievements";
import { routineTemplates, buildTemplateRoutine } from "@/data/routineTemplates";
import { uid } from "@/utils/id";
import RecoveryHeatmap from "@/components/RecoveryHeatmap";
import { KineticEmptyState } from "@/components/ui-custom/KineticEmptyState";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: "easeOut" as const },
  }),
};

// ── Dynamic greeting by time of day ──
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function HomePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [streak, setStreak] = useState(0);
  const [totalStats, setTotalStats] = useState({
    totalWorkouts: 0,
    totalVolume: 0,
    totalDuration: 0,
  });
  const [recentWorkouts, setRecentWorkouts] = useState<
    { id: string; name: string; date: string; exerciseCount: number; volume: number; prCount: number }[]
  >([]);

  const routines = useRoutineStore((s) => s.routines);
  const loadRoutines = useRoutineStore((s) => s.loadRoutines);
  const deleteRoutine = useRoutineStore((s) => s.deleteRoutine);
  const saveRoutine = useRoutineStore((s) => s.saveRoutine);
  const startWorkout = useWorkoutStore((s) => s.startWorkout);

  const user = useAuthStore((s) => s.user);

  const exercises = useExerciseStore((s) => s.exercises);
  const loadExercises = useExerciseStore((s) => s.loadExercises);

  const newlyUnlocked = useAchievementsStore((s) => s.newlyUnlocked);
  const clearNewlyUnlocked = useAchievementsStore((s) => s.clearNewlyUnlocked);

  // Program + Challenges for "Next Workout" + active challenge cards
  const program = useGeneratorStore((s) => s.program);
  const activeChallenges = useChallengesStore((s) => s.activeChallenges);
  const fetchActiveChallenges = useChallengesStore((s) => s.fetchActiveChallenges);

  const [showStreakBanner, setShowStreakBanner] = useState(true);
  const [localName, setLocalName] = useState<string>("");

  useEffect(() => {
    const updateName = () => {
      if (typeof window !== "undefined") {
        setLocalName(localStorage.getItem("pulse_user_name") || "");
      }
    };
    updateName();
    window.addEventListener("pulse-user-name-updated", updateName);
    return () => window.removeEventListener("pulse-user-name-updated", updateName);
  }, []);

  useEffect(() => {
    loadRoutines();
    loadExercises();
    fetchActiveChallenges();
  }, [loadRoutines, loadExercises, fetchActiveChallenges]);

  useEffect(() => {
    async function loadData() {
      try {
        const [streakData, statsData, sessions] = await Promise.all([
          getWorkoutStreak(),
          getTotalStats(),
          db.workoutSessions.filter((s) => s.completed === true).reverse().limit(3).toArray(),
        ]);

        setStreak(streakData);
        setTotalStats(statsData);
        setRecentWorkouts(
          sessions.map((s) => ({
            id: s.id,
            name: s.name,
            date: s.date,
            exerciseCount: s.exercises.length,
            volume: s.exercises.reduce(
              (acc, ex) =>
                acc + ex.sets.filter((set) => set.completed).reduce((a, set) => a + set.weight * set.reps, 0),
              0
            ),
            prCount: 0, // TODO: compute PR count per session if needed
          }))
        );
      } catch (err) {
        console.error("Failed to load home data:", err);
      }
    }
    loadData();
  }, []);

  const formatVolume = (kg: number) => {
    if (kg >= 1000000) return `${(kg / 1000000).toFixed(1)}M`;
    if (kg >= 1000) return `${(kg / 1000).toFixed(1)}K`;
    return `${Math.round(kg)}`;
  };

  const templateImages: Record<string, string> = {
    "Push Day (PPL)": "/images/push-day.jpg",
    "Pull Day (PPL)": "/images/pull-day.jpg",
    "Legs Day (PPL)": "/images/legs-day.jpg",
    "Full Body Foundational": "/images/full-body.jpg",
  };

  // ── Next Workout (from active program) ──
  const nextWorkout = useMemo(() => {
    if (!program || !program.weeklyDays || program.weeklyDays.length === 0) return null;
    // Pick day 1 (or could track which day is "next" in storage)
    const day = program.weeklyDays[0];
    return {
      title: day.name.replace(/^Day \d+ — /, ""),
      dayNumber: 1,
      exerciseCount: day.exercises.length,
      estimatedMinutes: day.estimatedMinutes,
    };
  }, [program]);

  const greeting = getGreeting();
  const userName = useMemo(() => {
    if (localName) return localName;
    return user?.displayName?.split(" ")[0] || "ATHLETE";
  }, [localName, user]);

  const handleStartQuickWorkout = async () => {
    try {
      const sessionId = await startWorkout([]);
      navigate({ to: "/workout/$sessionId", params: { sessionId } });
    } catch (e) {
      console.error(e);
    }
  };

  // ── Streak Protection Banner logic ──
  // Show the banner when: streak >= 3, user hasn't trained today, and hasn't
  // already frozen today. Detect "trained today" by comparing the most recent
  // workout's date to today's local date.
  const todayStr = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
  const lastWorkoutDate = recentWorkouts[0]?.date
    ? new Date(recentWorkouts[0].date).toLocaleDateString("en-CA")
    : null;
  const trainedToday = lastWorkoutDate === todayStr;

  // Also check if a freeze session was already added today
  const [frozenToday, setFrozenToday] = useState(false);
  useEffect(() => {
    db.workoutSessions
      .filter((s) => s.isFreeze === true)
      .reverse()
      .limit(1)
      .toArray()
      .then((freezes) => {
        if (freezes.length > 0) {
          const freezeDate = new Date(freezes[0].date).toLocaleDateString("en-CA");
          setFrozenToday(freezeDate === todayStr);
        }
      })
      .catch(() => {});
  }, [todayStr]);

  const showStreakProtection =
    showStreakBanner && streak >= 3 && !trainedToday && !frozenToday;

  const handleFreezeStreak = async () => {
    const dbDate = new Date().toISOString();
    await db.workoutSessions.add({
      id: uid(),
      name: "Streak Freeze ❄️",
      date: dbDate,
      duration: 0,
      exercises: [],
      completed: true,
      isFreeze: true,
      createdAt: dbDate,
      updatedAt: dbDate,
    });
    // Update toast via the store
    const { useToastStore } = await import("@/store/useToastStore");
    useToastStore.getState().addToast("success", "Streak frozen for today! ❄️");
    setFrozenToday(true);
    setShowStreakBanner(false);
  };

  return (
    <div className="space-y-5 pb-4">
      {/* ── SECTION 1: Hero Card ── */}
      <motion.section
        custom={0}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="glass-card relative min-h-[200px] overflow-hidden rounded-2xl border border-border"
      >
        {/* Background image with overlay */}
        <img
          src="/images/hero-athlete.jpg"
          alt="Athlete training"
          className="absolute inset-0 h-full w-full object-cover opacity-30 mix-blend-overlay"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/80 to-transparent" />

        {/* Ambient glow */}
        <motion.div
          className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-primary/10 blur-[60px]"
          animate={{ opacity: [0.3, 0.5, 0.3], scale: [1, 1.1, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="relative z-10 flex h-full flex-col justify-between p-5">
          <div>
            <div className="mb-1 flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary">PULSE</span>
            </div>
            <h1 className="text-2xl font-black italic uppercase tracking-tighter text-white">
              {greeting},
              <br />
              <span className="text-primary">{userName.toUpperCase()}</span>
            </h1>
            <p className="mt-2 max-w-[80%] text-sm text-text-secondary">
              {totalStats.totalWorkouts > 0
                ? "Ready to crush today's workout?"
                : "Start your fitness journey today."}
            </p>
          </div>

          <div className="mt-6 flex justify-end">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate({ to: "/exercises" })}
              className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-xs font-black uppercase italic tracking-widest text-black transition-transform"
              style={{ boxShadow: "0 0 20px rgba(204,255,0,0.3)" }}
            >
              <Play className="h-4 w-4 fill-black" />
              Start Workout
            </motion.button>
          </div>
        </div>
      </motion.section>

      {/* ── Newly Unlocked Achievements Toast ── */}
      {newlyUnlocked.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card relative flex flex-col gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-4"
        >
          <button
            onClick={clearNewlyUnlocked}
            className="absolute right-3 top-3 text-text-secondary hover:text-text-primary"
            aria-label="Dismiss"
          >
            ✕
          </button>
          <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
            🎉 New Achievement Unlocked!
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {newlyUnlocked.slice(0, 2).map((id) => {
              const ach = ACHIEVEMENTS.find((a) => a.id === id);
              if (!ach) return null;
              return (
                <AchievementBadge
                  key={id}
                  title={ach.title}
                  description={ach.description}
                  iconName={ach.iconName}
                  isUnlocked={true}
                  unlockedAt={new Date().toISOString()}
                />
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ── Streak Protection Banner ── */}
      {showStreakProtection && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="glass-card flex items-center gap-3 rounded-xl border border-warning/30 bg-warning/5 p-3"
        >
          <Snowflake className="h-5 w-5 shrink-0 text-warning" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-text-primary">
              Your {streak}-day streak is active.
            </p>
            <p className="text-[10px] text-text-secondary">
              Rest day? Freeze it to protect your streak. ❄️
            </p>
          </div>
          <button
            onClick={handleFreezeStreak}
            className="shrink-0 rounded-lg bg-warning/20 px-3 min-h-[44px] flex items-center justify-center text-xs font-black uppercase tracking-wider text-warning transition-colors hover:bg-warning/30"
          >
            Freeze
          </button>
          <button
            onClick={() => setShowStreakBanner(false)}
            aria-label="Dismiss streak banner"
            className="shrink-0 flex h-11 w-11 items-center justify-center rounded-lg text-text-secondary transition-colors hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}

      {/* ── SECTION 2: Quick Stats (3 compact cards) ── */}
      <motion.section
        custom={1}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-3 gap-3"
      >
        {/* Streak */}
        <div className="glass-card relative flex flex-col items-center justify-center overflow-hidden rounded-xl border border-border p-3">
          <div className="absolute left-0 top-0 h-[2px] w-full bg-warning/50" />
          <span className="mb-1 text-[9px] font-bold uppercase tracking-widest text-text-secondary">
            Streak
          </span>
          <div className="flex items-baseline gap-1">
            <Flame className="h-4 w-4 text-warning" />
            <span className="text-xl font-black italic tabular-nums text-warning">{streak}</span>
          </div>
        </div>

        {/* Workouts */}
        <div className="glass-card relative flex flex-col items-center justify-center overflow-hidden rounded-xl border border-border p-3">
          <div className="absolute left-0 top-0 h-[2px] w-full bg-primary/50" />
          <span className="mb-1 text-[9px] font-bold uppercase tracking-widest text-text-secondary">
            Workouts
          </span>
          <span className="text-xl font-black italic tabular-nums text-primary">
            {totalStats.totalWorkouts}
          </span>
        </div>

        {/* Volume */}
        <div className="glass-card relative flex flex-col items-center justify-center overflow-hidden rounded-xl border border-border p-3">
          <div className="absolute left-0 top-0 h-[2px] w-full bg-success/50" />
          <span className="mb-1 text-[9px] font-bold uppercase tracking-widest text-text-secondary">
            Volume
          </span>
          <span className="text-xl font-black italic tabular-nums text-success">
            {formatVolume(totalStats.totalVolume)}
          </span>
        </div>
      </motion.section>

      {/* ── SECTION 3: Next Workout (if program exists) ── */}
      {nextWorkout && (
        <motion.section
          custom={2}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="glass-card flex items-center justify-between rounded-xl border border-border border-l-4 border-l-primary p-4"
        >
          <div className="min-w-0 flex-1">
            <h3 className="mb-1 text-[10px] font-bold uppercase tracking-widest text-primary">
              Next Workout · Day {nextWorkout.dayNumber}
            </h3>
            <p className="truncate text-sm font-bold text-text-primary capitalize">
              {nextWorkout.title}
            </p>
            <p className="mt-0.5 text-[10px] text-text-secondary">
              {nextWorkout.exerciseCount} exercises · ~{nextWorkout.estimatedMinutes} min
            </p>
          </div>
          <button
            onClick={() => navigate({ to: "/generator-result" })}
            className="flex items-center gap-1 text-primary transition-colors hover:text-primary-light"
          >
            <span className="text-[10px] font-bold uppercase italic">Start</span>
            <ChevronRight className="h-5 w-5" />
          </button>
        </motion.section>
      )}

      {/* ── SECTION 4: AI Generator Promo ── */}
      <motion.section
        custom={3}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="glass-card relative overflow-hidden rounded-2xl border border-primary/30 p-5"
      >
        {/* Gradient background */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />

        {/* Pulse glow */}
        <motion.div
          className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-[40px]"
          animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="relative z-10">
          <div className="mb-3 flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20"
              style={{ boxShadow: "0 0 15px rgba(204,255,0,0.3)" }}
            >
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <h3 className="text-base font-black italic uppercase tracking-tight text-primary">
              AI WORKOUT
              <br />
              GENERATOR
            </h3>
          </div>

          <p className="mb-4 text-xs text-text-secondary">
            Get a personalized workout in seconds based on your fatigue, RPE, and muscle balance.
          </p>

          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate({ to: "/wizard" })}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-xs font-black uppercase italic tracking-widest text-black transition-transform"
            style={{ boxShadow: "0 0 20px rgba(204,255,0,0.2)" }}
          >
            <Zap className="h-4 w-4 fill-black" />
            Generate Plan
          </motion.button>
        </div>
      </motion.section>

      {/* ── SECTION 5: Active Challenge (if any) ── */}
      {activeChallenges.length > 0 && (
        <motion.section
          custom={4}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="glass-card flex items-center justify-between rounded-xl border border-border border-l-4 border-l-warning p-4"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/10">
              <Trophy className="h-5 w-5 text-warning" />
            </div>
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-warning">
                Active Challenge
              </h3>
              <p className="text-sm font-bold text-text-primary">{activeChallenges[0].title}</p>
              <p className="text-[10px] text-text-secondary">
                Goal: {activeChallenges[0].goalKg.toLocaleString()}kg
              </p>
            </div>
          </div>
          <Link
            to="/challenges"
            className="flex items-center gap-1 text-warning transition-colors hover:text-warning/80"
          >
            <ChevronRight className="h-5 w-5" />
          </Link>
        </motion.section>
      )}

      {/* ── SECTION 6: Recovery Status Mini ── */}
      <motion.section
        custom={5}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
      >
        <RecoveryHeatmap />
      </motion.section>

      {/* ── SECTION 7: My Routines ── */}
      <motion.section
        custom={6}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="space-y-3"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-text-primary">
            {t("my_routines")}
          </h2>
          <Link
            to="/builder"
            className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-primary hover:text-primary-light"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("create_routine")}
          </Link>
        </div>

        {routines.length > 0 ? (
          <div className="grid grid-cols-1 gap-3">
            {routines.map((routine, idx) => (
              <motion.div
                key={routine.id}
                className="glass-card group relative flex flex-col gap-3 rounded-2xl border border-border p-4"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 + idx * 0.1 }}
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-bold uppercase tracking-wider text-text-primary">
                      {routine.name}
                    </h3>
                    <p className="text-xs text-text-secondary">
                      {routine.exercises.length} {t("exercises")}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteRoutine(routine.id)}
                    className="text-text-secondary transition-colors hover:text-danger"
                    aria-label="Delete routine"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={async () => {
                    const ids = routine.exercises.map((e) => e.exerciseId);
                    const sessionId = await startWorkout(ids.map(String));
                    navigate({ to: "/workout/$sessionId", params: { sessionId } });
                  }}
                >
                  <Play className="h-3.5 w-3.5" />
                  {t("start")}
                </Button>
              </motion.div>
            ))}
          </div>
        ) : (
          <KineticEmptyState
            variant="routines"
            actionLabel="Create Routine"
            onAction={() => navigate({ to: "/builder" })}
          />
        )}
      </motion.section>

      {/* ── SECTION 8: Popular Templates ── */}
      <motion.section
        custom={7}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="space-y-3"
      >
        <div className="flex items-center gap-2">
          <div className="h-4 w-1 rounded-full bg-secondary" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-text-primary">
            {t("popular_templates")}
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {routineTemplates.map((template, idx) => (
            <motion.div
              key={template.name}
              className="glass-card flex flex-col overflow-hidden rounded-2xl border border-border border-l-4 border-l-secondary/40"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 + idx * 0.1 }}
            >
              <div className="relative aspect-[3/1] overflow-hidden bg-bg-elevated">
                <img
                  src={templateImages[template.name] || "/images/full-body.jpg"}
                  alt={template.name}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-bg-card via-bg-card/40 to-transparent" />
                <h3 className="absolute bottom-2 left-4 right-4 text-sm font-bold uppercase tracking-wider text-text-primary">
                  {template.name}
                </h3>
              </div>
              <div className="p-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-secondary/30 text-secondary hover:bg-secondary/5"
                  icon={<Copy className="h-3.5 w-3.5" />}
                  onClick={async () => {
                    if (exercises.length === 0) return;
                    const built = buildTemplateRoutine(template, exercises);
                    await saveRoutine(
                      {
                        id: uid(),
                        name: template.name,
                        exercises: built.exercises,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                      },
                      user?.uid
                    );
                  }}
                >
                  {t("add_to_my_routines")}
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ── SECTION 9: Recent Activity ── */}
      <motion.section
        custom={8}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-4 w-1 rounded-full bg-success" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-text-primary">
              {t("recent_activity")}
            </h2>
          </div>
          {recentWorkouts.length > 0 && (
            <Link
              to="/stats"
              className="text-xs font-bold uppercase tracking-wider text-success hover:text-success/80"
            >
              {t("view_all")}
            </Link>
          )}
        </div>

        {recentWorkouts.length > 0 ? (
          <div className="space-y-2">
            {recentWorkouts.map((workout, idx) => (
              <motion.div
                key={workout.id}
                className="glass-card flex items-center gap-3 rounded-xl border border-border border-l-4 border-l-success/30 p-3"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + idx * 0.1 }}
              >
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                    idx === 0
                      ? "bg-success/10"
                      : idx === 1
                        ? "bg-success/5"
                        : "bg-success/5"
                  )}
                >
                  <Dumbbell
                    className={cn(
                      "h-4 w-4",
                      idx === 0
                        ? "text-success"
                        : "text-success/70"
                    )}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold capitalize text-text-primary">
                    {workout.name}
                  </p>
                  <p className="text-[10px] text-text-secondary">
                    {workout.exerciseCount} exercises · {formatVolume(workout.volume)}kg ·{" "}
                    {new Date(workout.date).toLocaleDateString("en-US", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </div>
                {workout.prCount > 0 && (
                  <div className="flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5">
                    <Trophy className="h-3 w-3 text-warning" />
                    <span className="text-[9px] font-bold text-warning">{workout.prCount} PRs</span>
                  </div>
                )}
                <Clock className="h-4 w-4 shrink-0 text-text-secondary" />
              </motion.div>
            ))}
          </div>
        ) : (
          <KineticEmptyState
            variant="workouts"
            actionLabel="Start Workout"
            onAction={handleStartQuickWorkout}
          />
        )}
      </motion.section>

      {/* ── SECTION 10: Quick Links ── */}
      <motion.section
        custom={9}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 gap-3 pb-4"
      >
        <Link
          to="/stats"
          className="glass-card flex flex-col items-center gap-2 rounded-2xl border border-border p-4 transition-colors hover:bg-bg-elevated"
        >
          <TrendingUp className="h-5 w-5 text-success" />
          <span className="text-xs font-bold uppercase tracking-wider text-text-primary">
            {t("stats")}
          </span>
        </Link>
        <Link
          to="/body"
          className="glass-card flex flex-col items-center gap-2 rounded-2xl border border-border p-4 transition-colors hover:bg-bg-elevated"
        >
          <Target className="h-5 w-5 text-warning" />
          <span className="text-xs font-bold uppercase tracking-wider text-text-primary">
            {t("body_metrics")}
          </span>
        </Link>
      </motion.section>
    </div>
  );
}
