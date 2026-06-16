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
import { getExerciseProgress, getEstimated1RM } from "@/db";
import { useThemeColors } from "@/hooks/useThemeColors";

export default function ExerciseProgressChart() {
  const { exercises } = useExerciseStore();
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>("");
  const [progressData, setProgressData] = useState<
    { date: string; maxWeight: number; e1rm: number }[]
  >([]);

  // Find exercises that might have data (e.g. barbell stuff)
  // For simplicity, we just list all exercises in dropdown, but perhaps sorted alphabetically.
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
      const maxWeightData = await getExerciseProgress(selectedExerciseId);
      const e1rmData = await getEstimated1RM(selectedExerciseId);

      // Merge data by date
      const mergedMap = new Map<
        string,
        { date: string; maxWeight: number; e1rm: number }
      >();

      maxWeightData.forEach((d) => {
        mergedMap.set(d.date, {
          date: d.date,
          maxWeight: d.maxWeight,
          e1rm: 0,
        });
      });

      e1rmData.forEach((d) => {
        if (mergedMap.has(d.date)) {
          mergedMap.get(d.date)!.e1rm = d.e1rm;
        } else {
          mergedMap.set(d.date, { date: d.date, maxWeight: 0, e1rm: d.e1rm });
        }
      });

      const merged = Array.from(mergedMap.values()).sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      );
      setProgressData(merged);
    }
    loadData();
  }, [selectedExerciseId]);

  return (
    <div className="glass-card rounded-3xl p-5 border border-border/50">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
        <h3 className="text-sm font-black text-text-primary uppercase tracking-wider">
          Exercise Progress
        </h3>
        <select
          value={selectedExerciseId}
          onChange={(e) => setSelectedExerciseId(e.target.value)}
          className="bg-bg-elevated border border-border rounded-xl px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary max-w-xs overflow-hidden"
        >
          {sortedExercises.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.name}
            </option>
          ))}
        </select>
      </div>

      {progressData.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-text-muted">
          <div className="text-sm font-bold uppercase tracking-wider mb-1">
            No Data Found
          </div>
          <div className="text-xs">
            Complete some sets to see your progress here.
          </div>
        </div>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={progressData}
              margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#27272a"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                stroke="#71717a"
                fontSize={10}
                tickMargin={10}
                tickFormatter={(val) => {
                  const d = new Date(val);
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                }}
              />
              <YAxis
                stroke="#71717a"
                fontSize={10}
                tickFormatter={(val) => `${val}kg`}
              />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: "8px",
                }}
                itemStyle={{ fontSize: "12px" }}
                labelStyle={{
                  color: "#a1a1aa",
                  fontSize: "10px",
                  marginBottom: "4px",
                }}
              />
              <Legend
                iconType="circle"
                wrapperStyle={{ fontSize: "12px", marginTop: "10px" }}
              />
              <Line
                type="monotone"
                name="Est. 1RM"
                dataKey="e1rm"
                stroke="#caff33"
                strokeWidth={3}
                dot={{ fill: "#caff33", r: 4 }}
                activeDot={{ r: 6, fill: "#caff33" }}
              />
              <Line
                type="monotone"
                name="Max Weight"
                dataKey="maxWeight"
                stroke="#38bdf8"
                strokeWidth={2}
                dot={{ fill: "#38bdf8", r: 3 }}
                activeDot={{ r: 5, fill: "#38bdf8" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
