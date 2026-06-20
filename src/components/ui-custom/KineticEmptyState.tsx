"use client";
import { motion } from "framer-motion";
import { LucideIcon, ArrowRight } from "lucide-react";
import { cn } from "@/utils/cn";

export type EmptyStateVariant =
  | "workouts"
  | "routines"
  | "prs"
  | "measurements"
  | "photos"
  | "custom";

interface KineticEmptyStateProps {
  variant?: EmptyStateVariant;
  icon?: LucideIcon;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

// ── SVG Illustrations (adapted from Stitch) ──

function DumbbellIllustration() {
  return (
    <>
      <div className="absolute inset-0 rounded-full bg-primary/5 blur-2xl" />
      <motion.div
        className="absolute h-24 w-24 rounded-full border border-primary/20"
        animate={{ scale: [0.8, 1.5], opacity: [0.5, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.svg
        className="relative z-10 h-24 w-24"
        fill="none"
        viewBox="0 0 100 100"
        animate={{ y: [0, -10, 0], rotate: [0, 2, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        style={{ filter: "drop-shadow(0 0 15px rgba(204,255,0,0.4))" }}
      >
        <path d="M20 40H30V60H20V40Z" fill="#ccff00" />
        <path d="M70 40H80V60H70V40Z" fill="#ccff00" />
        <path d="M30 45H70V55H30V45Z" fill="#444933" />
        <rect fill="#00eefc" height="30" opacity="0.8" width="5" x="15" y="35" />
        <rect fill="#00eefc" height="30" opacity="0.8" width="5" x="80" y="35" />
      </motion.svg>
      {/* Orbit particles */}
      <motion.div
        className="absolute left-1/2 top-1/2 h-2 w-2"
        animate={{ rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
      >
        <div
          className="h-2 w-2 rounded-full bg-secondary"
          style={{ boxShadow: "0 0 10px #00eefc", transform: "translateX(48px)" }}
        />
      </motion.div>
      <motion.div
        className="absolute left-1/2 top-1/2 h-1.5 w-1.5"
        animate={{ rotate: -360 }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear", delay: 4 }}
      >
        <div
          className="h-1.5 w-1.5 rounded-full bg-primary"
          style={{ boxShadow: "0 0 10px #ccff00", transform: "translateX(48px)" }}
        />
      </motion.div>
    </>
  );
}

function RoutinesIllustration() {
  return (
    <>
      <div className="absolute inset-0 rounded-full bg-secondary/5 blur-2xl" />
      <motion.div
        className="relative h-24 w-24"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        <svg
          className="absolute inset-0 -translate-x-1 -rotate-12"
          fill="none"
          viewBox="0 0 100 100"
        >
          <rect
            fill="#0f0f11"
            height="80"
            rx="4"
            stroke="#444933"
            strokeWidth="2"
            width="60"
            x="20"
            y="10"
          />
          <path
            d="M30 30H70M30 50H60M30 70H50"
            stroke="#444933"
            strokeLinecap="round"
            strokeWidth="2"
          />
        </svg>
        <svg
          className="absolute inset-0 z-10"
          fill="none"
          style={{ filter: "drop-shadow(0 0 15px rgba(0,238,252,0.4))" }}
          viewBox="0 0 100 100"
        >
          <rect
            fill="#0f0f11"
            height="80"
            rx="4"
            stroke="#00eefc"
            strokeWidth="2"
            width="60"
            x="20"
            y="10"
          />
          <path
            d="M40 40L50 30L60 40M50 30V70"
            stroke="#00eefc"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
          <circle cx="50" cy="50" opacity="0.5" r="15" stroke="#ccff00" strokeDasharray="2 2" strokeWidth="1" />
        </svg>
      </motion.div>
    </>
  );
}

function TrophyIllustration() {
  return (
    <>
      <div className="absolute inset-0 rounded-full bg-danger/5 blur-2xl" />
      <motion.svg
        className="relative z-10 h-24 w-24 opacity-60 transition-opacity hover:opacity-100"
        fill="none"
        viewBox="0 0 100 100"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        style={{ filter: "drop-shadow(0 0 10px rgba(255,180,171,0.2))" }}
      >
        <path d="M30 30C30 30 20 30 20 40C20 50 30 50 30 50M70 30C70 30 80 30 80 40C80 50 70 50 70 50" stroke="#ffb4ab" strokeLinecap="round" strokeWidth="2" />
        <path d="M30 20H70V50C70 61.0457 61.0457 70 50 70C38.9543 70 30 61.0457 30 50V20Z" stroke="#ffb4ab" strokeWidth="2" />
        <path d="M40 70V80H60V70" stroke="#ffb4ab" strokeWidth="2" />
        <path d="M35 80H65" stroke="#ffb4ab" strokeLinecap="round" strokeWidth="2" />
        <path d="M50 35V55M40 45H60" stroke="#444933" strokeDasharray="4 4" strokeLinecap="round" strokeWidth="2" />
      </motion.svg>
    </>
  );
}

function MeasurementsIllustration() {
  return (
    <div className="relative h-24 w-24">
      <div className="absolute inset-0 rounded-full bg-primary/5 blur-2xl" />
      <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 gap-0.5 opacity-20">
        {Array.from({ length: 16 }).map((_, i) => (
          <div key={i} className="border border-secondary/20" />
        ))}
      </div>
      <svg className="absolute inset-0 z-10 h-full w-full" fill="none" viewBox="0 0 100 100">
        <path
          d="M50 20C54.4183 20 58 16.4183 58 12C58 7.58172 54.4183 4 50 4C45.5817 4 42 7.58172 42 12C42 16.4183 45.5817 20 50 20Z"
          stroke="#00eefc"
          strokeDasharray="2 2"
          strokeWidth="1.5"
        />
        <path
          d="M35 25C40 25 45 22 50 22C55 22 60 25 65 25C70 25 75 35 70 50C65 65 60 55 55 70C55 85 50 95 50 95C50 95 45 85 45 70C40 55 35 65 30 50C25 35 30 25 35 25Z"
          stroke="#ccff00"
          strokeWidth="2"
        />
        <motion.line
          stroke="#00eefc"
          strokeWidth="2"
          style={{ filter: "drop-shadow(0 0 5px #00eefc)" }}
          x1="20"
          x2="80"
          y1="50"
          y2="50"
          animate={{ y1: [40, 60, 40], y2: [40, 60, 40] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      </svg>
    </div>
  );
}

function PhotosIllustration() {
  return (
    <>
      <div className="absolute inset-0 rounded-full bg-info/5 blur-2xl" />
      <motion.div
        className="relative h-24 w-24"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        <svg
          className="absolute inset-0 h-full w-full"
          fill="none"
          style={{ filter: "drop-shadow(0 10px 15px rgba(0,0,0,0.5))" }}
          viewBox="0 0 100 100"
        >
          <rect fill="#1c1b1b" height="70" stroke="#353534" strokeWidth="2" width="60" x="20" y="10" />
          <rect fill="#0f0f11" height="45" stroke="#444933" strokeWidth="1" width="50" x="25" y="15" />
          <path
            d="M40 40C40 34.4772 44.4772 30 50 30C55.5228 30 60 34.4772 60 40C60 45.5228 55.5228 50 50 50C44.4772 50 40 45.5228 40 40Z"
            stroke="#ccff00"
            strokeDasharray="4 2"
            strokeWidth="2"
          />
          <circle cx="50" cy="40" fill="#00eefc" r="2" />
        </svg>
      </motion.div>
    </>
  );
}

function CustomIconIllustration({ Icon }: { Icon: LucideIcon }) {
  return (
    <motion.div
      className="flex h-24 w-24 items-center justify-center rounded-3xl border border-primary/20 bg-bg-elevated/30 backdrop-blur-xl"
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      style={{ boxShadow: "0 0 40px rgba(204,255,0,0.15)" }}
    >
      <Icon className="h-12 w-12 text-primary" strokeWidth={1.5} />
    </motion.div>
  );
}

// ── Variant configs ──

const VARIANT_CONFIG: Record<
  Exclude<EmptyStateVariant, "custom">,
  {
    illustration: React.ReactNode;
    title: string;
    description: string;
    actionLabel: string;
    accentColor: "primary" | "secondary" | "danger" | "info";
  }
> = {
  workouts: {
    illustration: <DumbbellIllustration />,
    title: "START YOUR JOURNEY",
    description: "Your telemetry is blank. Initiate a training protocol to begin data collection.",
    actionLabel: "Start Workout",
    accentColor: "primary",
  },
  routines: {
    illustration: <RoutinesIllustration />,
    title: "BUILD YOUR ROUTINE",
    description: "No structured protocols found. Leverage AI to construct an optimized training pathway.",
    actionLabel: "Generate with AI",
    accentColor: "secondary",
  },
  prs: {
    illustration: <TrophyIllustration />,
    title: "NO PRS YET",
    description: "Performance thresholds undefined. Push beyond limits to establish baseline metrics.",
    actionLabel: "Start Workout",
    accentColor: "danger",
  },
  measurements: {
    illustration: <MeasurementsIllustration />,
    title: "TRACK YOUR PROGRESS",
    description: "Physical telemetry missing. Input current biometrics to track evolutionary progress.",
    actionLabel: "Add Measurement",
    accentColor: "primary",
  },
  photos: {
    illustration: <PhotosIllustration />,
    title: "CAPTURE YOUR PROGRESS",
    description: "Visual data absent. Document physical state to correlate with performance metrics.",
    actionLabel: "Add Photo",
    accentColor: "info",
  },
};

const ACCENT_BORDER: Record<string, string> = {
  primary: "border-t-2 border-t-primary",
  secondary: "border-t-2 border-t-secondary",
  danger: "border-t-2 border-t-danger",
  info: "border-t-2 border-t-info",
};

const ACCENT_GLOW: Record<string, string> = {
  primary: "rgba(204,255,0,0.05)",
  secondary: "rgba(0,238,252,0.05)",
  danger: "rgba(255,82,82,0.05)",
  info: "rgba(56,189,248,0.05)",
};

/**
 * KineticEmptyState — high-performance empty state component.
 *
 * 5 pre-built variants with custom SVG illustrations + Framer Motion animations.
 */
export function KineticEmptyState({
  variant = "custom",
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: KineticEmptyStateProps) {
  if (variant === "custom") {
    if (!icon) {
      console.warn("[KineticEmptyState] variant='custom' requires an `icon` prop");
      return null;
    }
    return (
      <EmptyStateShell
        illustration={<CustomIconIllustration Icon={icon} />}
        title={title || "NO DATA"}
        description={description || "No data available yet."}
        actionLabel={actionLabel}
        onAction={onAction}
        accentClass="border-t-2 border-t-primary"
        accentGlow="rgba(204,255,0,0.05)"
        className={className}
      />
    );
  }

  const config = VARIANT_CONFIG[variant];
  return (
    <EmptyStateShell
      illustration={config.illustration}
      title={title || config.title}
      description={description || config.description}
      actionLabel={actionLabel || config.actionLabel}
      onAction={onAction}
      accentClass={ACCENT_BORDER[config.accentColor]}
      accentGlow={ACCENT_GLOW[config.accentColor]}
      className={className}
    />
  );
}

function EmptyStateShell({
  illustration,
  title,
  description,
  actionLabel,
  onAction,
  accentClass,
  accentGlow,
  className,
}: {
  illustration: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  accentClass: string;
  accentGlow: string;
  className?: string;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={cn(
        "glass-card group relative flex flex-col items-center overflow-hidden rounded-2xl border border-border p-6 text-center",
        accentClass,
        className
      )}
    >
      {/* Hover glow background */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b to-transparent opacity-0 transition-opacity duration-700 group-hover:opacity-100"
        style={{ background: `linear-gradient(to bottom, ${accentGlow}, transparent)` }}
      />

      {/* Illustration area */}
      <div className="relative mb-6 flex h-32 w-32 items-center justify-center">
        {illustration}
      </div>

      {/* Title */}
      <h3 className="mb-3 text-lg font-black uppercase italic tracking-tight text-text-primary">
        {title}
      </h3>

      {/* Description */}
      <p className="mb-6 max-w-xs text-sm leading-relaxed text-text-secondary">
        {description}
      </p>

      {/* CTA button */}
      {actionLabel && onAction && (
        <motion.button
          whileTap={{ scale: 0.98 }}
          whileHover={{ scale: 1.02 }}
          onClick={onAction}
          className="flex w-full max-w-[240px] items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-black uppercase italic tracking-wider text-black transition-all"
          style={{ boxShadow: "0 0 20px rgba(204,255,0,0.2)" }}
        >
          {actionLabel}
          <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
        </motion.button>
      )}
    </motion.section>
  );
}

// ── Backward compatibility: re-export as DataEmptyState ──
export function DataEmptyState(props: {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}) {
  return <KineticEmptyState variant="custom" {...props} />;
}
