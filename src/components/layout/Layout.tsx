"use client";
import { ReactNode, useRef, useState, useEffect, ElementType } from "react";
import { Link, useLocation } from "@/router-shim";
import { Home, Dumbbell, Activity, User, Utensils, Globe, ArrowUp, Trophy } from "lucide-react";
import { ToastContainer } from "@/components/ui-custom/Toast";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/utils/cn";
import { useCloudSyncState } from "@/hooks/useCloudSyncState";
import { useAuthStore } from "@/store/useAuthStore";
import { useTranslation } from "react-i18next";
import RestTimer from "@/components/workout/RestTimer";

function NavItem({ to, icon: Icon, label, isActive }: { to: string; icon: ElementType; label: string; isActive: boolean }) {
  const triggerHaptic = () => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(50);
    }
  };

  return (
    <Link
      to={to}
      onClick={triggerHaptic}
      aria-current={isActive ? "page" : undefined}
      aria-label={label}
      className={cn(
        "group relative flex flex-1 flex-col items-center p-3 transition-colors",
        isActive
          ? "text-primary"
          : "text-text-secondary hover:text-text-primary"
      )}
    >
      {/* Active top indicator bar */}
      <div
        className={cn(
          "absolute top-0 w-8 h-0.5 bg-primary transition-transform origin-center rounded-b-full",
          isActive ? "scale-x-100 shadow-[0_0_8px_var(--c-primary-glow)]" : "scale-x-0"
        )}
      />
      {/* Active background pill (clear "you are here" layer) */}
      <div
        className={cn(
          "absolute inset-x-1.5 top-1.5 bottom-1.5 rounded-xl transition-all",
          isActive ? "bg-primary-dim opacity-100" : "opacity-0"
        )}
      />
      <Icon
        size={22}
        strokeWidth={isActive ? 2.75 : 2.25}
        className="mt-1 relative z-10"
      />
      <span
        className={cn(
          "text-xs mt-1 tracking-wide relative z-10",
          isActive ? "font-bold" : "font-medium"
        )}
      >
        {label}
      </span>
    </Link>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const isLoading = useAuthStore((state) => state.isLoading);
  const user = useAuthStore((state) => state.user);
  const mainRef = useRef<HTMLElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const location = useLocation();
  const { isOnline, status } = useCloudSyncState();

  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTo(0, 0);
    }
  }, [location.pathname]);

  if (isLoading) {
    return (
      <div className="flex justify-center bg-bg-surface min-h-screen">
        <div className="flex flex-col items-center justify-center h-[100dvh] w-full max-w-md bg-gradient-to-br from-bg-surface via-bg to-bg-surface text-text-primary relative shadow-2xl border-x border-border overflow-hidden">
          <div className="absolute inset-0 bg-bg/50 backdrop-blur-md pointer-events-none" />
          <div className="relative z-10 flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin shadow-[0_0_15px_var(--c-primary-glow)]" />
            <p className="text-xs text-text-secondary font-black tracking-widest uppercase animate-pulse">
              {t("loading")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleScroll = (e: React.UIEvent<HTMLElement>) => {
    setShowScrollTop(e.currentTarget.scrollTop > 300);
  };

  const scrollToTop = () => {
    if (mainRef.current) {
      mainRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="flex justify-center bg-bg-surface min-h-screen">
      <div className="flex flex-col h-[100dvh] w-full max-w-md bg-bg text-text-primary relative shadow-2xl border-x border-border overflow-hidden">
        <ToastContainer />

        {/* Top Left Challenges Link — reactive to auth state */}
        {user && (
          <div className="absolute top-4 start-4 z-[90]">
            <Link
              to="/challenges"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-bg-surface/85 backdrop-blur-md border border-border/50 text-xs font-black tracking-wider uppercase select-none shadow-sm hover:bg-bg-elevated transition-colors text-text-primary"
            >
              <Trophy size={12} className="text-warning" />
              <span>{t("challenges")}</span>
            </Link>
          </div>
        )}

        {/* Top Floating Sync Indicator */}
        <div className="absolute top-4 end-4 z-[90] flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-bg-surface/85 backdrop-blur-md border border-border/50 text-xs font-black tracking-wider uppercase select-none shadow-sm transition-all pointer-events-none">
          <span
            className={cn(
              "w-2 h-2 rounded-full",
              !isOnline
                ? "bg-danger shadow-[0_0_8px_rgba(239,68,68,0.6)]"
                : status === "syncing"
                  ? "bg-warning animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]"
                  : status === "error"
                    ? "bg-danger shadow-[0_0_8px_rgba(239,68,68,0.6)]"
                    : "bg-success shadow-[0_0_8px_rgba(34,197,94,0.6)]"
            )}
          />
          <span className="text-text-secondary text-xs">
            {!isOnline ? t("offline") : status === "syncing" ? t("syncing") : t("cloud")}
          </span>
        </div>
        <main
          ref={mainRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto pb-[calc(80px+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)] scroll-smooth no-scrollbar"
        >
          <div className="px-4">{children}</div>
        </main>

        <AnimatePresence>
          {showScrollTop && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              onClick={scrollToTop}
              aria-label="Scroll to top"
              className="absolute bottom-24 end-4 z-40 p-3 rounded-full bg-primary text-primary-text shadow-[0_0_16px_var(--c-primary-glow)] hover:scale-105 active:scale-95 transition-transform"
            >
              <ArrowUp className="w-5 h-5" aria-hidden="true" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* ── Global Rest Timer ──
            Mounted here (not only in WorkoutSessionPage) so the timer UI
            stays alive whenever the user is anywhere inside the app. The
            timer state is global + persisted, so navigating away during a
            rest period no longer loses the completion side effects
            (sound, voice, notification). The component itself renders
            nothing unless `restTimerActive` is true (AnimatePresence
            handles the enter/exit animation), so mounting it globally is
            safe and cheap. */}
        <RestTimer />

        <nav className="absolute bottom-0 w-full bg-bg-surface/90 backdrop-blur-md border-t border-border flex justify-between items-center z-50 pb-[env(safe-area-inset-bottom)]">
          <NavItem to="/" icon={Home} label={t("nav_home")} isActive={location.pathname === "home"} />
          <NavItem to="/exercises" icon={Dumbbell} label={t("nav_exercises")} isActive={location.pathname === "exercises" || location.pathname === "exercise-detail"} />
          <NavItem to="/feed" icon={Globe} label={t("nav_feed")} isActive={location.pathname === "feed" || location.pathname === "challenges" || location.pathname === "challenge-detail"} />
          <NavItem to="/nutrition" icon={Utensils} label={t("nav_nutrition")} isActive={location.pathname === "nutrition"} />
          <NavItem to="/stats" icon={Activity} label={t("nav_stats")} isActive={location.pathname === "stats"} />
          <NavItem to="/profile" icon={User} label={t("nav_profile")} isActive={location.pathname === "profile" || location.pathname === "settings" || location.pathname === "body"} />
        </nav>
      </div>
    </div>
  );
}
