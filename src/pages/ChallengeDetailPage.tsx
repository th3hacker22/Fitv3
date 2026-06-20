"use client";
import { useEffect } from "react";
import { useParams } from "@/router-shim";
import { Link } from "@/router-shim";
import { motion } from "framer-motion";
import {
  Trophy,
  Calendar,
  Dumbbell,
  ArrowLeft,
  CheckCircle2,
  User,
  Users,
  ShieldAlert,
} from "lucide-react";
import { useChallengesStore } from "@/store/useChallengesStore";
import { useAuthStore } from "@/store/useAuthStore";
import { Button } from "@/components/ui-custom/Button";

export default function ChallengeDetailPage() {
  const { challengeId } = useParams({ from: "/challenges/$challengeId" });
  const user = useAuthStore((s) => s.user);
  const {
    activeChallenges,
    userParticipations,
    leaderboards,
    fetchActiveChallenges,
    joinChallenge,
    fetchUserProgress,
    fetchLeaderboard,
  } = useChallengesStore();

  useEffect(() => {
    if (activeChallenges.length === 0) {
      fetchActiveChallenges();
    }
  }, [activeChallenges.length, fetchActiveChallenges]);

  useEffect(() => {
    if (challengeId) {
      fetchUserProgress(challengeId);
      fetchLeaderboard(challengeId);
    }
  }, [challengeId, fetchUserProgress, fetchLeaderboard]);

  const challenge = activeChallenges.find((c) => c.id === challengeId);
  const participation = challengeId ? userParticipations[challengeId] : undefined;
  const leaderboard = challengeId ? leaderboards[challengeId] || [] : [];
  const isJoined = !!participation;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  if (!challenge) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-8 pb-24 w-full max-w-lg mx-auto px-4 mt-12">
        <ShieldAlert className="w-16 h-16 text-warning mb-4 animate-bounce" />
        <h3 className="text-xl font-bold text-text-primary mb-2">Challenge Not Found</h3>
        <p className="text-sm text-text-secondary mb-6">
          The challenge you are looking for may have expired or does not exist.
        </p>
        <Link to="/challenges">
          <Button variant="outline" className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Challenges
          </Button>
        </Link>
      </div>
    );
  }

  const progress = participation?.progressKg || 0;
  const goal = challenge.goalKg;
  const percentage = Math.min(Math.round((progress / goal) * 100), 100);
  const isCompleted = participation?.completed || progress >= goal;

  return (
    <div className="flex flex-col gap-6 pb-24 w-full max-w-lg mx-auto px-4">
      {/* Header Navigation */}
      <div className="flex items-center gap-2">
        <Link
          to="/challenges"
          className="p-2 -ml-2 rounded-lg hover:bg-bg-elevated text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <span className="text-xs uppercase tracking-wider text-text-secondary font-bold">
          Challenge Details
        </span>
      </div>

      {/* Hero Card */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="glass-card flex flex-col rounded-2xl border border-border/40 p-6 relative overflow-hidden"
      >
        <div className="absolute -right-8 -top-8 w-28 h-28 bg-primary/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-xl font-black text-text-primary uppercase tracking-tight">
              {challenge.title}
            </h1>
            <p className="text-sm text-text-secondary leading-relaxed">{challenge.description}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-warning/10 text-warning shrink-0">
            <Trophy className="w-6 h-6" />
          </div>
        </div>

        {/* Timelines and Goals */}
        <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-border/40 text-xs text-text-secondary">
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase font-bold tracking-wider text-text-secondary">
              Active Window
            </span>
            <span className="flex items-center gap-1.5 font-semibold text-text-primary">
              <Calendar className="w-4 h-4 text-primary" />
              {formatDate(challenge.startDate)} - {formatDate(challenge.endDate)}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase font-bold tracking-wider text-text-secondary">
              Target Volume
            </span>
            <span className="flex items-center gap-1.5 font-semibold text-text-primary">
              <Dumbbell className="w-4 h-4 text-primary" />
              {goal.toLocaleString()} kg
            </span>
          </div>
        </div>
      </motion.div>

      {/* User Progress Section */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="glass-card rounded-2xl border border-border/40 p-6"
      >
        <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary mb-4 flex items-center gap-2">
          <User className="w-4 h-4 text-primary" />
          Your Participation
        </h3>

        {isJoined ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center text-sm">
              <span className="text-text-secondary">
                Progress: <strong className="text-text-primary">{progress.toLocaleString()}</strong>{" "}
                / {goal.toLocaleString()} kg
              </span>
              <span className="font-extrabold text-primary">{percentage}%</span>
            </div>
            <div className="w-full bg-bg-elevated h-3 rounded-full overflow-hidden border border-border/50">
              <motion.div
                className={`h-full rounded-full ${isCompleted ? "bg-success" : "bg-primary"}`}
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
            <div className="flex justify-between items-center text-xs text-text-secondary pt-1">
              <span>Joined: {formatDate(participation.joinedAt)}</span>
              {isCompleted ? (
                <span className="text-success font-bold flex items-center gap-1 bg-success/10 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Completed! 🎉
                </span>
              ) : (
                <span>
                  Remaining: {(goal - progress > 0 ? goal - progress : 0).toLocaleString()} kg
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <p className="text-sm text-text-secondary mb-4">
              Join this challenge to track your volume and compete on the leaderboard!
            </p>
            <Button
              onClick={() => joinChallenge(challenge.id)}
              className="w-full font-bold uppercase tracking-wider py-3"
            >
              Join the Challenge
            </Button>
          </div>
        )}
      </motion.div>

      {/* Leaderboard Section */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="glass-card rounded-2xl border border-border/40 p-6"
      >
        <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          Leaderboard (Top 100)
        </h3>

        {leaderboard.length === 0 ? (
          <div className="text-center py-8 text-text-secondary text-sm italic">
            No participants yet. Be the first to join and log progress!
          </div>
        ) : (
          <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
            {leaderboard.map((item, index) => {
              const rank = index + 1;
              const isCurrentUser = user && item.userId === user.uid;
              const rankColor =
                rank === 1
                  ? "bg-warning/20 text-warning"
                  : rank === 2
                    ? "bg-text-secondary/20 text-text-secondary"
                    : rank === 3
                      ? "bg-amber-700/20 text-amber-700"
                      : "bg-bg-elevated text-text-secondary";

              return (
                <div
                  key={item.userId}
                  className={`flex items-center justify-between p-3 rounded-xl transition-colors border ${
                    isCurrentUser
                      ? "bg-primary/10 border-primary/40"
                      : "bg-bg-elevated/40 border-border/20"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Rank Badge */}
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${rankColor}`}
                    >
                      {rank}
                    </div>

                    {/* Avatar */}
                    {item.userPhotoURL ? (
                      <img
                        src={item.userPhotoURL}
                        alt={item.userName}
                        className="w-8 h-8 rounded-full object-cover shrink-0 border border-border/50"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary-muted text-primary flex items-center justify-center text-xs font-black shrink-0">
                        {getInitials(item.userName)}
                      </div>
                    )}

                    {/* Name */}
                    <span
                      className={`text-sm truncate ${isCurrentUser ? "font-bold text-primary" : "text-text-primary"}`}
                    >
                      {item.userName}
                      {isCurrentUser && " (You)"}
                    </span>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-sm font-black text-text-primary">
                      {item.progressKg.toLocaleString()}
                    </span>
                    <span className="text-xs text-text-secondary block">kg</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
