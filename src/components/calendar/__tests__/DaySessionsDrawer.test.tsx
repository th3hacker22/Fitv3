// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";

// ── Mock framer-motion ──
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, className, ...props }: any) => (
      <div className={className} {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useReducedMotion: () => false,
}));

// ── Mock vaul-backed Drawer ──
// vaul relies on real DOM measurement + pointer events that jsdom doesn't
// implement. We replace the Drawer primitives with thin divs that render
// their children only when `open` is true — preserving the prop-driven
// visibility contract that DaySessionsDrawer actually depends on.
vi.mock("@/components/ui/drawer", () => ({
  Drawer: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="drawer-root">{children}</div> : null,
  DrawerContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="drawer-content">{children}</div>
  ),
  DrawerHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="drawer-header">{children}</div>
  ),
  DrawerTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="drawer-title">{children}</h2>
  ),
  DrawerDescription: ({ children }: { children: React.ReactNode }) => (
    <p data-testid="drawer-description">{children}</p>
  ),
}));

import DaySessionsDrawer from "../DaySessionsDrawer";
import type { WorkoutSession } from "@/db/schema";

// ── Fixtures ──
function makeSession(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: "session-1",
    name: "Push Day",
    date: "2026-01-15T10:30:00.000Z",
    duration: 3600, // 1 hour
    exercises: [
      {
        exerciseId: "ex-1",
        exerciseName: "Bench Press",
        sets: [
          { weight: 100, reps: 8, completed: true },
          { weight: 100, reps: 8, completed: true },
        ],
      },
      {
        exerciseId: "ex-2",
        exerciseName: "Overhead Press",
        sets: [
          { weight: 60, reps: 10, completed: true },
        ],
      },
    ],
    completed: true,
    createdAt: "2026-01-15T10:30:00.000Z",
    updatedAt: "2026-01-15T11:30:00.000Z",
    ...overrides,
  };
}

function renderDrawer(overrides: {
  dateKey?: string | null;
  sessions?: WorkoutSession[];
  isLoading?: boolean;
  onOpenChange?: (open: boolean) => void;
} = {}) {
  // Use explicit `undefined` check (not `??`) so callers can pass `null`
  // to test the closed state — `null ?? "2026-01-15"` would fall back to
  // the default string and accidentally render the drawer as open.
  const dateKey = overrides.dateKey !== undefined ? overrides.dateKey : "2026-01-15";
  const sessions = overrides.sessions ?? [];
  const isLoading = overrides.isLoading ?? false;
  const onOpenChange = overrides.onOpenChange ?? vi.fn();
  return render(
    <DaySessionsDrawer
      dateKey={dateKey}
      sessions={sessions}
      isLoading={isLoading}
      onOpenChange={onOpenChange}
    />
  );
}

describe("DaySessionsDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when dateKey is null (closed)", () => {
    renderDrawer({ dateKey: null });
    expect(screen.queryByTestId("drawer-root")).toBeNull();
  });

  it("shows the formatted weekday + month + day + year in the header when open", () => {
    renderDrawer({ dateKey: "2026-01-15" });
    const title = screen.getByTestId("drawer-title");
    // "2026-01-15" → January 15, 2026 — weekday depends on locale but the
    // day/month/year must appear in the formatted string.
    expect(title.textContent).toContain("January");
    expect(title.textContent).toContain("15");
    expect(title.textContent).toContain("2026");
  });

  it("shows three loading skeletons when isLoading=true and the drawer is open", () => {
    renderDrawer({ dateKey: "2026-01-15", isLoading: true, sessions: [] });
    // The Skeleton component is rendered with className "h-20 w-full rounded-xl".
    // We grab every element with that class signature.
    const skeletons = document.querySelectorAll(".h-20.w-full.rounded-xl");
    expect(skeletons.length).toBe(3);
  });

  it("shows the 'No sessions found' empty state when sessions=[] and !isLoading", () => {
    renderDrawer({ dateKey: "2026-01-15", isLoading: false, sessions: [] });
    expect(screen.getByText("No sessions found")).toBeTruthy();
    expect(
      screen.getByText(/haven't logged a workout for this day/i)
    ).toBeTruthy();
  });

  it("renders a session card for each session when sessions are provided", () => {
    const sessions = [
      makeSession({ id: "s1", name: "Push Day" }),
      makeSession({ id: "s2", name: "Pull Day", date: "2026-01-15T16:00:00.000Z" }),
    ];
    renderDrawer({ dateKey: "2026-01-15", sessions });
    expect(screen.getByText("Push Day")).toBeTruthy();
    expect(screen.getByText("Pull Day")).toBeTruthy();
  });

  it("renders the summary stats (exercises, duration, volume) when sessions exist and !isLoading", () => {
    const session = makeSession();
    renderDrawer({ dateKey: "2026-01-15", sessions: [session] });
    // The stats grid renders three labeled sections — Exercises, Duration,
    // Volume — each with a tiny uppercase label.
    expect(screen.getByText("Exercises")).toBeTruthy();
    expect(screen.getByText("Duration")).toBeTruthy();
    expect(screen.getByText("Volume")).toBeTruthy();
    // 2 exercises with at least one completed set → "2".
    expect(screen.getByText("2")).toBeTruthy();
    // Duration 3600s = "60m".
    expect(screen.getByText("60m")).toBeTruthy();
  });

  it("does NOT render the summary stats while loading", () => {
    renderDrawer({
      dateKey: "2026-01-15",
      isLoading: true,
      sessions: [makeSession()],
    });
    expect(screen.queryByText("Exercises")).toBeNull();
    expect(screen.queryByText("Duration")).toBeNull();
    expect(screen.queryByText("Volume")).toBeNull();
  });

  it("renders the time-of-day for each session", () => {
    // The session date is rendered with formatTime → uses toLocaleTimeString.
    // We just assert that some formatted time string appears next to the name.
    renderDrawer({
      dateKey: "2026-01-15",
      sessions: [makeSession({ date: "2026-01-15T10:30:00.000Z" })],
    });
    // The formatted time string contains a digit (hour) and a colon (minutes).
    // Use a regex that matches "10:30" or "10:30 AM" etc — the actual format
    // depends on the locale, but it will always contain "10:30" in jsdom's
    // default en-US locale.
    const timeEl = screen.getByText(/\d{1,2}:\d{2}/);
    expect(timeEl).toBeTruthy();
  });

  it("renders the volume badge per session", () => {
    // Bench: 100×8 + 100×8 = 1600; OHP: 60×10 = 600; total = 2200.
    // The session-volume badge uses formatVolume(2200) → "2.2k kg-reps".
    // The same string also appears in the day summary stats (one session →
    // day total === session total), so we assert at least one match.
    renderDrawer({
      dateKey: "2026-01-15",
      sessions: [makeSession()],
    });
    const badges = screen.getAllByText(/2\.2k kg-reps/i);
    expect(badges.length).toBeGreaterThanOrEqual(1);
    // The per-session badge is the small pill (text-[10px]) — verify it
    // carries the primary accent class.
    const sessionBadge = badges.find((el) =>
      el.className.includes("bg-primary/15")
    );
    expect(sessionBadge).toBeTruthy();
  });
});
