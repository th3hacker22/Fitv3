import { describe, it, expect } from "vitest";
import {
  buildMonthGrid,
  formatDateKey,
  volumeToIntensity,
} from "../CalendarGrid";

// ── formatDateKey ───────────────────────────────────────────────────────────

describe("formatDateKey", () => {
  it("formats a date as YYYY-MM-DD with zero-padding", () => {
    expect(formatDateKey(2026, 0, 1)).toBe("2026-01-01"); // Jan 1
    expect(formatDateKey(2026, 11, 31)).toBe("2026-12-31"); // Dec 31
    expect(formatDateKey(2026, 5, 9)).toBe("2026-06-09"); // Jun 9
  });

  it("handles month wrapping (month is 0-indexed)", () => {
    expect(formatDateKey(2026, 0, 15)).toBe("2026-01-15");
    expect(formatDateKey(2026, 11, 15)).toBe("2026-12-15");
  });

  it("zero-pads single-digit days and months", () => {
    expect(formatDateKey(2026, 2, 3)).toBe("2026-03-03");
    expect(formatDateKey(2026, 8, 1)).toBe("2026-09-01");
  });
});

// ── volumeToIntensity ───────────────────────────────────────────────────────

describe("volumeToIntensity", () => {
  it("returns 0 for zero/negative volume", () => {
    expect(volumeToIntensity(0)).toBe(0);
    expect(volumeToIntensity(-100)).toBe(0);
  });

  it("returns 1 for light volume (< 1500)", () => {
    expect(volumeToIntensity(1)).toBe(1);
    expect(volumeToIntensity(1499)).toBe(1);
  });

  it("returns 2 for moderate volume (1500-3999)", () => {
    expect(volumeToIntensity(1500)).toBe(2);
    expect(volumeToIntensity(3999)).toBe(2);
  });

  it("returns 3 for heavy volume (≥ 4000)", () => {
    expect(volumeToIntensity(4000)).toBe(3);
    expect(volumeToIntensity(10000)).toBe(3);
  });

  it("respects the boundary exactly at 1500 (moderate start)", () => {
    expect(volumeToIntensity(1499)).toBe(1);
    expect(volumeToIntensity(1500)).toBe(2);
  });

  it("respects the boundary exactly at 4000 (heavy start)", () => {
    expect(volumeToIntensity(3999)).toBe(2);
    expect(volumeToIntensity(4000)).toBe(3);
  });
});

// ── buildMonthGrid ──────────────────────────────────────────────────────────

describe("buildMonthGrid", () => {
  it("returns exactly 42 cells (6 weeks × 7 days) for a stable grid height", () => {
    const cells = buildMonthGrid(2026, 0); // Jan 2026
    expect(cells).toHaveLength(42);
  });

  it("always returns 42 cells regardless of month", () => {
    // Test every month of 2026.
    for (let m = 0; m < 12; m++) {
      expect(buildMonthGrid(2026, m)).toHaveLength(42);
    }
  });

  it("places the 1st of the month on the correct weekday (Jan 2026 = Thursday)", () => {
    // Jan 1, 2026 is a Thursday (day index 4 in Sun-Sat).
    const cells = buildMonthGrid(2026, 0);
    // The first "day" cell should be at index 4 (after 4 leading cells).
    const firstDayCell = cells.find((c) => c.type === "day" && c.day === 1);
    expect(firstDayCell).toBeDefined();
    const firstDayIndex = cells.indexOf(firstDayCell!);
    expect(firstDayIndex).toBe(4); // Sun=0, Mon=1, Tue=2, Wed=3, Thu=4
  });

  it("includes all days of the month", () => {
    const cells = buildMonthGrid(2026, 0); // Jan = 31 days
    const dayCells = cells.filter((c) => c.type === "day");
    expect(dayCells).toHaveLength(31);
    // Day numbers 1-31
    const dayNumbers = dayCells.map((c) => (c as { day: number }).day);
    expect(dayNumbers).toEqual(Array.from({ length: 31 }, (_, i) => i + 1));
  });

  it("handles February in a non-leap year (28 days)", () => {
    const cells = buildMonthGrid(2025, 1); // Feb 2025 (not a leap year)
    const dayCells = cells.filter((c) => c.type === "day");
    expect(dayCells).toHaveLength(28);
  });

  it("handles February in a leap year (29 days)", () => {
    const cells = buildMonthGrid(2024, 1); // Feb 2024 (leap year)
    const dayCells = cells.filter((c) => c.type === "day");
    expect(dayCells).toHaveLength(29);
  });

  it("generates correct dateKey for each day cell", () => {
    const cells = buildMonthGrid(2026, 5); // June 2026
    const firstDay = cells.find((c) => c.type === "day" && c.day === 1) as {
      type: "day";
      day: number;
      dateKey: string;
    };
    expect(firstDay.dateKey).toBe("2026-06-01");

    const lastDay = cells.find((c) => c.type === "day" && c.day === 30) as {
      type: "day";
      day: number;
      dateKey: string;
    };
    expect(lastDay.dateKey).toBe("2026-06-30");
  });

  it("marks leading cells as 'leading' type", () => {
    // Jan 2026 starts on Thursday → 4 leading cells (Sun, Mon, Tue, Wed).
    const cells = buildMonthGrid(2026, 0);
    const leading = cells.filter((c) => c.type === "leading");
    expect(leading).toHaveLength(4);
  });

  it("marks trailing cells as 'trailing' type", () => {
    const cells = buildMonthGrid(2026, 0); // Jan 2026
    const dayCells = cells.filter((c) => c.type === "day");
    const leading = cells.filter((c) => c.type === "leading");
    const trailing = cells.filter((c) => c.type === "trailing");
    // 42 total = 4 leading + 31 days + 7 trailing
    expect(leading.length + dayCells.length + trailing.length).toBe(42);
    expect(trailing.length).toBeGreaterThan(0);
  });

  it("leading cell day numbers come from the previous month", () => {
    // Jan 2026 starts Thu → leading cells are Dec 28 (Sun), 29, 30, 31.
    const cells = buildMonthGrid(2026, 0);
    const leading = cells.filter((c) => c.type === "leading");
    const leadingDays = leading.map((c) => (c as { day: number }).day);
    expect(leadingDays).toEqual([28, 29, 30, 31]);
  });

  it("trailing cell day numbers start from 1", () => {
    const cells = buildMonthGrid(2026, 0);
    const trailing = cells.filter((c) => c.type === "trailing");
    const trailingDays = trailing.map((c) => (c as { day: number }).day);
    expect(trailingDays[0]).toBe(1);
    // Consecutive
    for (let i = 1; i < trailingDays.length; i++) {
      expect(trailingDays[i]).toBe(trailingDays[i - 1] + 1);
    }
  });

  it("handles month rollover (Dec 2026 → Jan 2027)", () => {
    const cells = buildMonthGrid(2026, 11); // Dec 2026
    const dayCells = cells.filter((c) => c.type === "day");
    expect(dayCells).toHaveLength(31);
    const lastDay = dayCells[dayCells.length - 1] as {
      type: "day";
      day: number;
      dateKey: string;
    };
    expect(lastDay.day).toBe(31);
    expect(lastDay.dateKey).toBe("2026-12-31");
  });
});
