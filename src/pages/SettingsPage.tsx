"use client";
import { useState, useEffect } from "react";
import { Link } from "@/router-shim";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Moon,
  Timer,
  Bell,
  Scale,
  Info,
  ChevronRight,
  Sun,
  Monitor,
  Volume2,
  Mic,
  Cloud,
  RefreshCw,
  Download,
  Upload,
  DatabaseBackup,
  Play,
} from "lucide-react";
import { useSettingsStore, Theme } from "@/store/useSettingsStore";
import { Button } from "@/components/ui-custom/Button";
import { cn } from "@/utils/cn";
import { useCloudSyncState } from "@/hooks/useCloudSyncState";
import { useAuthStore } from "@/store/useAuthStore";
import { syncAll, exportLocalBackup } from "@/lib/syncEngine";
import {
  requestNotificationPermission,
  getNotificationPermission,
  sendNotification,
} from "@/services/notificationService";
import { useTranslation } from "react-i18next";
import { useToastStore } from "@/store/useToastStore";
import { useVoiceCoach } from "@/hooks/useVoiceCoach";
import { voiceCoach } from "@/services/voiceCoach";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: "easeOut" as const },
  }),
};

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const {
    ramadanMode,
    toggleRamadanMode,
    restDuration,
    setRestDuration,
    weightUnit,
    setWeightUnit,
    notificationsEnabled,
    toggleNotifications,
    setNotificationsEnabled,
    soundEnabled,
    toggleSound,
    theme,
    setTheme,
  } = useSettingsStore();

  const { isOnline, status, lastSyncedText } = useCloudSyncState();

  const voiceCoachState = useVoiceCoach();

  interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  }

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallBtn(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    if (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches
    ) {
      setShowInstallBtn(false);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);
    setDeferredPrompt(null);
    setShowInstallBtn(false);
  };

  const handleNotificationsToggle = async () => {
    // Turning OFF is always allowed.
    if (notificationsEnabled) {
      toggleNotifications();
      return;
    }
    // Turning ON requires browser permission.
    const perm = getNotificationPermission();
    if (perm === "unsupported") {
      alert("Your browser does not support notifications.");
      return;
    }
    const granted = await requestNotificationPermission();
    if (granted) {
      setNotificationsEnabled(true);
      sendNotification("Pulse notifications enabled", {
        body: "We'll remind you when your rest timer is done. Let's go!",
      });
      // Initialize the new notification service (workout reminders, PR alerts)
      import("@/services/notificationService").then(({ initNotifications }) => {
        initNotifications();
      }).catch(() => {});
    } else {
      alert(
        "Notifications are blocked. Please enable them in your browser settings to receive workout reminders."
      );
    }
  };

  return (
    <div className="space-y-6 pb-6">
      {/* ── Back Button ── */}
      <Link
        to="/profile"
        className="inline-flex items-center gap-2 text-sm font-medium text-text-secondary transition-colors hover:text-primary uppercase tracking-wide"
      >
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        {t("back")}
      </Link>

      {/* ── Page Title ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-xl font-bold text-text-primary uppercase tracking-wider">{t("settings")}</h1>
        <p className="mt-1 text-sm text-text-secondary">{t("settings_desc")}</p>
      </motion.div>

      {/* ── Theme ── */}
      <motion.div
        className="glass-card rounded-[--radius-card] p-4"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={0}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-muted">
            <Sun className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-text-primary uppercase tracking-wider truncate">
              {t("app_theme")}
            </p>
            <p className="text-xs text-text-secondary truncate">{t("theme_desc")}</p>
          </div>
        </div>
        <div className="flex p-1 bg-bg-surface-hover rounded-xl border border-border">
          {[
            { value: "light" as Theme, label: t("light"), icon: Sun },
            { value: "dark" as Theme, label: t("dark"), icon: Moon },
            { value: "system" as Theme, label: t("system"), icon: Monitor },
          ].map((option) => {
            const isSelected = theme === option.value;
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                onClick={() => setTheme(option.value)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold transition-all uppercase tracking-wider",
                  isSelected
                    ? "bg-bg-elevated text-text-primary shadow-sm ring-1 ring-border"
                    : "text-text-secondary hover:text-text-secondary"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{option.label}</span>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* ── Install App (PWA) ── */}
      {showInstallBtn && (
        <motion.div
          className="glass-card rounded-[--radius-card] p-4 border border-border"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-muted">
                <Download className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-text-primary uppercase tracking-wider truncate">
                  {t("install_app")}
                </p>
                <p className="text-xs text-text-secondary truncate">{t("install_desc")}</p>
              </div>
            </div>
            <Button
              onClick={handleInstallClick}
              variant="primary"
              className="py-2.5 px-4 text-xs font-bold uppercase tracking-wider h-auto"
            >
              {t("install")}
            </Button>
          </div>
        </motion.div>
      )}

      {/* ── Ramadan Mode ── */}
      <motion.div
        className="glass-card rounded-[--radius-card] p-4"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={1}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-warning/10">
              <Moon className="h-5 w-5 text-warning" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-text-primary uppercase tracking-wider truncate">
                {t("ramadan_mode")} 🌙
              </p>
              <p className="text-xs text-text-secondary truncate">{t("ramadan_desc")}</p>
            </div>
          </div>
          <button
            onClick={toggleRamadanMode}
            className={cn(
              "relative h-8 w-14 shrink-0 rounded-full transition-colors duration-300",
              ramadanMode ? "bg-warning" : "bg-toggle-off"
            )}
          >
            <motion.div
              className="absolute top-1 h-6 w-6 rounded-full bg-white shadow-md"
              animate={{ x: ramadanMode ? 28 : 4 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </button>
        </div>
        {ramadanMode && (
          <motion.p
            className="mt-3 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning border border-warning/20 uppercase tracking-wider text-center"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
          >
            ✨ Ramadan Mode Active! Ramadan Mubarak 🌙
          </motion.p>
        )}
      </motion.div>

      {/* ── Rest Timer Duration ── */}
      <motion.div
        className="glass-card rounded-[--radius-card] p-4"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={1}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-muted">
            <Timer className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-text-primary uppercase tracking-wider truncate">
              {t("rest_duration")}
            </p>
            <p className="text-xs text-text-secondary truncate">{t("rest_duration_desc")}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {[60, 90, 120, 180].map((seconds) => (
            <Button
              key={seconds}
              onClick={() => setRestDuration(seconds)}
              variant={restDuration === seconds ? "primary" : "ghost"}
              className="flex-1 py-2 text-sm font-semibold"
            >
              {seconds >= 60 ? `${seconds / 60}m` : `${seconds}s`}
            </Button>
          ))}
        </div>
      </motion.div>

      {/* ── Weight Unit ── */}
      <motion.div
        className="glass-card rounded-[--radius-card] p-4"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={2}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-success/10">
            <Scale className="h-5 w-5 text-success" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-text-primary uppercase tracking-wider truncate">
              {t("weight_unit")}
            </p>
            <p className="text-xs text-text-secondary truncate">{t("weight_unit_desc")}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {[
            { value: "kg" as const, label: "Kilograms (kg)" },
            { value: "lbs" as const, label: "Pounds (lbs)" },
          ].map((option) => (
            <Button
              key={option.value}
              onClick={() => setWeightUnit(option.value)}
              variant={weightUnit === option.value ? "primary" : "ghost"}
              className="flex-1 py-2.5 text-sm uppercase tracking-wider h-auto font-semibold"
            >
              {option.label}
            </Button>
          ))}
        </div>
      </motion.div>

      {/* ── Notifications ── */}
      <motion.div
        className="glass-card rounded-[--radius-card] p-4"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={3}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-muted">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-text-primary uppercase tracking-wider truncate">
                {t("notifications")}
              </p>
              <p className="text-xs text-text-secondary truncate">{t("notifications_desc")}</p>
            </div>
          </div>
          <button
            onClick={handleNotificationsToggle}
            className={cn(
              "relative h-8 w-14 shrink-0 rounded-full transition-colors duration-300",
              notificationsEnabled
                ? "bg-primary shadow-[0_0_10px_var(--c-primary-glow)]"
                : "bg-toggle-off"
            )}
          >
            <motion.div
              className="absolute top-1 h-6 w-6 rounded-full bg-white shadow-md"
              animate={{ x: notificationsEnabled ? 28 : 4 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </button>
        </div>
      </motion.div>

      {/* ── Sounds ── */}
      <motion.div
        className="glass-card rounded-[--radius-card] p-4"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={4}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-info/10">
              <Volume2 className="h-5 w-5 text-info" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-text-primary uppercase tracking-wider truncate">
                {t("sound_effects")}
              </p>
              <p className="text-xs text-text-secondary truncate">{t("sound_effects_desc")}</p>
            </div>
          </div>
          <button
            onClick={toggleSound}
            className={cn(
              "relative h-8 w-14 shrink-0 rounded-full transition-colors duration-300",
              soundEnabled ? "bg-info shadow-[0_0_10px_rgba(56,189,248,0.4)]" : "bg-toggle-off"
            )}
          >
            <motion.div
              className="absolute top-1 h-6 w-6 rounded-full bg-white shadow-md"
              animate={{ x: soundEnabled ? 28 : 4 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </button>
        </div>
      </motion.div>

      {/* ── Voice Coach ── */}
      <motion.div
        className="glass-card rounded-[--radius-card] p-4"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={4}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-muted">
              <Mic className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-text-primary uppercase tracking-wider truncate">
                Voice Coach 🎙️
              </p>
              <p className="text-xs text-text-secondary truncate">
                Spoken cues for rest, PRs, and milestones
              </p>
            </div>
          </div>
          <button
            onClick={() => voiceCoachState.toggle(!voiceCoachState.enabled)}
            disabled={!voiceCoachState.isSupported}
            aria-label="Toggle voice coach"
            aria-pressed={voiceCoachState.enabled}
            className={cn(
              "relative h-8 w-14 shrink-0 rounded-full transition-colors duration-300",
              voiceCoachState.enabled
                ? "bg-primary shadow-[0_0_10px_var(--c-primary-glow)]"
                : "bg-toggle-off",
              !voiceCoachState.isSupported && "opacity-50 cursor-not-allowed"
            )}
          >
            <motion.div
              className="absolute top-1 h-6 w-6 rounded-full bg-white shadow-md"
              animate={{ x: voiceCoachState.enabled ? 28 : 4 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </button>
        </div>

        {/* Unsupported notice */}
        {!voiceCoachState.isSupported && (
          <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger border border-danger/20">
            Your browser doesn't support speech synthesis. Try Chrome, Edge, or Safari.
          </p>
        )}

        {/* Voice selector + Test button — only when enabled */}
        {voiceCoachState.enabled && voiceCoachState.isSupported && (
          <motion.div
            className="mt-4 space-y-3"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
          >
            <div>
              <label
                htmlFor="voice-coach-select"
                className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1.5"
              >
                Voice
              </label>
              <select
                id="voice-coach-select"
                value={voiceCoachState.selectedVoiceURI ?? ""}
                onChange={(e) => voiceCoachState.selectVoice(e.target.value)}
                className="w-full h-11 rounded-xl bg-bg-surface-hover border border-border px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {voiceCoachState.voices.length === 0 && (
                  <option value="">Loading voices…</option>
                )}
                {voiceCoachState.voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} — {v.lang}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() =>
                  voiceCoach.speakText("That's how I sound. Let's get to work!")
                }
                variant="outline"
                className="flex-1 py-2.5 text-xs uppercase tracking-wider h-auto"
              >
                <Play className="h-4 w-4" />
                Test Voice
              </Button>
              <Button
                onClick={() => {
                  voiceCoach.stop();
                  useToastStore.getState().addToast("info", "Voice coach stopped.");
                }}
                variant="ghost"
                className="py-2.5 text-xs uppercase tracking-wider h-auto"
              >
                Stop
              </Button>
            </div>

            <p className="text-[11px] text-text-muted flex items-start gap-1.5">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-text-muted" />
              <span>
                Uses your device's built-in speech engine. Works offline. Cues fire
                on rest completion, new PRs, set completion, the halfway mark, and
                workout completion.
              </span>
            </p>
          </motion.div>
        )}
      </motion.div>

      {/* ── Cloud Sync ── */}
      <motion.div
        className="glass-card rounded-[--radius-card] p-4"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={5}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
                !isOnline ? "bg-danger/10 text-danger" : "bg-primary/10 text-primary"
              )}
            >
              <Cloud className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-text-primary uppercase tracking-wider truncate">
                {t("cloud_sync")}
              </p>
              <p className="text-xs text-text-secondary truncate">
                {status === "syncing" ? t("loading") : lastSyncedText}
              </p>
            </div>
          </div>
          {isOnline && (
            <button
              onClick={() => {
                const user = useAuthStore.getState().user;
                if (user) syncAll(user.uid).catch(console.error);
              }}
              disabled={status === "syncing"}
              className={cn(
                "h-11 w-11 flex items-center justify-center rounded-xl bg-bg-elevated hover:bg-bg-hover text-text-secondary transition-all active:scale-95 border border-border/50",
                status === "syncing" && "animate-spin"
              )}
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
        </div>
      </motion.div>

      {/* ── Data Backup (Phase 3 improvement: export/import) ── */}
      <motion.div
        className="glass-card rounded-[--radius-card] p-4"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={5}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-success/10">
            <DatabaseBackup className="h-5 w-5 text-success" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-text-primary uppercase tracking-wider truncate">
              Data Backup
            </p>
            <p className="text-xs text-text-secondary truncate">
              Export / import your local workout data
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={async () => {
              try {
                const backup = await exportLocalBackup();
                const blob = new Blob([JSON.stringify(backup, null, 2)], {
                  type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `pulse-backup-${new Date().toISOString().split("T")[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
                useToastStore.getState().addToast("success", "Backup exported!");
              } catch (e) {
                console.error(e);
                useToastStore.getState().addToast("error", "Export failed");
              }
            }}
            variant="outline"
            className="flex-1 py-2.5 text-xs uppercase tracking-wider h-auto"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = "application/json";
              input.onchange = async (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (!file) return;
                try {
                  const text = await file.text();
                  const backup = JSON.parse(text);
                  const { importLocalBackup } = await import("@/lib/syncEngine");
                  await importLocalBackup(backup);
                  useToastStore.getState().addToast("success", "Backup imported!");
                } catch (err) {
                  console.error(err);
                  useToastStore.getState().addToast("error", "Import failed — invalid file");
                }
              };
              input.click();
            }}
            variant="outline"
            className="flex-1 py-2.5 text-xs uppercase tracking-wider h-auto"
          >
            <Upload className="h-4 w-4" />
            Import
          </Button>
        </div>
      </motion.div>

      {/* ── About ── */}
      <motion.div
        className="glass-card rounded-[--radius-card] p-4 flex items-center justify-between active:scale-[0.98] transition-all cursor-pointer hover:ring-1 hover:ring-border/80"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={5}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-bg-elevated">
            <Info className="h-5 w-5 text-text-secondary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-text-primary uppercase tracking-wider truncate">
              {t("about")}
            </p>
            <p className="text-xs text-text-secondary truncate">Pulse v1.0.0</p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-text-secondary shrink-0 rtl:rotate-180" />
      </motion.div>

      {/* ── Footer ── */}
      <motion.p
        className="text-center text-xs text-text-secondary pt-4 uppercase tracking-widest"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={5}
      >
        Crafted with ⚡ for the Fitness Community
      </motion.p>
    </div>
  );
}
