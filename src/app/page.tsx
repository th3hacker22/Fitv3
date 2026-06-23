"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import Layout from "@/components/layout/Layout";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useRouter } from "@/router";
import { useAuthStore, initAuthListener } from "@/store/useAuthStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { applyTheme, initThemeListener } from "@/utils/theme";
import { useBackgroundSync } from "@/hooks/useBackgroundSync";
import { motion, AnimatePresence } from "framer-motion";

// Client-only overlays — never SSR'd (avoids hydration mismatch from
// sessionStorage/localStorage reads that differ between server and client).
const SplashScreen = dynamic(() => import("@/components/onboarding/SplashScreen"), { ssr: false });
const OnboardingCarousel = dynamic(() => import("@/components/onboarding/OnboardingCarousel"), { ssr: false });

import HomePage from "@/pages/HomePage";
import ExercisesPage from "@/pages/ExercisesPage";
import ExerciseDetailPage from "@/pages/ExerciseDetailPage";
import WorkoutSessionPage from "@/pages/WorkoutSessionPage";
import StatsPage from "@/pages/StatsPage";
import BodyPage from "@/pages/BodyPage";
import ProfilePage from "@/pages/ProfilePage";
import SettingsPage from "@/pages/SettingsPage";
import AuthPage from "@/pages/AuthPage";
import NutritionPage from "@/pages/NutritionPage";
import FeedPage from "@/pages/FeedPage";
import BuilderPage from "@/pages/BuilderPage";
import WizardPage from "@/pages/WizardPage";
import WorkoutResultView from "@/pages/WorkoutResultView";
import ChallengesPage from "@/pages/ChallengesPage";
import ChallengeDetailPage from "@/pages/ChallengeDetailPage";
import CalendarPage from "@/pages/CalendarPage";
import GoalsPage from "@/pages/GoalsPage";

const ONBOARDING_KEY = "pulse_onboarding_done";
const SPLASH_KEY = "pulse_splash_seen";

function AppEntry() {
  // Mounted gate — ensures overlays only render on the client (after hydration).
  const [mounted, setMounted] = useState(false);
  const [stage, setStage] = useState<"splash" | "onboarding" | "none">("none");

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
      // Splash: show once per browser session (sessionStorage)
      const splashSeen = sessionStorage.getItem(SPLASH_KEY);
      // Onboarding: show once per user (localStorage)
      const onboardingDone = localStorage.getItem(ONBOARDING_KEY);

      if (!splashSeen) {
        setStage("splash");
        sessionStorage.setItem(SPLASH_KEY, "true");
      } else if (!onboardingDone) {
        setStage("onboarding");
      } else {
        setStage("none");
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleSplashComplete = useCallback(() => {
    const onboardingDone = localStorage.getItem(ONBOARDING_KEY);
    if (!onboardingDone) {
      setStage("onboarding");
    } else {
      setStage("none");
    }
  }, []);

  const handleOnboardingComplete = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setStage("none");
  }, []);

  return (
    <>
      <AppShell />
      <AnimatePresence>
        {mounted && stage !== "none" && (
          <motion.div
            key="onboarding-overlay"
            className="fixed inset-0 z-[150] bg-[#050505]"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          >
            <AnimatePresence mode="wait">
              {stage === "splash" && (
                <SplashScreen key="splash" onComplete={handleSplashComplete} />
              )}
              {stage === "onboarding" && (
                <OnboardingCarousel key="onboarding" onComplete={handleOnboardingComplete} />
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function AppShell() {
  const route = useRouter((s) => s.route);
  const params = useRouter((s) => s.params);
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  useBackgroundSync();

  // Redirect to auth if not logged in — but ONLY after the auth listener has
  // finished initializing. Without the `isLoading` gate, this effect fires
  // on mount while `user` is still null (initial state), causing an auth-page
  // flash on every reload even for logged-in users.
  useEffect(() => {
    if (isLoading) return; // wait for initAuthListener to resolve
    if (!user && route !== "auth") {
      useRouter.getState().navigate("auth");
    }
    if (user && route === "auth") {
      useRouter.getState().navigate("home");
    }
  }, [user, route, isLoading]);

  const page = useMemo(() => {
    // Workout session is a full-screen overlay (no layout chrome)
    if (route === "workout") {
      return <WorkoutSessionPage />;
    }

    let content: React.ReactNode = null;
    switch (route) {
      case "home":
        content = <HomePage />;
        break;
      case "exercises":
        content = <ExercisesPage />;
        break;
      case "exercise-detail":
        content = <ExerciseDetailPage />;
        break;
      case "stats":
        content = <StatsPage />;
        break;
      case "body":
        content = <BodyPage />;
        break;
      case "profile":
        content = <ProfilePage />;
        break;
      case "settings":
        content = <SettingsPage />;
        break;
      case "auth":
        content = <AuthPage />;
        break;
      case "nutrition":
        content = <NutritionPage />;
        break;
      case "feed":
        content = <FeedPage />;
        break;
      case "builder":
        content = <BuilderPage />;
        break;
      case "wizard":
        content = <WizardPage />;
        break;
      case "generator-result":
        content = <WorkoutResultView />;
        break;
      case "challenges":
        content = <ChallengesPage />;
        break;
      case "challenge-detail":
        content = <ChallengeDetailPage />;
        break;
      case "calendar":
        content = <CalendarPage />;
        break;
      case "goals":
        content = <GoalsPage />;
        break;
      default:
        content = <HomePage />;
    }

    // Auth page is also full-screen (no layout chrome)
    if (route === "auth") {
      return <div className="min-h-[100dvh]">{content}</div>;
    }

    return <Layout>{content}</Layout>;
  }, [route, params]);

  return page;
}

export default function Home() {
  // Init auth listener synchronously on mount — the dynamic import delayed
  // initialization by a microtask, worsening the auth-redirect race. Calling
  // directly ensures the listener runs before the redirect effect checks.
  useEffect(() => {
    initAuthListener();
  }, []);

  useEffect(() => {
    applyTheme(useSettingsStore.getState().theme);
    // initThemeListener returns a cleanup function — capture and return it
    // to avoid leaking matchMedia listeners across HMR / remounts.
    const unsubThemeListener = initThemeListener();
    const unsubStore = useSettingsStore.subscribe((state) => applyTheme(state.theme));
    return () => {
      unsubStore();
      if (typeof unsubThemeListener === "function") unsubThemeListener();
    };
  }, []);

  // Language is fixed to English (LTR) — no RTL / languageChanged handling needed.

  return (
    <ErrorBoundary>
      <I18nextProvider i18n={i18n}>
        <AppEntry />
      </I18nextProvider>
    </ErrorBoundary>
  );
}
