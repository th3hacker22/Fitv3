import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Moon,
  Timer,
  Bell,
  Scale,
  Info,
  ChevronRight,
  Sun,
  Monitor,
  Volume2,
} from "lucide-react";
import { useSettingsStore, Theme } from "@/store/useSettingsStore";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: "easeOut" as const },
  }),
};

export default function SettingsPage() {
  const {
    ramadanMode,
    toggleRamadanMode,
    restDuration,
    setRestDuration,
    weightUnit,
    setWeightUnit,
    notificationsEnabled,
    toggleNotifications,
    soundEnabled,
    toggleSound,
    theme,
    setTheme
  } = useSettingsStore();

  return (
    <div className="space-y-6 pb-6">
      {/* ── Back Button ── */}
      <Link
        to="/profile"
        className="inline-flex items-center gap-2 text-sm font-medium text-text-secondary transition-colors hover:text-primary uppercase tracking-wide"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      {/* ── Page Title ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-xl font-bold text-text-primary uppercase tracking-wider">
          Settings
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Customize your Pulse experience
        </p>
      </motion.div>

      {/* ── Theme ── */}
      <motion.div
        className="glass-card rounded-[--radius-card] p-4"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={0}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-muted">
            <Sun className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-text-primary uppercase tracking-wider truncate">
              App Theme
            </p>
            <p className="text-xs text-text-muted truncate">
              Light, Dark or System
            </p>
          </div>
        </div>
        <div className="flex p-1 bg-bg-surface-hover rounded-xl border border-border">
          {[
            { value: "light" as Theme, label: "Light", icon: Sun },
            { value: "dark" as Theme, label: "Dark", icon: Moon },
            { value: "system" as Theme, label: "System", icon: Monitor },
          ].map((option) => {
            const isSelected = theme === option.value;
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                onClick={() => setTheme(option.value)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold transition-all uppercase tracking-wider",
                  isSelected
                    ? "bg-bg-elevated text-text-primary shadow-sm ring-1 ring-border"
                    : "text-text-muted hover:text-text-secondary"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{option.label}</span>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* ── Ramadan Mode ── */}
      <motion.div
        className="glass-card rounded-[--radius-card] p-4"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={1}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/10">
              <Moon className="h-5 w-5 text-warning" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-text-primary uppercase tracking-wider truncate">
                Ramadan Mode 🌙
              </p>
              <p className="text-xs text-text-muted truncate">
                Optimize for fasting month
              </p>
            </div>
          </div>
          <button
            onClick={toggleRamadanMode}
            className={cn(
              "relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300",
              ramadanMode ? "bg-warning" : "bg-bg-elevated",
            )}
          >
            <motion.div
              className="absolute top-1 h-5 w-5 rounded-full bg-white shadow-md"
              animate={{ x: ramadanMode ? 24 : 4 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </button>
        </div>
        {ramadanMode && (
          <motion.p
            className="mt-3 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning border border-warning/20 uppercase tracking-wider text-center"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
          >
            ✨ Ramadan Mode Active! Ramadan Mubarak 🌙
          </motion.p>
        )}
      </motion.div>

      {/* ── Rest Timer Duration ── */}
      <motion.div
        className="glass-card rounded-[--radius-card] p-4"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={1}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-muted">
            <Timer className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-text-primary uppercase tracking-wider truncate">
              Rest Duration
            </p>
            <p className="text-xs text-text-muted truncate">
              Default time between sets
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {[60, 90, 120, 180].map((seconds) => (
            <Button
              key={seconds}
              onClick={() => setRestDuration(seconds)}
              variant={restDuration === seconds ? "primary" : "ghost"}
              className="flex-1 py-2 text-sm font-semibold"
            >
              {seconds >= 60 ? `${seconds / 60}m` : `${seconds}s`}
            </Button>
          ))}
        </div>
      </motion.div>

      {/* ── Weight Unit ── */}
      <motion.div
        className="glass-card rounded-[--radius-card] p-4"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={2}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/10">
            <Scale className="h-5 w-5 text-success" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-text-primary uppercase tracking-wider truncate">
              Weight Unit
            </p>
            <p className="text-xs text-text-muted truncate">
              Preferred measurement
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {[
            { value: "kg" as const, label: "Kilograms (kg)" },
            { value: "lbs" as const, label: "Pounds (lbs)" },
          ].map((option) => (
            <Button
              key={option.value}
              onClick={() => setWeightUnit(option.value)}
              variant={weightUnit === option.value ? "primary" : "ghost"}
              className="flex-1 py-2.5 text-sm uppercase tracking-wider h-auto font-semibold"
            >
              {option.label}
            </Button>
          ))}
        </div>
      </motion.div>

      {/* ── Notifications ── */}
      <motion.div
        className="glass-card rounded-[--radius-card] p-4"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={3}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-muted">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-text-primary uppercase tracking-wider truncate">
                Notifications
              </p>
              <p className="text-xs text-text-muted truncate">
                Workout reminders
              </p>
            </div>
          </div>
          <button
            onClick={toggleNotifications}
            className={cn(
              "relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300",
              notificationsEnabled
                ? "bg-primary shadow-[0_0_10px_rgba(204,255,0,0.4)]"
                : "bg-bg-elevated",
            )}
          >
            <motion.div
              className="absolute top-1 h-5 w-5 rounded-full bg-white shadow-md relative"
              animate={{ x: notificationsEnabled ? 24 : 4 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </button>
        </div>
      </motion.div>

      {/* ── Sounds ── */}
      <motion.div
        className="glass-card rounded-[--radius-card] p-4"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={4}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-info/10">
              <Volume2 className="h-5 w-5 text-info" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-text-primary uppercase tracking-wider truncate">
                Sound Effects
              </p>
              <p className="text-xs text-text-muted truncate">
                Audio cues for workouts
              </p>
            </div>
          </div>
          <button
            onClick={toggleSound}
            className={cn(
              "relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300",
              soundEnabled
                ? "bg-info shadow-[0_0_10px_rgba(59,130,246,0.4)]"
                : "bg-bg-elevated",
            )}
          >
            <motion.div
              className="absolute top-1 h-5 w-5 rounded-full bg-white shadow-md relative"
              animate={{ x: soundEnabled ? 24 : 4 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </button>
        </div>
      </motion.div>

      {/* ── About ── */}
      <motion.div
        className="glass-card rounded-[--radius-card] p-4 flex items-center justify-between active:scale-[0.98] transition-all cursor-pointer hover:ring-1 hover:ring-border/80"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={5}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-bg-elevated">
            <Info className="h-5 w-5 text-text-secondary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-text-primary uppercase tracking-wider truncate">
              About
            </p>
            <p className="text-xs text-text-muted truncate">Pulse v1.0.0</p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-text-muted shrink-0" />
      </motion.div>

      {/* ── Footer ── */}
      <motion.p
        className="text-center text-xs text-text-muted pt-4 uppercase tracking-widest opacity-80"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={5}
      >
        Crafted with ⚡ for the Fitness Community
      </motion.p>
    </div>
  );
}
