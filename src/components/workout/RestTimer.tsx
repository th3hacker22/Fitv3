"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Timer } from "lucide-react";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useGeneratorStore } from "@/store/useGeneratorStore";
import { playTimerCompleteSound } from "@/utils/audio";
import { sendNotification } from "@/utils/notifications";
import { suggestRestDuration, type SmartRestRecommendation } from "@/services/smartRest";
import { voiceCoach } from "@/services/voiceCoach";
import { cn } from "@/utils/cn";

const CIRCUMFERENCE = 2 * Math.PI * 24; // r=24

export default function RestTimer() {
  const restTimerActive = useWorkoutStore((s) => s.restTimerActive);
  const dismissRestTimer = useWorkoutStore((s) => s.dismissRestTimer);
  const restTimerExerciseRole = useWorkoutStore((s) => s.restTimerExerciseRole);
  const restTimerLastRPE = useWorkoutStore((s) => s.restTimerLastRPE);
  const restDuration = useSettingsStore((s) => s.restDuration);
  const notificationsEnabled = useSettingsStore((s) => s.notificationsEnabled);
  // Read the user's primary goal to pass to suggestRestDuration.
  // Falls back to "Hypertrophy" if the generator profile hasn't been filled yet.
  const goal = useGeneratorStore((s) => s.goal) || "Hypertrophy";

  // Compute the smart-rest recommendation. Memoized on the activation inputs so
  // it stays stable for the lifetime of one rest period (the suggested duration
  // won't drift as the timer counts down).
  const recommendation: SmartRestRecommendation = useMemo(
    () =>
      suggestRestDuration({
        role: restTimerExerciseRole,
        lastSetRPE: restTimerLastRPE,
        goal,
        defaultRest: restDuration,
      }),
    [restTimerExerciseRole, restTimerLastRPE, goal, restDuration]
  );

  const suggestedSeconds = recommendation.seconds;
  const [seconds, setSeconds] = useState(suggestedSeconds);
  const [prevActive, setPrevActive] = useState(restTimerActive);
  const [prevSuggested, setPrevSuggested] = useState(suggestedSeconds);

  if (restTimerActive !== prevActive || (restTimerActive && suggestedSeconds !== prevSuggested)) {
    setPrevActive(restTimerActive);
    setPrevSuggested(suggestedSeconds);
    if (restTimerActive) {
      setSeconds(suggestedSeconds);
    }
  }

  // Countdown — depend ONLY on restTimerActive so the interval is created once
  // per activation, not recreated every second (which caused timing drift).
  // Side effects (sound, notification, dismiss) moved to a separate effect
  // to keep the setSeconds updater pure (StrictMode double-fires updaters).
  useEffect(() => {
    if (!restTimerActive) return;

    const interval = setInterval(() => {
      setSeconds((prev: number) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [restTimerActive]);

  // Fire completion side effects when the timer reaches 0.
  useEffect(() => {
    if (restTimerActive && seconds === 0) {
      playTimerCompleteSound();
      voiceCoach.speak("rest_complete");
      if (notificationsEnabled) {
        sendNotification("Rest complete", {
          body: "Time for your next set. Let's go!",
        });
      }
      dismissRestTimer();
    }
  }, [restTimerActive, seconds, notificationsEnabled, dismissRestTimer]);

  // 15-second warning — only fires when the rest period was long enough to
  // justify a heads-up (avoids the warning overlapping the final countdown
  // of a short 30s rest).
  useEffect(() => {
    if (restTimerActive && seconds === 15 && suggestedSeconds > 30) {
      voiceCoach.speak("rest_15s_left");
    }
  }, [restTimerActive, seconds, suggestedSeconds]);

  const progress = Math.min(1, seconds / suggestedSeconds);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const formatTime = `${mins}:${secs.toString().padStart(2, "0")}`;

  const handleDismiss = useCallback(() => {
    dismissRestTimer();
  }, [dismissRestTimer]);

  const handlePreset = useCallback((delta: number) => {
    setSeconds((prev: number) => Math.max(0, prev + delta));
  }, []);

  // "Ready!" pulse — final 5 seconds of the rest period.
  const isReady = seconds > 0 && seconds <= 5;

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
          <div
            className={cn(
              "rounded-2xl border bg-bg-elevated/95 p-4 backdrop-blur-xl shadow-glow transition-colors",
              isReady ? "border-success/40" : "border-primary/20"
            )}
          >
            <div className="flex items-center gap-4">
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
                    stroke={isReady ? "var(--color-success)" : "var(--color-primary)"}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={CIRCUMFERENCE}
                    strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
                    className="transition-all duration-1000 ease-linear"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Timer
                    className={cn("h-5 w-5", isReady ? "text-success" : "text-primary")}
                    aria-hidden="true"
                  />
                </div>
              </div>

              {/* Timer Info */}
              <div
                className="flex-1 min-w-0"
                role="timer"
                aria-live="polite"
                aria-atomic="true"
              >
                <p className="text-xs font-medium text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                  {isReady ? (
                    <>
                      <span className="text-success font-bold">Ready!</span>
                      <span aria-hidden="true">⚡</span>
                    </>
                  ) : (
                    <>
                      Rest Time <span aria-hidden="true">⏱</span>
                    </>
                  )}
                </p>
                <p
                  className={cn(
                    "text-2xl font-bold tabular-nums transition-colors",
                    isReady ? "text-success animate-pulse" : "text-text-primary"
                  )}
                >
                  {formatTime}
                </p>
                {recommendation.reason && (
                  <p className="text-[10px] text-text-muted mt-0.5 truncate" title={recommendation.reason}>
                    {recommendation.reason}
                  </p>
                )}
              </div>

              {/* Dismiss */}
              <button
                onClick={handleDismiss}
                aria-label="Dismiss rest timer"
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-bg-card text-text-secondary transition-colors hover:text-text-primary"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {/* Quick-adjust presets row */}
            <div className="mt-3 grid grid-cols-4 gap-2">
              {recommendation.presets.map((p) => {
                const isNegative = p.delta < 0;
                const isPlus = p.delta > 0;
                return (
                  <button
                    key={p.label}
                    onClick={() => handlePreset(p.delta)}
                    aria-label={`${p.label} to rest timer`}
                    className={cn(
                      "flex h-9 items-center justify-center rounded-xl text-xs font-bold transition-colors active:scale-95",
                      isNegative
                        ? "bg-bg-card text-text-secondary hover:bg-bg-hover hover:text-danger"
                        : isPlus
                        ? "bg-primary-muted text-primary hover:bg-primary/20"
                        : "bg-bg-card text-text-secondary hover:bg-bg-hover"
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
