"use client";
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
  Trophy,
  Trash2,
  MessageSquare,
  Share2,
  Send,
} from "lucide-react";
import { useSocialStore, type FeedPost } from "@/store/useSocialStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useNavigate } from "@/router-shim";
import { SkeletonCard } from "@/components/ui-custom/Skeleton";
import ChallengesPage from "@/pages/ChallengesPage";
import { useTranslation } from "react-i18next";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

export default function FeedPage() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"feed" | "challenges">("feed");
  const [kudosAnimating, setKudosAnimating] = useState<string | null>(null);

  // Inline comments state
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const [submittingComments, setSubmittingComments] = useState<Record<string, boolean>>({});

  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const feed = useSocialStore((s) => s.feed);
  const following = useSocialStore((s) => s.following);
  const followingProfiles = useSocialStore((s) => s.followingProfiles);
  const searchResults = useSocialStore((s) => s.searchResults);
  const isLoading = useSocialStore((s) => s.isLoading);
  const isSearching = useSocialStore((s) => s.isSearching);
  const loadFollowing = useSocialStore((s) => s.loadFollowing);
  const loadFeed = useSocialStore((s) => s.loadFeed);
  const searchUsers = useSocialStore((s) => s.searchUsers);
  const follow = useSocialStore((s) => s.follow);
  const unfollow = useSocialStore((s) => s.unfollow);
  const giveKudos = useSocialStore((s) => s.giveKudos);
  const deletePost = useSocialStore((s) => s.deletePost);
  const clearState = useSocialStore((s) => s.clearState);

  const commentsByPost = useSocialStore((s) => s.commentsByPost);
  const loadComments = useSocialStore((s) => s.loadComments);
  const addComment = useSocialStore((s) => s.addComment);
  const deleteComment = useSocialStore((s) => s.deleteComment);

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
    setKudosAnimating(postId);
    setTimeout(() => setKudosAnimating(null), 300);
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

  const handleToggleComments = async (postId: string) => {
    const isExpanded = !expandedComments[postId];
    setExpandedComments((prev) => ({ ...prev, [postId]: isExpanded }));
    if (isExpanded) {
      await loadComments(postId);
    }
  };

  const handleAddComment = async (postId: string) => {
    const text = commentTexts[postId] || "";
    if (!text.trim() || text.length > 500) return;

    setSubmittingComments((prev) => ({ ...prev, [postId]: true }));
    try {
      await addComment(postId, text.trim());
      setCommentTexts((prev) => ({ ...prev, [postId]: "" }));
    } catch (e) {
      console.error("Failed to add comment:", e);
    } finally {
      setSubmittingComments((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    if (confirm("Delete this comment? This cannot be undone.")) {
      try {
        await deleteComment(postId, commentId);
      } catch (e) {
        console.error("Failed to delete comment:", e);
      }
    }
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}H ${m}M`;
    return `${m}M`;
  };

  const formatVolume = (kg: number) => {
    if (kg >= 1000) return `${(kg / 1000).toFixed(1)}K`;
    return `${kg}`;
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days > 0) return `${days}D ago`;
    if (hours > 0) return `${hours}H ago`;
    return "Just now";
  };

  const renderBiometricChart = (post: FeedPost) => {
    const title = post.workoutTitle.toLowerCase();
    const isCardio =
      title.includes("run") ||
      title.includes("cardio") ||
      title.includes("vo2") ||
      title.includes("cycle") ||
      title.includes("pace");

    if (isCardio) {
      return (
        <div className="mb-4 bg-black/40 border border-white/5 p-3 rounded-none">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-[#00f0ff] uppercase">Cardio Route Map</span>
            <span className="text-[10px] font-bold text-[#ccff00] uppercase">Pace: 4:30/KM</span>
          </div>
          <div className="h-16 w-full flex items-center justify-center p-2">
            <svg className="h-full w-full opacity-60" viewBox="0 0 100 40" preserveAspectRatio="none">
              <path
                d="M10,30 Q30,35 40,20 T70,25 T90,10"
                fill="none"
                stroke="#00f0ff"
                strokeDasharray="3 1.5"
                strokeWidth="2"
              />
              <circle cx="10" cy="30" fill="#ccff00" r="2.5" />
              <circle cx="90" cy="10" fill="#ff5252" r="2.5" />
            </svg>
          </div>
        </div>
      );
    } else {
      return (
        <div className="mb-4 bg-black/40 border border-white/5 p-3 rounded-none">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-[#00f0ff] uppercase">Volume Trend</span>
            <span className="text-[10px] font-bold text-[#ccff00] uppercase">+12% vs last session</span>
          </div>
          <div className="h-16 w-full p-1">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 200 40" preserveAspectRatio="none">
              <path
                d="M0 35 L20 30 L40 32 L60 20 L80 25 L100 15 L120 18 L140 10 L160 12 L180 5 L200 8"
                fill="none"
                stroke="#00f0ff"
                strokeWidth="1.5"
              />
              <circle cx="180" cy="5" fill="#ccff00" r="2" />
            </svg>
          </div>
        </div>
      );
    }
  };

  if (activeTab === "challenges") {
    return (
      <div className="mx-auto w-full max-w-lg pb-24">
        <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible" className="mb-4">
          <h1 className="text-2xl font-black italic uppercase tracking-tighter text-text-primary">
            CHALLENGES
          </h1>
          <p className="mt-1 text-xs text-text-secondary">Compete and climb the leaderboard</p>
        </motion.div>

        <div className="mb-6 flex rounded-none border border-border/40 bg-bg-elevated/40 p-1">
          <button
            onClick={() => setActiveTab("feed")}
            className="flex-1 cursor-pointer rounded-none py-2 text-xs font-bold uppercase tracking-wider text-text-secondary transition-all hover:text-text-primary"
          >
            Feed
          </button>
          <button
            onClick={() => setActiveTab("challenges")}
            className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-none bg-[#ccff00] py-2 text-xs font-bold uppercase tracking-wider text-black shadow-sm transition-all"
          >
            <Trophy className="h-3.5 w-3.5" />
            Challenges
          </button>
        </div>

        <ChallengesPage />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg pb-4">
      {/* Page Header */}
      <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible" className="mb-4">
        <h1 className="text-2xl font-black italic uppercase tracking-tighter text-text-primary">
          PULSE FEED
        </h1>
        <p className="mt-1 text-xs text-text-secondary">See what your friends are lifting</p>
      </motion.div>

      {/* Tab Buttons */}
      <motion.div
        custom={0}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="mb-5 flex rounded-none border border-border/40 bg-bg-elevated/40 p-1"
      >
        <button
          onClick={() => setActiveTab("feed")}
          className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-none bg-[#ccff00] py-2 text-xs font-bold uppercase tracking-wider text-black shadow-sm transition-all"
        >
          Feed
        </button>
        <button
          onClick={() => setActiveTab("challenges")}
          className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-none py-2 text-xs font-bold uppercase tracking-wider text-text-secondary transition-all hover:text-text-primary"
        >
          <Trophy className="h-3.5 w-3.5 text-warning" />
          Challenges
        </button>
      </motion.div>

      {/* Search Bar */}
      <motion.div
        custom={1}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="relative mb-5"
      >
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search athletes..."
          className="w-full rounded-none border border-border bg-bg-elevated py-3 pe-4 ps-10 text-sm text-text-primary placeholder-text-muted focus:border-[#ccff00] focus:outline-none"
        />
        <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
      </motion.div>

      {/* Search Results */}
      {searchQuery.trim().length > 0 && (
        <div className="mb-6 flex flex-col gap-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-text-secondary">
            Search Results
          </h3>
          {isSearching ? (
            <div className="py-4 text-center text-sm text-text-secondary">Searching...</div>
          ) : searchResults.length === 0 ? (
            <div className="py-4 text-center text-sm text-text-secondary">No athletes found</div>
          ) : (
            searchResults
              .filter((r) => r.uid !== user?.uid)
              .map((res) => {
                const isFollowing = following.includes(res.uid);
                return (
                  <div
                    key={res.uid}
                    className="flex items-center justify-between rounded-none border border-border/50 bg-bg-elevated/40 p-3"
                  >
                    <div className="flex items-center gap-3">
                      {res.photoURL ? (
                        <img
                          src={res.photoURL}
                          alt={res.displayName}
                          className="h-10 w-10 rounded-full bg-bg-elevated object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ccff00]/20 font-bold text-[#ccff00]">
                          {res.displayName.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <span className="text-sm font-bold text-text-primary">{res.displayName}</span>
                    </div>
                    <button
                      onClick={() => handleFollowToggle(res.uid)}
                      className={`flex h-9 w-9 items-center justify-center rounded-none transition-colors ${
                        isFollowing ? "bg-bg-elevated text-text-secondary" : "bg-[#ccff00] text-black font-bold"
                      }`}
                    >
                      {isFollowing ? <UserMinus className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                    </button>
                  </div>
                );
              })
          )}
        </div>
      )}

      {/* Followed Users Horizontal Scroll */}
      {searchQuery.trim().length === 0 && (
        <motion.div
          custom={2}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="mb-6"
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-text-secondary">
              Following
            </h3>
            <span className="text-[10px] uppercase tracking-widest text-text-muted">
              {following.length} athlete{following.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="no-scrollbar flex w-full gap-5 overflow-x-auto pb-2">
            {isLoading && followingProfiles.length === 0 ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5 shrink-0">
                  <div className="w-14 h-14 rounded-full skeleton-shimmer bg-bg-elevated/40" />
                  <div className="w-8 h-2 rounded skeleton-shimmer bg-bg-elevated/30 mt-1" />
                  <div className="w-12 h-3 rounded skeleton-shimmer bg-bg-elevated/35" />
                </div>
              ))
            ) : (
              followingProfiles.map((profile) => {
                // training status rings
                let statusText = "RESTING";
                let ringClass = "border-2 border-surface-variant";
                let statusColor = "text-text-muted";

                const dName = profile.displayName.toUpperCase();
                if (dName.includes("JAX") || dName.includes("JOSH")) {
                  statusText = "TRAINING NOW";
                  ringClass = "border-2 border-[#ccff00] shadow-[0_0_8px_#ccff00]";
                  statusColor = "text-[#ccff00]";
                } else if (dName.includes("SARA") || dName.includes("MIA")) {
                  statusText = "COMPLETED";
                  ringClass = "border-2 border-[#00f0ff] shadow-[0_0_8px_#00f0ff]";
                  statusColor = "text-[#00f0ff]";
                }

                return (
                  <div key={profile.uid} className="flex flex-col items-center gap-1.5 shrink-0">
                    <div className={`w-14 h-14 rounded-full p-[2px] overflow-hidden ${ringClass}`}>
                      {profile.photoURL ? (
                        <img
                          src={profile.photoURL}
                          alt={profile.displayName}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full rounded-full bg-bg-elevated flex items-center justify-center text-primary-neon font-black text-xs">
                          {profile.displayName.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <span className={`text-[8px] font-black italic uppercase tracking-wider ${statusColor}`}>
                      {statusText}
                    </span>
                    <span className="text-[10px] font-bold text-white uppercase tracking-tighter">
                      {profile.displayName.split(" ")[0]}
                    </span>
                  </div>
                );
              })
            )}

            {/* Find button */}
            <div
              onClick={() => {
                const searchEl = document.querySelector("input[placeholder='Search athletes...']") as HTMLInputElement;
                if (searchEl) searchEl.focus();
              }}
              className="group flex cursor-pointer flex-col items-center gap-1.5"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-border p-[2px] transition-all group-hover:border-[#ccff00] group-hover:scale-105">
                <div className="flex h-full w-full items-center justify-center rounded-full bg-bg-elevated">
                  <Search className="h-4 w-4 text-text-secondary group-hover:text-[#ccff00]" />
                </div>
              </div>
              <span className="text-[8px] font-black italic uppercase tracking-wider text-text-muted group-hover:text-[#ccff00]">
                Search
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary group-hover:text-[#ccff00]">
                Find
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Post Creation Prompt */}
      {searchQuery.trim().length === 0 && (
        <motion.div
          custom={3}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="mb-6"
        >
          <div className="glass-card flex cursor-pointer items-center justify-between rounded-none border-l-4 border-l-[#ccff00] p-4 transition-transform hover:-translate-y-0.5">
            <p className="text-sm text-text-secondary">Share your latest workout?</p>
            <button
              onClick={() => navigate({ to: "/#home" })}
              className="flex items-center gap-1.5 rounded-none bg-[#ccff00] px-4 py-2 text-[10px] font-bold italic uppercase tracking-widest text-black transition-transform active:scale-95 shadow-[0_0_10px_rgba(204,255,0,0.3)]"
            >
              <Share2 className="h-3 w-3" />
              ADD POST
            </button>
          </div>
        </motion.div>
      )}

      {/* Feed Posts */}
      {searchQuery.trim().length === 0 && (
        <div className="flex flex-col gap-5">
          {isLoading ? (
            <div className="flex flex-col gap-4">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : feed.length === 0 ? (
            <div className="glass-card p-10 text-center flex flex-col items-center gap-4 bg-white/[0.02] border-dashed rounded-none">
              <Search className="h-10 w-10 text-text-muted" />
              <h2 className="text-xl font-black italic uppercase text-white">FEED IS QUIET</h2>
              <p className="text-xs text-text-muted max-w-xs mx-auto">
                Be the first to share your workout! Complete a session and share it to the feed.
              </p>
              <button
                onClick={() => navigate({ to: "/exercises" })}
                className="bg-[#ccff00] text-black font-black italic uppercase text-xs py-3.5 px-8 rounded-none mt-4 shadow-[0_0_10px_rgba(204,255,0,0.3)] active:scale-95 transition-transform"
              >
                START WORKOUT
              </button>
            </div>
          ) : (
            <AnimatePresence>
              {feed.map((post, idx) => {
                const isPR =
                  post.workoutTitle.toLowerCase().includes("pr") ||
                  post.workoutTitle.toLowerCase().includes("annihilation") ||
                  post.totalVolume > 8000;

                return (
                  <motion.article
                    key={post.id}
                    custom={idx + 4}
                    variants={fadeUp}
                    initial="hidden"
                    animate="visible"
                    exit={{ opacity: 0, x: -40 }}
                    className="glass-card rounded-none p-5 transition-transform duration-300 hover:-translate-y-0.5 border-t-2 border-t-[#ccff00]"
                  >
                    {/* Post Header */}
                    <div className="mb-4 flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {post.authorPhotoURL ? (
                          <img
                            src={post.authorPhotoURL}
                            alt={post.authorName}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ccff00]/20 text-xs font-bold text-[#ccff00]">
                            {post.authorName.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <h3 className="m-0 text-sm font-black italic uppercase text-white tracking-tight">
                            {post.authorName}
                          </h3>
                          <span className="text-[9px] font-bold uppercase tracking-widest text-text-secondary">
                            {formatTimeAgo(post.createdAt)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isPR && (
                          <div className="bg-[#ffab00]/10 border border-[#ffab00]/30 px-2 py-0.5 flex items-center gap-1.5 rounded-none">
                            <Trophy className="h-3 w-3 text-[#ffab00]" />
                            <span className="text-[9px] font-black text-[#ffab00] italic uppercase tracking-wide">
                              PR
                            </span>
                          </div>
                        )}

                        {/* Delete post — author only */}
                        {post.authorUid === user?.uid && (
                          <button
                            onClick={async () => {
                              if (confirm("Delete this post? This cannot be undone.")) {
                                try {
                                  await deletePost(post.id);
                                } catch {
                                  alert("Failed to delete post.");
                                }
                              }
                            }}
                            className="rounded-none p-1 text-text-secondary transition-colors hover:bg-danger/10 hover:text-[#ff5252]"
                            aria-label="Delete post"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Workout Summary Card */}
                    <div className="relative mb-4 overflow-hidden rounded-none border border-white/5 bg-bg-elevated/40 p-4">
                      {/* Subtle gradient effect */}
                      <div className="pointer-events-none absolute -mr-10 -mt-10 right-0 top-0 h-32 w-32 rounded-full bg-[#ccff00]/5 blur-3xl" />
                      <h4 className="mb-3 border-b border-white/10 pb-2 text-sm font-bold italic uppercase text-text-primary">
                        {post.workoutTitle}
                      </h4>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="flex flex-col">
                          <span className="mb-1 text-[9px] font-bold uppercase tracking-widest text-text-secondary">
                            Duration
                          </span>
                          <span className="text-sm font-black italic text-[#ccff00]">
                            {formatDuration(post.duration)}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="mb-1 text-[9px] font-bold uppercase tracking-widest text-text-secondary">
                            Exercises
                          </span>
                          <span className="text-sm font-black italic text-[#00f0ff]">
                            {post.exercisesCount}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="mb-1 text-[9px] font-bold uppercase tracking-widest text-text-secondary">
                            Volume
                          </span>
                          <span className="text-sm font-black italic text-[#ffab00]">
                            {formatVolume(post.totalVolume)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Biometric SVG Chart */}
                    {renderBiometricChart(post)}

                    {/* Action Bar */}
                    <div className="flex items-center gap-6 border-t border-white/5 pt-3">
                      <button
                        onClick={() => handleKudos(post.id)}
                        className="group flex items-center gap-2 transition-colors text-text-secondary hover:text-[#ccff00]"
                      >
                        <motion.div
                          animate={kudosAnimating === post.id ? { scale: [1, 1.3, 1] } : { scale: 1 }}
                          transition={{ duration: 0.3 }}
                        >
                          <Heart
                            className={`h-4 w-4 ${kudosAnimating === post.id ? "text-[#ccff00] fill-[#ccff00]" : "text-text-secondary group-hover:text-[#ccff00]"}`}
                          />
                        </motion.div>
                        <span className="text-xs font-bold group-hover:text-[#ccff00]">
                          {post.kudosCount}
                        </span>
                      </button>

                      <button
                        onClick={() => handleToggleComments(post.id)}
                        className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors"
                      >
                        <MessageSquare className="h-4 w-4" />
                        <span className="text-xs font-black italic uppercase">
                          {post.commentCount || 0}
                        </span>
                      </button>
                    </div>

                    {/* Expandable Inline Comments Section */}
                    {expandedComments[post.id] && (
                      <div className="mt-4 bg-white/[0.03] border-t border-white/5 p-4 flex flex-col gap-4 text-left">
                        {/* Comments List */}
                        <div className="flex flex-col gap-3">
                          {(commentsByPost[post.id] || []).length > 0 ? (
                            (commentsByPost[post.id] || []).map((comment) => (
                              <div key={comment.id} className="flex gap-3 items-start text-xs">
                                {comment.authorPhotoURL ? (
                                  <img
                                    src={comment.authorPhotoURL}
                                    alt={comment.authorName}
                                    className="w-7 h-7 rounded-full object-cover shrink-0"
                                  />
                                ) : (
                                  <div className="w-7 h-7 rounded-full bg-bg-elevated flex items-center justify-center text-primary font-bold text-[10px] shrink-0">
                                    {comment.authorName.substring(0, 2).toUpperCase()}
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex justify-between items-start">
                                    <p className="text-white">
                                      <span className="font-black italic uppercase mr-2 text-[#00f0ff]">
                                        {comment.authorName}
                                      </span>
                                      {comment.text}
                                    </p>
                                    {user && user.uid === comment.authorUid && (
                                      <button
                                        onClick={() => handleDeleteComment(post.id, comment.id)}
                                        className="text-text-muted hover:text-[#ff5252] transition-colors shrink-0 ml-2"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    )}
                                  </div>
                                  <p className="text-[8px] text-text-muted font-bold uppercase mt-0.5">
                                    {formatTimeAgo(comment.createdAt)}
                                  </p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-text-muted py-2">No comments yet. Start the conversation!</p>
                          )}
                        </div>

                        {/* Comment Input */}
                        <div className="flex items-center gap-2 mt-2">
                          <input
                            type="text"
                            value={commentTexts[post.id] || ""}
                            onChange={(e) =>
                              setCommentTexts((prev) => ({ ...prev, [post.id]: e.target.value }))
                            }
                            placeholder="WRITE A COMMENT..."
                            className="flex-1 bg-transparent border-t-0 border-x-0 border-b-2 border-b-[#00f0ff] focus:border-b-[#ccff00] focus:ring-0 text-xs text-white py-2 px-0 placeholder-text-muted focus:outline-none"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddComment(post.id);
                              }
                            }}
                          />
                          <button
                            onClick={() => handleAddComment(post.id)}
                            disabled={!(commentTexts[post.id] || "").trim() || submittingComments[post.id]}
                            className="bg-[#00f0ff] text-black font-black italic uppercase text-[10px] px-4 py-2 rounded-none hover:opacity-90 transition-opacity disabled:opacity-45"
                          >
                            POST
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.article>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      )}
    </div>
  );
}
