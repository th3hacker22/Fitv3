import { describe, it, expect } from "vitest";
import type { Exercise } from "@/types/exercise";
import {
  filterExercises,
  getAlternativeExercises,
  getExercisesByIds,
  getBodyParts,
  getEquipmentTypes,
  getTargetMuscles,
  getRandomExercises,
  getPopularExercises,
} from "./exerciseService";

function makeExercise(overrides: Partial<Exercise>): Exercise {
  return {
    id: "x",
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

const DB: Exercise[] = [
  makeExercise({ id: "1", name: "Barbell Bench Press", bodyPart: "chest", equipment: "barbell", target: "pectorals" }),
  makeExercise({ id: "2", name: "Dumbbell Fly", bodyPart: "chest", equipment: "dumbbell", target: "pectorals" }),
  makeExercise({ id: "3", name: "Barbell Squat", bodyPart: "upper legs", equipment: "barbell", target: "quads" }),
  makeExercise({ id: "4", name: "Pull-up", bodyPart: "back", equipment: "body weight", target: "lats" }),
  makeExercise({ id: "5", name: "Cable Triceps Pushdown", bodyPart: "upper arms", equipment: "cable", target: "triceps" }),
];

describe("filterExercises", () => {
  it("returns everything when no filters apply", () => {
    expect(filterExercises(DB, {})).toHaveLength(DB.length);
    expect(filterExercises(DB, { bodyPart: "all" })).toHaveLength(DB.length);
  });

  it("filters by single body part", () => {
    const r = filterExercises(DB, { bodyPart: "chest" });
    expect(r.map((e) => e.id).sort()).toEqual(["1", "2"]);
  });

  it("filters by an array of body parts", () => {
    const r = filterExercises(DB, { bodyPart: ["chest", "back"] });
    expect(r.map((e) => e.id).sort()).toEqual(["1", "2", "4"]);
  });

  it("treats an empty body-part array as no filter", () => {
    expect(filterExercises(DB, { bodyPart: [] })).toHaveLength(DB.length);
  });

  it("filters by equipment and target", () => {
    expect(filterExercises(DB, { equipment: "barbell" }).map((e) => e.id).sort()).toEqual(["1", "3"]);
    expect(filterExercises(DB, { target: "lats" }).map((e) => e.id)).toEqual(["4"]);
  });

  it("searches by name, muscle, or equipment, case-insensitively", () => {
    expect(filterExercises(DB, { search: "bench" }).map((e) => e.id)).toEqual(["1"]);
    expect(filterExercises(DB, { search: "QUADS" }).map((e) => e.id)).toEqual(["3"]);
    expect(filterExercises(DB, { search: "cable" }).map((e) => e.id)).toEqual(["5"]);
  });

  it("combines multiple filters (AND)", () => {
    expect(filterExercises(DB, { bodyPart: "chest", equipment: "dumbbell" }).map((e) => e.id)).toEqual(["2"]);
  });
});

describe("getAlternativeExercises", () => {
  it("returns same-target exercises excluding the current one", () => {
    const alts = getAlternativeExercises(DB, "1");
    expect(alts.map((e) => e.id)).toEqual(["2"]);
  });

  it("respects the limit", () => {
    const many = [DB[0], ...Array.from({ length: 5 }, (_, i) => makeExercise({ id: `p${i}`, target: "pectorals" }))];
    expect(getAlternativeExercises(many, "1", 2)).toHaveLength(2);
  });

  it("returns empty array for unknown id", () => {
    expect(getAlternativeExercises(DB, "nope")).toEqual([]);
  });
});

describe("getExercisesByIds", () => {
  it("maps ids preserving order and drops missing ones", () => {
    expect(getExercisesByIds(DB, ["3", "1", "missing"]).map((e) => e.id)).toEqual(["3", "1"]);
  });
});

describe("aggregation helpers", () => {
  it("returns unique body parts, equipment, and targets", () => {
    expect(getBodyParts(DB).map((b) => b.id).sort()).toEqual(["back", "chest", "upper arms", "upper legs"]);
    expect(getEquipmentTypes(DB).sort()).toEqual(["barbell", "body weight", "cable", "dumbbell"]);
    expect(getTargetMuscles(DB).sort()).toEqual(["lats", "pectorals", "quads", "triceps"]);
  });
});

describe("getRandomExercises", () => {
  it("returns the requested count without duplicates and without mutating input", () => {
    const before = DB.map((e) => e.id);
    const r = getRandomExercises(DB, 3);
    expect(r).toHaveLength(3);
    expect(new Set(r.map((e) => e.id)).size).toBe(3);
    expect(DB.map((e) => e.id)).toEqual(before);
  });
});

describe("getPopularExercises", () => {
  it("matches well-known exercise names", () => {
    const ids = getPopularExercises(DB).map((e) => e.id).sort();
    expect(ids).toEqual(["1", "3", "4", "5"]);
  });
});
