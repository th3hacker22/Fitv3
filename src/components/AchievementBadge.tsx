"use client";
import { motion } from "framer-motion";
import { Trophy, Flame, Dumbbell, Award, Moon, Sun, Medal, Star, Crown, Lock } from "lucide-react";

const ICONS: Record<string, React.ElementType> = {
  Trophy,
  Flame,
  Dumbbell,
  Award,
  Moon,
  Sun,
  Medal,
  Star,
  Crown,
};

// Color themes per icon type for visual variety
const ICON_THEMES: Record<string, { color: string; bg: string; glow: string; border: string }> = {
  Trophy: {
    color: "text-warning",
    bg: "bg-warning/15",
    glow: "rgba(255,171,0,0.3)",
    border: "border-warning/30",
  },
  Flame: {
    color: "text-danger",
    bg: "bg-danger/15",
    glow: "rgba(255,82,82,0.3)",
    border: "border-danger/30",
  },
  Dumbbell: {
    color: "text-primary",
    bg: "bg-primary/15",
    glow: "rgba(204,255,0,0.3)",
    border: "border-primary/30",
  },
  Award: {
    color: "text-secondary",
    bg: "bg-secondary/15",
    glow: "rgba(0,240,255,0.3)",
    border: "border-secondary/30",
  },
  Medal: {
    color: "text-warning",
    bg: "bg-warning/15",
    glow: "rgba(255,171,0,0.3)",
    border: "border-warning/30",
  },
  Star: {
    color: "text-primary",
    bg: "bg-primary/15",
    glow: "rgba(204,255,0,0.3)",
    border: "border-primary/30",
  },
  Crown: {
    color: "text-warning",
    bg: "bg-warning/15",
    glow: "rgba(255,171,0,0.4)",
    border: "border-warning/40",
  },
  Moon: {
    color: "text-info",
    bg: "bg-info/15",
    glow: "rgba(56,189,248,0.3)",
    border: "border-info/30",
  },
  Sun: {
    color: "text-warning",
    bg: "bg-warning/15",
    glow: "rgba(255,171,0,0.3)",
    border: "border-warning/30",
  },
};

interface Props {
  title: string;
  description: string;
  iconName: string;
  isUnlocked: boolean;
  unlockedAt?: string;
  animate?: boolean;
  progress?: number; // 0-100 for locked badges
  progressLabel?: string; // e.g. "3/7"
}

export default function AchievementBadge({
  title,
  description,
  iconName,
  isUnlocked,
  unlockedAt,
  animate = false,
  progress,
  progressLabel,
}: Props) {
  const IconComponent = ICONS[iconName] || Trophy;
  const theme = ICON_THEMES[iconName] || ICON_THEMES.Trophy;

  return (
    <motion.div
      initial={animate ? { scale: 0.8, opacity: 0 } : false}
      animate={animate ? { scale: 1, opacity: 1 } : false}
      transition={{ type: "spring", stiffness: 200, damping: 12 }}
      className={`relative flex flex-col items-center justify-center gap-2 rounded-2xl border p-4 text-center transition-all ${
        isUnlocked
          ? `${theme.bg} ${theme.border}`
          : "border-border/40 bg-bg-elevated/30"
      }`}
      style={
        isUnlocked
          ? { boxShadow: `0 0 20px ${theme.glow}` }
          : undefined
      }
    >
      {/* Lock badge for locked achievements */}
      {!isUnlocked && (
        <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-bg-elevated">
          <Lock className="h-3 w-3 text-text-secondary/60" />
        </div>
      )}

      {/* Icon */}
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-full transition-all ${
          isUnlocked
            ? `${theme.bg} ${theme.color}`
            : "bg-bg-elevated text-text-secondary/40"
        }`}
        style={
          isUnlocked
            ? { boxShadow: `0 0 12px ${theme.glow}` }
            : undefined
        }
      >
        <IconComponent className="h-6 w-6" strokeWidth={isUnlocked ? 2 : 1.5} />
      </div>

      {/* Title */}
      <h4
        className={`text-xs font-bold uppercase tracking-wider ${
          isUnlocked ? "text-text-primary" : "text-text-secondary"
        }`}
      >
        {title}
      </h4>

      {/* Description */}
      <p className="text-[10px] leading-tight text-text-secondary max-w-[120px]">
        {description}
      </p>

      {/* Progress bar for locked badges */}
      {!isUnlocked && progress !== undefined && progress > 0 && (
        <div className="mt-1 w-full">
          <div className="h-1 w-full overflow-hidden rounded-full bg-bg-elevated">
            <motion.div
              className={`h-full rounded-full ${theme.color.replace("text-", "bg-")}`}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, delay: 0.3 }}
            />
          </div>
          {progressLabel && (
            <p className="mt-1 text-[9px] font-bold tabular-nums text-text-secondary">
              {progressLabel}
            </p>
          )}
        </div>
      )}

      {/* Unlock date for unlocked badges */}
      {isUnlocked && unlockedAt && (
        <span className="mt-1 text-[9px] font-bold uppercase tracking-widest text-text-secondary">
          {new Date(unlockedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </span>
      )}
    </motion.div>
  );
}
