import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Heart,
  UserPlus,
  UserMinus,
  Dumbbell,
  Activity,
  Clock,
  Users
} from "lucide-react";
import { useSocialStore } from "@/store/useSocialStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/Button";
import { DataEmptyState } from "@/components/ui/DataEmptyState";

import { SkeletonCard } from "@/components/ui/Skeleton";

export default function FeedPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const {
    feed,
    following,
    searchResults,
    isLoading,
    isSearching,
    loadFollowing,
    loadFeed,
    searchUsers,
    follow,
    unfollow,
    giveKudos,
    clearState,
  } = useSocialStore();

  useEffect(() => {
    if (user) {
      loadFollowing(user.uid).then(() => loadFeed());
    } else {
      clearState();
    }
  }, [user, loadFollowing, loadFeed, clearState]);

  useEffect(() => {
    const delayDebounceData = setTimeout(() => {
      searchUsers(searchQuery);
    }, 500);
    return () => clearTimeout(delayDebounceData);
  }, [searchQuery, searchUsers]);

  const handleKudos = (postId: string) => {
    giveKudos(postId);
  };

  const handleFollowToggle = (targetUid: string) => {
    if (!user) return;
    if (following.includes(targetUid)) {
      unfollow(user.uid, targetUid);
    } else {
      follow(user.uid, targetUid);
    }
  };

  if (!user) {
    return (
      <div className="pt-20">
        <DataEmptyState
          icon={Heart}
          title="Social Feed"
          description="Sign in to follow other athletes, share your workouts, and get kudos!"
          actionLabel="Sign In"
          onAction={() => navigate({ to: "/auth" })}
        />
      </div>
    );
  }

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    return `${m} min`;
  };

  return (
    <div className="flex flex-col gap-6 pb-24 w-full max-w-lg mx-auto">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-black text-text-primary uppercase tracking-tight">
          Social Feed
        </h1>
        <p className="text-sm text-text-muted">
          See what your friends are lifting
        </p>
      </div>

      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search athletes (exact names)..."
          className="w-full bg-bg-elevated border border-border rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-primary text-text-primary"
        />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
      </div>

      {searchQuery.trim().length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-bold uppercase text-text-muted tracking-wider">
            Search Results
          </h3>
          {isSearching ? (
            <div className="text-sm text-text-muted text-center py-4">
              Searching...
            </div>
          ) : searchResults.length === 0 ? (
            <div className="text-sm text-text-muted text-center py-4">
              No athletes found.
            </div>
          ) : (
            searchResults
              .filter((r) => r.uid !== user.uid)
              .map((res) => {
                const isFollowing = following.includes(res.uid);
                return (
                  <div
                    key={res.uid}
                    className="flex items-center justify-between bg-bg p-3 rounded-xl border border-border/50"
                  >
                    <div className="flex items-center gap-3">
                      {res.photoURL ? (
                        <img
                          src={res.photoURL}
                          alt={res.displayName}
                          className="w-10 h-10 rounded-full bg-bg-elevated"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                          {res.displayName.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <span className="font-bold text-sm text-text-primary">
                        {res.displayName}
                      </span>
                    </div>
                    <button
                      onClick={() => handleFollowToggle(res.uid)}
                      className={`p-2 rounded-lg transition-colors ${isFollowing ? "bg-bg-elevated text-text-muted" : "bg-primary text-[#0A0A0B]"}`}
                    >
                      {isFollowing ? (
                        <UserMinus className="w-4 h-4" />
                      ) : (
                        <UserPlus className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                );
              })
          )}
        </div>
      )}

      {searchQuery.trim().length === 0 && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase text-text-muted tracking-wider">
              Recent Activity
            </h3>
            <span className="text-[10px] text-text-muted/50 uppercase tracking-widest">
              {following.length} FOLLOWING
            </span>
          </div>

          {isLoading ? (
            <div className="flex flex-col gap-4">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : feed.length === 0 ? (
            <DataEmptyState
              icon={Search}
              title="Your feed is quiet"
              description="Search for friends to follow and see their workouts here."
            />
          ) : (
            <AnimatePresence>
              {feed.map((post) => (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={post.id}
                  className="glass-card rounded-2xl p-4 border border-border flex flex-col gap-4"
                >
                  <div className="flex items-center gap-3">
                    {post.authorPhotoURL ? (
                      <img
                        src={post.authorPhotoURL}
                        alt={post.authorName}
                        className="w-10 h-10 rounded-full bg-bg-elevated"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                        {post.authorName.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="flex flex-col">
                      <span className="font-bold text-sm text-text-primary">
                        {post.authorName}
                      </span>
                      <span className="text-[10px] text-text-muted uppercase tracking-widest">
                        {new Date(post.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="bg-bg-elevated/40 rounded-xl p-4">
                    <h4 className="font-black text-text-primary capitalize text-sm mb-3">
                      {post.workoutTitle}
                    </h4>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5 text-xs text-text-muted">
                        <Clock className="w-3.5 h-3.5 text-primary" />
                        {formatDuration(post.duration)}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-text-muted">
                        <Dumbbell className="w-3.5 h-3.5 text-cyan-400" />
                        {post.exercisesCount} Ex
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-text-muted">
                        <Activity className="w-3.5 h-3.5 text-warning" />
                        {(post.totalVolume / 1000).toFixed(1)}k kg
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => handleKudos(post.id)}
                      className="flex items-center gap-2 text-text-muted hover:text-primary transition-colors hover:scale-105 active:scale-95"
                    >
                      <Heart className="w-5 h-5" />
                      <span className="text-sm font-bold">
                        {post.kudosCount}
                      </span>
                    </button>
                    {/* Placeholder for future features like comments */}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      )}
    </div>
  );
}
