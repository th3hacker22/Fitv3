import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  User,
  Settings,
  Scale,
  ChevronRight,
  Dumbbell,
  Flame,
  Calendar,
  Camera,
} from "lucide-react";
import { getWorkoutStreak, getTotalStats, db } from "@/db";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useAuthStore } from "@/store/useAuthStore";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { pushToCloud } from "@/lib/syncEngine";
import { useAchievementsStore } from "@/store/useAchievementsStore";
import { ACHIEVEMENTS } from "@/data/achievements";
import AchievementBadge from "@/components/AchievementBadge";
import { useToastStore } from "@/store/useToastStore";
import { Button } from "@/components/ui/Button";
import { uid } from "@/utils/id";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.4, ease: "easeOut" as const },
  }),
};

export default function ProfilePage() {
  const [streak, setStreak] = useState(0);
  const [totalWorkouts, setTotalWorkouts] = useState(0);
  const [latestWeight, setLatestWeight] = useState<number | null>(null);
  const ramadanMode = useSettingsStore((s) => s.ramadanMode);
  const { user } = useAuthStore();
  const [syncing, setSyncing] = useState(false);
  const { unlockedList, loadUnlocked } = useAchievementsStore();

  useEffect(() => {
    async function loadData() {
      const [streakData, statsData, measurements] = await Promise.all([
        getWorkoutStreak(),
        getTotalStats(),
        db.bodyMeasurements.orderBy("date").reverse().first(),
      ]);

      setStreak(streakData);
      setTotalWorkouts(statsData.totalWorkouts);
      setLatestWeight(measurements?.weight ?? null);

      loadUnlocked();
    }
    loadData();
  }, [loadUnlocked]);

  const handleFreezeStreak = async () => {
    if (
      confirm(
        "Freeze your streak for today? This adds a dummy session to protect your streak without adding to your volume.",
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
      useToastStore
        .getState()
        .addToast("success", "Streak frozen for today! ❄️");
      const streakData = await getWorkoutStreak();
      setStreak(streakData);
    }
  };

  const menuItems = [
    {
      icon: Scale,
      label: "Body Metrics",
      description: latestWeight
        ? `${latestWeight} kg`
        : "Log your measurements",
      color: "text-primary",
      href: "/body",
    },
    {
      icon: Camera,
      label: "Progress Photos",
      description: "Track your transformation",
      color: "text-warning",
      href: "/body",
    },
    {
      icon: Settings,
      label: "Settings",
      description: ramadanMode
        ? "Ramadan Mode Active 🌙"
        : "Customize application",
      color: "text-text-secondary",
      href: "/settings",
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── Page Title ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-xl font-bold text-text-primary uppercase tracking-wider">
          Profile
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Manage your info and track progress
        </p>
      </motion.div>

      {/* ── Profile Card ── */}
      <motion.div
        className="glass-card relative overflow-hidden rounded-[--radius-card] p-6"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={0}
      >
        <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative z-10 flex items-center gap-4">
          <div className="relative">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-muted shrink-0">
              <User className="h-8 w-8 text-primary" />
            </div>
            {ramadanMode && (
              <motion.div
                className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-warning text-xs"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
              >
                🌙
              </motion.div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-text-primary truncate">
                {user?.email || "Pulse User"}
              </h2>
            </div>
            <p className="text-sm text-text-secondary truncate">
              {totalWorkouts > 0
                ? `${totalWorkouts} completed workouts`
                : "Start your fitness journey"}
            </p>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          {user ? (
            <>
              <Button
                onClick={async () => {
                  setSyncing(true);
                  await pushToCloud(user.uid);
                  setSyncing(false);
                }}
                disabled={syncing}
                variant="outline"
                className="flex-1 py-2.5 text-sm"
              >
                {syncing ? "Syncing..." : "Sync Now"}
              </Button>
              <Button
                onClick={() => {
                  if (auth) signOut(auth);
                }}
                variant="danger"
                className="flex-1 py-2.5 text-sm"
              >
                Logout
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              className="w-full h-10"
              onClick={() => window.location.href = "/auth"}
            >
              Login / Signup
            </Button>
          )}
        </div>
      </motion.div>

      {/* ── Stats Summary ── */}
      <motion.div
        className="grid grid-cols-3 gap-3"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={1}
      >
        <div className="glass-card flex flex-col items-center gap-1 rounded-[--radius-card] p-3 text-center">
          <Dumbbell className="h-5 w-5 text-primary" />
          <p className="text-lg font-bold text-text-primary">{totalWorkouts}</p>
          <p className="text-[10px] text-text-muted uppercase tracking-wider">
            Workouts
          </p>
        </div>
        <div className="glass-card flex flex-col items-center gap-1 rounded-[--radius-card] p-3 text-center relative group">
          <Flame className="h-5 w-5 text-warning" />
          <p className="text-lg font-bold text-text-primary">{streak}</p>
          <div className="flex flex-col items-center">
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">
              Streak 🔥
            </p>
            <button
              onClick={handleFreezeStreak}
              className="text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded-full hover:bg-sky-500/20 transition-colors uppercase tracking-wider font-bold"
            >
              Freeze
            </button>
          </div>
        </div>
        <div className="glass-card flex flex-col items-center gap-1 rounded-[--radius-card] p-3 text-center">
          <Calendar className="h-5 w-5 text-success" />
          <p className="text-lg font-bold text-text-primary">
            {latestWeight ?? "—"}
          </p>
          <p className="text-[10px] text-text-muted uppercase tracking-wider">
            kg
          </p>
        </div>
      </motion.div>

      {/* ── Achievements ── */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={1.5}
        className="space-y-4"
      >
        <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary px-1">
          Achievements
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {ACHIEVEMENTS.map((ach) => {
            const unlocked = unlockedList.find(
              (u) => u.achievementId === ach.id,
            );
            return (
              <AchievementBadge
                key={ach.id}
                title={ach.title}
                description={ach.description}
                iconName={ach.iconName}
                isUnlocked={!!unlocked}
                unlockedAt={unlocked?.unlockedAt}
              />
            );
          })}
        </div>
      </motion.div>

      {/* ── Menu Items ── */}
      <motion.div
        className="space-y-2 pb-6"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={2}
      >
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.label} to={item.href} className="block">
              <div className="glass-card flex w-full items-center gap-4 rounded-[--radius-card] p-4 transition-all duration-200 hover:ring-1 hover:ring-primary/20 active:scale-[0.98]">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-bg-elevated">
                  <Icon className={`h-5 w-5 ${item.color}`} />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate uppercase tracking-wider">
                    {item.label}
                  </p>
                  {item.description && (
                    <p className="text-xs text-text-muted truncate">
                      {item.description}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 text-text-muted shrink-0" />
              </div>
            </Link>
          );
        })}
      </motion.div>

      {/* ── Ramadan Banner ── */}
      {ramadanMode && (
        <motion.div
          className="glass-card rounded-[--radius-card] p-4 border border-warning/20 bg-warning/5"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🌙</span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-warning uppercase tracking-wider truncate">
                Ramadan Mubarak!
              </p>
              <p className="text-xs text-text-muted truncate">
                Stay fit during the holy month
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── App Version ── */}
      <motion.p
        className="text-center text-xs text-text-muted pb-8"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={3}
      >
        Pulse v1.0.0
      </motion.p>
    </div>
  );
}
