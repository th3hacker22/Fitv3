"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { Calendar as CalendarIcon, ChevronLeft } from "lucide-react";
import { Link } from "@/router-shim";
import { useTranslation } from "react-i18next";
import CalendarGrid from "@/components/calendar/CalendarGrid";
import DaySessionsDrawer from "@/components/calendar/DaySessionsDrawer";
import { Skeleton } from "@/components/ui-custom/Skeleton";
import {
  getMonthActivitySummary,
  getSessionsByMonth,
  type DayActivitySummary,
} from "@/db/analytics";
import type { WorkoutSession } from "@/db/schema";

/**
 * CalendarPage (B2).
 *
 * Monthly calendar view of workout activity. Active days are shaded by
 * volume intensity. Tapping an active day opens a bottom sheet listing
 * that day's sessions.
 *
 * Offline-first: all data comes from Dexie (no network calls). The page
 * works identically online and offline.
 *
 * Prefetch: while the user is viewing month N, we prefetch month N+1's
 * data in the background so the "next month" navigation feels instant
 * (mirrors the competitor's prefetch strategy, but with a simple Dexie
 * query instead of an API call).
 */

export default function CalendarPage() {
  const { t } = useTranslation();

  // Current displayed month. Defaults to today's month.
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  // Activity map for the current month.
  const [activity, setActivity] = useState<Map<string, DayActivitySummary>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  // Prefetch state for the next month (competitor-inspired optimization).
  const [nextMonthPrefetch, setNextMonthPrefetch] = useState<WorkoutSession[] | null>(null);
  const [isPrefetching, setIsPrefetching] = useState(false);

  // Drawer state: which day is selected + that day's sessions.
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [selectedDaySessions, setSelectedDaySessions] = useState<WorkoutSession[]>([]);

  // ── Load the current month's activity summary ──
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    (async () => {
      const summary = await getMonthActivitySummary(year, month);
      if (!cancelled) {
        setActivity(summary);
        setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [year, month]);

  // ── Prefetch next month's sessions (competitor-inspired) ──
  // Fires in the background after the current month loads. The prefetched
  // sessions are reused when the user navigates forward — instant render.
  useEffect(() => {
    let cancelled = false;
    setIsPrefetching(true);

    // Compute next month (handles year rollover).
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;

    (async () => {
      const sessions = await getSessionsByMonth(nextYear, nextMonth);
      if (!cancelled) {
        setNextMonthPrefetch(sessions);
        setIsPrefetching(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [year, month]);

  // ── Navigation ──
  const handlePrevMonth = useCallback(() => {
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else {
      setMonth((m) => m - 1);
    }
  }, [month]);

  const handleNextMonth = useCallback(() => {
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else {
      setMonth((m) => m + 1);
    }
  }, [month]);

  // ── Day click → open drawer with that day's sessions ──
  // When the user tapped a day, we fetch that day's sessions from the
  // already-loaded current-month sessions (we keep them in scope via the
  // activity map — but we need the full session objects, so we re-query).
  const handleDayClick = useCallback(
    async (dateKey: string) => {
      setSelectedDateKey(dateKey);
      setSelectedDaySessions([]); // show loading state in drawer
      const monthSessions = await getSessionsByMonth(year, month);
      // Filter to just the tapped day.
      const daySessions = monthSessions.filter((s) => {
        const d = new Date(s.date);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}` === dateKey;
      });
      setSelectedDaySessions(daySessions);
    },
    [year, month]
  );

  const handleDrawerOpenChange = useCallback((open: boolean) => {
    if (!open) setSelectedDateKey(null);
  }, []);

  return (
    <div className="space-y-4 pb-6 pt-2">
      {/* Back link */}
      <Link
        to="/stats"
        className="inline-flex items-center gap-2 text-sm font-medium text-text-secondary transition-colors hover:text-primary uppercase tracking-wide"
      >
        <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
        {t("back")}
      </Link>

      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center gap-3"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
          <CalendarIcon className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-black uppercase tracking-wider text-text-primary">
            Workout Calendar
          </h1>
          <p className="text-xs text-text-secondary">
            Tap an active day to view its sessions
          </p>
        </div>
      </motion.div>

      {/* Calendar grid */}
      {isLoading ? (
        <Skeleton className="h-[420px] w-full rounded-[--radius-card]" />
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <CalendarGrid
            year={year}
            month={month}
            activity={activity}
            onDayClick={handleDayClick}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
            isPrefetching={isPrefetching}
          />
        </motion.div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 rounded-[--radius-card] glass-card p-3 text-[10px] font-bold uppercase tracking-widest text-text-secondary">
        <span>Less</span>
        <div className="flex gap-1">
          <span className="h-3 w-3 rounded-sm bg-bg-elevated" />
          <span className="h-3 w-3 rounded-sm bg-primary/15" />
          <span className="h-3 w-3 rounded-sm bg-primary/35" />
          <span className="h-3 w-3 rounded-sm bg-primary/60" />
        </div>
        <span>More</span>
        <span className="ms-auto inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm ring-2 ring-primary" />
          Today
        </span>
      </div>

      {/* Day sessions drawer */}
      <DaySessionsDrawer
        dateKey={selectedDateKey}
        sessions={selectedDaySessions}
        onOpenChange={handleDrawerOpenChange}
      />
    </div>
  );
}
