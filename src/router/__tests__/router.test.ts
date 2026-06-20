import { describe, it, expect, vi, beforeEach } from "vitest";
import { useRouter, type RouteName } from "../index";

function resetRouter() {
  useRouter.setState({ route: "home", params: {}, history: [] });
}

describe("client router", () => {
  beforeEach(() => {
    resetRouter();
  });

  it("starts at the home route with empty params and history", () => {
    const s = useRouter.getState();
    expect(s.route).toBe("home");
    expect(s.params).toEqual({});
    expect(s.history).toEqual([]);
  });

  it("navigate() updates the current route and params", () => {
    useRouter.getState().navigate("exercises", { foo: "bar" });
    const s = useRouter.getState();
    expect(s.route).toBe("exercises");
    expect(s.params).toEqual({ foo: "bar" });
  });

  it("navigate() pushes the previous state onto the history stack", () => {
    useRouter.getState().navigate("stats");
    useRouter.getState().navigate("profile");
    const s = useRouter.getState();
    expect(s.history).toHaveLength(2);
    expect(s.history[0]).toEqual({ route: "home", params: {} });
    expect(s.history[1]).toEqual({ route: "stats", params: {} });
  });

  it("back() pops the last history entry and restores it", () => {
    useRouter.getState().navigate("feed");
    useRouter.getState().navigate("stats");
    expect(useRouter.getState().route).toBe("stats");

    useRouter.getState().back();
    expect(useRouter.getState().route).toBe("feed");
    expect(useRouter.getState().history).toHaveLength(1);

    useRouter.getState().back();
    expect(useRouter.getState().route).toBe("home");
    expect(useRouter.getState().history).toHaveLength(0);
  });

  it("back() is a no-op when history is empty", () => {
    expect(useRouter.getState().history).toHaveLength(0);
    useRouter.getState().back();
    expect(useRouter.getState().route).toBe("home");
  });

  it("canGoBack() reflects history length", () => {
    expect(useRouter.getState().canGoBack()).toBe(false);
    useRouter.getState().navigate("stats");
    expect(useRouter.getState().canGoBack()).toBe(true);
    useRouter.getState().back();
    expect(useRouter.getState().canGoBack()).toBe(false);
  });

  it("navigate() with no params defaults to empty object", () => {
    useRouter.getState().navigate("nutrition");
    expect(useRouter.getState().params).toEqual({});
  });

  it("handles all valid route names", () => {
    const routes: RouteName[] = [
      "home", "exercises", "exercise-detail", "workout", "stats",
      "body", "profile", "settings", "auth", "nutrition", "feed",
      "builder", "wizard", "generator-result", "challenges", "challenge-detail",
    ];
    for (const r of routes) {
      useRouter.getState().navigate(r);
      expect(useRouter.getState().route).toBe(r);
    }
  });

  it("preserves params through navigate/back cycle", () => {
    useRouter.getState().navigate("exercise-detail", { exerciseId: "abc123" });
    useRouter.getState().navigate("exercises");
    useRouter.getState().back();
    expect(useRouter.getState().route).toBe("exercise-detail");
    expect(useRouter.getState().params).toEqual({ exerciseId: "abc123" });
  });
});
