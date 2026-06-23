"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Target, Plus, ChevronLeft, Trash2, Check, X, TrendingUp, Dumbbell, Repeat, Trophy } from "lucide-react";
import { Link } from "@/router-shim";
import { useTranslation } from "react-i18next";
import { useGoalsStore } from "@/store/useGoalsStore";
import { useToastStore } from "@/store/useToastStore";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { computeAllGoalProgress, formatGoalValue, type GoalProgress } from "@/services/goalProgress";
import { KineticEmptyState } from "@/components/ui-custom/KineticEmptyState";
import { Skeleton } from "@/components/ui-custom/Skeleton";
import { db, type GoalType, type GoalTimeFrame } from "@/db/schema";
import { cn } from "@/utils/cn";

const GOAL_TYPE_META: Record<GoalType, { label: string; icon: typeof Target; color: string }> = {
  volume: { label: "Volume", icon: TrendingUp, color: "text-primary" },
  "1rm": { label: "Est. 1RM", icon: Dumbbell, color: "text-success" },
  reps: { label: "Total Reps", icon: Repeat, color: "text-warning" },
  workouts: { label: "Workouts", icon: Target, color: "text-info" },
};

const TIME_FRAME_LABELS: Record<GoalTimeFrame, string> = {
  week: "This Week",
  month: "This Month",
  year: "This Year",
};

export default function GoalsPage() {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const goals = useGoalsStore((s) => s.goals);
  const isLoading = useGoalsStore((s) => s.isLoading);
  const loadGoals = useGoalsStore((s) => s.loadGoals);
  const createGoal = useGoalsStore((s) => s.createGoal);
  const deleteGoal = useGoalsStore((s) => s.deleteGoal);
  const markAchieved = useGoalsStore((s) => s.markAchieved);
  const addToast = useToastStore((s) => s.addToast);

  const [showAddForm, setShowAddForm] = useState(false);
  const [sessions, setSessions] = useState<typeof db.workoutSessions extends { toArray: () => infer T } ? Awaited<T> : never>([]);

  // Load goals + sessions on mount
  useEffect(() => {
    loadGoals();
    (async () => {
      try {
        const allSessions = await db.workoutSessions.filter((s) => s.completed && !s.isFreeze).toArray();
        setSessions(allSessions as never);
      } catch {
        // silent — goals will show 0 progress
      }
    })();
  }, [loadGoals]);

  // Compute progress for all goals
  const progressList: GoalProgress[] = useMemo(() => {
    return computeAllGoalProgress(goals, sessions as never[]);
  }, [goals, sessions]);

  // Check for newly achieved goals + toast
  useEffect(() => {
    for (const p of progressList) {
      if (p.achieved && !p.goal.achieved) {
        markAchieved(p.goal.id);
        addToast("success", `🎯 Goal achieved: ${p.goal.exerciseName ? p.goal.exerciseName + " " : ""}${GOAL_TYPE_META[p.goal.type].label} ${p.targetLabel}!`);
      }
    }
  }, [progressList, markAchieved, addToast]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteGoal(id);
    addToast("info", "Goal deleted.");
  }, [deleteGoal, addToast]);

  return (
    <div className="space-y-4 pb-6 pt-2">
      {/* Back link */}
      <Link
        to="/stats"
        className="inline-flex items-center gap-2 text-sm font-medium text-text-secondary transition-colors hover:text-primary uppercase tracking-wide"
      >
        <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
        {t("back")}
      </Link>

      {/* Page header */}
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
        className="flex items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
            <Target className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-wider text-text-primary">
              Goals
            </h1>
            <p className="text-xs text-text-secondary">
              Track measurable fitness targets
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-black uppercase tracking-wider text-primary-text transition-all active:scale-95"
        >
          <Plus className="h-4 w-4" />
          New Goal
        </button>
      </motion.div>

      {/* Goals list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-[--radius-card]" />
          ))}
        </div>
      ) : goals.length === 0 && !showAddForm ? (
        <KineticEmptyState
          variant="custom"
          icon={Target}
          title="No goals yet"
          description="Set a measurable target — volume, 1RM, reps, or workout count — and track your progress."
          actionLabel="Create Goal"
          onAction={() => setShowAddForm(true)}
        />
      ) : (
        <div className="space-y-3">
          {showAddForm && (
            <AddGoalForm
              onSave={async (input) => {
                await createGoal(input);
                setShowAddForm(false);
                addToast("success", "Goal created!");
              }}
              onCancel={() => setShowAddForm(false)}
            />
          )}

          {progressList.map((p, idx) => {
            const meta = GOAL_TYPE_META[p.goal.type];
            const Icon = meta.icon;
            return (
              <motion.div
                key={p.goal.id}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: prefersReducedMotion ? 0 : idx * 0.05 }}
                className="rounded-[--radius-card] glass-card p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-bg-elevated", meta.color)}>
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-text-primary truncate">
                        {p.goal.exerciseName ? `${p.goal.exerciseName} ` : ""}
                        {meta.label}
                      </p>
                      <p className="text-[11px] text-text-secondary uppercase tracking-wider">
                        {TIME_FRAME_LABELS[p.goal.timeFrame]} · {p.targetLabel}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {p.achieved && (
                      <span className="flex items-center gap-1 rounded-full bg-success/15 px-2 py-1 text-[10px] font-black text-success">
                        <Trophy className="h-3 w-3" />
                        Done
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(p.goal.id)}
                      aria-label="Delete goal"
                      className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-text-secondary transition-colors hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold tabular-nums text-text-primary">
                      {p.currentLabel}
                    </span>
                    <span className="text-xs font-bold tabular-nums text-text-secondary">
                      {p.targetLabel}
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-bg-elevated">
                    <motion.div
                      initial={prefersReducedMotion ? false : { width: 0 }}
                      animate={{ width: `${p.percent}%` }}
                      transition={{ duration: prefersReducedMotion ? 0 : 0.5, ease: "easeOut" }}
                      className={cn(
                        "h-full rounded-full transition-colors",
                        p.achieved ? "bg-success" : "bg-primary"
                      )}
                    />
                  </div>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-text-muted">
                    {p.percent}% complete
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Add Goal Form (inline) ──

interface AddGoalFormProps {
  onSave: (input: {
    type: GoalType;
    targetValue: number;
    exerciseId?: string;
    exerciseName?: string;
    timeFrame: GoalTimeFrame;
  }) => Promise<void>;
  onCancel: () => void;
}

function AddGoalForm({ onSave, onCancel }: AddGoalFormProps) {
  const [type, setType] = useState<GoalType>("volume");
  const [targetValue, setTargetValue] = useState("");
  const [timeFrame, setTimeFrame] = useState<GoalTimeFrame>("month");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    const value = Number(targetValue);
    if (!value || value <= 0) return;
    setIsSaving(true);
    try {
      await onSave({ type, targetValue: value, timeFrame });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="rounded-[--radius-card] glass-card p-4 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-black uppercase tracking-wider text-text-primary">New Goal</h2>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel"
          className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-text-secondary hover:text-text-primary"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Goal type selector */}
      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary mb-2 block">
          Metric
        </label>
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(GOAL_TYPE_META) as GoalType[]).map((t) => {
            const meta = GOAL_TYPE_META[t];
            const Icon = meta.icon;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95",
                  type === t
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-bg-elevated text-text-secondary"
                )}
              >
                <Icon className="h-4 w-4" />
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Target value */}
      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary mb-2 block">
          Target ({formatGoalValue(type, 0).replace(/[\d.]+/, "")})
        </label>
        <input
          type="number"
          inputMode="decimal"
          value={targetValue}
          onChange={(e) => setTargetValue(e.target.value)}
          placeholder="e.g. 10000"
          className="w-full min-h-11 rounded-xl border border-border bg-bg-elevated px-4 text-center text-sm font-bold text-text-primary outline-none focus:border-primary"
        />
      </div>

      {/* Time frame */}
      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary mb-2 block">
          Time Frame
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(TIME_FRAME_LABELS) as GoalTimeFrame[]).map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => setTimeFrame(tf)}
              className={cn(
                "flex min-h-11 items-center justify-center rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95",
                timeFrame === tf
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-bg-elevated text-text-secondary"
              )}
            >
              {TIME_FRAME_LABELS[tf]}
            </button>
          ))}
        </div>
      </div>

      {/* Save button */}
      <button
        type="button"
        onClick={handleSave}
        disabled={!targetValue || isSaving}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-xs font-black uppercase tracking-wider text-primary-text transition-all active:scale-95 disabled:opacity-50"
      >
        <Check className="h-4 w-4" />
        Create Goal
      </button>
    </motion.div>
  );
}
