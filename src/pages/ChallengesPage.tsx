"use client";
import { useEffect } from "react";
import { Link } from "@/router-shim";
import { motion } from "framer-motion";
import { Trophy, Calendar, Dumbbell, ChevronRight, CheckCircle2 } from "lucide-react";
import { useChallengesStore } from "@/store/useChallengesStore";
import { useAuthStore } from "@/store/useAuthStore";
import { Button } from "@/components/ui-custom/Button";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
} as const;

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
} as const;

export default function ChallengesPage() {
  const user = useAuthStore((s) => s.user);
  const {
    activeChallenges,
    userParticipations,
    isLoading,
    fetchActiveChallenges,
    joinChallenge,
    fetchUserProgress,
  } = useChallengesStore();

  useEffect(() => {
    fetchActiveChallenges();
  }, [fetchActiveChallenges]);

  // Load progress for each active challenge if user is logged in
  useEffect(() => {
    if (user && activeChallenges.length > 0) {
      activeChallenges.forEach((challenge) => {
        fetchUserProgress(challenge.id);
      });
    }
  }, [user, activeChallenges, fetchUserProgress]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (isLoading && activeChallenges.length === 0) {
    return (
      <div className="flex flex-col gap-6 pb-24 w-full max-w-lg mx-auto px-4">
        <div className="flex flex-col gap-1 animate-pulse">
          <div className="h-8 w-48 bg-bg-elevated rounded mb-2" />
          <div className="h-4 w-64 bg-bg-elevated rounded" />
        </div>
        <div className="grid grid-cols-1 gap-4 mt-6">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-48 bg-bg-elevated rounded-2xl animate-pulse border border-border"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-24 w-full max-w-lg mx-auto px-4">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-black text-text-primary uppercase tracking-tight flex items-center gap-2">
          <Trophy className="w-6 h-6 text-warning shrink-0" />
          Volume Challenges
        </h1>
        <p className="text-sm text-text-secondary">Lift weight, hit goals, and climb the leaderboard</p>
      </div>

      {activeChallenges.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center text-center p-8 rounded-2xl mt-4 border border-border">
          <Dumbbell className="w-12 h-12 text-text-secondary mb-4" />
          <h3 className="text-lg font-bold text-text-primary mb-1">No Active Challenges</h3>
          <p className="text-sm text-text-secondary">
            Check back later for new volume-based challenges!
          </p>
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-1 gap-4 mt-2"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {activeChallenges.map((challenge) => {
            const participation = userParticipations[challenge.id];
            const isJoined = !!participation;
            const progress = participation?.progressKg || 0;
            const goal = challenge.goalKg;
            const percentage = Math.min(Math.round((progress / goal) * 100), 100);
            const isCompleted = participation?.completed || progress >= goal;

            return (
              <motion.div
                key={challenge.id}
                variants={cardVariants}
                className="glass-card flex flex-col rounded-2xl border border-border/40 hover:border-primary/30 transition-all duration-300 p-5 overflow-hidden relative group"
              >
                {/* Background decorative gradient */}
                <div className="absolute -right-12 -bottom-12 w-36 h-36 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors duration-300 pointer-events-none" />

                {/* Challenge Title & Info */}
                <div className="flex justify-between items-start gap-4 z-10">
                  <div className="space-y-1">
                    <h3 className="text-base font-black text-text-primary group-hover:text-primary transition-colors uppercase tracking-tight">
                      {challenge.title}
                    </h3>
                    <p className="text-xs text-text-secondary line-clamp-2 pr-4">
                      {challenge.description}
                    </p>
                  </div>
                  {isCompleted && (
                    <span className="flex items-center gap-1 bg-success/10 text-success text-xs uppercase font-bold tracking-wider px-2 py-1 rounded-full shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Done
                    </span>
                  )}
                </div>

                {/* Dates & Goal Info */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary mt-3 z-10">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-primary" />
                    Ends: {formatDate(challenge.endDate)}
                  </span>
                  <span className="flex items-center gap-1 font-semibold text-text-primary">
                    <Dumbbell className="w-3.5 h-3.5 text-primary" />
                    Goal: {goal.toLocaleString()} kg
                  </span>
                </div>

                {/* Action / Progress Row */}
                <div className="mt-5 pt-4 border-t border-border/40 z-10">
                  {isJoined ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-text-secondary">
                          Progress:{" "}
                          <strong className="text-text-primary">{progress.toLocaleString()}</strong>{" "}
                          / {goal.toLocaleString()} kg
                        </span>
                        <span className="font-bold text-primary">{percentage}%</span>
                      </div>
                      <div className="w-full bg-bg-elevated h-3 rounded-full overflow-hidden border border-border/50">
                        <motion.div
                          className={`h-full rounded-full ${isCompleted ? "bg-success" : "bg-primary"}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ duration: 0.6, ease: "easeOut" }}
                        />
                      </div>
                      <div className="flex justify-end pt-1">
                        <Link
                          to="/challenges/$challengeId"
                          params={{ challengeId: challenge.id }}
                          className="flex items-center gap-1 text-xs font-bold text-primary hover:text-primary-hover uppercase tracking-wider transition-colors"
                        >
                          View Details
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center gap-4">
                      <span className="text-xs text-text-secondary italic">Not participating yet</span>
                      <Button
                        size="sm"
                        onClick={() => joinChallenge(challenge.id)}
                        className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider"
                      >
                        Join Challenge
                      </Button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
