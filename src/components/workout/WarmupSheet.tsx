"use client";
import { motion, AnimatePresence } from "framer-motion";
import { X, Flame, Clock } from "lucide-react";
import { useMemo } from "react";
import { calculateWarmupSets, estimateWarmupTime } from "@/services/warmupCalculator";

interface WarmupSheetProps {
  isOpen: boolean;
  onClose: () => void;
  workingWeight: number; // kg, from the first working set
  exerciseName: string;
  exerciseEquipment: string;
}

export default function WarmupSheet({
  isOpen,
  onClose,
  workingWeight,
  exerciseName,
  exerciseEquipment,
}: WarmupSheetProps) {
  const sets = useMemo(
    () => calculateWarmupSets(workingWeight, exerciseEquipment),
    [workingWeight, exerciseEquipment]
  );
  const warmupTime = useMemo(() => estimateWarmupTime(sets), [sets]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm"
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-[95] mx-auto max-w-md rounded-t-3xl border-t border-border bg-bg-card p-5 pb-safe shadow-2xl"
          >
            {/* Handle */}
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-border" />

            {/* Header */}
            <div className="mb-4 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Flame className="h-5 w-5 text-warning" />
                  <h2 className="text-lg font-black uppercase tracking-tight text-text-primary">
                    Warmup Sets
                  </h2>
                </div>
                <p className="mt-0.5 text-xs font-medium text-text-secondary capitalize">
                  {exerciseName} · Target: {workingWeight}kg
                </p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close warmup sheet"
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-bg-elevated text-text-secondary hover:text-text-primary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {sets.length === 0 ? (
              <div className="rounded-2xl border border-border bg-bg-elevated/50 p-6 text-center">
                <p className="text-sm font-medium text-text-secondary">
                  No weighted warmup needed for bodyweight exercises.
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  Do 2-3 minutes of dynamic stretching instead (arm circles, leg
                  swings, hip rotations).
                </p>
              </div>
            ) : (
              <>
                {/* Time estimate */}
                <div className="mb-3 flex items-center gap-2 rounded-xl bg-warning/10 px-3 py-2 text-xs font-semibold text-warning">
                  <Clock className="h-3.5 w-3.5" />
                  Estimated warmup time: ~{warmupTime}s ({Math.ceil(warmupTime / 60)} min)
                </div>

                {/* Sets list */}
                <div className="space-y-2">
                  {sets.map((set, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-xl border border-border bg-bg-elevated/50 p-3"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warning/15 text-xs font-bold text-warning">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-base font-bold tabular-nums text-text-primary">
                            {set.weight}kg
                          </span>
                          <span className="text-xs text-text-secondary">× {set.reps} reps</span>
                        </div>
                        <span className="text-xs text-text-muted uppercase tracking-wider">
                          {set.label} · {set.percentOfWorking}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="mt-4 text-center text-xs text-text-muted">
                  After warmup, rest 2-3 min before your first working set.
                </p>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
