"use client";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Trophy, X } from "lucide-react";
import confetti from "canvas-confetti";
import { useEffect } from "react";

export interface PRCelebrationData {
  exerciseName: string;
  weight: number;
  reps: number;
  previousWeight?: number;
  estimated1RM: number;
}

interface PRCelebrationProps {
  data: PRCelebrationData | null;
  onClose: () => void;
}

export default function PRCelebration({ data, onClose }: PRCelebrationProps) {
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!data) return;

    // Fire confetti burst — suppressed when the user has requested reduced
    // motion (WCAG 2.3.3). The celebratory message + scale-in animation
    // (also gated) still fire so the achievement is acknowledged, just
    // without the flashing particles that could trigger vestibular issues.
    if (!prefersReducedMotion) {
      const defaults = {
        colors: ["#CCFF00", "#00FFFF", "#FF00FF", "#00FF66", "#FFD700"],
        origin: { y: 0.5 },
      };
      confetti({ ...defaults, particleCount: 80, spread: 70, angle: 60 });
      confetti({ ...defaults, particleCount: 80, spread: 70, angle: 120 });
      setTimeout(() => confetti({ ...defaults, particleCount: 50, spread: 100 }), 300);
      setTimeout(() => confetti({ ...defaults, particleCount: 40, spread: 120, origin: { y: 0.3 } }), 600);
    }

    // Auto-dismiss after 5s
    const timeout = setTimeout(onClose, 5000);
    return () => clearTimeout(timeout);
  }, [data, onClose, prefersReducedMotion]);

  return (
    <AnimatePresence>
      {data && (
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0 }}
          animate={prefersReducedMotion ? undefined : { opacity: 1 }}
          exit={prefersReducedMotion ? undefined : { opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-6"
        >
          <motion.div
            initial={prefersReducedMotion ? false : { scale: 0.5, opacity: 0, y: 50 }}
            animate={prefersReducedMotion ? undefined : { scale: 1, opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? undefined : { scale: 0.5, opacity: 0, y: 50 }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { type: "spring", damping: 15, stiffness: 300 }
            }
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm overflow-hidden rounded-3xl border-2 border-warning/40 bg-gradient-to-br from-bg-card to-bg-elevated p-8 text-center shadow-2xl"
          >
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-warning/10 to-primary/10 pointer-events-none" />

            {/* Close button */}
            <button
              onClick={onClose}
              aria-label="Close celebration"
              className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Trophy icon */}
            <motion.div
              initial={prefersReducedMotion ? false : { scale: 0, rotate: -180 }}
              animate={prefersReducedMotion ? undefined : { scale: 1, rotate: 0 }}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { delay: 0.2, type: "spring", damping: 10, stiffness: 200 }
              }
              className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-warning to-yellow-500 shadow-lg shadow-warning/40"
            >
              <Trophy className="h-10 w-10 text-black" strokeWidth={2.5} />
            </motion.div>

            {/* NEW PR text */}
            <motion.h2
              initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
              animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ delay: prefersReducedMotion ? 0 : 0.3 }}
              className="text-3xl font-black uppercase italic tracking-tight text-warning mb-2"
            >
              NEW PR!
            </motion.h2>

            {/* Exercise name */}
            <p className="text-sm font-bold text-text-primary capitalize mb-4">
              {data.exerciseName}
            </p>

            {/* Stats */}
            <div className="mb-6 space-y-2">
              <div className="rounded-xl bg-success/10 border border-success/20 px-4 py-3">
                <div className="text-2xl font-black tabular-nums text-success">
                  {data.weight}kg × {data.reps}
                </div>
                <div className="text-xs font-semibold text-success/70 uppercase tracking-wider mt-0.5">
                  Est. 1RM: {data.estimated1RM}kg
                </div>
              </div>
              {data.previousWeight && data.previousWeight > 0 && (
                <div className="text-xs text-text-secondary">
                  Previous best: <span className="font-bold">{data.previousWeight}kg</span>
                  {" → "}
                  <span className="font-bold text-success">+{(data.weight - data.previousWeight).toFixed(1)}kg</span>
                </div>
              )}
            </div>

            {/* Dismiss button */}
            <motion.button
              whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
              onClick={onClose}
              className="w-full rounded-xl bg-primary py-3 text-sm font-black uppercase tracking-wider text-black transition-colors hover:bg-primary-light"
            >
              Let&apos;s Go! 🚀
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
