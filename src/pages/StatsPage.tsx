import { useState, useEffect } from "react";
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
} from "recharts";
import {
  Trophy,
  Flame,
  Dumbbell,
  TrendingUp,
  Calendar,
  Clock,
  ChevronDown,
  Activity,
} from "lucide-react";
import { DataEmptyState } from "@/components/ui/DataEmptyState";
import {
  getWorkoutStreak,
  getPersonalRecords,
  getWeeklyVolume,
  getWeeklyTonnage,
  getExerciseProgress,
  getEstimated1RM,
  getTotalStats,
  getMuscleGroupStats,
} from "@/db";
import { useExerciseStore } from "@/store/useExerciseStore";
import ExerciseProgressChart from "@/components/stats/ExerciseProgressChart";
import { useThemeColors } from "@/hooks/useThemeColors";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.4, ease: "easeOut" as const },
  }),
};

export default function StatsPage() {
  const { exercises, loadExercises } = useExerciseStore();
  const chartColors = useThemeColors();
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
      date: string;
    }[]
  >([]);
  const [weeklyVolume, setWeeklyVolume] = useState<
    { week: string; volume: number }[]
  >([]);
  const [weeklyTonnage, setWeeklyTonnage] = useState<
    { week: string; tonnage: number }[]
  >([]);
  const [muscleGroupStats, setMuscleGroupStats] = useState<
    { muscle: string; volume: number }[]
  >([]);
  const [e1rms, setE1rms] = useState<{ exerciseName: string; e1rm: number }[]>(
    [],
  );

  // Load exercises
  useEffect(() => {
    loadExercises();
  }, [loadExercises]);

  // Load stats data
  useEffect(() => {
    async function loadData() {
      if (exercises.length === 0) return; // Wait for exercises to load

      const [
        streakData,
        statsData,
        prsData,
        volumeData,
        tonnageData,
        muscleData,
      ] = await Promise.all([
        getWorkoutStreak(),
        getTotalStats(),
        getPersonalRecords(),
        getWeeklyVolume(8),
        getWeeklyTonnage(8),
        getMuscleGroupStats(exercises),
      ]);

      setStreak(streakData);
      setTotalStats(statsData);
      setPersonalRecords(prsData);
      setWeeklyVolume(volumeData);
      setWeeklyTonnage(tonnageData);
      setMuscleGroupStats(muscleData);

      // Calculate top 1RMs
      const calculated1RMs = await Promise.all(
        prsData.slice(0, 5).map(async (pr) => {
          const e1rmData = await getEstimated1RM(pr.exerciseId);
          const best =
            e1rmData.length > 0 ? Math.max(...e1rmData.map((d) => d.e1rm)) : 0;
          return {
            exerciseName: pr.exerciseName,
            e1rm: best,
          };
        }),
      );
      setE1rms(
        calculated1RMs
          .filter((item) => item.e1rm > 0)
          .sort((a, b) => b.e1rm - a.e1rm),
      );
    }
    loadData();
  }, [exercises]);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const formatVolume = (kg: number) => {
    if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`;
    return `${kg}kg`;
  };

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-xl font-bold text-text-primary uppercase tracking-wider">
          Statistics
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Track your progress and smash your goals
        </p>
      </motion.div>

      {/* ── Streak Card ── */}
      <motion.div
        className="glass-card relative overflow-hidden rounded-[--radius-card] p-5"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={0}
      >
        <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-warning/10 blur-3xl" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-warning/15">
            <Flame className="h-8 w-8 text-warning" />
          </div>
          <div>
            <p className="text-sm text-text-muted uppercase tracking-wider">
              Commitment Streak 🔥
            </p>
            <p className="text-3xl font-bold text-text-primary">
              {streak}{" "}
              <span className="text-lg text-text-secondary uppercase">
                Days
              </span>
            </p>
          </div>
        </div>
      </motion.div>

      {/* ── Quick Stats Grid ── */}
      <motion.div
        className="grid grid-cols-3 gap-3"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={1}
      >
        <div className="glass-card flex flex-col items-center gap-2 rounded-[--radius-card] p-4 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-muted shrink-0">
            <Dumbbell className="h-5 w-5 text-primary" />
          </div>
          <p className="text-xl font-bold text-text-primary">
            {totalStats.totalWorkouts}
          </p>
          <p className="text-[10px] text-text-muted uppercase tracking-wider">
            Workouts
          </p>
        </div>
        <div className="glass-card flex flex-col items-center gap-2 rounded-[--radius-card] p-4 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10 shrink-0">
            <TrendingUp className="h-5 w-5 text-success" />
          </div>
          <p className="text-xl font-bold text-text-primary">
            {formatVolume(totalStats.totalVolume)}
          </p>
          <p className="text-[10px] text-text-muted uppercase tracking-wider">
            Total Volume
          </p>
        </div>
        <div className="glass-card flex flex-col items-center gap-2 rounded-[--radius-card] p-4 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-muted shrink-0">
            <Clock className="h-5 w-5 text-primary" />
          </div>
          <p className="text-xl font-bold text-text-primary">
            {formatDuration(totalStats.totalDuration)}
          </p>
          <p className="text-[10px] text-text-muted uppercase tracking-wider">
            Training Time
          </p>
        </div>
      </motion.div>

      {/* ── Weekly Volume Chart ── */}
      <motion.div
        className="glass-card rounded-[--radius-card] p-5"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={2}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-text-primary uppercase tracking-wider">
            Weekly Volume & Tonnage
          </h2>
          <Calendar className="h-5 w-5 text-text-muted" />
        </div>

        {weeklyTonnage.length > 0 &&
        weeklyTonnage.some((w) => w.tonnage > 0) ? (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={weeklyTonnage}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={chartColors.grid}
                  vertical={false}
                />
                <XAxis
                  dataKey="week"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: chartColors.textMuted, fontSize: 10 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: chartColors.textMuted, fontSize: 10 }}
                  tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: chartColors.surface,
                    border: `1px solid ${chartColors.border}`,
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: chartColors.text }}
                  itemStyle={{ color: chartColors.text }}
                  formatter={(value) => [
                    `${Number(value).toLocaleString()} kg`,
                    "Tonnage",
                  ]}
                />
                <Bar
                  dataKey="tonnage"
                  fill={chartColors.primary}
                  radius={[4, 4, 0, 0]}
                  animationDuration={800}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <DataEmptyState
            icon={TrendingUp}
            title="No Data Yet"
            description="Log some workouts to start tracking your volume progress."
          />
        )}
      </motion.div>

      {/* ── Muscle Groups Chart ── */}
      <motion.div
        className="glass-card rounded-[--radius-card] p-5"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={3}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-text-primary uppercase tracking-wider">
            Muscle Focus
          </h2>
          <Activity className="h-5 w-5 text-text-muted" />
        </div>

        {muscleGroupStats.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart
                cx="50%"
                cy="50%"
                outerRadius="70%"
                data={muscleGroupStats}
              >
                <PolarGrid stroke={chartColors.grid} />
                <PolarAngleAxis
                  dataKey="muscle"
                  tick={{ fill: chartColors.textMuted, fontSize: 10, textAnchor: "middle" }}
                />
                <PolarRadiusAxis
                  angle={30}
                  domain={[0, "auto"]}
                  tick={false}
                  axisLine={false}
                />
                <Radar
                  name="Volume"
                  dataKey="volume"
                  stroke={chartColors.primary}
                  fill={chartColors.primary}
                  fillOpacity={0.4}
                  animationDuration={1000}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: chartColors.surface,
                    border: `1px solid ${chartColors.border}`,
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  itemStyle={{ color: chartColors.text }}
                  labelStyle={{
                    color: chartColors.text,
                    textTransform: "capitalize",
                  }}
                  formatter={(value) => [
                    `${Number(value).toLocaleString()} kg`,
                    "Volume",
                  ]}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <DataEmptyState
            icon={Activity}
            title="No Data Yet"
            description="Log some workouts to see muscle focus."
          />
        )}
      </motion.div>

      {/* ── Exercise Progress Chart ── */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={3}
      >
        <ExerciseProgressChart />
      </motion.div>

      {/* ── Est. 1RM Records ── */}
      <motion.div
        className="glass-card rounded-[--radius-card] p-5 pb-5"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={4}
      >
        <div className="mb-4 flex items-center gap-2">
          <Dumbbell className="h-5 w-5 text-cyan-400" />
          <h2 className="text-base font-bold text-text-primary uppercase tracking-wider">
            Estimated 1RM (Top 5)
          </h2>
        </div>

        {e1rms.length > 0 ? (
          <div className="space-y-3">
            {e1rms.map((pr, idx) => (
              <motion.div
                key={pr.exerciseName}
                className="glass-card flex items-center gap-3 rounded-xl p-3 border border-border/40"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + idx * 0.1 }}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-400/15">
                  <Dumbbell className="h-5 w-5 text-cyan-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-text-primary capitalize truncate">
                    {pr.exerciseName}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-cyan-400">
                    {pr.e1rm}
                    <span className="text-xs text-text-muted ml-0.5">kg</span>
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <DataEmptyState
            icon={Dumbbell}
            title="No 1RM Data"
            description="Complete sets with weights and reps to estimate your 1RM."
          />
        )}
      </motion.div>

      {/* ── Personal Records ── */}
      <motion.div
        className="glass-card rounded-[--radius-card] p-5 pb-8"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={4}
      >
        <div className="mb-4 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-warning" />
          <h2 className="text-base font-bold text-text-primary uppercase tracking-wider">
            Personal Records (PRs)
          </h2>
        </div>

        {personalRecords.length > 0 ? (
          <div className="space-y-3">
            {personalRecords.slice(0, 5).map((pr, idx) => (
              <motion.div
                key={String(pr.exerciseId)}
                className="glass-card flex items-center gap-3 rounded-xl p-3 border border-border/40"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + idx * 0.1 }}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/15">
                  <Trophy className="h-5 w-5 text-warning" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-text-primary capitalize truncate">
                    {pr.exerciseName}
                  </p>
                  <p className="text-[11px] text-text-muted">
                    {new Date(pr.date).toLocaleDateString("en-US")}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-warning">
                    {pr.maxWeight}
                    <span className="text-xs text-text-muted ml-0.5">kg</span>
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <DataEmptyState
            icon={Trophy}
            title="No Records Yet"
            description="Start your first workout to begin setting personal records!"
          />
        )}
      </motion.div>
    </div>
  );
}
