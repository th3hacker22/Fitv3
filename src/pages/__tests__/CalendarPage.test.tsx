// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// ── Mock framer-motion ──
// KineticEmptyState uses motion.section, motion.button, motion.svg, motion.div,
// etc. Rather than enumerate every tag, we use a Proxy that returns a generic
// passthrough component for any property access — the rendered tag matches the
// requested element type so DOM queries (getByRole, getByText) keep working.
function makeMotionTag(tag: string) {
  return ({ children, className, ...props }: any) =>
    React.createElement(tag, { className, ...props }, children);
}
vi.mock("framer-motion", () => ({
  motion: new Proxy(
    {
      div: makeMotionTag("div"),
      button: makeMotionTag("button"),
      svg: makeMotionTag("svg"),
      section: makeMotionTag("section"),
      path: makeMotionTag("path"),
      circle: makeMotionTag("circle"),
      rect: makeMotionTag("rect"),
      g: makeMotionTag("g"),
    },
    {
      get(target, prop: string) {
        if (prop in target) return (target as Record<string, unknown>)[prop];
        // Unknown motion tag → fall back to a div so the component tree still
        // renders without throwing "Element type is invalid".
        return makeMotionTag("div");
      },
    }
  ),
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useReducedMotion: () => false,
}));

// ── Mock react-i18next ──
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// ── Mock router-shim (avoid the in-memory router + Link) ──
const navigateSpy = vi.fn();
vi.mock("@/router-shim", () => ({
  Link: ({
    to,
    children,
    className,
    onClick,
  }: {
    to: string;
    children: React.ReactNode;
    className?: string;
    onClick?: (e: React.MouseEvent) => void;
  }) => (
    <a
      href={to}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        onClick?.(e);
      }}
    >
      {children}
    </a>
  ),
  useNavigate: () => navigateSpy,
}));

// ── Mock the toast store (CalendarPage calls addToast on errors) ──
const addToastSpy = vi.fn();
vi.mock("@/store/useToastStore", () => ({
  useToastStore: (selector: (s: { addToast: typeof addToastSpy }) => unknown) =>
    selector({ addToast: addToastSpy }),
}));

// ── Mock DaySessionsDrawer to keep the test focused on the page shell ──
vi.mock("@/components/calendar/DaySessionsDrawer", () => ({
  __esModule: true,
  default: (props: { dateKey: string | null }) => (
    <div data-testid="day-sessions-drawer" data-date-key={props.dateKey ?? ""}>
      DaySessionsDrawer
    </div>
  ),
}));

// ── Mock @/db/analytics — controlled promises so we can test the loading
//    state separately from the loaded state. ──
const getMonthActivitySummarySpy = vi.fn();
const getSessionsByMonthSpy = vi.fn();
vi.mock("@/db/analytics", () => ({
  getMonthActivitySummary: (year: number, month: number) =>
    getMonthActivitySummarySpy(year, month),
  getSessionsByMonth: (year: number, month: number) =>
    getSessionsByMonthSpy(year, month),
}));

import CalendarPage from "../CalendarPage";
import type { DayActivitySummary } from "@/db/analytics";

// ── Helpers ──
function makeActivity(entries: Array<Partial<DayActivitySummary> & { dateKey: string }>): Map<string, DayActivitySummary> {
  const map = new Map<string, DayActivitySummary>();
  for (const e of entries) {
    map.set(e.dateKey, {
      dateKey: e.dateKey,
      sessionCount: e.sessionCount ?? 1,
      volume: e.volume ?? 1000,
      duration: e.duration ?? 1800,
      exerciseCount: e.exerciseCount ?? 3,
      isActive: e.isActive ?? true,
    });
  }
  return map;
}

/** Today's local date key — CalendarPage keys empty-state detection off it. */
function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function renderPage() {
  return render(<CalendarPage />);
}

describe("CalendarPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: month activity resolves to an empty Map (no workouts).
    // Tests that need the loaded CalendarGrid override this per-test.
    getMonthActivitySummarySpy.mockResolvedValue(new Map<string, DayActivitySummary>());
    // getSessionsByMonth is called by the prefetch effect AND by
    // handleDayClick. Default to an empty array.
    getSessionsByMonthSpy.mockResolvedValue([]);
  });

  it("renders the 'Workout Calendar' heading", async () => {
    renderPage();
    expect(screen.getByText("Workout Calendar")).toBeTruthy();
  });

  it("shows the loading skeleton immediately on mount (before data resolves)", () => {
    // Use a never-resolving promise so the page stays in the loading state.
    getMonthActivitySummarySpy.mockImplementation(
      () => new Promise<Map<string, DayActivitySummary>>(() => {})
    );
    renderPage();
    // The skeleton is rendered as a div with the skeleton-shimmer class and
    // a tall height. We assert on its presence via the class signature.
    const skeleton = document.querySelector(".skeleton-shimmer.h-\\[420px\\]");
    expect(skeleton).toBeTruthy();
  });

  it("renders the CalendarGrid (with month name) after the activity data loads", async () => {
    // Provide some activity for today so the grid (not the empty state) shows.
    getMonthActivitySummarySpy.mockResolvedValue(
      makeActivity([{ dateKey: todayKey(), volume: 2000 }])
    );
    renderPage();
    // The CalendarGrid header shows the current month name + year. Wait for
    // the loading state to clear.
    const today = new Date();
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    const expectedHeader = `${monthNames[today.getMonth()]} ${today.getFullYear()}`;
    await waitFor(() => {
      expect(screen.getByText(expectedHeader)).toBeTruthy();
    });
  });

  it("renders Previous and Next month navigation buttons after load", async () => {
    getMonthActivitySummarySpy.mockResolvedValue(
      makeActivity([{ dateKey: todayKey(), volume: 2000 }])
    );
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Previous month/i })).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: /Next month/i })).toBeTruthy();
  });

  it("navigates to the previous month when the Previous button is clicked", async () => {
    getMonthActivitySummarySpy.mockResolvedValue(
      makeActivity([{ dateKey: todayKey(), volume: 2000 }])
    );
    renderPage();
    const prevBtn = await screen.findByRole("button", { name: /Previous month/i });
    fireEvent.click(prevBtn);
    // After clicking prev, getMonthActivitySummary should be called again
    // with the previous month's year/month. We just verify the spy was
    // called more than once (initial load + navigation).
    await waitFor(() => {
      expect(getMonthActivitySummarySpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("renders the legend with 'Less' / 'More' / 'Today' labels", async () => {
    renderPage();
    // The legend renders immediately (outside the loading branch).
    expect(screen.getByText("Less")).toBeTruthy();
    expect(screen.getByText("More")).toBeTruthy();
    expect(screen.getByText("Today")).toBeTruthy();
  });

  it("renders the empty state when the current month has no activity", async () => {
    // Default mock returns an empty Map — combine with the page's
    // isCurrentMonth check to trigger the KineticEmptyState.
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("No workouts this month")).toBeTruthy();
    });
    expect(
      screen.getByText(/Start your first one and build the habit/i)
    ).toBeTruthy();
    // The empty-state CTA is rendered as a button.
    expect(screen.getByRole("button", { name: /Start Workout/i })).toBeTruthy();
  });

  it("renders the back link to /stats", async () => {
    renderPage();
    // react-i18next mock returns the key verbatim, so the link text is "back".
    const backLink = screen.getByText("back");
    expect(backLink).toBeTruthy();
    expect(backLink.closest("a")?.getAttribute("href")).toBe("/stats");
  });

  it("renders the DaySessionsDrawer (closed, no dateKey) on initial mount", async () => {
    renderPage();
    const drawer = screen.getByTestId("day-sessions-drawer");
    expect(drawer).toBeTruthy();
    expect(drawer.getAttribute("data-date-key")).toBe("");
  });
});
