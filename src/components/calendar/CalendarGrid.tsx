"use client";
import { useMemo, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/utils/cn";
import type { DayActivitySummary } from "@/db/analytics";

/**
 * CalendarGrid.
 *
 * A 7-column monthly calendar that shades active days and emits a click
 * when the user taps a day with activity.
 *
 * Features:
 *  - 7-column grid (Sun-Sat) with leading/trailing empty cells for alignment.
 *  - Active days: colored by intensity (volume quartiles) + session count badge.
 *  - Today: distinct border.
 *  - Prev/next month navigation.
 *  - DST-safe: uses local-timezone date keys (YYYY-MM-DD), consistent with
 *    getWorkoutStreak / getSessionsByMonth.
 *
 * Pure presentational component — the data fetch + prefetch lives in
 * CalendarPage so this component stays focused on rendering.
 */

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"] as const;
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

export interface CalendarGridProps {
  /** Year (e.g. 2026). */
  year: number;
  /** Month 0-11. */
  month: number;
  /** Per-day activity map (keyed by YYYY-MM-DD local date). */
  activity: Map<string, DayActivitySummary>;
  /** Called when the user taps an active day. */
  onDayClick: (dateKey: string) => void;
  /** Navigate to the previous month. */
  onPrevMonth: () => void;
  /** Navigate to the next month. */
  onNextMonth: () => void;
  /** Whether the next-month data is being prefetched (shows subtle indicator). */
  isPrefetching?: boolean;
}

/**
 * Build the list of day cells for a month grid.
 *
 * Returns up to 42 cells (6 weeks × 7 days) to keep the grid height stable
 * across months. Each cell is either:
 *   - { type: "leading" | "trailing", day: number } — empty filler from the
 *     prev/next month, rendered dimmed and non-interactive.
 *   - { type: "day", day: number, dateKey: string } — a real day cell.
 *
 * Pure function — exported for unit testing.
 */
export function buildMonthGrid(
  year: number,
  month: number
): Array<
  | { type: "leading" | "trailing"; day: number }
  | { type: "day"; day: number; dateKey: string }
> {
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastOfMonth.getDate();
  // Day of week for the 1st (0=Sun). We render Sun-Sat, so leading cells =
  // firstOfMonth.getDay().
  const leadingCount = firstOfMonth.getDay();

  const cells: Array<
    | { type: "leading" | "trailing"; day: number }
    | { type: "day"; day: number; dateKey: string }
  > = [];

  // Leading cells (from previous month) — use the prev month's last days.
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = leadingCount - 1; i >= 0; i--) {
    cells.push({ type: "leading", day: prevMonthLastDay - i });
  }

  // Real days of the current month.
  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = formatDateKey(year, month, d);
    cells.push({ type: "day", day: d, dateKey });
  }

  // Trailing cells to fill the last week (up to 42 cells total for a stable 6-row grid).
  let trailingDay = 1;
  while (cells.length < 42) {
    cells.push({ type: "trailing", day: trailingDay++ });
  }

  return cells;
}

/** Format a local date as YYYY-MM-DD (zero-padded). Pure helper. */
export function formatDateKey(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

/** Today's local date key (YYYY-MM-DD). */
function todayKey(): string {
  const now = new Date();
  return formatDateKey(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Map a volume value to an intensity bucket (0-3) for color shading.
 * Pure function — exported for testing.
 *   0 → no activity
 *   1 → light (< 1500 kg-reps)
 *   2 → moderate (1500-4000)
 *   3 → heavy (> 4000)
 */
export function volumeToIntensity(volume: number): 0 | 1 | 2 | 3 {
  if (volume <= 0) return 0;
  if (volume < 1500) return 1;
  if (volume < 4000) return 2;
  return 3;
}

const INTENSITY_CLASSES: Record<0 | 1 | 2 | 3, string> = {
  0: "bg-bg-elevated text-text-muted",
  1: "bg-primary/15 text-primary",
  2: "bg-primary/35 text-primary-text",
  3: "bg-primary/60 text-primary-text",
};

export default function CalendarGrid({
  year,
  month,
  activity,
  onDayClick,
  onPrevMonth,
  onNextMonth,
  isPrefetching,
}: CalendarGridProps) {
  const cells = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const today = useMemo(() => todayKey(), []);

  const handleClick = useCallback(
    (dateKey: string, isActive: boolean) => {
      if (isActive) onDayClick(dateKey);
    },
    [onDayClick]
  );

  return (
    <div className="rounded-[--radius-card] glass-card p-4">
      {/* Header: month name + prev/next */}
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onPrevMonth}
          aria-label="Previous month"
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-bg-elevated text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary active:scale-95"
        >
          <ChevronLeft className="h-5 w-5 rtl:rotate-180" aria-hidden="true" />
        </button>

        <div className="flex flex-col items-center">
          <h2 className="text-base font-black uppercase tracking-wider text-text-primary">
            {MONTH_NAMES[month]} {year}
          </h2>
          {isPrefetching && (
            <span className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-text-muted animate-pulse">
              prefetching…
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onNextMonth}
          aria-label="Next month"
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-bg-elevated text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary active:scale-95"
        >
          <ChevronRight className="h-5 w-5 rtl:rotate-180" aria-hidden="true" />
        </button>
      </div>

      {/* Weekday labels */}
      <div className="mb-2 grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label, i) => (
          <div
            key={i}
            className="text-center text-[10px] font-black uppercase tracking-widest text-text-muted"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, idx) => {
          if (cell.type !== "day") {
            return (
              <div
                key={idx}
                className="flex aspect-square items-center justify-center text-xs text-text-muted/30"
                aria-hidden="true"
              >
                {cell.day}
              </div>
            );
          }

          const summary = activity.get(cell.dateKey);
          const isActive = Boolean(summary?.isActive);
          const intensity = volumeToIntensity(summary?.volume ?? 0);
          const isToday = cell.dateKey === today;

          return (
            <button
              key={cell.dateKey}
              type="button"
              onClick={() => handleClick(cell.dateKey, isActive)}
              disabled={!isActive}
              aria-label={
                isActive
                  ? `${cell.dateKey}: ${summary!.sessionCount} workout${summary!.sessionCount > 1 ? "s" : ""}, ${Math.round(summary!.volume)} kg-reps`
                  : cell.dateKey
              }
              aria-disabled={!isActive}
              className={cn(
                // min-h-[2.75rem] ensures the day cell meets the 44px WCAG
                // touch-target even when aspect-square would otherwise make
                // it smaller on narrow screens. active:scale-90 replaces the
                // former framer-motion whileTap (respects prefers-reduced-motion
                // automatically via the CSS engine's transform handling, and
                // avoids extra JS work on each tap).
                "relative flex min-h-[2.75rem] aspect-square flex-col items-center justify-center rounded-lg text-xs font-bold transition-all active:scale-90",
                INTENSITY_CLASSES[intensity],
                isActive ? "cursor-pointer hover:ring-2 hover:ring-primary/40" : "cursor-default",
                isToday && "ring-2 ring-primary"
              )}
            >
              <span className={cn("leading-none", intensity >= 2 && "drop-shadow-sm")}>
                {cell.day}
              </span>
              {isActive && summary!.sessionCount > 1 && (
                <span className="absolute top-0.5 end-0.5 flex h-3 min-w-[1.25rem] items-center justify-center rounded-full bg-bg/80 px-1 text-[8px] font-black text-text-primary">
                  {summary!.sessionCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
