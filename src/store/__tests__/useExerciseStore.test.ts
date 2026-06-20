import { beforeEach, describe, it, expect, vi } from "vitest";
import { useExerciseStore } from "../useExerciseStore";
import { fetchExercisesFromGitHub } from "@/services/exerciseService";
import { db } from "@/db";
import type { Exercise } from "@/types/exercise";

// Mock localStorage for node environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    clear: () => {
      store = {};
    },
    removeItem: (key: string) => {
      delete store[key];
    },
  };
})();
Object.defineProperty(global, "localStorage", { value: localStorageMock, writable: true });

vi.mock("@/services/exerciseService", async (importActual) => {
  const actual = await importActual<typeof import("@/services/exerciseService")>();
  return { ...actual, fetchExercisesFromGitHub: vi.fn() };
});

vi.mock("@/db", () => ({
  db: {
    exercises_v2: {
      count: vi.fn(),
      toArray: vi.fn(),
      bulkPut: vi.fn(),
      add: vi.fn(),
    },
  },
}));

function makeExercise(overrides: Partial<Exercise>): Exercise {
  return {
    id: "ex_1",
    name: "Test Exercise",
    category: "strength",
    bodyPart: "chest",
    equipment: "barbell",
    instructions: "",
    instructionSteps: [],
    muscleGroup: "chest",
    secondaryMuscles: [],
    target: "pectorals",
    imageUrl: "",
    gifUrl: "",
    ...overrides,
  };
}

const mockExercises: Exercise[] = [
  makeExercise({ id: "1", name: "Bench Press", bodyPart: "chest", equipment: "barbell" }),
  makeExercise({ id: "2", name: "Squat", bodyPart: "upper legs", equipment: "barbell" }),
  makeExercise({ id: "3", name: "Pullup", bodyPart: "back", equipment: "body weight" }),
];

describe("useExerciseStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useExerciseStore.setState({
      exercises: [],
      filteredExercises: [],
      isLoading: false,
      error: null,
      filters: {},
    });
  });

  it("initializes with default state", () => {
    const state = useExerciseStore.getState();
    expect(state.exercises).toEqual([]);
    expect(state.filteredExercises).toEqual([]);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.filters).toEqual({});
  });

  describe("loadExercises", () => {
    it("returns early if exercises are already loaded", async () => {
      useExerciseStore.setState({ exercises: mockExercises });
      await useExerciseStore.getState().loadExercises();
      expect(db.exercises_v2.count).not.toHaveBeenCalled();
      expect(fetchExercisesFromGitHub).not.toHaveBeenCalled();
    });

    it("loads exercises from IndexedDB if count > 0", async () => {
      vi.mocked(db.exercises_v2.count).mockResolvedValue(mockExercises.length);
      vi.mocked(db.exercises_v2.toArray).mockResolvedValue(mockExercises);

      await useExerciseStore.getState().loadExercises();

      expect(db.exercises_v2.count).toHaveBeenCalled();
      expect(db.exercises_v2.toArray).toHaveBeenCalled();
      expect(fetchExercisesFromGitHub).not.toHaveBeenCalled();

      const state = useExerciseStore.getState();
      expect(state.exercises).toEqual(mockExercises);
      expect(state.filteredExercises).toEqual(mockExercises);
      expect(state.isLoading).toBe(false);
    });

    it("fetches from GitHub and seeds IndexedDB when empty", async () => {
      vi.mocked(db.exercises_v2.count).mockResolvedValue(0);
      vi.mocked(fetchExercisesFromGitHub).mockResolvedValue(mockExercises);
      vi.mocked(db.exercises_v2.bulkPut).mockResolvedValue([]);

      await useExerciseStore.getState().loadExercises();

      expect(fetchExercisesFromGitHub).toHaveBeenCalled();
      expect(db.exercises_v2.bulkPut).toHaveBeenCalledWith(mockExercises);

      const state = useExerciseStore.getState();
      expect(state.exercises).toEqual(mockExercises);
      expect(state.isLoading).toBe(false);
    });

    it("handles loading errors gracefully", async () => {
      vi.mocked(db.exercises_v2.count).mockRejectedValue(new Error("DB Error"));

      await useExerciseStore.getState().loadExercises();

      const state = useExerciseStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe("Failed to load exercises. Please try again.");
    });
  });

  describe("filters", () => {
    beforeEach(() => {
      useExerciseStore.setState({ exercises: mockExercises, filteredExercises: mockExercises });
    });

    it("applies bodyPart filter", () => {
      useExerciseStore.getState().setFilter("bodyPart", "chest");
      const state = useExerciseStore.getState();
      expect(state.filters.bodyPart).toBe("chest");
      expect(state.filteredExercises).toHaveLength(1);
      expect(state.filteredExercises[0].id).toBe("1");
    });

    it("clears all filters", () => {
      useExerciseStore.getState().setFilter("bodyPart", "chest");
      useExerciseStore.getState().clearFilters();
      const state = useExerciseStore.getState();
      expect(state.filters).toEqual({});
      expect(state.filteredExercises).toEqual(mockExercises);
    });
  });

  describe("getExerciseById", () => {
    beforeEach(() => {
      useExerciseStore.setState({ exercises: mockExercises });
    });

    it("returns the correct exercise", () => {
      expect(useExerciseStore.getState().getExerciseById("2")).toEqual(mockExercises[1]);
    });

    it("returns undefined for unknown id", () => {
      expect(useExerciseStore.getState().getExerciseById("99")).toBeUndefined();
    });
  });

  describe("addCustomExercise", () => {
    beforeEach(() => {
      useExerciseStore.setState({ exercises: mockExercises, filteredExercises: mockExercises });
    });

    it("adds a custom exercise to the store and IndexedDB", async () => {
      vi.mocked(db.exercises_v2.add).mockResolvedValue("custom_id" as never);

      await useExerciseStore.getState().addCustomExercise({
        name: "Custom Pushup",
        category: "strength",
        bodyPart: "chest",
        equipment: "body weight",
        instructions: "Do pushups",
        instructionSteps: ["Do pushups"],
        muscleGroup: "chest",
        secondaryMuscles: [],
        target: "pectorals",
        imageUrl: "",
        gifUrl: "",
      });

      expect(db.exercises_v2.add).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Custom Pushup",
          isCustom: true,
          imageUrl: "/images/custom-exercise.jpg",
        })
      );

      const state = useExerciseStore.getState();
      expect(state.exercises).toHaveLength(mockExercises.length + 1);
      expect(state.exercises[0].isCustom).toBe(true);
      expect(state.exercises[0].id).toContain("custom_");
    });
  });
});
