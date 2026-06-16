import { memo } from "react";
import { motion } from "framer-motion";
import { Check, Trash2 } from "lucide-react";
import { cn } from "@/utils/cn";
import type { WorkoutSet } from "@/store/useWorkoutStore";

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
    onRemoveSet,
  }: SetRowProps) => {
    const isCompleted = set.completed;

    return (
      <motion.div
        layout
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        className={cn(
          "grid grid-cols-[2rem_1fr_1fr_3rem_3rem_2rem] gap-2 px-4 py-2.5 transition-colors duration-300 items-center",
          isCompleted ? "bg-success/5" : "bg-transparent",
        )}
      >
        <div className="flex items-center justify-center">
          <span
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold",
              isCompleted
                ? "bg-success/15 text-success"
                : "bg-bg-elevated text-text-muted",
            )}
          >
            {setIndex + 1}
          </span>
        </div>

        <input
          type="number"
          inputMode="decimal"
          value={set.weight}
          onChange={(e) => onUpdateWeight(e.target.value)}
          placeholder={ghostWeight != null ? String(ghostWeight) : ""}
          readOnly={isCompleted}
          className={cn(
            "w-full min-w-0 px-1 h-10 rounded-xl border text-center text-sm font-semibold outline-none transition-all duration-200",
            isCompleted
              ? "border-success/20 bg-success/5 text-success"
              : "border-border bg-bg-elevated text-text-primary placeholder-text-muted/40 focus:border-primary focus:ring-1 focus:ring-primary",
          )}
        />

        <input
          type="number"
          inputMode="numeric"
          value={set.reps}
          onChange={(e) => onUpdateReps(e.target.value)}
          placeholder={ghostReps != null ? String(ghostReps) : ""}
          readOnly={isCompleted}
          className={cn(
            "w-full min-w-0 px-1 h-10 rounded-xl border text-center text-sm font-semibold outline-none transition-all duration-200",
            isCompleted
              ? "border-success/20 bg-success/5 text-success"
              : "border-border bg-bg-elevated text-text-primary placeholder-text-muted/40 focus:border-primary focus:ring-1 focus:ring-primary",
          )}
        />

        <input
          type="number"
          inputMode="numeric"
          value={set.rpe || ""}
          onChange={(e) => onUpdateRpe && onUpdateRpe(e.target.value)}
          placeholder="RPE"
          readOnly={isCompleted}
          className={cn(
            "w-full min-w-0 px-1 h-10 rounded-xl border text-center text-xs font-semibold outline-none transition-all duration-200",
            isCompleted
              ? "border-success/20 bg-success/5 text-success"
              : "border-border bg-bg-elevated text-text-primary placeholder-text-muted/40 focus:border-primary focus:ring-1 focus:ring-primary",
          )}
        />

        <div className="flex items-center justify-center">
          <motion.button
            onClick={onToggleComplete}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200 active:scale-90",
              isCompleted
                ? "bg-success text-white shadow-lg shadow-success/25"
                : "border border-border bg-bg-elevated text-text-muted hover:border-success/40 hover:text-success",
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
            className="text-text-muted hover:text-danger disabled:opacity-30 transition-colors p-1"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </motion.div>
    );
  },
);

SetRow.displayName = "SetRow";

export default SetRow;
