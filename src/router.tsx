import {
  createRouter,
  createRoute,
  createRootRoute,
  Outlet,
} from "@tanstack/react-router";
import Layout from "@/components/layout/Layout";

// ── Pages ──
import HomePage from "@/pages/HomePage";
import ExercisesPage from "@/pages/ExercisesPage";
import ExerciseDetailPage from "@/pages/ExerciseDetailPage";
import WorkoutSessionPage from "@/pages/WorkoutSessionPage";
import StatsPage from "@/pages/StatsPage";
import BodyPage from "@/pages/BodyPage";
import ProfilePage from "@/pages/ProfilePage";
import SettingsPage from "@/pages/SettingsPage";
import BuilderPage from "@/pages/BuilderPage";
import WizardPage from "@/pages/WizardPage";
import WorkoutResultView from "@/pages/WorkoutResultView";
import AuthPage from "@/pages/AuthPage";
import NutritionPage from "@/pages/NutritionPage";
import FeedPage from "@/pages/FeedPage";

// ── Root Route ──
const rootRoute = createRootRoute({
  component: () => (
    <Layout>
      <Outlet />
    </Layout>
  ),
});

// ── Routes ──
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});

const builderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/builder",
  component: BuilderPage,
});

const exercisesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/exercises",
  component: ExercisesPage,
});

const exerciseDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/exercises/$exerciseId",
  component: ExerciseDetailPage,
});

const workoutSessionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workout/$sessionId",
  component: WorkoutSessionPage,
});

const statsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/stats",
  component: StatsPage,
});

const bodyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/body",
  component: BodyPage,
});

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/profile",
  component: ProfilePage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
});

const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/auth",
  component: AuthPage,
});

const nutritionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/nutrition",
  component: NutritionPage,
});

const feedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/feed",
  component: FeedPage,
});

const wizardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/wizard",
  component: WizardPage,
});

const resultRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/generator/result",
  component: WorkoutResultView,
});

// ── Route Tree ──
const routeTree = rootRoute.addChildren([
  indexRoute,
  builderRoute,
  exercisesRoute,
  exerciseDetailRoute,
  workoutSessionRoute,
  statsRoute,
  bodyRoute,
  profileRoute,
  settingsRoute,
  authRoute,
  nutritionRoute,
  feedRoute,
  wizardRoute,
  resultRoute,
]);

// ── Router ──
export const router = createRouter({
  routeTree,
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
