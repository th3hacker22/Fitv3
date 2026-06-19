"use client";
import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useExerciseStore } from "@/store/useExerciseStore";
import { getExerciseProgress, getEstimated1RM, type WorkoutSession } from "@/db";
import { useThemeColors } from "@/hooks/useThemeColors";
import { TrendingUp, ChevronDown } from "lucide-react";

interface ExerciseProgressChartProps {
  preloadedSessions?: WorkoutSession[];
}

export default function ExerciseProgressChart({ preloadedSessions }: ExerciseProgressChartProps) {
  const { exercises } = useExerciseStore();
  const colors = useThemeColors();
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>("");
  const [progressData, setProgressData] = useState<
    { date: string; maxWeight: number; e1rm: number }[]
  >([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const sortedExercises = useMemo(() => {
    return [...exercises].sort((a, b) => a.name.localeCompare(b.name));
  }, [exercises]);

  useEffect(() => {
    if (sortedExercises.length > 0 && !selectedExerciseId) {
      setSelectedExerciseId(sortedExercises[0].id);
    }
  }, [sortedExercises, selectedExerciseId]);

  useEffect(() => {
    async function loadData() {
      if (!selectedExerciseId) return;
      const maxWeightData = await getExerciseProgress(selectedExerciseId, preloadedSessions);
      const e1rmData = await getEstimated1RM(selectedExerciseId, preloadedSessions);

      const mergedMap = new Map<string, { date: string; maxWeight: number; e1rm: number }>();

      maxWeightData.forEach((d) => {
        mergedMap.set(d.date, { date: d.date, maxWeight: d.maxWeight, e1rm: 0 });
      });

      e1rmData.forEach((d) => {
        if (mergedMap.has(d.date)) {
          mergedMap.get(d.date)!.e1rm = d.e1rm;
        } else {
          mergedMap.set(d.date, { date: d.date, maxWeight: 0, e1rm: d.e1rm });
        }
      });

      const merged = Array.from(mergedMap.values()).sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      setProgressData(merged);
    }
    loadData();
  }, [selectedExerciseId, preloadedSessions]);

  const selectedExercise = sortedExercises.find((e) => e.id === selectedExerciseId);

  // Calculate trend (improvement %)
  const trend = useMemo(() => {
    if (progressData.length < 2) return null;
    const first = progressData[0].e1rm || progressData[0].maxWeight;
    const last = progressData[progressData.length - 1].e1rm || progressData[progressData.length - 1].maxWeight;
    if (first === 0) return null;
    return Math.round(((last - first) / first) * 100);
  }, [progressData]);

  if (progressData.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center text-text-secondary">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-bg-elevated mb-2">
          <TrendingUp className="h-5 w-5 text-text-muted" />
        </div>
        <div className="text-xs font-bold uppercase tracking-wider">No Data Found</div>
        <div className="text-[10px] text-text-muted mt-1">Complete some sets to see your progress</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Exercise selector dropdown */}
      <div className="relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex w-full items-center justify-between rounded-xl border border-border bg-bg-elevated/50 px-3 py-2.5 text-sm text-text-primary transition-colors hover:border-primary/30"
        >
          <span className="truncate font-medium capitalize">{selectedExercise?.name || "Select exercise"}</span>
          <ChevronDown className={`h-4 w-4 text-text-secondary transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
        </button>

        {dropdownOpen && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-border bg-bg-card shadow-xl no-scrollbar"
          >
            {sortedExercises.map((ex) => (
              <button
                key={ex.id}
                onClick={() => {
                  setSelectedExerciseId(ex.id);
                  setDropdownOpen(false);
                }}
                className={`flex w-full items-center px-3 py-2 text-left text-sm transition-colors hover:bg-primary/5 ${
                  ex.id === selectedExerciseId ? "bg-primary/10 text-primary font-bold" : "text-text-primary"
                }`}
              >
                <span className="capitalize truncate">{ex.name}</span>
              </button>
            ))}
          </motion.div>
        )}
      </div>

      {/* Trend indicator */}
      {trend !== null && trend !== 0 && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">Trend:</span>
          <span className={`flex items-center gap-1 text-xs font-bold ${trend > 0 ? "text-success" : "text-danger"}`}>
            <TrendingUp className={`h-3 w-3 ${trend < 0 ? "rotate-180" : ""}`} />
            {trend > 0 ? "+" : ""}{trend}%
          </span>
        </div>
      )}

      {/* Chart */}
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={progressData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
            <defs>
              <linearGradient id="e1rmGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.primary} stopOpacity={0.3} />
                <stop offset="100%" stopColor={colors.primary} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
            <XAxis
              dataKey="date"
              stroke={colors.textMuted}
              fontSize={9}
              tickMargin={8}
              tickFormatter={(val) => {
                const d = new Date(val);
                return `${d.getMonth() + 1}/${d.getDate()}`;
              }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              stroke={colors.textMuted}
              fontSize={9}
              tickFormatter={(val) => `${val}kg`}
              axisLine={false}
              tickLine={false}
            />
            <RechartsTooltip
              contentStyle={{
                backgroundColor: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: "8px",
                fontSize: "12px",
              }}
              itemStyle={{ fontSize: "11px", color: colors.text }}
              labelStyle={{ color: colors.textMuted, fontSize: "10px", marginBottom: "4px" }}
              labelFormatter={(val) => {
                const d = new Date(val);
                return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
              }}
            />
            <Legend
              iconType="circle"
              wrapperStyle={{ fontSize: "10px", marginTop: "5px", paddingTop: "5px" }}
            />
            <Line
              type="monotone"
              name="Est. 1RM"
              dataKey="e1rm"
              stroke={colors.primary}
              strokeWidth={3}
              dot={{ fill: colors.primary, r: 4, strokeWidth: 0 }}
              activeDot={{ r: 6, fill: colors.primary, strokeWidth: 2, stroke: "#050505" }}
            />
            <Line
              type="monotone"
              name="Max Weight"
              dataKey="maxWeight"
              stroke="#38bdf8"
              strokeWidth={2}
              strokeDasharray="4 2"
              dot={{ fill: "#38bdf8", r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: "#38bdf8", strokeWidth: 2, stroke: "#050505" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
