import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { X, Clock, Flag, Trophy } from "lucide-react";
import confetti from "canvas-confetti";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { getWorkoutStreak } from "@/db";
import ExerciseWorkoutCard from "@/components/workout/ExerciseWorkoutCard";
import RestTimer from "@/components/workout/RestTimer";
import ShareCard from "@/components/workout/ShareCard";
import { ConfirmModal } from "@/components/ui/ConfirmationModal";
import { Button } from "@/components/ui/Button";

// ── Timer Hook ──
function useElapsedTimer(startedAt: number) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
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
  const finishWorkout = useWorkoutStore((s) => s.finishWorkout);
  const cancelWorkout = useWorkoutStore((s) => s.cancelWorkout);
  const [isFinishing, setIsFinishing] = useState(false);
  const [showShareCard, setShowShareCard] = useState(false);
  const [shareToFeed, setShareToFeed] = useState(true);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [workoutSummary, setWorkoutSummary] = useState<{
    date: string;
    duration: number;
    totalVolume: number;
    exerciseCount: number;
    setCount: number;
    streak?: number;
  } | null>(null);

  const { elapsed, formatted: elapsedTime } = useElapsedTimer(
    activeWorkout?.startedAt ?? Date.now(),
  );

  // Redirect if no active workout and not showing share card
  useEffect(() => {
    if (!activeWorkout && !showShareCard) {
      navigate({ to: "/" });
    }
  }, [activeWorkout, showShareCard, navigate]);

  if (!activeWorkout && !showShareCard) return null;

  const totalCompleted =
    activeWorkout?.exercises.reduce(
      (acc, ex) => acc + ex.sets.filter((s) => s.completed).length,
      0,
    ) ?? 0;

  const totalSets =
    activeWorkout?.exercises.reduce((acc, ex) => acc + ex.sets.length, 0) ?? 0;

  // Calculate total volume
  const totalVolume =
    activeWorkout?.exercises.reduce((acc, ex) => {
      return (
        acc +
        ex.sets
          .filter((s) => s.completed)
          .reduce(
            (setAcc, s) =>
              setAcc + (Number(s.weight) || 0) * (Number(s.reps) || 0),
            0,
          )
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
      exerciseCount: activeWorkout.exercises.filter((e) =>
        e.sets.some((s) => s.completed),
      ).length,
      setCount: totalCompleted,
      streak: currentStreak + 1,
    };

    setWorkoutSummary(summary);

    // Save to DB
    await finishWorkout(shareToFeed);

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
      navigate({ to: "/" });
    }
  };

  const confirmCancel = () => {
    setShowCancelConfirm(false);
    cancelWorkout();
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
      <header className="flex items-center justify-between border-b border-border bg-bg/90 px-5 py-3 backdrop-blur-xl">
        <button
          onClick={requestCancel}
          aria-label="Cancel Workout"
          className="flex h-12 w-12 items-center justify-center rounded-xl text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary"
        >
          <X className="h-6 w-6" />
        </button>

        <div className="flex flex-col items-center">
          <h1 className="text-sm font-bold text-text-primary uppercase tracking-wider">
            Workout Session
          </h1>
          <div className="flex items-center gap-1 text-[11px] text-text-muted">
            <Clock className="h-3 w-3" />
            <span className="tabular-nums">{elapsedTime}</span>
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
            width:
              totalSets > 0 ? `${(totalCompleted / totalSets) * 100}%` : "0%",
          }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
        />
      </div>

      {/* ── Volume Display ── */}
      {totalVolume > 0 && (
        <div className="border-b border-border bg-bg-card/50 px-5 py-2">
          <p className="text-center text-xs text-text-muted uppercase tracking-wider">
            Total Volume:{" "}
            <span className="font-bold text-primary">
              {totalVolume.toLocaleString()} kg
            </span>
          </p>
        </div>
      )}

      {/* ── Exercises List ── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 pb-safe no-scrollbar">
        <div className="space-y-4">
          {activeWorkout.exercises.map((exercise, idx) => (
            <ExerciseWorkoutCard
              key={exercise.id}
              exercise={exercise}
              exerciseIndex={idx}
            />
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
              className="text-sm text-text-muted cursor-pointer uppercase tracking-wider font-bold"
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
                  ? "bg-bg-elevated text-text-muted shadow-none h-auto"
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
    </div>
  );
}

function cn_(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
