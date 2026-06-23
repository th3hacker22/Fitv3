"use client";
import { memo } from "react";
import { motion } from "framer-motion";
import { Check, Trash2 } from "lucide-react";
import { cn } from "@/utils/cn";
import type { WorkoutSet } from "@/store/useWorkoutStore";
import { rpeColorClass, rpeLabel } from "@/services/smartRest";
import { getSetTypeMeta } from "@/config/setTypes";

interface SetRowProps {
  set: WorkoutSet;
  setIndex: number;
  exerciseIndex: number;
  ghostWeight?: number;
  ghostReps?: number;
  onToggleComplete: () => void;
  onUpdateWeight: (value: string) => void;
  onUpdateReps: (value: string) => void;
  onUpdateRpe?: (value: string) => void;
  /** Tap-to-cycle the set type chip (11 types). See src/config/setTypes.ts. */
  onCycleSetType?: () => void;
  onRemoveSet?: () => void;
}

const SetRow = memo(
  ({
    set,
    setIndex,
    ghostWeight,
    ghostReps,
    onToggleComplete,
    onUpdateWeight,
    onUpdateReps,
    onUpdateRpe,
    onCycleSetType,
    onRemoveSet,
  }: SetRowProps) => {
    const isCompleted = set.completed;

    // ---- Set type metadata (badge + color) -----------------------------------
    const typeMeta = getSetTypeMeta(set.setType);
    const isNonDefaultType = typeMeta.id !== "normal";

    // ---- RPE-based color coding ----------------------------------------------
    // RPE scale (1-10): ≤7 easy (green), 8 moderate (yellow), 9 hard (orange),
    // 10 max effort (red). Powered by src/services/smartRest.ts so the color
    // thresholds stay in sync with the Smart Rest Timer's RPE-aware suggestions.
    // When the set is already completed we keep the success (green) styling so
    // the row reads as "done" at a glance, regardless of how hard it was.
    const rpeColor = rpeColorClass(set.rpe);
    const rpeText = rpeLabel(set.rpe);

    const rpeInputClasses = isCompleted
      ? "border-success/20 bg-success/5 text-success placeholder-text-muted/60"
      : rpeColor ||
        "border-border bg-bg-elevated text-text-primary placeholder-text-muted/60 focus:border-primary focus:ring-1 focus:ring-primary";

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      const target = e.currentTarget;
      setTimeout(() => {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    };

    return (
      <motion.div
        layout
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        className={cn(
          "grid grid-cols-[2rem_1fr_1fr_3rem_3rem_2.75rem] gap-2 px-4 py-2.5 transition-colors duration-300 items-center",
          isCompleted ? "bg-success/5" : "bg-transparent"
        )}
      >
        <div className="flex flex-col items-center justify-center gap-1">
          <span
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold",
              isCompleted ? "bg-success/15 text-success" : "bg-bg-elevated text-text-secondary"
            )}
          >
            {setIndex + 1}
          </span>
          {/* Set-type chip: tap to cycle through 11 types.
              Hidden when completed (no mid-workout type change after logging). */}
          {onCycleSetType && (
            <button
              type="button"
              onClick={onCycleSetType}
              disabled={isCompleted}
              aria-label={`Set type: ${typeMeta.labelEn}. Tap to change.`}
              title={`${typeMeta.labelEn} (${typeMeta.labelAr})`}
              className={cn(
                "flex h-5 min-w-[1.75rem] items-center justify-center rounded-md px-1 text-[10px] font-black tracking-tight transition-all active:scale-90 disabled:opacity-50 disabled:active:scale-100 cursor-pointer",
                typeMeta.chipBg,
                typeMeta.chipText,
                !isNonDefaultType && "opacity-40 hover:opacity-100"
              )}
            >
              {typeMeta.badge}
            </button>
          )}
        </div>

        <div className="flex flex-col items-center w-full min-w-0">
          <input
            type="number"
            inputMode="decimal"
            value={set.weight}
            onChange={(e) => onUpdateWeight(e.target.value)}
            onFocus={handleFocus}
            placeholder={ghostWeight != null ? String(ghostWeight) : ""}
            readOnly={isCompleted}
            className={cn(
              "w-full min-w-0 px-1 h-10 rounded-xl border text-center text-sm font-semibold outline-none transition-all duration-200",
              isCompleted
                ? "border-success/20 bg-success/5 text-success"
                : "border-border bg-bg-elevated text-text-primary placeholder-text-muted/60 focus:border-primary focus:ring-1 focus:ring-primary"
            )}
          />
          {ghostWeight != null && (
            <span className="text-xs text-text-secondary mt-0.5 tabular-nums">
              Prev: {ghostWeight}
            </span>
          )}
        </div>

        <div className="flex flex-col items-center w-full min-w-0">
          <input
            type="number"
            inputMode="numeric"
            value={set.reps}
            onChange={(e) => onUpdateReps(e.target.value)}
            onFocus={handleFocus}
            placeholder={ghostReps != null ? String(ghostReps) : ""}
            readOnly={isCompleted}
            className={cn(
              "w-full min-w-0 px-1 h-10 rounded-xl border text-center text-sm font-semibold outline-none transition-all duration-200",
              isCompleted
                ? "border-success/20 bg-success/5 text-success"
                : "border-border bg-bg-elevated text-text-primary placeholder-text-muted/60 focus:border-primary focus:ring-1 focus:ring-primary"
            )}
          />
          {ghostReps != null && (
            <span className="text-xs text-text-secondary mt-0.5 tabular-nums">
              Prev: {ghostReps}
            </span>
          )}
        </div>

        <div className="flex flex-col items-center w-full min-w-0">
          <input
            type="number"
            inputMode="numeric"
            value={set.rpe || ""}
            onChange={(e) => onUpdateRpe && onUpdateRpe(e.target.value)}
            onFocus={handleFocus}
            placeholder="RPE"
            readOnly={isCompleted}
            className={cn(
              "w-full min-w-0 px-1 h-10 rounded-xl border text-center text-xs font-semibold outline-none transition-all duration-200",
              rpeInputClasses
            )}
          />
          {rpeText && (
            <span className="text-[10px] text-text-muted mt-0.5 leading-tight text-center">
              {rpeText}
            </span>
          )}
        </div>

        <div className="flex items-center justify-center">
          <motion.button
            onClick={onToggleComplete}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200 active:scale-90",
              isCompleted
                ? "bg-success text-white shadow-lg shadow-success/25"
                : "border border-border bg-bg-elevated text-text-secondary hover:border-success/40 hover:text-success"
            )}
            whileTap={{ scale: 0.85 }}
          >
            <Check className="h-5 w-5" strokeWidth={isCompleted ? 3 : 2} />
          </motion.button>
        </div>

        <div className="flex items-center justify-center">
          <button
            onClick={onRemoveSet}
            disabled={isCompleted}
            className="flex h-11 w-11 items-center justify-center text-text-secondary hover:text-danger disabled:opacity-30 transition-colors rounded-xl"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </motion.div>
    );
  }
);

SetRow.displayName = "SetRow";

export default SetRow;
