"use client";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "@/router-shim";
import { motion } from "framer-motion";
import { X, Clock, Flag, Trophy } from "lucide-react";
import confetti from "canvas-confetti";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { getWorkoutStreak, getPersonalRecords } from "@/db";
import { estimateOneRepMax } from "@/utils/fitnessMath";
import ExerciseWorkoutCard from "@/components/workout/ExerciseWorkoutCard";
import RestTimer from "@/components/workout/RestTimer";
import ShareCard from "@/components/workout/ShareCard";
import PRCelebration, { type PRCelebrationData } from "@/components/workout/PRCelebration";
import { ConfirmModal } from "@/components/ui-custom/ConfirmationModal";
import { Button } from "@/components/ui-custom/Button";
import { playWorkoutStartSound, playWorkoutStopSound } from "@/utils/audio";
import { voiceCoach } from "@/services/voiceCoach";

// ── Timer Hook ──
function useElapsedTimer(startedAt: number) {
  const [prevStartedAt, setPrevStartedAt] = useState(startedAt);
  const [elapsed, setElapsed] = useState(() => Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));

  if (startedAt !== prevStartedAt) {
    setPrevStartedAt(startedAt);
    setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return {
    elapsed,
    formatted: `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`,
  };
}

export default function WorkoutSessionPage() {
  const navigate = useNavigate();
  const activeWorkout = useWorkoutStore((s) => s.activeWorkout);
  const isWorkoutActive = useWorkoutStore((s) => s.isWorkoutActive);
  const resumeWorkout = useWorkoutStore((s) => s.resumeWorkout);
  const finishWorkout = useWorkoutStore((s) => s.finishWorkout);
  const cancelWorkout = useWorkoutStore((s) => s.cancelWorkout);
  const [isFinishing, setIsFinishing] = useState(false);
  const [showShareCard, setShowShareCard] = useState(false);
  const [shareToFeed, setShareToFeed] = useState(true);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [workoutSummary, setWorkoutSummary] = useState<{
    date: string;
    duration: number;
    totalVolume: number;
    exerciseCount: number;
    setCount: number;
    streak?: number;
  } | null>(null);

  // ── PR Celebration State ──
  // Snapshot of the user's prior best e1RM per exercise, loaded on mount.
  // Used to detect new PRs the instant a set is completed mid-workout.
  const [prCelebration, setPrCelebration] = useState<PRCelebrationData | null>(null);
  const [knownPRs, setKnownPRs] = useState<Map<string, { weight: number; e1rm: number }>>(
    new Map()
  );
  const [prsLoaded, setPrsLoaded] = useState(false);
  const prevCompletedRef = useRef(0);

  const { elapsed, formatted: elapsedTime } = useElapsedTimer(
    activeWorkout?.startedAt ?? Date.now()
  );

  // Play start sound when workout becomes active
  useEffect(() => {
    if (activeWorkout && isWorkoutActive) {
      playWorkoutStartSound();
    }
  }, [activeWorkout, isWorkoutActive]);

  // Show resume modal on mount if workout is persisted but not active in session
  useEffect(() => {
    if (activeWorkout && !isWorkoutActive) {
      setTimeout(() => {
        setShowResumeModal(true);
      }, 0);
    }
  }, [activeWorkout, isWorkoutActive]);

  // Total prescribed & completed sets — derived from `activeWorkout`. Computed
  // up here (before any effect that needs them) so the voice-coach halfway
  // effect and the PR-detection effects below can reference them without
  // tripping the "accessed before declared" rule.
  const totalCompleted =
    activeWorkout?.exercises.reduce(
      (acc, ex) => acc + ex.sets.filter((s) => s.completed).length,
      0
    ) ?? 0;
  const totalSets = activeWorkout?.exercises.reduce((acc, ex) => acc + ex.sets.length, 0) ?? 0;

  // ── Voice Coach: announce when the workout crosses the halfway mark ──
  // Fires exactly once per session — guarded by `halfwayAnnouncedRef` so the
  // user doesn't hear it on every set after the threshold.
  const halfwayAnnouncedRef = useRef(false);
  useEffect(() => {
    if (!activeWorkout || halfwayAnnouncedRef.current) return;
    if (totalSets < 4) return; // skip tiny workouts — no meaningful "halfway"
    const completed = activeWorkout.exercises.reduce(
      (acc, ex) => acc + ex.sets.filter((s) => s.completed).length,
      0
    );
    if (completed >= Math.ceil(totalSets / 2)) {
      halfwayAnnouncedRef.current = true;
      voiceCoach.speak("halfway");
    }
  }, [activeWorkout, totalSets]);

  // Redirect if no active workout and not showing share card
  useEffect(() => {
    if (!activeWorkout && !showShareCard) {
      navigate({ to: "/" });
    }
  }, [activeWorkout, showShareCard, navigate]);

  // ── Load known Personal Records on mount ──
  // We snapshot the user's prior best e1RM per exercise so we can compare
  // against sets as they're completed. Updates to knownPRs during the workout
  // (when a new PR is set) prevent re-triggering the celebration for the same set.
  useEffect(() => {
    let cancelled = false;
    getPersonalRecords()
      .then((prs) => {
        if (cancelled) return;
        const map = new Map<string, { weight: number; e1rm: number }>();
        for (const pr of prs) {
          map.set(String(pr.exerciseId), { weight: pr.maxWeight, e1rm: pr.max1RM });
        }
        setKnownPRs(map);
        setPrsLoaded(true);
        // Sync the completed-count baseline so we don't fire PR celebrations
        // for sets that were already completed before this effect ran.
        prevCompletedRef.current = totalCompleted;
      })
      .catch((err) => {
        console.warn("[PRCelebration] Failed to load personal records:", err);
        setPrsLoaded(true);
        prevCompletedRef.current = totalCompleted;
      });
    return () => {
      cancelled = true;
    };
    // Intentionally empty deps — load once on mount. `totalCompleted` is read
    // as a snapshot for baseline sync, not as a reactive dep.
  }, []);

  // ── Watch for newly-completed sets and detect PRs ──
  // When `totalCompleted` increments, scan all completed sets for any whose
  // estimated 1RM exceeds the known PR for its exercise. If found, fire the
  // PRCelebration modal and update the in-memory PR cache so the same set
  // doesn't re-trigger it. We pick the highest-e1RM candidate when multiple
  // new PRs land in the same tick (e.g. superset completed together).
  useEffect(() => {
    if (!prsLoaded || !activeWorkout) {
      prevCompletedRef.current = totalCompleted;
      return;
    }
    if (totalCompleted > prevCompletedRef.current) {
      let found: { exId: string; e1rm: number; data: PRCelebrationData } | null = null;
      for (const ex of activeWorkout.exercises) {
        for (const set of ex.sets) {
          if (!set.completed) continue;
          const w = Number(set.weight) || 0;
          const r = Number(set.reps) || 0;
          const e1rm = estimateOneRepMax(w, r);
          if (e1rm <= 0) continue;
          const knownPR = knownPRs.get(String(ex.exerciseId));
          if (!knownPR || e1rm > knownPR.e1rm) {
            if (!found || e1rm > found.e1rm) {
              found = {
                exId: String(ex.exerciseId),
                e1rm,
                data: {
                  exerciseName: ex.exerciseName,
                  weight: w,
                  reps: r,
                  previousWeight: knownPR?.weight,
                  estimated1RM: Math.round(e1rm * 10) / 10,
                },
              };
            }
          }
        }
      }
      if (found) {
        setPrCelebration(found.data);
        const newMap = new Map(knownPRs);
        newMap.set(found.exId, { weight: found.data.weight, e1rm: found.e1rm });
        setKnownPRs(newMap);
      }
    }
    prevCompletedRef.current = totalCompleted;
  }, [totalCompleted, activeWorkout, knownPRs, prsLoaded]);

  if (!activeWorkout && !showShareCard) return null;

  // Calculate total volume
  const totalVolume =
    activeWorkout?.exercises.reduce((acc, ex) => {
      return (
        acc +
        ex.sets
          .filter((s) => s.completed)
          .reduce((setAcc, s) => setAcc + (Number(s.weight) || 0) * (Number(s.reps) || 0), 0)
      );
    }, 0) ?? 0;

  // ── Fire Confetti Celebration ──
  const fireConfetti = () => {
    const defaults = {
      colors: ["#CCFF00", "#00FFFF", "#FF00FF", "#00FF66"], // High-energy Pulse neon colors
      origin: { y: 0.7 },
    };

    confetti({ ...defaults, particleCount: 60, spread: 55, angle: 60 });
    confetti({ ...defaults, particleCount: 60, spread: 55, angle: 120 });

    setTimeout(() => {
      confetti({ ...defaults, particleCount: 40, spread: 100 });
    }, 300);
  };

  // ── Handle Finish Workout ──
  const requestFinish = () => {
    if (!activeWorkout) return;
    setShowFinishConfirm(true);
  };

  const confirmFinish = async () => {
    setShowFinishConfirm(false);

    if (!activeWorkout) return;

    setIsFinishing(true);
    fireConfetti();

    // Get streak before saving (it will increase after save)
    const currentStreak = await getWorkoutStreak();

    // Prepare summary for share card
    const summary = {
      date: new Date().toISOString(),
      duration: elapsed,
      totalVolume,
      exerciseCount: activeWorkout.exercises.filter((e) => e.sets.some((s) => s.completed)).length,
      setCount: totalCompleted,
      streak: currentStreak + 1,
    };

    setWorkoutSummary(summary);

    // Save to DB
    await finishWorkout(shareToFeed);
    playWorkoutStopSound();

    // ── Request notification permission AFTER first workout ──
    // This is the optimal time: the user just experienced the app's core value,
    // so they're most likely to accept. Non-blocking.
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        import("@/services/notificationService").then(({ requestNotificationPermission }) => {
          requestNotificationPermission().catch(() => {});
        }).catch(() => {});
      }
    }

    // Voice Coach: celebrate a completed session (no-op when disabled).
    // Fired AFTER finishWorkout so any new-PR announcements play first,
    // then the closing message — uses speakText to bypass the 2s throttle
    // (speak() would silently drop this right after a PR toast).
    voiceCoach.speakText("Workout complete! Amazing session!");

    // Show share card
    setTimeout(() => {
      setIsFinishing(false);
      setShowShareCard(true);
    }, 1500);
  };

  // ── Handle Cancel ──
  const requestCancel = () => {
    if (totalCompleted > 0) {
      setShowCancelConfirm(true);
    } else {
      cancelWorkout();
      playWorkoutStopSound();
      navigate({ to: "/" });
    }
  };

  const confirmCancel = () => {
    setShowCancelConfirm(false);
    cancelWorkout();
    playWorkoutStopSound();
    navigate({ to: "/" });
  };

  // ── Handle Share Card Close ──
  const handleShareCardClose = () => {
    setShowShareCard(false);
    navigate({ to: "/" });
  };

  // If showing share card only
  if (showShareCard && workoutSummary) {
    return (
      <ShareCard
        isOpen={showShareCard}
        onClose={handleShareCardClose}
        workoutData={workoutSummary}
      />
    );
  }

  if (!activeWorkout) return null;

  return (
    <div className="absolute inset-0 z-[80] flex flex-col bg-bg">
      {/* ── Workout Header ── */}
      <header className="flex items-center justify-between border-b border-border bg-bg/90 px-5 pb-3 pt-[calc(12px+env(safe-area-inset-top,0px))] backdrop-blur-xl shrink-0">
        <button
          onClick={requestCancel}
          aria-label="Cancel Workout"
          className="flex h-12 w-12 items-center justify-center rounded-xl text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary"
        >
          <X className="h-6 w-6" aria-hidden="true" />
        </button>

        <div className="flex flex-col items-center">
          <h1 className="text-sm font-bold text-text-primary uppercase tracking-wider">
            Workout Session
          </h1>
          <div className="flex items-center gap-1.5 text-base font-bold text-text-primary tabular-nums">
            <Clock className="h-4 w-4 text-primary" aria-hidden="true" />
            <span>{elapsedTime}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Trophy className="h-4 w-4 text-warning" />
          <span className="text-xs font-bold text-text-primary tabular-nums">
            {totalCompleted}/{totalSets}
          </span>
        </div>
      </header>

      {/* ── Progress Bar ── */}
      <div
        className="h-1 bg-bg-elevated"
        role="progressbar"
        aria-valuenow={(totalCompleted / totalSets) * 100}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <motion.div
          className="h-full bg-gradient-to-l from-primary to-primary-light"
          initial={{ width: 0 }}
          animate={{
            width: totalSets > 0 ? `${(totalCompleted / totalSets) * 100}%` : "0%",
          }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
        />
      </div>

      {/* ── Volume Display ── */}
      {totalVolume > 0 && (
        <div className="border-b border-border bg-bg-card/50 px-5 py-2">
          <p className="text-center text-xs text-text-secondary uppercase tracking-wider">
            Total Volume:{" "}
            <span className="font-bold text-primary">{totalVolume.toLocaleString()} kg</span>
          </p>
        </div>
      )}

      {/* ── Exercises List ── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 pb-safe no-scrollbar">
        <div className="space-y-4">
          {activeWorkout.exercises.map((exercise, idx) => (
            <div key={exercise.id} className="flex flex-col gap-4">
              <ExerciseWorkoutCard exercise={exercise} exerciseIndex={idx} />
              {exercise.isSupersetWithNext && (
                <div className="flex flex-col items-center justify-center -my-2 relative h-8 z-10">
                  <div className="w-[3px] h-full bg-warning shadow-[0_0_8px_rgba(255,171,0,0.5)]" />
                  <div className="absolute top-1/2 -translate-y-1/2 bg-warning text-[#0A0A0B] text-xs font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border border-warning/50 shadow-md flex items-center gap-1 select-none">
                    Superset Link
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <motion.div
          className="mt-6 pb-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <div className="mb-4 flex items-center justify-center gap-2">
            <input
              type="checkbox"
              id="shareToFeed"
              checked={shareToFeed}
              onChange={(e) => setShareToFeed(e.target.checked)}
              className="w-4 h-4 rounded bg-bg-elevated border-border text-primary focus:ring-primary"
            />
            <label
              htmlFor="shareToFeed"
              className="text-sm text-text-secondary cursor-pointer uppercase tracking-wider font-bold"
            >
              Share to Feed
            </label>
          </div>
          <Button
            onClick={requestFinish}
            disabled={isFinishing || totalCompleted === 0}
            aria-label="Finish Workout"
            variant="primary"
            className={cn_(
              "w-full py-4 text-base font-bold uppercase tracking-wider",
              isFinishing
                ? "bg-success text-[#0A0A0B] shadow-none"
                : totalCompleted === 0
                  ? "bg-bg-elevated text-text-secondary shadow-none h-auto"
                  : ""
            )}
          >
            {isFinishing ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              >
                <Trophy className="h-6 w-6" />
              </motion.div>
            ) : (
              <>
                <Flag className="h-5 w-5" />
                <span>Finish Workout</span>
                {totalCompleted > 0 && (
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
                    {totalCompleted} sets
                  </span>
                )}
              </>
            )}
          </Button>
        </motion.div>
      </div>

      {/* ── Rest Timer Overlay ── */}
      <RestTimer />

      <ConfirmModal
        isOpen={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        onConfirm={confirmCancel}
        title="Cancel Workout"
        description="Are you sure you want to cancel the workout? All progress will be lost."
        confirmText="Cancel Workout"
      />

      <ConfirmModal
        isOpen={showFinishConfirm}
        onClose={() => setShowFinishConfirm(false)}
        onConfirm={confirmFinish}
        title="Finish Workout"
        description="Are you sure you want to finish the workout? Uncompleted sets will be discarded."
        confirmText="Finish Workout"
      />

      <ConfirmModal
        isOpen={showResumeModal}
        onClose={confirmCancel}
        onConfirm={() => {
          resumeWorkout();
          setShowResumeModal(false);
        }}
        title="Resume Workout?"
        description="You have a persisted workout session in progress. Would you like to resume it or discard it and start fresh?"
        confirmText="Resume Workout"
        cancelText="Discard"
      />

      {/* ── PR Celebration Overlay ── */}
      <PRCelebration data={prCelebration} onClose={() => setPrCelebration(null)} />
    </div>
  );
}

function cn_(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
