// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

// ── Mock framer-motion ──
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

// ── Mock react-i18next ──
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// ── Mock the workout store ──
// The card subscribes to 6 actions plus the previous-exercise superset flag.
const storeMocks = {
  updateSet: vi.fn(),
  toggleSetComplete: vi.fn(),
  setSetType: vi.fn(),
  addSet: vi.fn(),
  removeSet: vi.fn(),
  setExerciseNotes: vi.fn(),
  activeWorkout: { exercises: [] as Array<{ isSupersetWithNext?: boolean }> },
};
vi.mock("@/store/useWorkoutStore", () => ({
  useWorkoutStore: (selector: (s: typeof storeMocks) => unknown) =>
    selector(storeMocks),
}));

// ── Mock ExerciseVideoPlayer to keep the test focused on the card ──
vi.mock("@/components/exercise/ExerciseVideoPlayer", () => ({
  __esModule: true,
  default: (props: { exerciseName: string }) => (
    <div data-testid="exercise-video-player" aria-label={props.exerciseName}>
      ExerciseVideoPlayer
    </div>
  ),
}));

// ── Mock SetRow so we can count instances without dragging in framer-motion
//    state from the child. Each SetRow receives `set` + `setIndex` props; we
//    expose them as data attributes so tests can assert on them. ──
vi.mock("../SetRow", () => ({
  __esModule: true,
  default: (props: { set: { id: string }; setIndex: number }) => (
    <div
      data-testid="set-row"
      data-set-id={props.set.id}
      data-set-index={props.setIndex}
    >
      SetRow
    </div>
  ),
}));

// ── Mock the sheet modals (they're portaled and depend on vaul) ──
vi.mock("../ReplaceExerciseSheet", () => ({
  __esModule: true,
  default: () => <div data-testid="replace-sheet">ReplaceSheet</div>,
}));
vi.mock("../WarmupSheet", () => ({
  __esModule: true,
  default: () => <div data-testid="warmup-sheet">WarmupSheet</div>,
}));
vi.mock("../PlateCalculatorSheet", () => ({
  __esModule: true,
  default: () => <div data-testid="plate-sheet">PlateSheet</div>,
}));
vi.mock("../SetTypePicker", () => ({
  __esModule: true,
  default: () => <div data-testid="set-type-picker">SetTypePicker</div>,
}));
vi.mock("../SkipReasonModal", () => ({
  __esModule: true,
  default: () => <div data-testid="skip-modal">SkipModal</div>,
}));

// ── Mock the learning-loop service ──
vi.mock("@/services/learningLoop", () => ({
  recordSkip: vi.fn().mockResolvedValue(undefined),
}));

import ExerciseWorkoutCard from "../ExerciseWorkoutCard";
import type { WorkoutExerciseItem } from "@/store/useWorkoutStore";

// ── Fixtures ──
function makeExercise(overrides: Partial<WorkoutExerciseItem> = {}): WorkoutExerciseItem {
  return {
    id: "ex-1",
    exerciseId: "ex-123",
    exerciseName: "Bench Press",
    exerciseNameEn: "Bench Press",
    muscleGroup: "Chest",
    equipment: "Barbell",
    tips: [],
    imageUrl: "",
    gifUrl: "",
    target: "Chest",
    secondaryMuscles: [],
    notes: "",
    sets: [
      { id: "set-1", weight: "100", reps: "8", rpe: "8", completed: false, setType: "normal" },
      { id: "set-2", weight: "100", reps: "8", rpe: "8", completed: false, setType: "normal" },
      { id: "set-3", weight: "100", reps: "8", rpe: "8", completed: true, setType: "normal" },
    ],
    isSupersetWithNext: false,
    ...overrides,
  };
}

function renderCard(overrides: {
  exercise?: Partial<WorkoutExerciseItem>;
  exerciseIndex?: number;
} = {}) {
  const exercise = makeExercise(overrides.exercise ?? {});
  const exerciseIndex = overrides.exerciseIndex ?? 0;
  return render(
    <ExerciseWorkoutCard exercise={exercise} exerciseIndex={exerciseIndex} />
  );
}

describe("ExerciseWorkoutCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the previous-exercise superset flag between tests.
    storeMocks.activeWorkout.exercises = [];
  });

  it("renders the exercise name (capitalized) and equipment · target subtitle", () => {
    renderCard({ exercise: { exerciseName: "bench press", equipment: "Barbell", target: "Chest" } });
    // The header renders the name with `capitalize` CSS — the raw text is
    // still "bench press" but visually capitalized. We assert on the raw
    // text content.
    expect(screen.getByText("bench press")).toBeTruthy();
    expect(screen.getByText(/Barbell · Chest/)).toBeTruthy();
  });

  it("renders one SetRow per set in the exercise.sets array", () => {
    renderCard({ exercise: { sets: [
      { id: "s1", weight: "50", reps: "5", completed: false },
      { id: "s2", weight: "55", reps: "5", completed: false },
      { id: "s3", weight: "60", reps: "5", completed: false },
      { id: "s4", weight: "65", reps: "5", completed: false },
    ] } });
    const rows = screen.getAllByTestId("set-row");
    expect(rows).toHaveLength(4);
    // Verify the setIndex prop is passed correctly.
    expect(rows[0].getAttribute("data-set-index")).toBe("0");
    expect(rows[3].getAttribute("data-set-index")).toBe("3");
  });

  it("renders a kebab menu button (aria-label 'More actions for …')", () => {
    renderCard({ exercise: { exerciseName: "Squat" } });
    const kebab = screen.getByRole("button", { name: /More actions for Squat/i });
    expect(kebab).toBeTruthy();
    expect(kebab.getAttribute("aria-haspopup")).toBe("menu");
  });

  it("opens a dropdown menu with action items when the kebab is clicked", () => {
    renderCard({ exercise: { exerciseName: "Squat", equipment: "Barbell", sets: [
      { id: "s1", weight: "100", reps: "5", completed: false },
    ] } });
    // Initially the menu items should not be visible.
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.queryByText(/Skip Exercise/i)).toBeNull();
    expect(screen.queryByText(/Replace Exercise/i)).toBeNull();

    // Click the kebab to open.
    fireEvent.click(screen.getByRole("button", { name: /More actions for Squat/i }));

    // The dropdown should now expose the menu role with the always-on items
    // (Skip + Replace) and the barbell-only Plate Calculator item.
    const menu = screen.getByRole("menu");
    expect(menu).toBeTruthy();
    expect(screen.getByText(/Skip Exercise/i)).toBeTruthy();
    expect(screen.getByText(/Replace Exercise/i)).toBeTruthy();
    expect(screen.getByText(/Plate Calculator/i)).toBeTruthy();
  });

  it("renders the 'Add Set' button", () => {
    renderCard();
    const addBtn = screen.getByRole("button", { name: /Add Set/i });
    expect(addBtn).toBeTruthy();
  });

  it("clicking 'Add Set' calls addSet(exerciseIndex) on the workout store", () => {
    renderCard({ exerciseIndex: 2 });
    fireEvent.click(screen.getByRole("button", { name: /Add Set/i }));
    expect(storeMocks.addSet).toHaveBeenCalledTimes(1);
    expect(storeMocks.addSet).toHaveBeenCalledWith(2);
  });

  it("renders the ExerciseVideoPlayer", () => {
    renderCard({ exercise: { exerciseName: "Deadlift" } });
    const player = screen.getByTestId("exercise-video-player");
    expect(player).toBeTruthy();
    expect(player.getAttribute("aria-label")).toBe("Deadlift");
  });

  it("shows the completed/total sets counter badge", () => {
    // 1 of 3 sets completed (makeExercise default has 1 completed).
    renderCard();
    // The badge text is "1/3".
    expect(screen.getByText("1/3")).toBeTruthy();
  });

  it("updates the counter when sets are completed", () => {
    renderCard({ exercise: { sets: [
      { id: "s1", weight: "100", reps: "5", completed: true },
      { id: "s2", weight: "100", reps: "5", completed: true },
      { id: "s3", weight: "100", reps: "5", completed: true },
    ] } });
    // All 3 sets completed → 3/3.
    expect(screen.getByText("3/3")).toBeTruthy();
  });

  it("does NOT render the Warmup menu item when firstSetWeight is 0", () => {
    renderCard({ exercise: { sets: [
      { id: "s1", weight: "0", reps: "5", completed: false },
    ] } });
    fireEvent.click(screen.getByRole("button", { name: /More actions for/i }));
    // Warmup should be absent (only shown when working weight > 0).
    expect(screen.queryByText(/Warmup Sets/i)).toBeNull();
  });
});
