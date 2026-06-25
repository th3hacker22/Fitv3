/**
 * Set Type Configuration — single source of truth for all set variants.
 *
 * Extracted from SetRow.tsx into a standalone config so the type metadata
 * (labels, colors, volume/PR eligibility) is:
 *   1. Testable in isolation (pure data, no React).
 *   2. Reusable by analytics.ts (volume/PR filters), the workout store
 *      (finishWorkout PR detection), and the UI (SetRow picker).
 *   3. Backward compatible — old sessions without a `setType` field default
 *      to `normal` via `normalizeSetType()`.
 *
 * Lessons learned from Lyfta competitor analysis: Lyfta hardcodes its 11 set
 * types inside the component tree and duplicates the volume/PR exclusion
 * logic across 4 files. We avoid that by centralizing here.
 */

/** All 11 set types supported by Pulse. */
export type SetType =
  | "normal"
  | "warmup"
  | "drop_set"
  | "failure"
  | "right"
  | "left"
  | "negative"
  | "partial"
  | "myo_reps"
  | "top_set"
  | "back_off";

/** Metadata describing how a set type behaves and is rendered. */
export interface SetTypeMeta {
  /** Stable identifier stored in Dexie (never localize this). */
  id: SetType;
  /** English label (shown in UI + used for ARIA). */
  labelEn: string;
  /** Arabic label (RTL support). */
  labelAr: string;
  /** Short badge text (≤3 chars) shown in the set row chip. */
  badge: string;
  /**
   * Tailwind color token classes for the chip. We use semantic tokens
   * (bg-*, text-*) so the colors adapt to light/dark themes automatically.
   * Format: { chip: "...", text: "..." }.
   */
  chipBg: string;
  chipText: string;
  /**
   * Whether sets of this type contribute to total volume (weight × reps).
   * Warmup sets don't count (they're preparatory, not working sets).
   */
  countsInVolume: boolean;
  /**
   * Whether sets of this type are eligible for Personal Record detection.
   * PRs only count for "true" working sets where the lifter is fresh —
   * not for warmup, drop sets (post-failure), negatives (eccentric-only),
   * or partial reps (shortened ROM).
   */
  countsForPR: boolean;
}

/**
 * Ordered list — the cycle order when the user taps the set-type chip.
 * Normal first (default), then the most-common variants, then the
 * specialized techniques last so the cycle is fast for the 80% case.
 */
export const SET_TYPES: readonly SetTypeMeta[] = [
  {
    id: "normal",
    labelEn: "Working",
    labelAr: "عادي",
    badge: "W",
    chipBg: "bg-primary/15",
    chipText: "text-primary",
    countsInVolume: true,
    countsForPR: true,
  },
  {
    id: "warmup",
    labelEn: "Warmup",
    labelAr: "إحماء",
    badge: "WU",
    chipBg: "bg-warning/15",
    chipText: "text-warning",
    countsInVolume: false,
    countsForPR: false,
  },
  {
    id: "top_set",
    labelEn: "Top Set",
    labelAr: "أعلى مجموعة",
    badge: "T",
    chipBg: "bg-success/15",
    chipText: "text-success",
    countsInVolume: true,
    countsForPR: true,
  },
  {
    id: "back_off",
    labelEn: "Back-off",
    labelAr: "تخفيف",
    badge: "BO",
    chipBg: "bg-info/15",
    chipText: "text-info",
    countsInVolume: true,
    countsForPR: false,
  },
  {
    id: "drop_set",
    labelEn: "Drop",
    labelAr: "تنازلي",
    badge: "D",
    chipBg: "bg-warning/15",
    chipText: "text-warning",
    countsInVolume: true,
    countsForPR: false,
  },
  {
    id: "failure",
    labelEn: "Failure",
    labelAr: "حتى الفشل",
    badge: "F",
    chipBg: "bg-danger/15",
    chipText: "text-danger",
    countsInVolume: true,
    countsForPR: false,
  },
  {
    id: "myo_reps",
    labelEn: "Myo-rep",
    labelAr: "مايو-ريب",
    badge: "M",
    chipBg: "bg-danger/15",
    chipText: "text-danger",
    countsInVolume: true,
    countsForPR: false,
  },
  {
    id: "negative",
    labelEn: "Negative",
    labelAr: "سلبي",
    badge: "N",
    chipBg: "bg-warning/15",
    chipText: "text-warning",
    countsInVolume: false,
    countsForPR: false,
  },
  {
    id: "partial",
    labelEn: "Partial",
    labelAr: "جزئي",
    badge: "P",
    chipBg: "bg-success/15",
    chipText: "text-success",
    countsInVolume: true,
    countsForPR: false,
  },
  {
    id: "right",
    labelEn: "Right",
    labelAr: "يمين",
    badge: "R",
    chipBg: "bg-info/15",
    chipText: "text-info",
    countsInVolume: true,
    countsForPR: true,
  },
  {
    id: "left",
    labelEn: "Left",
    labelAr: "يسار",
    badge: "L",
    chipBg: "bg-primary/15",
    chipText: "text-primary",
    countsInVolume: true,
    countsForPR: true,
  },
] as const;

/** Fast lookup map: id → meta. */
export const SET_TYPE_MAP: ReadonlyMap<SetType, SetTypeMeta> = new Map(
  SET_TYPES.map((m) => [m.id, m]),
);

/**
 * Normalize an unknown setType value (from old Dexie rows or untrusted input)
 * to a valid SetType. Unknown/undefined → "normal" (backward compatible).
 */
export function normalizeSetType(value: unknown): SetType {
  if (typeof value === "string" && SET_TYPE_MAP.has(value as SetType)) {
    return value as SetType;
  }
  return "normal";
}

/** Get metadata for a setType, falling back to "normal" for unknown values. */
export function getSetTypeMeta(type: unknown): SetTypeMeta {
  return SET_TYPE_MAP.get(normalizeSetType(type)) ?? SET_TYPES[0];
}

/**
 * Cycle to the next set type in the defined order.
 * Used by SetRow.tsx tap-to-cycle. Wraps around at the end.
 */
export function nextSetType(current: SetType): SetType {
  const idx = SET_TYPES.findIndex((m) => m.id === current);
  if (idx === -1) return "normal";
  const nextIdx = (idx + 1) % SET_TYPES.length;
  return SET_TYPES[nextIdx].id;
}

/** Does this set type count toward total volume? */
export function countsInVolume(type: unknown): boolean {
  return getSetTypeMeta(type).countsInVolume;
}

/** Is this set type eligible for PR detection? */
export function countsForPR(type: unknown): boolean {
  return getSetTypeMeta(type).countsForPR;
}
