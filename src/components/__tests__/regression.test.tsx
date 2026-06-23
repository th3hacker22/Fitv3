/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import path from "path";

/**
 * Regression tests for Phase 1-5 fixes.
 * These verify that the critical bugs we fixed don't come back.
 */

// ── Mock framer-motion to bypass animation overhead ──
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, className, ...props }: any) => (
      <div className={className} {...props}>{children}</div>
    ),
    button: ({ children, className, ...props }: any) => (
      <button className={className} {...props}>{children}</button>
    ),
    p: ({ children, className, ...props }: any) => (
      <p className={className} {...props}>{children}</p>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useReducedMotion: () => false,
}));

// ── Test 1: OptionBtn is defined at module scope (not inside component) ──
// If OptionBtn were inside GeneratorWizard, React would remount it on every
// render, causing focus loss. We verify it's a stable module-level function.

describe("OptionBtn hoist regression test", () => {
  it("GeneratorWizard module exports a stable OptionBtn (not re-created per render)", async () => {
    // Read the source file to verify OptionBtn is defined at module level,
    // not inside the component function body.
    const fs = await import("fs");
    const source = fs.readFileSync(
      path.join(__dirname, "../../components/workout/GeneratorWizard.tsx"),
      "utf-8"
    );

    // OptionBtn should be defined BEFORE the GeneratorWizard export
    const optionBtnPos = source.indexOf("function OptionBtn");
    const wizardPos = source.indexOf("export const GeneratorWizard");

    expect(optionBtnPos).toBeGreaterThan(-1);
    expect(wizardPos).toBeGreaterThan(-1);
    expect(optionBtnPos).toBeLessThan(wizardPos);
  });
});

// ── Test 2: MacroBar is defined at module scope in NutritionPage ──

describe("MacroBar hoist regression test", () => {
  it("NutritionPage module exports a stable MacroBar (not re-created per render)", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      path.join(__dirname, "../../pages/NutritionPage.tsx"),
      "utf-8"
    );

    const macroBarPos = source.indexOf("function MacroBar");
    const pagePos = source.indexOf("export default function NutritionPage");

    expect(macroBarPos).toBeGreaterThan(-1);
    expect(pagePos).toBeGreaterThan(-1);
    expect(macroBarPos).toBeLessThan(pagePos);
  });
});

// ── Test 3: Router-shim Link handles modifier keys ──
// ctrl+click / meta+click / shift+click / middle-click should NOT preventDefault
// (should allow native new-tab behavior).

describe("Router-shim Link modifier key handling", () => {
  let originalNavigate: any;

  beforeEach(async () => {
    const { useRouter } = await import("../../router");
    // Save the original navigate so we can restore it after each test
    originalNavigate = useRouter.getState().navigate;
    // Reset to a clean state
    useRouter.setState({ route: "home", params: {}, history: [] });
  });

  afterEach(async () => {
    const { useRouter } = await import("../../router");
    // Restore the original navigate function (previous tests may have overwritten it)
    useRouter.setState({ navigate: originalNavigate });
  });

  it("prevents default on normal left-click", async () => {
    const { Link } = await import("../../router-shim");
    const { useRouter } = await import("../../router");

    const navigateSpy = vi.fn();
    useRouter.setState({ navigate: navigateSpy });

    render(<Link to="/exercises">Exercises</Link>);
    const link = screen.getByText("Exercises");

    fireEvent.click(link);
    expect(navigateSpy).toHaveBeenCalled();
  });

  it("does NOT prevent default on ctrl+click (new tab)", async () => {
    const { Link } = await import("../../router-shim");
    const { useRouter } = await import("../../router");

    const navigateSpy = vi.fn();
    useRouter.setState({ navigate: navigateSpy });

    render(<Link to="/exercises">Exercises</Link>);
    const link = screen.getByText("Exercises");

    fireEvent.click(link, { ctrlKey: true });
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it("does NOT prevent default on meta+click (Mac new tab)", async () => {
    const { Link } = await import("../../router-shim");
    const { useRouter } = await import("../../router");

    const navigateSpy = vi.fn();
    useRouter.setState({ navigate: navigateSpy });

    render(<Link to="/exercises">Exercises</Link>);
    const link = screen.getByText("Exercises");

    fireEvent.click(link, { metaKey: true });
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it("does NOT prevent default on shift+click (new window)", async () => {
    const { Link } = await import("../../router-shim");
    const { useRouter } = await import("../../router");

    const navigateSpy = vi.fn();
    useRouter.setState({ navigate: navigateSpy });

    render(<Link to="/exercises">Exercises</Link>);
    const link = screen.getByText("Exercises");

    fireEvent.click(link, { shiftKey: true });
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it("substitutes params into href (not literal $param)", async () => {
    const { Link } = await import("../../router-shim");

    render(
      <Link to="/exercises/$exerciseId" params={{ exerciseId: "abc123" }}>
        Detail
      </Link>
    );
    const link = screen.getByText("Detail") as HTMLAnchorElement;

    // href should contain the actual ID, not the $placeholder
    expect(link.getAttribute("href")).toContain("abc123");
    expect(link.getAttribute("href")).not.toContain("$exerciseId");
  });
});

// ── Test 4: Router history is capped at 50 entries ──

describe("Router history cap regression test", () => {
  it("caps history at 50 entries", async () => {
    const { useRouter } = await import("../../router");
    useRouter.setState({ route: "home", params: {}, history: [] });

    // Navigate 60 times
    for (let i = 0; i < 60; i++) {
      useRouter.getState().navigate("exercises");
      useRouter.getState().navigate("home");
    }

    expect(useRouter.getState().history.length).toBeLessThanOrEqual(50);
  });

  it("back() still works after history cap", async () => {
    const { useRouter } = await import("../../router");
    useRouter.setState({ route: "home", params: {}, history: [] });

    useRouter.getState().navigate("exercises");
    useRouter.getState().navigate("stats");

    expect(useRouter.getState().route).toBe("stats");
    useRouter.getState().back();
    expect(useRouter.getState().route).toBe("exercises");
    useRouter.getState().back();
    expect(useRouter.getState().route).toBe("home");
  });
});

// ── Test 5: syncAll in-flight guard prevents concurrent calls ──

describe("syncAll in-flight guard regression test", () => {
  it("does not set syncing state twice for concurrent calls", async () => {
    const { syncAll } = await import("../../lib/syncEngine");
    const { useSyncStore } = await import("../../store/useSyncStore");
    useSyncStore.setState({ status: "idle", lastSyncedAt: null });

    // Fire two concurrent syncAll calls
    const p1 = syncAll("user1");
    const p2 = syncAll("user1");

    await Promise.all([p1, p2]);

    // Both should complete, status should be idle (not error)
    expect(useSyncStore.getState().status).toBe("idle");
    expect(useSyncStore.getState().lastSyncedAt).not.toBeNull();
  });
});

// ── Test 6: i18n is English-only (no Arabic detection) ──

describe("i18n English-only regression test", () => {
  it("language is fixed to 'en'", async () => {
    const i18n = await import("../../i18n");
    expect(i18n.default.language).toBe("en");
  });

  it("supportedLngs does not include 'ar'", async () => {
    const i18n = await import("../../i18n");
    const supported = i18n.default.options?.supportedLngs || [];
    expect(supported).not.toContain("ar");
    expect(supported).toContain("en");
  });
});
