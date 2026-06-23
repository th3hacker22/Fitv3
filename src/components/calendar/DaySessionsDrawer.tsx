"use client";
import { useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Dumbbell, Clock, TrendingUp, CalendarX } from "lucide-react";
import { Skeleton } from "@/components/ui-custom/Skeleton";
import type { WorkoutSession } from "@/db/schema";

/**
 * DaySessionsDrawer.
 *
 * Bottom sheet that lists the workout sessions for a single calendar day.
 * Opens when the user taps an active day in the CalendarGrid.
 *
 * Each session row shows:
 *   - Workout name + time
 *   - Exercise count
 *   - Duration
 *   - Total volume (kg-reps)
 */

export interface DaySessionsDrawerProps {
  /** The YYYY-MM-DD date key being shown, or null when closed. */
  dateKey: string | null;
  /** All sessions for that day (already filtered by the parent). */
  sessions: WorkoutSession[];
  /** When true, shows 3 skeleton placeholder cards (parent is fetching). */
  isLoading?: boolean;
  /** Called when the drawer should close. */
  onOpenChange: (open: boolean) => void;
}

function formatTime(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function formatVolume(volume: number): string {
  if (volume >= 1000) return `${(volume / 1000).toFixed(1)}k kg-reps`;
  return `${Math.round(volume)} kg-reps`;
}

function sessionVolume(session: WorkoutSession): number {
  return session.exercises.reduce(
    (exAcc, ex) =>
      exAcc +
      ex.sets
        .filter((set) => set.completed)
        .reduce((setAcc, set) => setAcc + set.weight * set.reps, 0),
    0
  );
}

function sessionExerciseCount(session: WorkoutSession): number {
  return session.exercises.filter((ex) => ex.sets.some((s) => s.completed)).length;
}

export default function DaySessionsDrawer({
  dateKey,
  sessions,
  isLoading = false,
  onOpenChange,
}: DaySessionsDrawerProps) {
  const open = Boolean(dateKey);
  const prefersReducedMotion = useReducedMotion();

  const totalVolume = useMemo(
    () => sessions.reduce((acc, s) => acc + sessionVolume(s), 0),
    [sessions]
  );
  const totalDuration = useMemo(
    () => sessions.reduce((acc, s) => acc + s.duration, 0),
    [sessions]
  );
  const totalExercises = useMemo(
    () => sessions.reduce((acc, s) => acc + sessionExerciseCount(s), 0),
    [sessions]
  );

  const formattedDate = useMemo(() => {
    if (!dateKey) return "";
    const [y, m, d] = dateKey.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }, [dateKey]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[80vh]">
        <DrawerHeader className="border-b border-border pb-3">
          <DrawerTitle className="text-base font-black uppercase tracking-wider text-text-primary">
            {formattedDate || "Workout Day"}
          </DrawerTitle>
          <DrawerDescription className="sr-only">
            Workout sessions logged on {formattedDate}
          </DrawerDescription>
        </DrawerHeader>

        {/* Day summary stats */}
        {open && !isLoading && sessions.length > 0 && (
          <div className="grid grid-cols-3 gap-2 border-b border-border p-3">
            <div className="flex flex-col items-center gap-1 rounded-xl bg-bg-elevated p-2">
              <Dumbbell className="h-4 w-4 text-primary" aria-hidden="true" />
              <span className="text-base font-black tabular-nums text-text-primary">
                {totalExercises}
              </span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted">
                Exercises
              </span>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-xl bg-bg-elevated p-2">
              <Clock className="h-4 w-4 text-primary" aria-hidden="true" />
              <span className="text-base font-black tabular-nums text-text-primary">
                {formatDuration(totalDuration)}
              </span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted">
                Duration
              </span>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-xl bg-bg-elevated p-2">
              <TrendingUp className="h-4 w-4 text-primary" aria-hidden="true" />
              <span className="text-base font-black tabular-nums text-text-primary">
                {formatVolume(totalVolume)}
              </span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted">
                Volume
              </span>
            </div>
          </div>
        )}

        {/* Session list */}
        <div className="flex-1 overflow-y-auto p-3 no-scrollbar">
          <AnimatePresence mode="popLayout">
            {/* Loading state — 3 skeleton cards while the parent fetches. */}
            {open && isLoading && (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))}
              </div>
            )}

            {open && !isLoading && sessions.length === 0 && (
              <motion.div
                initial={prefersReducedMotion ? false : { opacity: 0 }}
                animate={prefersReducedMotion ? undefined : { opacity: 1 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0 }}
                className="flex flex-col items-center justify-center gap-3 py-10 text-center"
              >
                <CalendarX className="h-10 w-10 text-text-muted" aria-hidden="true" />
                <div>
                  <p className="text-sm font-bold text-text-secondary">No sessions found</p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    You haven&apos;t logged a workout for this day.
                  </p>
                </div>
              </motion.div>
            )}

            {open &&
              !isLoading &&
              sessions.map((session, idx) => {
                const vol = sessionVolume(session);
                const exCount = sessionExerciseCount(session);
                return (
                  <motion.div
                    key={session.id}
                    layout={!prefersReducedMotion}
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
                    animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                    exit={prefersReducedMotion ? undefined : { opacity: 0, y: -10 }}
                    transition={{ delay: prefersReducedMotion ? 0 : idx * 0.04 }}
                    className="mb-2 rounded-xl border border-border bg-bg-card p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-bold text-text-primary">
                          {session.name || `Workout ${idx + 1}`}
                        </p>
                        <p className="text-[11px] font-medium text-text-secondary">
                          {formatTime(session.date)}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-black text-primary">
                        {formatVolume(vol)}
                      </span>
                    </div>

                    {exCount > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {session.exercises
                          .filter((ex) => ex.sets.some((s) => s.completed))
                          .slice(0, 4)
                          .map((ex, i) => (
                            <span
                              key={i}
                              className="rounded-md bg-bg-elevated px-1.5 py-0.5 text-[10px] font-semibold text-text-secondary"
                            >
                              {ex.exerciseName}
                            </span>
                          ))}
                        {sessionExercisesMore(session) > 0 && (
                          <span className="rounded-md bg-bg-elevated px-1.5 py-0.5 text-[10px] font-bold text-text-muted">
                            +{sessionExercisesMore(session)}
                          </span>
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              })}
          </AnimatePresence>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function sessionExercisesMore(session: WorkoutSession): number {
  const active = session.exercises.filter((ex) => ex.sets.some((s) => s.completed));
  return Math.max(0, active.length - 4);
}
