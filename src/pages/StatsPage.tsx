"use client";
import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Cell,
} from "recharts";
import {
  Trophy,
  Flame,
  Dumbbell,
  TrendingUp,
  Clock,
  Activity,
  AlertTriangle,
  ChevronRight,
  Calendar,
} from "lucide-react";
import { Link } from "@/router-shim";
import { KineticEmptyState } from "@/components/ui-custom/KineticEmptyState";
import { Skeleton } from "@/components/ui-custom/Skeleton";
import {
  db,
  type WorkoutSession,
  getWorkoutStreak,
  getPersonalRecords,
  getWeeklyVolume,
  getTotalStats,
  getMuscleGroupStats,
} from "@/db";
import { useExerciseStore } from "@/store/useExerciseStore";
import ExerciseProgressChart from "@/components/stats/ExerciseProgressChart";
import MuscleVolumeMap from "@/components/stats/MuscleVolumeMap";
import { useThemeColors } from "@/hooks/useThemeColors";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: "easeOut" as const },
  }),
};

export default function StatsPage() {
  const exercises = useExerciseStore((s) => s.exercises);
  const exercisesCount = exercises.length;
  const loadExercises = useExerciseStore((s) => s.loadExercises);
  const chartColors = useThemeColors();

  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [streak, setStreak] = useState(0);
  const [totalStats, setTotalStats] = useState({
    totalWorkouts: 0,
    totalVolume: 0,
    totalDuration: 0,
  });
  const [personalRecords, setPersonalRecords] = useState<
    {
      exerciseId: string | number;
      exerciseName: string;
      maxWeight: number;
      max1RM: number;
      weight: number;
      reps: number;
      date: string;
    }[]
  >([]);
  const [weeklyVolume, setWeeklyVolume] = useState<{ week: string; volume: number }[]>([]);
  const [muscleGroupStats, setMuscleGroupStats] = useState<{ muscle: string; volume: number }[]>(
    []
  );
  const [isStatsLoading, setIsStatsLoading] = useState(true);

  useEffect(() => {
    loadExercises();
  }, [loadExercises]);

  useEffect(() => {
    async function loadData() {
      if (exercises.length === 0) return;
      setIsStatsLoading(true);
      try {
        const completedSessions = await db.workoutSessions
          .filter((s) => s.completed === true)
          .toArray();
        setSessions(completedSessions);

        const [streakData, statsData, prsData, volumeData, muscleData] = await Promise.all([
          getWorkoutStreak(completedSessions),
          getTotalStats(completedSessions),
          getPersonalRecords(completedSessions),
          getWeeklyVolume(8, completedSessions),
          getMuscleGroupStats(exercises, completedSessions),
        ]);

        setStreak(streakData);
        setTotalStats(statsData);
        setPersonalRecords(prsData);
        setWeeklyVolume(volumeData);
        setMuscleGroupStats(muscleData);
      } catch (err) {
        console.error("Failed to load stats data:", err);
      } finally {
        setIsStatsLoading(false);
      }
    }
    loadData();
  }, [exercisesCount]);

  // ── Derived data ──

  const formatVolume = (kg: number) => {
    if (kg >= 1000000) return `${(kg / 1000000).toFixed(1)}M`;
    if (kg >= 1000) return `${(kg / 1000).toFixed(1)}K`;
    return `${Math.round(kg)}`;
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return { hours, mins };
  };

  const dur = formatDuration(totalStats.totalDuration);

  // Weekly volume change %
  const weeklyChange = useMemo(() => {
    if (weeklyVolume.length < 2) return 0;
    const last = weeklyVolume[weeklyVolume.length - 1]?.volume || 0;
    const prev = weeklyVolume[weeklyVolume.length - 2]?.volume || 0;
    if (prev === 0) return 0;
    return Math.round(((last - prev) / prev) * 100);
  }, [weeklyVolume]);

  // Radar chart data (top 6 muscles)
  const radarData = useMemo(() => {
    const top = muscleGroupStats.slice(0, 6);
    const maxVol = top.length > 0 ? top[0].volume : 1;
    return top.map((m) => ({
      muscle: m.muscle,
      volume: Math.round((m.volume / maxVol) * 100),
    }));
  }, [muscleGroupStats]);

  // Imbalance detection (lowest muscle < 30% of max)
  const imbalanceMuscle = useMemo(() => {
    if (radarData.length < 3) return null;
    const min = radarData[radarData.length - 1];
    if (min.volume < 30) return min.muscle;
    return null;
  }, [radarData]);

  // Calendar heatmap data (last 84 days = 12 weeks)
  const calendarData = useMemo(() => {
    const days: { date: Date; volume: number; isPR: boolean }[] = [];
    const now = new Date();
    for (let i = 83; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      days.push({ date: d, volume: 0, isPR: false });
    }
    // Fill from sessions
    for (const s of sessions) {
      const sd = new Date(s.date);
      sd.setHours(0, 0, 0, 0);
      const day = days.find((d) => d.date.getTime() === sd.getTime());
      if (day) {
        const vol = s.exercises.reduce(
          (acc, ex) =>
            acc +
            ex.sets.filter((set) => set.completed).reduce((a, set) => a + set.weight * set.reps, 0),
          0
        );
        day.volume += vol;
      }
    }
    return days;
  }, [sessions]);

  // 7-day mini heatmap
  const last7Days = calendarData.slice(-7);

  if (isStatsLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-10 w-32 rounded-xl" />
          <Skeleton className="mt-2 h-4 w-40 rounded" />
        </div>
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-4">
      {/* Page Header */}
      <motion.div
        custom={0}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="flex flex-col gap-1"
      >
        <h1 className="text-3xl font-black italic uppercase tracking-tighter text-text-primary tabular-nums">
          STATS
        </h1>
        <p className="text-xs font-bold uppercase tracking-widest text-text-secondary">
          Track your progress
        </p>
      </motion.div>

      {/* Empty state */}
      {totalStats.totalWorkouts === 0 && (
        <motion.div custom={1} variants={fadeUp} initial="hidden" animate="visible">
          <KineticEmptyState
            variant="prs"
            title="NO STATS YET"
            description="Complete your first workout to see detailed analytics, charts, and personal records."
          />
        </motion.div>
      )}

      {/* Section 1: Hero Streak Card */}
      <motion.section
        custom={1}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="glass-card relative overflow-hidden rounded-2xl border border-warning/20 p-5"
      >
        {/* Pulsing glow */}
        <motion.div
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-warning/10 blur-[80px]"
          animate={{ opacity: [0.4, 0.7, 0.4], scale: [1, 1.1, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="relative z-10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-warning/30 bg-bg-elevated">
              <Flame className="h-7 w-7 text-warning" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">
                Current Streak
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-black italic tabular-nums text-text-primary">
                  {streak}
                </span>
                <span className="text-base font-black italic text-warning">DAYS</span>
              </div>
            </div>
          </div>

          {/* Mini 7-day heatmap */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] font-bold uppercase tracking-widest text-text-secondary text-right">
              Last 7
            </span>
            <div className="flex gap-1">
              {last7Days.map((day, i) => {
                const isToday = i === 6;
                const intensity =
                  day.volume === 0 ? 0 : day.volume < 500 ? 0.3 : day.volume < 2000 ? 0.6 : 1;
                return (
                  <div
                    key={i}
                    className="h-7 w-7 rounded border"
                    style={{
                      backgroundColor:
                        intensity === 0
                          ? "rgba(255,255,255,0.03)"
                          : `rgba(255,171,0,${intensity * 0.8})`,
                      borderColor:
                        intensity === 0
                          ? "rgba(255,255,255,0.06)"
                          : `rgba(255,171,0,${intensity})`,
                      boxShadow: isToday ? "0 0 8px rgba(255,171,0,0.6)" : "none",
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </motion.section>

      {/* Section 2: Quick Stats Grid */}
      <motion.section
        custom={2}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-3 gap-3"
      >
        {/* Workouts */}
        <div className="glass-card flex flex-col gap-2 rounded-2xl border border-border p-3">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-wider text-text-secondary">
              Workouts
            </span>
            <Dumbbell className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black italic tabular-nums text-primary">
              {totalStats.totalWorkouts}
            </span>
          </div>
        </div>

        {/* Volume */}
        <div className="glass-card flex flex-col gap-2 rounded-2xl border border-border p-3">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-wider text-text-secondary">
              Volume
            </span>
            <TrendingUp className="h-3.5 w-3.5 text-secondary" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black italic tabular-nums text-secondary">
              {formatVolume(totalStats.totalVolume)}
            </span>
            <span className="text-[9px] font-bold uppercase text-text-secondary">kg</span>
          </div>
        </div>

        {/* Training Time */}
        <div className="glass-card flex flex-col gap-2 rounded-2xl border border-border p-3">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-wider text-text-secondary">
              Time
            </span>
            <Clock className="h-3.5 w-3.5 text-info" />
          </div>
          <div className="flex items-baseline gap-1">
            {dur.hours > 0 && (
              <>
                <span className="text-2xl font-black italic tabular-nums text-info">
                  {dur.hours}
                </span>
                <span className="text-[9px] font-bold uppercase text-text-secondary">h</span>
              </>
            )}
            <span className="text-2xl font-black italic tabular-nums text-info">{dur.mins}</span>
            <span className="text-[9px] font-bold uppercase text-text-secondary">m</span>
          </div>
        </div>
      </motion.section>

      {/* Section 3: Weekly Volume Bar Chart */}
      {weeklyVolume.length > 0 && (
        <motion.section
          custom={3}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="glass-card flex flex-col gap-4 rounded-2xl border border-border p-5"
        >
          <div className="flex items-end justify-between border-b border-border pb-3">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-sm font-bold uppercase italic text-text-primary">
                Weekly Volume
              </h2>
              <span className="text-[9px] font-bold uppercase tracking-widest text-text-secondary">
                Last 8 Weeks
              </span>
            </div>
            {weeklyChange !== 0 && (
              <span
                className={`text-sm font-bold italic tabular-nums ${weeklyChange > 0 ? "text-success" : "text-danger"}`}
              >
                {weeklyChange > 0 ? "+" : ""}
                {weeklyChange}%
              </span>
            )}
          </div>

          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={weeklyVolume} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartColors.primary} stopOpacity={0.9} />
                  <stop offset="100%" stopColor={chartColors.primary} stopOpacity={0.2} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="week"
                tick={{ fill: chartColors.textSecondary, fontSize: 9 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
                contentStyle={{
                  background: chartColors.surface,
                  border: `1px solid ${chartColors.border}`,
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: chartColors.textSecondary }}
                formatter={(v: number) => [`${Math.round(v)} kg`, "Volume"]}
              />
              <Bar dataKey="volume" fill="url(#barGradient)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.section>
      )}

      {/* Section 4: Muscle Volume Map (Interactive AnatomyMap) */}
      {muscleGroupStats.length > 0 && (
        <motion.div custom={4} variants={fadeUp} initial="hidden" animate="visible">
          <MuscleVolumeMap sessions={sessions} exercises={exercises} />
        </motion.div>
      )}

      {/* Section 5: Exercise Progress (improved) */}
      {personalRecords.length > 0 && (
        <motion.section
          custom={5}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="glass-card flex flex-col gap-3 rounded-2xl border border-border p-5"
        >
          <div className="flex items-center justify-between border-b border-border pb-2">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-sm font-bold uppercase italic text-text-primary">
                Exercise Progress
              </h2>
              <span className="text-[9px] font-bold uppercase tracking-widest text-text-secondary">
                Weight & 1RM Over Time
              </span>
            </div>
            <Activity className="h-4 w-4 text-text-secondary" />
          </div>
          <ExerciseProgressChart exercises={exercises} sessions={sessions} />
        </motion.section>
      )}

      {/* Section 6: Personal Records */}
      {personalRecords.length > 0 && (
        <motion.section
          custom={6}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="flex flex-col gap-3"
        >
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h2 className="text-sm font-bold uppercase italic text-text-primary">
              Personal Records
            </h2>
            <span className="text-[9px] font-bold uppercase tracking-widest text-text-secondary">
              {personalRecords.length} total
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {personalRecords.slice(0, 5).map((pr, i) => (
              <div
                key={i}
                className="glass-card group flex items-center justify-between rounded-xl border border-border border-l-2 border-l-transparent p-3 transition-all hover:border-l-primary hover:bg-white/[0.03]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
                    <Trophy className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase text-text-primary">
                      {pr.exerciseName}
                    </h3>
                    <span className="text-[10px] font-medium text-text-secondary">
                      {new Date(pr.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black italic tabular-nums text-text-primary">
                    {pr.maxWeight}
                    <span className="ml-1 text-[10px] font-bold uppercase text-text-secondary">
                      kg
                    </span>
                  </div>
                  <span className="inline-block rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                    1RM: {Math.round(pr.max1RM)}kg
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Section 7: Calendar Heatmap (GitHub-style) */}
      {calendarData.some((d) => d.volume > 0) && (
        <motion.section
          custom={7}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="glass-card flex flex-col gap-3 overflow-hidden rounded-2xl border border-border p-5"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase italic text-text-primary">Consistency</h2>
            <div className="flex items-center gap-3">
              <Link
                to="/calendar"
                className="flex items-center gap-1.5 rounded-lg bg-bg-elevated px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-primary transition-colors hover:bg-bg-hover active:scale-95"
              >
                <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                Calendar
              </Link>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold uppercase text-text-secondary">Less</span>
                <div className="flex gap-0.5">
                  <div className="h-2.5 w-2.5 rounded-sm border border-border bg-bg-elevated" />
                  <div className="h-2.5 w-2.5 rounded-sm bg-primary/30" />
                  <div className="h-2.5 w-2.5 rounded-sm bg-primary/60" />
                  <div className="h-2.5 w-2.5 rounded-sm bg-primary" />
                </div>
                <span className="text-[9px] font-bold uppercase text-text-secondary">More</span>
              </div>
            </div>
          </div>

          {/* Heatmap grid — 12 weeks × 7 days */}
          <div className="flex flex-col gap-1 overflow-x-auto no-scrollbar">
            {Array.from({ length: 7 }).map((_, dayIdx) => (
              <div key={dayIdx} className="flex gap-1">
                {Array.from({ length: 12 }).map((_, weekIdx) => {
                  const cellIdx = weekIdx * 7 + dayIdx;
                  const day = calendarData[cellIdx];
                  if (!day) return <div key={weekIdx} className="h-3 w-3" />;
                  const intensity =
                    day.volume === 0
                      ? 0
                      : day.volume < 500
                        ? 0.3
                        : day.volume < 2000
                          ? 0.6
                          : 1;
                  return (
                    <div
                      key={weekIdx}
                      className="h-3 w-3 rounded-sm"
                      style={{
                        backgroundColor:
                          intensity === 0
                            ? "rgba(255,255,255,0.03)"
                            : `rgba(204,255,0,${intensity * 0.9})`,
                        boxShadow:
                          intensity === 1 ? "0 0 4px rgba(204,255,0,0.4)" : "none",
                      }}
                      title={`${day.date.toDateString()} — ${Math.round(day.volume)}kg`}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          <div className="mt-1 flex justify-between text-[9px] font-bold uppercase tracking-widest text-text-secondary">
            <span>12 weeks ago</span>
            <span>Today</span>
          </div>
        </motion.section>
      )}
    </div>
  );
}
