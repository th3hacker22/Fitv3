// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

// ── Mock framer-motion to bypass animation overhead in jsdom ──
// The real motion components rely on layout measurement APIs that jsdom
// doesn't implement. We replace them with plain DOM elements so the
// component tree renders synchronously.
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, className, ...props }: any) => (
      <div className={className} {...props}>{children}</div>
    ),
    button: ({ children, className, ...props }: any) => (
      <button className={className} {...props}>{children}</button>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useReducedMotion: () => false,
}));

import SetRow from "../SetRow";
import type { WorkoutSet } from "@/store/useWorkoutStore";
import { getSetTypeMeta, type SetType } from "@/config/setTypes";

// ── Test fixtures ──
function makeSet(overrides: Partial<WorkoutSet> = {}): WorkoutSet {
  return {
    id: "set-1",
    weight: "100",
    reps: "8",
    rpe: "8",
    completed: false,
    setType: "normal",
    ...overrides,
  };
}

function renderSetRow(overrides: {
  set?: Partial<WorkoutSet>;
  setIndex?: number;
  onToggleComplete?: (id: string) => void;
  onUpdateWeight?: (id: string, v: string) => void;
  onUpdateReps?: (id: string, v: string) => void;
  onUpdateRpe?: (id: string, v: string) => void;
  onOpenTypePicker?: (id: string) => void;
  onRemoveSet?: (id: string) => void;
} = {}) {
  const onToggleComplete = overrides.onToggleComplete ?? vi.fn();
  const onUpdateWeight = overrides.onUpdateWeight ?? vi.fn();
  const onUpdateReps = overrides.onUpdateReps ?? vi.fn();
  const onUpdateRpe = overrides.onUpdateRpe ?? vi.fn();
  const onOpenTypePicker = overrides.onOpenTypePicker ?? vi.fn();
  const onRemoveSet = overrides.onRemoveSet ?? vi.fn();
  const set = makeSet(overrides.set ?? {});
  const setIndex = overrides.setIndex ?? 0;
  const utils = render(
    <SetRow
      set={set}
      setIndex={setIndex}
      onToggleComplete={onToggleComplete}
      onUpdateWeight={onUpdateWeight}
      onUpdateReps={onUpdateReps}
      onUpdateRpe={onUpdateRpe}
      onOpenTypePicker={onOpenTypePicker}
      onRemoveSet={onRemoveSet}
    />
  );
  return {
    ...utils,
    set,
    onToggleComplete,
    onUpdateWeight,
    onUpdateReps,
    onUpdateRpe,
    onOpenTypePicker,
    onRemoveSet,
  };
}

// ── Tests ──

describe("SetRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the set number (setIndex + 1) and weight/reps/RPE inputs", () => {
    const { set } = renderSetRow({ setIndex: 2 });
    // setIndex is 0-based; the displayed number is setIndex + 1 → "3"
    expect(screen.getByText("3")).toBeTruthy();

    // Three numeric inputs: weight, reps, RPE.
    const inputs = screen.getAllByRole("spinbutton") as HTMLInputElement[];
    expect(inputs).toHaveLength(3);
    expect(inputs[0].value).toBe(set.weight);
    expect(inputs[1].value).toBe(set.reps);
    expect(inputs[2].value).toBe(set.rpe);
  });

  it("calls onToggleComplete(set.id) when the check button is clicked", () => {
    const { onToggleComplete, set } = renderSetRow();
    // The check button is the only <button> wrapped around the Check icon.
    // The SetRow also renders a trash button and (when onOpenTypePicker is
    // provided) a chip button — so we target the toggle button by its
    // position in the grid (last actionable column before trash). The
    // simplest robust selector: find the button containing an svg with the
    // "check" path. Lucide renders <svg> with a recognizable stroke; we
    // rely on the known DOM order — the toggle button comes before trash.
    const buttons = screen.getAllByRole("button");
    // Chip + toggle + trash = 3 buttons when onOpenTypePicker is supplied.
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    // The toggle-complete button sits between the chip and the trash button.
    // It does not have an aria-label (only the chip and trash do), so we
    // find it by filtering unlabeled buttons.
    const toggleButton = buttons.find(
      (b) => !b.hasAttribute("aria-label")
    );
    expect(toggleButton).toBeTruthy();
    fireEvent.click(toggleButton!);
    expect(onToggleComplete).toHaveBeenCalledTimes(1);
    expect(onToggleComplete).toHaveBeenCalledWith(set.id);
  });

  it("calls onUpdateWeight(set.id, value) when the weight input changes", () => {
    const { onUpdateWeight, set } = renderSetRow();
    const inputs = screen.getAllByRole("spinbutton") as HTMLInputElement[];
    fireEvent.change(inputs[0], { target: { value: "120" } });
    expect(onUpdateWeight).toHaveBeenCalledTimes(1);
    expect(onUpdateWeight).toHaveBeenCalledWith(set.id, "120");
  });

  it("calls onUpdateReps(set.id, value) when the reps input changes", () => {
    const { onUpdateReps, set } = renderSetRow();
    const inputs = screen.getAllByRole("spinbutton") as HTMLInputElement[];
    fireEvent.change(inputs[1], { target: { value: "12" } });
    expect(onUpdateReps).toHaveBeenCalledTimes(1);
    expect(onUpdateReps).toHaveBeenCalledWith(set.id, "12");
  });

  it("renders the set-type chip with the correct badge text from getSetTypeMeta", () => {
    const setType: SetType = "warmup";
    const meta = getSetTypeMeta(setType);
    renderSetRow({ set: { setType } });
    const chip = screen.getByRole("button", {
      name: new RegExp(`Set type: ${meta.labelEn}`, "i"),
    });
    expect(chip).toBeTruthy();
    expect(chip.textContent).toBe(meta.badge);
  });

  it("calls onOpenTypePicker(set.id) when the set-type chip is clicked", () => {
    const { onOpenTypePicker, set } = renderSetRow();
    const chip = screen.getByRole("button", {
      name: /Set type:/i,
    });
    fireEvent.click(chip);
    expect(onOpenTypePicker).toHaveBeenCalledTimes(1);
    expect(onOpenTypePicker).toHaveBeenCalledWith(set.id);
  });

  it("applies completed styling (success background) when set.completed is true", () => {
    const { container } = renderSetRow({ set: { completed: true } });
    // The outer motion.div receives the "bg-success/5" class when completed.
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("bg-success/5");
    // The check button becomes the success filled style.
    const buttons = screen.getAllByRole("button");
    const toggleButton = buttons.find((b) => !b.hasAttribute("aria-label"));
    expect(toggleButton?.className).toContain("bg-success");
  });

  it("renders the chip as disabled (not interactive) when the set is completed", () => {
    renderSetRow({ set: { completed: true } });
    const chip = screen.queryByRole("button", { name: /Set type:/i });
    // The chip is still rendered (onOpenTypePicker is provided) but must
    // be marked disabled so the user can't trigger a type change after
    // the set has been logged.
    expect(chip).toBeTruthy();
    expect((chip as HTMLButtonElement).disabled).toBe(true);
  });

  it("does NOT render the set-type chip when onOpenTypePicker is not provided", () => {
    // Re-render without onOpenTypePicker — the chip should be absent.
    const set = makeSet();
    render(
      <SetRow
        set={set}
        setIndex={0}
        onToggleComplete={vi.fn()}
        onUpdateWeight={vi.fn()}
        onUpdateReps={vi.fn()}
      />
    );
    expect(screen.queryByRole("button", { name: /Set type:/i })).toBeNull();
  });
});
