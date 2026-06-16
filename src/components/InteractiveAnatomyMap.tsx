import React, { useState } from "react";
import { motion } from "framer-motion";

const InteractiveAnatomyMap = ({
  onSelect,
}: {
  onSelect: (muscle: string | null) => void;
}) => {
  const [activeMuscle, setActiveMuscle] = useState<string | null>(null);

  const handleMuscleClick = (id: string) => {
    const newSelection = activeMuscle === id ? null : id;
    setActiveMuscle(newSelection);
    onSelect(newSelection);
  };

  const getPathProps = (id: string) => ({
    fill: activeMuscle === id ? "url(#activeGrad)" : "url(#inactiveGrad)",
    className: `transition-all duration-300 ${activeMuscle === id ? "filter drop-shadow-[0_0_15px_#3B82F6]" : "hover:fill-slate-600"}`,
    onClick: () => handleMuscleClick(id),
  });

  return (
    <div className="w-full max-w-lg mx-auto p-4 bg-bg-surface rounded-xl">
      <svg
        viewBox="0 0 660.46 1206.46"
        className="w-full h-auto cursor-pointer"
      >
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <linearGradient id="inactiveGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
          <linearGradient id="activeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1e40af" />
          </linearGradient>
        </defs>

        <g id="chest" {...getPathProps("chest")}>
          <path d="M330.23,200 C400,200 450,250 450,300 C450,350 400,400 330.23,400 C260.46,400 210.46,350 210.46,300 C210.46,250 260.46,200 330.23,200 Z" />
        </g>
        <g id="abs" {...getPathProps("abs")}>
          <path d="M250,420 L410,420 L400,550 L260,550 Z" />
        </g>
        <g id="back" {...getPathProps("back")}>
          <path d="M220,200 L440,200 L460,500 L200,500 Z" />
        </g>
        <g id="quads" {...getPathProps("quads")}>
          <path d="M200,600 L460,600 L440,850 L220,850 Z" />
        </g>
      </svg>
    </div>
  );
};

export default InteractiveAnatomyMap;
