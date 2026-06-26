"use client";
import { motion, useReducedMotion } from "framer-motion";
import { Dumbbell, Trophy, Clock, Target, Play } from "lucide-react";
import { Link, useNavigate } from "@/router-shim";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui-custom/Button";
import { cn } from "@/utils/cn";

export interface RecentWorkout {
  id: string;
  name: string;
  date: string;
  exerciseCount: number;
  volume: number;
  prCount: number;
}

function formatVolume(kg: number): string {
  if (kg >= 1000000) return `${(kg / 1000000).toFixed(1)}M`;
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}K`;
  return `${Math.round(kg)}`;
}

export default function RecentActivity({ workouts }: { workouts: RecentWorkout[] }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1, y: 0,
      transition: { delay: i * 0.1, duration: 0.4, ease: "easeOut" as const },
    }),
  };

  const handleStartQuickWorkout = async () => {
    // Delegate to parent via navigate — the store action is imported there
    navigate({ to: "/exercises" });
  };

  return (
    <motion.section
      custom={8}
      variants={fadeUp}
      initial={prefersReducedMotion ? false : "hidden"}
      animate="visible"
      className="space-y-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-4 w-1 rounded-full bg-success" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-text-primary">
            {t("recent_activity")}
          </h2>
        </div>
        {workouts.length > 0 && (
          <Link
            to="/stats"
            className="text-xs font-bold uppercase tracking-wider text-success hover:text-success/80"
          >
            {t("view_all")}
          </Link>
        )}
      </div>

      {workouts.length > 0 ? (
        <div className="space-y-2">
          {workouts.map((workout, idx) => (
            <motion.div
              key={workout.id}
              className="glass-card flex items-center gap-3 rounded-xl border border-border border-l-4 border-l-success/30 p-3"
              initial={prefersReducedMotion ? false : { opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: prefersReducedMotion ? 0 : 0.6 + idx * 0.1 }}
            >
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                  idx === 0 ? "bg-success/10" : "bg-success/5"
                )}
              >
                <Dumbbell className={cn("h-4 w-4", idx === 0 ? "text-success" : "text-success/70")} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold capitalize text-text-primary">
                  {workout.name}
                </p>
                <p className="text-[10px] text-text-secondary">
                  {workout.exerciseCount} exercises · {formatVolume(workout.volume)}kg ·{" "}
                  {new Date(workout.date).toLocaleDateString("en-US", {
                    day: "numeric",
                    month: "short",
                  })}
                </p>
              </div>
              {workout.prCount > 0 && (
                <div className="flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5">
                  <Trophy className="h-3 w-3 text-warning" />
                  <span className="text-[9px] font-bold text-warning">{workout.prCount} PRs</span>
                </div>
              )}
              <Clock className="h-4 w-4 shrink-0 text-text-secondary" />
            </motion.div>
          ))}
        </div>
      ) : (
        <div
          className="glass-card flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-success/20 bg-success/[0.01] p-8 text-center"
          style={{ boxShadow: "0 0 25px rgba(0,230,118,0.03)" }}
        >
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success/10 border border-success/20"
            style={{ boxShadow: "0 0 15px rgba(0,230,118,0.15)" }}
          >
            <Target className="h-7 w-7 text-success" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-black italic uppercase tracking-wider text-text-primary">
              Your Journey Starts Here!
            </h3>
            <p className="max-w-[280px] text-xs leading-relaxed text-text-secondary">
              Every legendary athlete started with a single set. Log your first workout today to unlock streaks, stats, and achievements.
            </p>
          </div>
          <Button
            onClick={handleStartQuickWorkout}
            variant="primary"
            className="w-full max-w-[220px] text-xs font-black uppercase tracking-widest italic py-3 mt-2 bg-success text-[#050505] hover:bg-success/90"
            style={{ boxShadow: "0 0 15px rgba(0,230,118,0.2)" }}
          >
            <Play className="h-3.5 w-3.5 fill-[#050505]" />
            Start First Workout
          </Button>
        </div>
      )}
    </motion.section>
  );
}
