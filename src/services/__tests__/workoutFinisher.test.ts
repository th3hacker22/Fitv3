import { describe, it, expect, vi } from "vitest";
import {
  buildSession,
  detectNewPRs,
  computeSessionVolume,
} from "../workoutFinisher";
import type { WorkoutSession } from "@/db/schema";
import type { WorkoutExerciseItem } from "@/store/useWorkoutStore";

// Mock uid so we get predictable session IDs
vi.mock("@/utils/id", () => ({ uid: vi.fn(() => "test-uid") }));

// ── Fixtures ──

function makeExerciseItem(
  exerciseId: string,
  sets: { weight: string; reps: string; completed: boolean; rpe?: string; setType?: string }[]
): WorkoutExerciseItem {
  return {
    id: `item-${exerciseId}`,
    exerciseId,
    exerciseName: `Exercise ${exerciseId}`,
    exerciseNameEn: `Exercise ${exerciseId}`,
    muscleGroup: "Chest",
    equipment: "barbell",
    tips: [],
    imageUrl: "",
    gifUrl: "",
    target: "pectorals",
    secondaryMuscles: [],
    sets: sets.map((s, i) => ({
      id: `set-${i}`,
      weight: s.weight,
      reps: s.reps,
      rpe: s.rpe,
      completed: s.completed,
      setType: s.setType as never,
    })),
  } as WorkoutExerciseItem;
}

function makeSession(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: "s1",
    name: "Test",
    date: new Date().toISOString(),
    duration: 3600,
    exercises: [
      {
        exerciseId: "ex1",
        exerciseName: "Bench Press",
        sets: [
          { weight: 100, reps: 10, completed: true, estimated1RM: 133, setType: "normal" },
        ],
      },
    ],
    completed: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as WorkoutSession;
}

// ── buildSession ──

describe("buildSession", () => {
  it("builds a session from completed exercises", () => {
    const items = [
      makeExerciseItem("ex1", [
        { weight: "100", reps: "10", completed: true },
        { weight: "105", reps: "8", completed: true },
      ]),
    ];
    const session = buildSession(items, Date.now() - 3600_000);
    expect(session.id).toBe("test-uid");
    expect(session.completed).toBe(true);
    expect(session.exercises).toHaveLength(1);
    expect(session.exercises[0].exerciseId).toBe("ex1");
    expect(session.exercises[0].sets).toHaveLength(2);
    expect(session.exercises[0].sets[0].weight).toBe(100);
    expect(session.exercises[0].sets[0].reps).toBe(10);
    expect(session.exercises[0].sets[0].completed).toBe(true);
    expect(session.exercises[0].sets[0].setType).toBe("normal");
    expect(session.exercises[0].sets[0].estimated1RM).toBeGreaterThan(0);
  });

  it("filters out exercises with no completed sets", () => {
    const items = [
      makeExerciseItem("ex1", [{ weight: "100", reps: "10", completed: true }]),
      makeExerciseItem("ex2", [{ weight: "100", reps: "10", completed: false }]),
    ];
    const session = buildSession(items, Date.now());
    expect(session.exercises).toHaveLength(1);
    expect(session.exercises[0].exerciseId).toBe("ex1");
  });

  it("filters out uncompleted sets within an exercise", () => {
    const items = [
      makeExerciseItem("ex1", [
        { weight: "60", reps: "5", completed: false },
        { weight: "100", reps: "10", completed: true },
      ]),
    ];
    const session = buildSession(items, Date.now());
    expect(session.exercises[0].sets).toHaveLength(1);
    expect(session.exercises[0].sets[0].weight).toBe(100);
  });

  it("persists setType from the workout set", () => {
    const items = [
      makeExerciseItem("ex1", [
        { weight: "40", reps: "10", completed: true, setType: "warmup" },
        { weight: "100", reps: "10", completed: true, setType: "normal" },
      ]),
    ];
    const session = buildSession(items, Date.now());
    expect(session.exercises[0].sets[0].setType).toBe("warmup");
    expect(session.exercises[0].sets[1].setType).toBe("normal");
  });

  it("defaults setType to 'normal' when not set", () => {
    const items = [
      makeExerciseItem("ex1", [{ weight: "100", reps: "10", completed: true }]),
    ];
    const session = buildSession(items, Date.now());
    expect(session.exercises[0].sets[0].setType).toBe("normal");
  });

  it("computes duration from startedAt", () => {
    const startedAt = Date.now() - 1800_000; // 30 min ago
    const session = buildSession(
      [makeExerciseItem("ex1", [{ weight: "100", reps: "10", completed: true }])],
      startedAt
    );
    expect(session.duration).toBeGreaterThanOrEqual(1799);
    expect(session.duration).toBeLessThanOrEqual(1801);
  });
});

// ── detectNewPRs ──

describe("detectNewPRs", () => {
  it("detects a new PR when session e1RM exceeds prior best", () => {
    const session = makeSession();
    const priorBests = new Map([["ex1", 120]]);
    const result = detectNewPRs(session, priorBests);
    expect(result.count).toBe(1);
    expect(result.newPRs[0].exerciseId).toBe("ex1");
    expect(result.newPRs[0].weight).toBe(100);
    expect(result.newPRs[0].reps).toBe(10);
    expect(result.newPRs[0].estimated1RM).toBe(133);
  });

  it("returns no PRs when session e1RM is below prior best", () => {
    const session = makeSession();
    const priorBests = new Map([["ex1", 150]]);
    const result = detectNewPRs(session, priorBests);
    expect(result.count).toBe(0);
    expect(result.newPRs).toEqual([]);
  });

  it("detects PR for exercises with no prior history", () => {
    const session = makeSession();
    const priorBests = new Map<string, number>();
    const result = detectNewPRs(session, priorBests);
    expect(result.count).toBe(1);
  });

  it("excludes warmup sets from PR detection", () => {
    const session = makeSession({
      exercises: [{
        exerciseId: "ex1",
        exerciseName: "Bench Press",
        sets: [
          { weight: 200, reps: 1, completed: true, estimated1RM: 200, setType: "warmup" },
          { weight: 100, reps: 10, completed: true, estimated1RM: 133, setType: "normal" },
        ],
      }],
    });
    const priorBests = new Map([["ex1", 150]]);
    const result = detectNewPRs(session, priorBests);
    // Warmup @ 200 e1RM should NOT count — normal @ 133 is below prior 150
    expect(result.count).toBe(0);
  });

  it("excludes drop_set from PR detection", () => {
    const session = makeSession({
      exercises: [{
        exerciseId: "ex1",
        exerciseName: "Bench Press",
        sets: [
          { weight: 150, reps: 5, completed: true, estimated1RM: 175, setType: "drop_set" },
          { weight: 100, reps: 10, completed: true, estimated1RM: 133, setType: "normal" },
        ],
      }],
    });
    const priorBests = new Map([["ex1", 160]]);
    const result = detectNewPRs(session, priorBests);
    // Drop @ 175 should NOT count — normal @ 133 is below 160
    expect(result.count).toBe(0);
  });

  it("handles multiple exercises with mixed PRs", () => {
    const session: WorkoutSession = {
      ...makeSession(),
      exercises: [
        {
          exerciseId: "ex1",
          exerciseName: "Bench Press",
          sets: [{ weight: 100, reps: 10, completed: true, estimated1RM: 133, setType: "normal" }],
        },
        {
          exerciseId: "ex2",
          exerciseName: "Squat",
          sets: [{ weight: 80, reps: 5, completed: true, estimated1RM: 93, setType: "normal" }],
        },
      ],
    };
    const priorBests = new Map([["ex1", 120], ["ex2", 100]]);
    const result = detectNewPRs(session, priorBests);
    expect(result.count).toBe(1);
    expect(result.newPRs[0].exerciseId).toBe("ex1");
  });

  it("returns empty for a session with no completed sets", () => {
    const session = makeSession({
      exercises: [{
        exerciseId: "ex1",
        exerciseName: "Bench",
        sets: [{ weight: 100, reps: 10, completed: false, setType: "normal" }],
      }],
    });
    const result = detectNewPRs(session, new Map());
    expect(result.count).toBe(0);
  });
});

// ── computeSessionVolume ──

describe("computeSessionVolume", () => {
  it("sums weight × reps for all completed sets", () => {
    const session = makeSession({
      exercises: [{
        exerciseId: "ex1",
        exerciseName: "Bench",
        sets: [
          { weight: 100, reps: 10, completed: true },
          { weight: 105, reps: 8, completed: true },
        ],
      }],
    });
    expect(computeSessionVolume(session)).toBe(1000 + 840);
  });

  it("sums across multiple exercises", () => {
    const session = makeSession({
      exercises: [
        { exerciseId: "ex1", exerciseName: "Bench", sets: [{ weight: 100, reps: 10, completed: true }] },
        { exerciseId: "ex2", exerciseName: "Squat", sets: [{ weight: 120, reps: 5, completed: true }] },
      ],
    });
    expect(computeSessionVolume(session)).toBe(1000 + 600);
  });

  it("returns 0 for a session with no sets", () => {
    const session = makeSession({ exercises: [] });
    expect(computeSessionVolume(session)).toBe(0);
  });
});
