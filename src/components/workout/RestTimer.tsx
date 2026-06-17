import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Timer } from "lucide-react";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { playTimerCompleteSound } from "@/utils/audio";
import { sendNotification } from "@/utils/notifications";

const CIRCUMFERENCE = 2 * Math.PI * 24; // r=24

export default function RestTimer() {
  const restTimerActive = useWorkoutStore((s) => s.restTimerActive);
  const dismissRestTimer = useWorkoutStore((s) => s.dismissRestTimer);
  const restDuration = useSettingsStore((s) => s.restDuration);
  const notificationsEnabled = useSettingsStore((s) => s.notificationsEnabled);
  const [seconds, setSeconds] = useState(restDuration);

  // Reset when activated
  useEffect(() => {
    if (restTimerActive) {
      setSeconds(restDuration);
    }
  }, [restTimerActive, restDuration]);

  // Countdown
  useEffect(() => {
    if (!restTimerActive || seconds <= 0) return;

    const interval = setInterval(() => {
      setSeconds((prev: number) => {
        if (prev <= 1) {
          playTimerCompleteSound();
          if (notificationsEnabled) {
            sendNotification("Rest complete", {
              body: "Time for your next set. Let's go!",
            });
          }
          dismissRestTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [restTimerActive, seconds, dismissRestTimer, notificationsEnabled]);

  const progress = seconds / restDuration;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const formatTime = `${mins}:${secs.toString().padStart(2, "0")}`;

  const handleDismiss = useCallback(() => {
    dismissRestTimer();
  }, [dismissRestTimer]);

  return (
    <AnimatePresence>
      {restTimerActive && (
        <motion.div
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed inset-x-0 bottom-20 z-[100] mx-auto max-w-md px-5"
        >
          <div className="flex items-center gap-4 rounded-2xl border border-primary/20 bg-bg-elevated/95 p-4 backdrop-blur-xl shadow-glow">
            {/* Circular Progress */}
            <div className="relative h-14 w-14 flex-shrink-0">
              <svg className="h-14 w-14 -rotate-90" viewBox="0 0 56 56">
                <circle
                  cx="28"
                  cy="28"
                  r="24"
                  fill="none"
                  stroke="var(--color-border)"
                  strokeWidth="4"
                />
                <circle
                  cx="28"
                  cy="28"
                  r="24"
                  fill="none"
                  stroke="var(--color-primary)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
                  className="transition-all duration-1000 ease-linear"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <Timer className="h-5 w-5 text-primary" />
              </div>
            </div>

            {/* Timer Info */}
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
                Rest Time ⏱
              </p>
              <p className="text-2xl font-bold tabular-nums text-text-primary">
                {formatTime}
              </p>
            </div>

            {/* Quick Add */}
            <button
              onClick={() => setSeconds((p: number) => p + 30)}
              className="flex h-10 items-center justify-center rounded-xl bg-primary-muted px-3 text-xs font-bold text-primary transition-colors hover:bg-primary/20"
            >
              +30s
            </button>

            {/* Dismiss */}
            <button
              onClick={handleDismiss}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-bg-card text-text-muted transition-colors hover:text-text-primary"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
