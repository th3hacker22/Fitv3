import { motion } from "framer-motion";
import { Trophy, Flame, Dumbbell, Award, Moon, Sun, Lock } from "lucide-react";

const ICONS: Record<string, React.ElementType> = {
  Trophy,
  Flame,
  Dumbbell,
  Award,
  Moon,
  Sun,
};

interface Props {
  title: string;
  description: string;
  iconName: string;
  isUnlocked: boolean;
  unlockedAt?: string;
  animate?: boolean;
}

export default function AchievementBadge({
  title,
  description,
  iconName,
  isUnlocked,
  unlockedAt,
  animate = false,
}: Props) {
  const IconComponent = ICONS[iconName] || Trophy;

  return (
    <motion.div
      initial={animate ? { scale: 0.8, opacity: 0 } : false}
      animate={animate ? { scale: 1, opacity: 1 } : false}
      transition={{ type: "spring", stiffness: 200, damping: 12 }}
      className={`relative p-4 rounded-2xl flex flex-col items-center justify-center text-center gap-2 border transition-all ${
        isUnlocked
          ? "bg-primary/10 border-primary/30 shadow-[0_0_15px_rgba(202,255,51,0.1)]"
          : "bg-bg-elevated/40 border-border/40 opacity-70 grayscale"
      }`}
    >
      {!isUnlocked && (
        <div className="absolute top-2 right-2">
          <Lock className="w-3 h-3 text-text-muted/50" />
        </div>
      )}

      <div
        className={`p-3 rounded-full ${isUnlocked ? "bg-primary/20 text-primary" : "bg-bg text-text-muted/50"}`}
      >
        <IconComponent className="w-6 h-6" />
      </div>

      <div className="flex flex-col items-center mt-1">
        <h4
          className={`text-sm font-bold uppercase tracking-wider ${isUnlocked ? "text-text-primary" : "text-text-muted"}`}
        >
          {title}
        </h4>
        <p className="text-[10px] text-text-muted mt-1 leading-tight max-w-[120px]">
          {description}
        </p>

        {isUnlocked && unlockedAt && (
          <span className="text-[9px] text-primary/60 font-mono mt-2">
            {new Date(unlockedAt).toLocaleDateString()}
          </span>
        )}
      </div>
    </motion.div>
  );
}
