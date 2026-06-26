"use client";
import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "@/router-shim";
import { motion, useReducedMotion } from "framer-motion";
import { Target, TrendingUp, ChevronRight, Zap, Play, Trophy } from "lucide-react";
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
import RecoveryHeatmap from "@/components/RecoveryHeatmap";
import QuickStats from "@/components/home/QuickStats";
import RoutinesList from "@/components/home/RoutinesList";
import PopularTemplates from "@/components/home/PopularTemplates";
import RecentActivity, { type RecentWorkout } from "@/components/home/RecentActivity";
import type { Routine } from "@/db/schema";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: "easeOut" as const },
  }),
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function HomePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const [streak, setStreak] = useState(0);
  const [totalStats, setTotalStats] = useState({
    totalWorkouts: 0,
    totalVolume: 0,
    totalDuration: 0,
  });
  const [recentWorkouts, setRecentWorkouts] = useState<RecentWorkout[]>([]);

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
  const program = useGeneratorStore((s) => s.program);
  const activeChallenges = useChallengesStore((s) => s.activeChallenges);
  const fetchActiveChallenges = useChallengesStore((s) => s.fetchActiveChallenges);

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
          db.workoutSessions.orderBy("date").reverse().filter((s) => s.completed === true).limit(3).toArray(),
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
            prCount: 0,
          }))
        );
      } catch (err) {
        console.error("Failed to load home data:", err);
      }
    }
    loadData();
  }, []);

  const nextWorkout = useMemo(() => {
    if (!program || !program.weeklyDays || program.weeklyDays.length === 0) return null;
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

  const handleSaveRoutine = async (routine: Routine) => {
    await saveRoutine(routine, user?.uid);
  };

  return (
    <div className="space-y-5 pb-4">
      {/* ── SECTION 1: Hero Card ── */}
      <motion.section
        custom={0}
        variants={fadeUp}
        initial={prefersReducedMotion ? false : "hidden"}
        animate="visible"
        className="glass-card relative min-h-[200px] overflow-hidden rounded-2xl border border-border"
      >
        <img
          src="/images/hero-athlete.jpg"
          alt="Athlete training"
          className="absolute inset-0 h-full w-full object-cover opacity-30 mix-blend-overlay"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/80 to-transparent" />
        <motion.div
          className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-primary/10 blur-[60px]"
          animate={prefersReducedMotion ? undefined : { opacity: [0.3, 0.5, 0.3], scale: [1, 1.1, 1] }}
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
              whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
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
          initial={prefersReducedMotion ? false : { opacity: 0, y: -10 }}
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

      {/* ── SECTION 2: Quick Stats ── */}
      <QuickStats
        streak={streak}
        totalWorkouts={totalStats.totalWorkouts}
        totalVolume={totalStats.totalVolume}
      />

      {/* ── SECTION 3: Next Workout ── */}
      {nextWorkout && (
        <motion.section
          custom={2}
          variants={fadeUp}
          initial={prefersReducedMotion ? false : "hidden"}
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
        initial={prefersReducedMotion ? false : "hidden"}
        animate="visible"
        className="glass-card relative overflow-hidden rounded-2xl border border-primary/30 p-5"
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />
        <motion.div
          className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-[40px]"
          animate={prefersReducedMotion ? undefined : { opacity: [0.3, 0.6, 0.3], scale: [1, 1.2, 1] }}
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
            whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
            onClick={() => navigate({ to: "/wizard" })}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-xs font-black uppercase italic tracking-widest text-black transition-transform"
            style={{ boxShadow: "0 0 20px rgba(204,255,0,0.2)" }}
          >
            <Zap className="h-4 w-4 fill-black" />
            Generate Plan
          </motion.button>
        </div>
      </motion.section>

      {/* ── SECTION 5: Active Challenge ── */}
      {activeChallenges.length > 0 && (
        <motion.section
          custom={4}
          variants={fadeUp}
          initial={prefersReducedMotion ? false : "hidden"}
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

      {/* ── SECTION 6: Recovery Status ── */}
      <motion.section
        custom={5}
        variants={fadeUp}
        initial={prefersReducedMotion ? false : "hidden"}
        animate="visible"
      >
        <RecoveryHeatmap />
      </motion.section>

      {/* ── SECTION 7: My Routines ── */}
      <RoutinesList routines={routines} onDelete={deleteRoutine} />

      {/* ── SECTION 8: Popular Templates ── */}
      <PopularTemplates exercises={exercises} onSave={handleSaveRoutine} />

      {/* ── SECTION 9: Recent Activity ── */}
      <RecentActivity workouts={recentWorkouts} />

      {/* ── SECTION 10: Quick Links ── */}
      <motion.section
        custom={9}
        variants={fadeUp}
        initial={prefersReducedMotion ? false : "hidden"}
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
