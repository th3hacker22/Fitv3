"use client";
import { motion, useReducedMotion } from "framer-motion";
import { Flame } from "lucide-react";

function formatVolume(kg: number): string {
  if (kg >= 1000000) return `${(kg / 1000000).toFixed(1)}M`;
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}K`;
  return `${Math.round(kg)}`;
}

interface QuickStatsProps {
  streak: number;
  totalWorkouts: number;
  totalVolume: number;
}

export default function QuickStats({ streak, totalWorkouts, totalVolume }: QuickStatsProps) {
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
      custom={1}
      variants={fadeUp}
      initial={prefersReducedMotion ? false : "hidden"}
      animate="visible"
      className="grid grid-cols-3 gap-3"
    >
      {/* Streak */}
      <div className="glass-card relative flex flex-col items-center justify-center overflow-hidden rounded-xl border border-border p-3">
        <div className="absolute left-0 top-0 h-[2px] w-full bg-warning/50" />
        <span className="mb-1 text-[9px] font-bold uppercase tracking-widest text-text-secondary">
          Streak
        </span>
        <div className="flex items-baseline gap-1">
          <Flame className="h-4 w-4 text-warning" />
          <span className="text-xl font-black italic tabular-nums text-warning">{streak}</span>
        </div>
      </div>

      {/* Workouts */}
      <div className="glass-card relative flex flex-col items-center justify-center overflow-hidden rounded-xl border border-border p-3">
        <div className="absolute left-0 top-0 h-[2px] w-full bg-primary/50" />
        <span className="mb-1 text-[9px] font-bold uppercase tracking-widest text-text-secondary">
          Workouts
        </span>
        <span className="text-xl font-black italic tabular-nums text-primary">
          {totalWorkouts}
        </span>
      </div>

      {/* Volume */}
      <div className="glass-card relative flex flex-col items-center justify-center overflow-hidden rounded-xl border border-border p-3">
        <div className="absolute left-0 top-0 h-[2px] w-full bg-success/50" />
        <span className="mb-1 text-[9px] font-bold uppercase tracking-widest text-text-secondary">
          Volume
        </span>
        <span className="text-xl font-black italic tabular-nums text-success">
          {formatVolume(totalVolume)}
        </span>
      </div>
    </motion.section>
  );
}
