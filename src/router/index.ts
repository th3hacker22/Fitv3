"use client";
import { create } from "zustand";

/**
 * Lightweight client-side router. The whole app lives on the "/" Next.js route,
 * but internally we navigate between "pages" using this store. This mirrors the
 * original TanStack Router routes while respecting the single-route constraint.
 */

export type RouteName =
  | "home"
  | "exercises"
  | "exercise-detail"
  | "workout"
  | "stats"
  | "body"
  | "profile"
  | "settings"
  | "auth"
  | "nutrition"
  | "feed"
  | "builder"
  | "wizard"
  | "generator-result"
  | "challenges"
  | "challenge-detail"
  | "calendar"
  | "goals";

interface RouterState {
  route: RouteName;
  params: Record<string, string>;
  history: { route: RouteName; params: Record<string, string> }[];
  navigate: (route: RouteName, params?: Record<string, string>) => void;
  back: () => void;
  canGoBack: () => boolean;
}

export const useRouter = create<RouterState>((set, get) => ({
  route: "home",
  params: {},
  history: [],
  navigate: (route, params = {}) => {
    const current = get();
    set({
      route,
      params,
      // Cap history at 50 entries to bound memory and prevent unbounded
      // re-renders from subscribers selecting the history array.
      history: [...current.history, { route: current.route, params: current.params }].slice(-50),
    });
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0 });
    }
  },
  back: () => {
    const { history } = get();
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    set({
      route: prev.route,
      params: prev.params,
      history: history.slice(0, -1),
    });
  },
  canGoBack: () => get().history.length > 0,
}));

