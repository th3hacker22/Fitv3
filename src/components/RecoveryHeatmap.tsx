"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { db } from "@/db";
import { useExerciseStore } from "@/store/useExerciseStore";
import {
  calculateMuscleRecovery,
  getRecoverySummary,
  getRecoveryColor,
  type MuscleRecoveryStatus,
} from "@/services/recoveryTracker";
import AnatomyMap from "@/components/AnatomyMap";

export default function RecoveryHeatmap() {
  const { exercises } = useExerciseStore();
  const [recovery, setRecovery] = useState<Map<string, MuscleRecoveryStatus>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const sessions = await db.workoutSessions
          .filter((s) => s.completed === true)
          .reverse()
          .limit(50)
          .toArray();
        if (!mounted) return;
        const rec = calculateMuscleRecovery(sessions, exercises);
        setRecovery(rec);
      } catch (err) {
        console.warn("Failed to load recovery data:", err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [exercises]);

  const summary = getRecoverySummary(recovery);
  const justTrainedMuscles = Array.from(recovery.values()).filter((s) => s.status === "just-trained").map((s) => s.muscleId);
  const recoveringMuscles = Array.from(recovery.values()).filter((s) => s.status === "recovering").map((s) => s.muscleId);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-bg-card p-6 animate-pulse">
        <div className="h-6 w-48 bg-bg-elevated rounded mb-4" />
        <div className="h-40 bg-bg-elevated rounded" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-bg-card p-5"
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <h2 className="text-sm font-black uppercase tracking-wider text-text-primary">
            Recovery Status
          </h2>
        </div>
        <span className="text-xs font-bold text-text-secondary">
          {summary.recovered + summary.neverTrained} ready
        </span>
      </div>

      {/* Summary stats */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-success/10 p-2.5 text-center border border-success/20">
          <CheckCircle2 className="mx-auto h-4 w-4 text-success mb-1" />
          <div className="text-lg font-black text-success tabular-nums">{summary.recovered}</div>
          <div className="text-[10px] font-bold text-success/70 uppercase">Ready</div>
        </div>
        <div className="rounded-xl bg-warning/10 p-2.5 text-center border border-warning/20">
          <Clock className="mx-auto h-4 w-4 text-warning mb-1" />
          <div className="text-lg font-black text-warning tabular-nums">{summary.recovering}</div>
          <div className="text-[10px] font-bold text-warning/70 uppercase">Recovering</div>
        </div>
        <div className="rounded-xl bg-danger/10 p-2.5 text-center border border-danger/20">
          <AlertCircle className="mx-auto h-4 w-4 text-danger mb-1" />
          <div className="text-lg font-black text-danger tabular-nums">{summary.justTrained}</div>
          <div className="text-[10px] font-bold text-danger/70 uppercase">Just Trained</div>
        </div>
      </div>

      {/* Legend */}
      <div className="mb-3 flex items-center justify-center gap-4 text-[10px] font-bold uppercase tracking-wider">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-danger" /> Just Trained
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-warning" /> Recovering
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-success" /> Ready
        </span>
      </div>

      {/* AnatomyMap with recovery overlay */}
      <div className="rounded-2xl bg-bg-elevated/30 p-2 border border-border/50 min-h-[280px]">
        <AnatomyMap
          readOnly
          highlightedMuscles={justTrainedMuscles}
          secondaryHighlightedMuscles={recoveringMuscles}
        />
      </div>

      {/* Detailed list (collapsible) */}
      <details className="mt-4 group">
        <summary className="cursor-pointer text-xs font-bold text-text-secondary uppercase tracking-wider hover:text-text-primary">
          View detailed status →
        </summary>
        <div className="mt-3 max-h-48 overflow-y-auto space-y-1.5 no-scrollbar">
          {Array.from(recovery.values())
            .filter((s) => s.status !== "never-trained")
            .sort((a, b) => (a.hoursSinceTrained || 0) - (b.hoursSinceTrained || 0))
            .map((status) => (
              <div
                key={status.muscleId}
                className="flex items-center justify-between rounded-lg bg-bg-elevated/50 px-3 py-2"
              >
                <span className="text-xs font-semibold text-text-primary capitalize">
                  {status.muscleId.replace(/-/g, " ")}
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: getRecoveryColor(status) }}
                  />
                  <span className="text-xs text-text-secondary">{status.label}</span>
                </div>
              </div>
            ))}
        </div>
      </details>
    </motion.div>
  );
}
