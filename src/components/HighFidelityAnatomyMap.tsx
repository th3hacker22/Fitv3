import React, { useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/utils/cn";

// Premium 3D Anatomy paths representation
interface MusclePath {
  id: string;
  label: string;
  dFront: string;
  dBack: string;
}

const MUSCLES: MusclePath[] = [
  {
    id: "chest",
    label: "Chest",
    dFront:
      "M70,120 C80,120 90,130 90,150 C90,170 80,180 70,180 C60,180 50,170 50,150 C50,130 60,120 70,120",
    dBack: "",
  },
  {
    id: "abs",
    label: "Abs",
    dFront: "M60,190 L80,190 L85,240 L55,240 Z",
    dBack: "",
  },
  {
    id: "quads",
    label: "Quads",
    dFront: "M50,260 L70,260 L75,340 L45,340 Z",
    dBack: "",
  },
  {
    id: "lats",
    label: "Lats",
    dFront: "M40,120 L50,120 L40,180 Z M100,120 L90,120 L100,180 Z",
    dBack: "M40,120 L50,120 L40,200 Z M100,120 L90,120 L100,200 Z",
  },
];

export default function HighFidelityAnatomyMap({
  onSelectMuscle,
  activeMuscle,
}: {
  onSelectMuscle: (id: string | null) => void;
  activeMuscle: string | null;
}) {
  const [view, setView] = useState<"front" | "back">("front");

  return (
    <div className="flex flex-col items-center p-6 bg-bg-surface rounded-[--radius-card] border border-border shadow-2xl">
      <div className="flex gap-2 mb-6 bg-bg-elevated p-1 rounded-full">
        <button
          onClick={() => setView("front")}
          className={cn(
            "px-6 py-2 rounded-full text-xs font-bold transition-all",
            view === "front" ? "bg-primary/20 text-primary " : "text-text-muted hover:text-text-primary",
          )}
        >
          FRONT
        </button>
        <button
          onClick={() => setView("back")}
          className={cn(
            "px-6 py-2 rounded-full text-xs font-bold transition-all",
            view === "back" ? "bg-primary/20 text-primary " : "text-text-muted hover:text-text-primary",
          )}
        >
          BACK
        </button>
      </div>

      <svg viewBox="0 0 150 400" className="w-56 h-auto drop-shadow-2xl">
        <defs>
          <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow
              dx="0"
              dy="2"
              stdDeviation="2"
              floodColor="#000"
              floodOpacity="0.5"
            />
          </filter>
          <linearGradient id="muscleGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="100%" stopColor="#1E293B" />
          </linearGradient>
        </defs>

        <g>
          {MUSCLES.map((muscle) => {
            const d = view === "front" ? muscle.dFront : muscle.dBack;
            if (!d) return null;
            const isActive = activeMuscle === muscle.id;

            return (
              <motion.path
                key={muscle.id}
                d={d}
                fill={isActive ? "#3B82F6" : "url(#muscleGrad)"}
                stroke={isActive ? "#93C5FD" : "#0F172A"}
                strokeWidth="1.5"
                className={cn(
                  "cursor-pointer transition-all duration-500",
                  isActive &&
                    "filter drop-shadow-[0_0_12px_rgba(59,130,246,0.8)]",
                )}
                onClick={() => onSelectMuscle(isActive ? null : muscle.id)}
                whileHover={{
                  scale: 1.02,
                  fill: isActive ? "#3B82F6" : "#2D3748",
                  filter: isActive
                    ? "drop-shadow(0 0 12px rgba(59,130,246,0.8))"
                    : "drop-shadow(0 0 4px rgba(59,130,246,0.3))",
                }}
              />
            );
          })}
        </g>
      </svg>
      <p className="mt-4 text-xs text-text-muted hover:text-text-primary font-medium tracking-widest uppercase">
        {activeMuscle ? activeMuscle : "Select a muscle group"}
      </p>
    </div>
  );
}
