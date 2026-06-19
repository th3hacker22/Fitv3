// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateWorkoutAI } from "../aiWorkoutService";
import type { Exercise } from "@/types/exercise";

// Mock the toast store
const mockAddToast = vi.fn();
vi.mock("@/store/useToastStore", () => ({
  useToastStore: {
    getState: () => ({ addToast: mockAddToast }),
  },
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock navigator.onLine
Object.defineProperty(navigator, "onLine", {
  value: true,
  configurable: true,
  writable: true,
});

const mockExercises: Exercise[] = [
  {
    id: "ex_1",
    name: "Push Up",
    category: "strength",
    bodyPart: "chest",
    equipment: "body weight",
    instructions: "Push yourself up.",
    instructionSteps: ["Laying down", "Push up"],
    muscleGroup: "chest",
    secondaryMuscles: ["triceps"],
    target: "pectorals",
    imageUrl: "",
    gifUrl: "",
  },
  {
    id: "ex_2",
    name: "Squat",
    category: "strength",
    bodyPart: "upper legs",
    equipment: "barbell",
    instructions: "Squat down.",
    instructionSteps: ["Bar on back", "Squat down"],
    muscleGroup: "upper legs",
    secondaryMuscles: ["glutes"],
    target: "quadriceps",
    imageUrl: "",
    gifUrl: "",
  },
];

const mockState = {
  gender: "male" as const,
  age: 25,
  goal: "Strength" as const,
  fitnessLevel: "Beginner" as const,
  equipment: ["body weight"],
  selectedMuscles: ["chest"],
};

describe("aiWorkoutService (Next.js API route version)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
  });

  it("calls /api/ai-workout and returns resolved exercises when online", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        text: JSON.stringify({
          exercises: [
            {
              exerciseId: "ex_1",
              sets: 4,
              reps: "10",
              restSeconds: 60,
              progression: "Do it slowly.",
            },
          ],
        }),
      }),
    });

    const result = await generateWorkoutAI(mockState, mockExercises);

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/ai-workout",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(result.exercises).toHaveLength(1);
    expect(result.exercises[0].exercise.id).toBe("ex_1");
    expect(result.exercises[0].sets).toBe(4);
    expect(result.exercises[0].reps).toBe("10");
  });

  it("shows toast and falls back to algorithmic generator when offline", async () => {
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });

    const result = await generateWorkoutAI(mockState, mockExercises);

    expect(mockAddToast).toHaveBeenCalledWith("error", "AI requires internet connection");
    expect(mockFetch).not.toHaveBeenCalled();
    // Falls back to algorithmic generator — should still return a routine
    expect(result).toBeDefined();
    expect(result.exercises).toBeDefined();
  });

  it("shows toast and falls back when the API returns a non-OK response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const result = await generateWorkoutAI(mockState, mockExercises);

    expect(mockAddToast).toHaveBeenCalledWith(
      "error",
      "AI service unavailable, using standard generator"
    );
    expect(result).toBeDefined();
    expect(result.exercises).toBeDefined();
  });

  it("shows specific toast and falls back when the API returns a 200 OK with an error field", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        error: "Rate limit exceeded. Please try again in a moment.",
      }),
    });

    const result = await generateWorkoutAI(mockState, mockExercises);

    expect(mockAddToast).toHaveBeenCalledWith(
      "error",
      "Rate limit exceeded. Please try again in a moment."
    );
    expect(result).toBeDefined();
    expect(result.exercises).toBeDefined();
  });

  it("falls back when the API response has no valid exercise matches", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        text: JSON.stringify({
          exercises: [{ exerciseId: "nonexistent_id", sets: 3, reps: "10", restSeconds: 90 }],
        }),
      }),
    });

    const result = await generateWorkoutAI(mockState, mockExercises);

    // No matching exercise → falls back to algorithmic generator
    expect(result).toBeDefined();
    expect(result.exercises.length).toBeGreaterThan(0);
  });

  it("falls back when the API returns invalid JSON", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: "not valid json {{" }),
    });

    const result = await generateWorkoutAI(mockState, mockExercises);

    expect(mockAddToast).toHaveBeenCalledWith(
      "error",
      "AI service unavailable, using standard generator"
    );
    expect(result).toBeDefined();
  });
});
