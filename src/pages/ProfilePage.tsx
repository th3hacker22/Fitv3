"use client";
import { useState, useEffect } from "react";
import { Link } from "@/router-shim";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Settings,
  Scale,
  ChevronRight,
  Dumbbell,
  Flame,
  Camera,
  Trophy,
  TrendingUp,
  TrendingDown,
  Lock,
  RefreshCw,
  LogOut,
} from "lucide-react";
import { getWorkoutStreak, getTotalStats, db, getPersonalRecords, getWeeklyTonnage } from "@/db";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useGeneratorStore } from "@/store/useGeneratorStore";
import { classifyStrength } from "@/services/strengthStandards";
import { pushToCloud } from "@/lib/syncEngine";
import { useAchievementsStore } from "@/store/useAchievementsStore";
import { ACHIEVEMENTS } from "@/data/achievements";
import AchievementBadge from "@/components/AchievementBadge";
import AvatarUploadSheet from "@/components/profile/AvatarUploadSheet";
import { Avatar } from "@/components/ui-custom/Avatar";
import { useToastStore } from "@/store/useToastStore";
import { uid } from "@/utils/id";
import { Button } from "@/components/ui-custom/Button";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.4, ease: "easeOut" as const },
  }),
};

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const ramadanMode = useSettingsStore((s) => s.ramadanMode);
  const unlockedList = useAchievementsStore((s) => s.unlockedList);
  const loadUnlocked = useAchievementsStore((s) => s.loadUnlocked);
  const bodyweight = useGeneratorStore((s) => s.weightKg) || 70;

  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [profileName, setProfileName] = useState("");

  useEffect(() => {
    const currentName = (typeof window !== "undefined" && localStorage.getItem("pulse_user_name")) ||
      user?.displayName ||
      "ATHLETE";
    setTimeout(() => {
      setProfileName(currentName);
    }, 0);
  }, [user]);

  const handleSaveName = async () => {
    if (!newName.trim()) return;
    if (typeof window !== "undefined") {
      localStorage.setItem("pulse_user_name", newName.trim());
      setProfileName(newName.trim());
      window.dispatchEvent(new Event("pulse-user-name-updated"));
    }
    if (user) {
      try {
        await fetch("/api/social/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayName: newName.trim() }),
        });
        useAuthStore.getState().setUser({
          ...user,
          displayName: newName.trim(),
        });
      } catch (err) {
        console.error("Failed to update profile name on server:", err);
      }
    }
    setShowEditNameModal(false);
    useToastStore.getState().addToast("success", "Profile name updated!");
  };

  const [streak, setStreak] = useState(0);
  const [totalWorkouts, setTotalWorkouts] = useState(0);
  const [allTimeVolume, setAllTimeVolume] = useState(0);
  const [latestWeight, setLatestWeight] = useState<number | null>(null);
  const [prevWeight, setPrevWeight] = useState<number | null>(null);
  const [maxWeeklyTonnage, setMaxWeeklyTonnage] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [showAvatarSheet, setShowAvatarSheet] = useState(false);
  const [personalRecords, setPersonalRecords] = useState<
    {
      exerciseId: string | number;
      exerciseName: string;
      max1RM: number;
      maxWeight: number;
      weight: number;
      reps: number;
      date: string;
    }[]
  >([]);

  useEffect(() => {
    async function loadData() {
      const [streakData, statsData, measurements, prsData, tonnageData] = await Promise.all([
        getWorkoutStreak(),
        getTotalStats(),
        db.bodyMeasurements.orderBy("date").reverse().limit(2).toArray(),
        getPersonalRecords(),
        getWeeklyTonnage(8),
      ]);

      setStreak(streakData);
      setTotalWorkouts(statsData.totalWorkouts);
      setAllTimeVolume(statsData.totalVolume);
      if (measurements.length > 0) {
        setLatestWeight(measurements[0].weight ?? null);
        if (measurements.length > 1) {
          setPrevWeight(measurements[1].weight ?? null);
        }
      }
      setPersonalRecords(prsData);
      setMaxWeeklyTonnage(tonnageData.length > 0 ? Math.max(...tonnageData.map((w) => w.tonnage)) : 0);
      loadUnlocked();
    }
    loadData();
  }, [loadUnlocked]);

  const handleFreezeStreak = async () => {
    if (
      confirm(
        "Freeze your streak for today? This adds a dummy session to protect your streak without adding to your volume."
      )
    ) {
      const dbDate = new Date().toISOString();
      await db.workoutSessions.add({
        id: uid(),
        name: "Streak Freeze ❄️",
        date: dbDate,
        duration: 0,
        exercises: [],
        completed: true,
        isFreeze: true,
        createdAt: dbDate,
        updatedAt: dbDate,
      });
      useToastStore.getState().addToast("success", "Streak frozen for today! ❄️");
      const streakData = await getWorkoutStreak();
      setStreak(streakData);
    }
  };

  const handleSync = async () => {
    if (!user) return;
    setSyncing(true);
    try {
      await pushToCloud(user.uid);
      useToastStore.getState().addToast("success", "Synced to cloud!");
    } catch (err) {
      console.error("Sync failed:", err);
      useToastStore.getState().addToast("error", "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
    } catch (err) {
      console.error("Failed to delete session on server:", err);
    }
    localStorage.removeItem("local_user");
    useAuthStore.getState().setUser(null);
  };

  const formatVolume = (kg: number) => {
    if (kg >= 1000000) return { value: (kg / 1000000).toFixed(1), unit: "M" };
    if (kg >= 1000) return { value: (kg / 1000).toFixed(1), unit: "K" };
    return { value: String(Math.round(kg)), unit: "kg" };
  };

  const volFormatted = formatVolume(allTimeVolume);
  const weightTrend =
    latestWeight != null && prevWeight != null ? latestWeight - prevWeight : null;

  const unlockedCount = unlockedList.length;
  const totalAchievements = ACHIEVEMENTS.length;

  return (
    <div className="space-y-6 pb-4">
      {/* Section 1: Hero Profile Card */}
      <motion.section
        custom={0}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="glass-card relative overflow-hidden rounded-2xl border border-border p-6"
      >
        {/* Ambient glow */}
        <motion.div
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-[80px]"
          animate={{ opacity: [0.3, 0.5, 0.3], scale: [1, 1.1, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />

        <Link
          to="/settings"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary"
          aria-label="Settings"
        >
          <Settings className="h-4 w-4" />
        </Link>

        <div className="relative z-10 flex flex-col items-center">
          {/* Avatar with glow ring — tappable to upload */}
          <button
            onClick={() => setShowAvatarSheet(true)}
            className="group relative mb-4 h-24 w-24 cursor-pointer"
            aria-label="Change profile photo"
          >
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-primary"
              style={{ boxShadow: "0 0 20px rgba(204,255,0,0.3)" }}
              animate={{ scale: [1, 1.05, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
            <Avatar size="xl" className="relative h-full w-full border-4 border-bg" />
            {/* Camera badge on hover */}
            <div className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-bg bg-primary opacity-0 transition-opacity group-hover:opacity-100">
              <Camera className="h-3.5 w-3.5 text-black" />
            </div>
            {ramadanMode && (
              <motion.div
                className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-warning text-xs"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
              >
                🌙
              </motion.div>
            )}
          </button>

          {/* Name + email */}
          <div className="flex items-center gap-2">
            <h1 className="text-center text-2xl font-black italic uppercase tracking-tighter text-text-primary">
              {profileName}
            </h1>
            <button
              onClick={() => {
                setNewName(profileName);
                setShowEditNameModal(true);
              }}
              className="rounded-lg border border-border bg-bg-elevated px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-text-secondary hover:text-text-primary transition-colors"
            >
              Edit
            </button>
          </div>
          <p className="mt-1 mb-3 text-xs font-medium text-text-secondary">
            {user?.email || "guest@pulse.fitness"}
          </p>

          {/* Workouts count badge */}
          <div className="mb-6 rounded-full border border-border bg-bg-elevated/50 px-4 py-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
              {totalWorkouts} Completed Workouts
            </span>
          </div>

          {/* Achievement badge icons row (mini) */}
          <div className="mb-6 flex gap-2">
            {ACHIEVEMENTS.slice(0, 5).map((ach) => {
              const unlocked = unlockedList.find((u) => u.achievementId === ach.id);
              return (
                <div
                  key={ach.id}
                  className={`flex h-8 w-8 items-center justify-center rounded-full border ${
                    unlocked
                      ? "border-primary/40 bg-primary/10"
                      : "border-border bg-bg-elevated opacity-40"
                  }`}
                  title={ach.title}
                >
                  {unlocked ? (
                    <Trophy className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <Lock className="h-3 w-3 text-text-secondary" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Action buttons */}
          <div className="flex w-full gap-3">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex flex-1 items-center justify-center gap-2 border-2 border-primary/30 py-3 text-xs font-bold uppercase tracking-widest text-primary transition-colors hover:bg-primary/5 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing" : "Sync Now"}
            </button>
            <button
              onClick={handleLogout}
              className="flex flex-1 items-center justify-center gap-2 bg-danger/10 py-3 text-xs font-bold uppercase tracking-widest text-danger transition-colors hover:bg-danger/20"
            >
              <LogOut className="h-3.5 w-3.5" />
              Logout
            </button>
          </div>
        </div>
      </motion.section>

      {/* Section 2: Stats Summary (2x2 grid) */}
      <motion.section
        custom={1}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 gap-3"
      >
        {/* Workouts */}
        <div className="glass-card rounded-xl border border-border border-t-2 border-t-primary p-4">
          <div className="mb-2 flex items-center gap-2 text-text-secondary">
            <Dumbbell className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Workouts</span>
          </div>
          <div className="text-2xl font-black italic tabular-nums text-primary">
            {totalWorkouts}
          </div>
        </div>

        {/* Streak with Freeze */}
        <div className="glass-card rounded-xl border border-border border-t-2 border-t-warning p-4">
          <div className="mb-2 flex items-center justify-between text-text-secondary">
            <div className="flex items-center gap-2">
              <Flame className="h-3.5 w-3.5 text-warning" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Streak</span>
            </div>
            <button
              onClick={handleFreezeStreak}
              className="rounded border border-warning/20 bg-warning/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-warning transition-colors hover:bg-warning/20"
            >
              Freeze
            </button>
          </div>
          <div className="text-2xl font-black italic tabular-nums text-warning">{streak}</div>
        </div>

        {/* Weight with trend */}
        <div className="glass-card rounded-xl border border-border border-t-2 border-t-secondary p-4">
          <div className="mb-2 flex items-center justify-between text-text-secondary">
            <div className="flex items-center gap-2">
              <Scale className="h-3.5 w-3.5 text-secondary" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Weight</span>
            </div>
            {weightTrend !== null && weightTrend !== 0 && (
              <span
                className={`flex items-center gap-0.5 text-[9px] font-bold ${
                  weightTrend < 0 ? "text-success" : "text-danger"
                }`}
              >
                {weightTrend < 0 ? (
                  <TrendingDown className="h-3 w-3" />
                ) : (
                  <TrendingUp className="h-3 w-3" />
                )}
                {Math.abs(weightTrend).toFixed(1)}
              </span>
            )}
          </div>
          <div className="text-2xl font-black italic tabular-nums text-text-primary">
            {latestWeight ?? "—"}
            {latestWeight != null && (
              <span className="ml-1 text-sm font-normal not-italic text-text-secondary">kg</span>
            )}
          </div>
        </div>

        {/* Volume */}
        <div className="glass-card rounded-xl border border-border border-t-2 border-t-primary p-4">
          <div className="mb-2 flex items-center gap-2 text-text-secondary">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Volume</span>
          </div>
          <div className="text-2xl font-black italic tabular-nums text-text-primary">
            {volFormatted.value}
            <span className="ml-1 text-sm font-normal not-italic text-text-secondary">
              {volFormatted.unit}
            </span>
          </div>
        </div>
      </motion.section>

      {/* Section 3: Personal Records */}
      {personalRecords.length > 0 && (
        <motion.section
          custom={2}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="space-y-3"
        >
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h2 className="text-sm font-bold uppercase italic text-text-primary">
              Personal Records
            </h2>
            <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">
              {personalRecords.length} total
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {personalRecords.slice(0, 3).map((pr, i) => (
              <div
                key={i}
                className="glass-card group flex items-center justify-between rounded-xl border border-border border-l-2 border-l-transparent p-3 transition-all hover:border-l-primary hover:bg-white/[0.03]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
                    <Trophy className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase text-text-primary">
                      {pr.exerciseName}
                    </h3>
                    <span className="text-[10px] font-medium text-text-secondary">
                      {pr.weight}kg × {pr.reps} reps ·{" "}
                      {new Date(pr.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black italic tabular-nums text-text-primary">
                    {pr.maxWeight}
                    <span className="ml-1 text-[10px] font-bold uppercase text-text-secondary">
                      kg
                    </span>
                  </div>
                  <span className="inline-block rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                    1RM: {Math.round(pr.max1RM)}
                  </span>
                  {(() => {
                    const s = classifyStrength(pr.max1RM, bodyweight, pr.exerciseName);
                    return (
                      <span className={`ml-1 inline-block rounded border ${s.borderClass} ${s.bgClass} px-1.5 py-0.5 text-[9px] font-bold ${s.colorClass}`}>
                        {s.level}
                      </span>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Section 4: Achievements with progress bars */}
      <motion.section
        custom={3}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="space-y-3"
      >
        <div className="flex items-center justify-between border-b border-border pb-2">
          <h2 className="text-sm font-bold uppercase italic text-text-primary">Achievements</h2>
          <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">
            {unlockedCount}/{totalAchievements} Unlocked
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {ACHIEVEMENTS.map((ach) => {
            const unlocked = unlockedList.find((u) => u.achievementId === ach.id);
            const isUnlocked = !!unlocked;

            // Calculate progress for locked achievements
            let currentValue = 0;
            if (
              ach.id === "first_workout" ||
              ach.id === "10_workouts" ||
              ach.id === "25_workouts" ||
              ach.id === "50_workouts" ||
              ach.id === "100_workouts" ||
              ach.id === "250_workouts" ||
              ach.id === "500_workouts" ||
              ach.id === "1000_workouts"
            ) {
              currentValue = totalWorkouts;
            } else if (
              ach.id === "3_day_streak" ||
              ach.id === "7_day_streak" ||
              ach.id === "14_day_streak" ||
              ach.id === "30_day_streak"
            ) {
              currentValue = streak;
            } else if (ach.id === "10k_tonnage" || ach.id === "50k_tonnage") {
              currentValue = maxWeeklyTonnage;
            } else if (ach.id === "10_prs") {
              currentValue = personalRecords.length;
            }

            const threshold = ach.threshold || 1;
            const progress = !isUnlocked
              ? Math.min(100, Math.round((currentValue / threshold) * 100))
              : 100;
            const progressLabel = !isUnlocked ? `${currentValue}/${threshold}` : undefined;

            return (
              <AchievementBadge
                key={ach.id}
                title={ach.title}
                description={ach.description}
                iconName={ach.iconName}
                isUnlocked={isUnlocked}
                unlockedAt={unlocked?.unlockedAt}
                progress={progress}
                progressLabel={progressLabel}
              />
            );
          })}
        </div>
      </motion.section>

      {/* Section 5: Menu Items */}
      <motion.section
        custom={4}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="glass-card overflow-hidden rounded-2xl border border-border"
      >
        <Link
          to="/body"
          className="flex w-full items-center justify-between border-b border-border p-4 transition-colors hover:bg-white/[0.03]"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/10">
              <Scale className="h-5 w-5 text-secondary" />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-bold text-text-primary">Body Metrics</h3>
              <p className="text-xs text-text-secondary">Track your physical changes</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-text-secondary" />
        </Link>

        <Link
          to="/body"
          className="flex w-full items-center justify-between border-b border-border p-4 transition-colors hover:bg-white/[0.03]"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Camera className="h-5 w-5 text-primary" />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-bold text-text-primary">Progress Photos</h3>
              <p className="text-xs text-text-secondary">Visual transformation</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-text-secondary" />
        </Link>

        <Link
          to="/settings"
          className="flex w-full items-center justify-between p-4 transition-colors hover:bg-white/[0.03]"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-bg-elevated">
              <Settings className="h-5 w-5 text-text-secondary" />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-bold text-text-primary">Settings</h3>
              <p className="text-xs text-text-secondary">
                {ramadanMode ? "Ramadan mode active" : "App preferences & account"}
              </p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-text-secondary" />
        </Link>
      </motion.section>

      {/* Footer */}
      <motion.footer
        custom={5}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="pb-8 text-center"
      >
        <p className="text-sm text-text-secondary">Pulse v1.0.0</p>
        <p className="mt-2 text-[10px] uppercase tracking-widest text-text-secondary/50">
          CRAFTED WITH ⚡ FOR THE FITNESS COMMUNITY
        </p>
      </motion.footer>

      {/* Avatar Upload Sheet */}
      <AvatarUploadSheet
        isOpen={showAvatarSheet}
        onClose={() => setShowAvatarSheet(false)}
      />

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {showEditNameModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEditNameModal(false)}
              className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-[101] flex items-center justify-center p-6"
            >
              <div className="w-full max-w-sm rounded-3xl bg-bg-card p-6 shadow-2xl border border-border">
                <h2 className="text-xl font-bold text-text-primary mb-4 uppercase tracking-wider">Edit Profile</h2>
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-text-secondary mb-2">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Enter new name"
                      className="w-full rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button variant="ghost" className="flex-1" onClick={() => setShowEditNameModal(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" className="flex-1" onClick={handleSaveName}>
                    Save
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
