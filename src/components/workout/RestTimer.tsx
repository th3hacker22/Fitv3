"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X, Timer } from "lucide-react";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useGeneratorStore } from "@/store/useGeneratorStore";
import { playTimerCompleteSound } from "@/utils/audio";
import { sendNotification } from "@/services/notificationService";
import { suggestRestDuration, type SmartRestRecommendation } from "@/services/smartRest";
import { voiceCoach } from "@/services/voiceCoach";
import { cn } from "@/utils/cn";

const CIRCUMFERENCE = 2 * Math.PI * 24; // r=24

/**
 * Compute remaining seconds from a timestamp-based end time.
 * Pure function — also used by the tests.
 * @returns integer seconds remaining (≥ 0).
 */
export function computeRemainingSeconds(endTs: number | undefined, now: number = Date.now()): number {
  if (endTs == null) return 0;
  return Math.max(0, Math.ceil((endTs - now) / 1000));
}

export default function RestTimer() {
  const restTimerActive = useWorkoutStore((s) => s.restTimerActive);
  const restTimerEndTs = useWorkoutStore((s) => s.restTimerEndTs);
  const restTimerTotalDuration = useWorkoutStore((s) => s.restTimerTotalDuration);
  const restTimerExerciseRole = useWorkoutStore((s) => s.restTimerExerciseRole);
  const restTimerLastRPE = useWorkoutStore((s) => s.restTimerLastRPE);
  const dismissRestTimer = useWorkoutStore((s) => s.dismissRestTimer);
  const adjustRestTimer = useWorkoutStore((s) => s.adjustRestTimer);
  const restDuration = useSettingsStore((s) => s.restDuration);
  const notificationsEnabled = useSettingsStore((s) => s.notificationsEnabled);
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const goal = useGeneratorStore((s) => s.goal) || "Hypertrophy";
  const prefersReducedMotion = useReducedMotion();

  // The recommendation is recomputed for display purposes (reason text +
  // presets). The actual countdown duration comes from the store's
  // restTimerEndTs — not from recommendation.seconds — so the timer is
  // timestamp-based and survives reloads.
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

  // ── Timestamp-based remaining seconds ──
  // The source of truth is restTimerEndTs (persisted). The displayed value
  // is recomputed every second AND on visibilitychange / focus so it's
  // always accurate even after the tab was backgrounded or reloaded.
  const [seconds, setSeconds] = useState(() =>
    computeRemainingSeconds(restTimerEndTs)
  );

  // Track whether the completion side effects (sound, voice, notification,
  // dismiss) have already fired for the current rest period. This prevents
  // double-firing in React StrictMode (which double-invokes effects) and
  // also prevents re-firing if the interval ticks past 0 multiple times
  // before the dismiss takes effect.
  const completedRef = useRef(false);
  const fifteenFiredRef = useRef(false);

  // ── Countdown interval (recomputes from timestamp every second) ──
  // Depend ONLY on restTimerActive so the interval is created once per
  // activation, not recreated every second (which caused timing drift).
  useEffect(() => {
    if (!restTimerActive || restTimerEndTs == null) return;

    // Sync immediately on activation / mount.
    completedRef.current = false;
    fifteenFiredRef.current = false;
    setSeconds(computeRemainingSeconds(restTimerEndTs));

    const interval = setInterval(() => {
      setSeconds(computeRemainingSeconds(restTimerEndTs));
    }, 1000);

    return () => clearInterval(interval);
  }, [restTimerActive, restTimerEndTs]);

  // ── Resync on visibility change / focus ──
  // When the user returns to the tab after switching away, recompute the
  // remaining seconds immediately (the 1s interval may not have fired
  // while the tab was throttled in the background). This also covers the
  // case where the rest period ended entirely while the tab was hidden —
  // the completion effect below will fire and show the notification.
  useEffect(() => {
    if (!restTimerActive || restTimerEndTs == null) return;

    const resync = () => {
      setSeconds(computeRemainingSeconds(restTimerEndTs));
    };

    document.addEventListener("visibilitychange", resync);
    window.addEventListener("focus", resync);
    return () => {
      document.removeEventListener("visibilitychange", resync);
      window.removeEventListener("focus", resync);
    };
  }, [restTimerActive, restTimerEndTs]);

  // ── Fire completion side effects when the timer reaches 0 ──
  // StrictMode-safe via completedRef: the side effects fire exactly once
  // per rest period, even if the effect is double-invoked.
  useEffect(() => {
    if (!restTimerActive || restTimerEndTs == null) return;
    if (seconds > 0) return;
    if (completedRef.current) return;
    completedRef.current = true;

    if (soundEnabled) playTimerCompleteSound();
    voiceCoach.speak("rest_complete");
    if (notificationsEnabled) {
      sendNotification("Rest complete", {
        body: "Time for your next set. Let's go!",
      });
    }
    dismissRestTimer();
  }, [restTimerActive, restTimerEndTs, seconds, notificationsEnabled, soundEnabled, dismissRestTimer]);

  // ── 15-second warning ──
  // Only fires when the rest period was long enough to justify a heads-up
  // (avoids the warning overlapping the final countdown of a short 30s rest).
  // StrictMode-safe via fifteenFiredRef.
  useEffect(() => {
    if (!restTimerActive || restTimerEndTs == null) return;
    if (seconds !== 15) return;
    if (fifteenFiredRef.current) return;
    const total = restTimerTotalDuration ?? 0;
    if (total <= 30) return;
    fifteenFiredRef.current = true;
    voiceCoach.speak("rest_15s_left");
  }, [restTimerActive, restTimerEndTs, restTimerTotalDuration, seconds]);

  // ── Background notification via setTimeout ──
  // When the tab is hidden, the 1s interval may be throttled. To deliver
  // the "rest complete" notification as close to on-time as possible even
  // in the background, schedule a one-shot setTimeout for the exact
  // remaining duration. This fires (possibly slightly late) and triggers
  // the notification. The visibilitychange handler + the completion effect
  // above serve as a fallback for when the setTimeout is further delayed.
  useEffect(() => {
    if (!restTimerActive || restTimerEndTs == null || !notificationsEnabled) return;

    const remainingMs = restTimerEndTs - Date.now();
    if (remainingMs <= 0) return;

    const timeoutId = window.setTimeout(() => {
      // Only fire if the timer hasn't already been dismissed/completed.
      // The completion effect handles the full side-effect chain; here we
      // just nudge the state so that effect runs even if the interval is
      // throttled.
      setSeconds(computeRemainingSeconds(restTimerEndTs));
    }, remainingMs);

    return () => window.clearTimeout(timeoutId);
  }, [restTimerActive, restTimerEndTs, notificationsEnabled]);

  // Total duration for the progress ring denominator. Falls back to the
  // recommendation's suggested seconds if the store value is missing
  // (e.g., legacy persisted state from before this field existed).
  const totalDuration = restTimerTotalDuration ?? recommendation.seconds;

  const progress = totalDuration > 0 ? Math.min(1, seconds / totalDuration) : 0;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const formatTime = `${mins}:${secs.toString().padStart(2, "0")}`;

  const handleDismiss = useCallback(() => {
    dismissRestTimer();
  }, [dismissRestTimer]);

  const handlePreset = useCallback(
    (delta: number) => {
      // Timestamp-based: shift restTimerEndTs by ±delta seconds. The
      // countdown picks up the new end time on the next interval tick
      // (or immediately via the resync effect).
      adjustRestTimer(delta);
      // Immediately recompute so the UI updates without waiting 1s.
      setSeconds(computeRemainingSeconds(useWorkoutStore.getState().restTimerEndTs));
    },
    [adjustRestTimer]
  );

  // "Ready!" pulse — final 5 seconds of the rest period.
  const isReady = seconds > 0 && seconds <= 5;

  return (
    <AnimatePresence>
      {restTimerActive && (
        <motion.div
          initial={prefersReducedMotion ? false : { y: 120, opacity: 0 }}
          animate={prefersReducedMotion ? undefined : { y: 0, opacity: 1 }}
          exit={prefersReducedMotion ? undefined : { y: 120, opacity: 0 }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { type: "spring", damping: 25, stiffness: 300 }
          }
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
                    isReady && !prefersReducedMotion
                      ? "text-success animate-pulse"
                      : isReady
                      ? "text-success"
                      : "text-text-primary"
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
