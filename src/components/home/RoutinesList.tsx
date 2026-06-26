"use client";
import { motion, useReducedMotion } from "framer-motion";
import { Plus, Trash2, Play, Dumbbell } from "lucide-react";
import { Link, useNavigate } from "@/router-shim";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui-custom/Button";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import type { Routine } from "@/db/schema";

interface RoutinesListProps {
  routines: Routine[];
  onDelete: (id: string) => void;
}

export default function RoutinesList({ routines, onDelete }: RoutinesListProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const startWorkout = useWorkoutStore((s) => s.startWorkout);
  const prefersReducedMotion = useReducedMotion();
  const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1, y: 0,
      transition: { delay: i * 0.1, duration: 0.4, ease: "easeOut" as const },
    }),
  };

  return (
    <motion.section
      custom={6}
      variants={fadeUp}
      initial={prefersReducedMotion ? false : "hidden"}
      animate="visible"
      className="space-y-3"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-text-primary">
          {t("my_routines")}
        </h2>
        <Link
          to="/builder"
          className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-primary hover:text-primary-light"
        >
          <Plus className="h-3.5 w-3.5" />
          {t("create_routine")}
        </Link>
      </div>

      {routines.length > 0 ? (
        <div className="grid grid-cols-1 gap-3">
          {routines.map((routine, idx) => (
            <motion.div
              key={routine.id}
              className="glass-card group relative flex flex-col gap-3 rounded-2xl border border-border p-4"
              initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: prefersReducedMotion ? 0 : 0.4 + idx * 0.1 }}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-bold uppercase tracking-wider text-text-primary">
                    {routine.name}
                  </h3>
                  <p className="text-xs text-text-secondary">
                    {routine.exercises.length} {t("exercises")}
                  </p>
                </div>
                <button
                  onClick={() => onDelete(routine.id)}
                  className="text-text-secondary transition-colors hover:text-danger"
                  aria-label="Delete routine"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={async () => {
                  const items = routine.exercises.map((e) => ({
                    exerciseId: e.exerciseId,
                    isSupersetWithNext: e.isSupersetWithNext,
                  }));
                  const sessionId = await startWorkout(items);
                  navigate({ to: "/workout/$sessionId", params: { sessionId } });
                }}
              >
                <Play className="h-3.5 w-3.5" />
                {t("start")}
              </Button>
            </motion.div>
          ))}
        </div>
      ) : (
        <div
          className="glass-card flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-primary/20 bg-primary/[0.02] p-8 text-center"
          style={{ boxShadow: "0 0 25px rgba(204,255,0,0.05)" }}
        >
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20"
            style={{ boxShadow: "0 0 15px rgba(204,255,0,0.2)" }}
          >
            <Dumbbell className="h-7 w-7 text-primary" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-black italic uppercase tracking-wider text-text-primary">
              Design Your Training Flow
            </h3>
            <p className="max-w-[280px] text-xs leading-relaxed text-text-secondary">
              Build your own routine from scratch, or let our AI generate a personalized program for you.
            </p>
          </div>
          <div className="flex w-full max-w-[260px] justify-center gap-3 mt-1">
            <Button
              onClick={() => navigate({ to: "/builder" })}
              variant="outline"
              className="flex-1 border-border bg-bg-elevated/40 text-xs py-2.5"
            >
              {t("build_manually")}
            </Button>
            <Button
              onClick={() => navigate({ to: "/wizard" })}
              variant="primary"
              className="flex-1 text-xs py-2.5"
            >
              {t("generate_with_ai")}
            </Button>
          </div>
        </div>
      )}
    </motion.section>
  );
}
