import { describe, it, expect } from "vitest";
import { getMuscleIdsForExercise } from "./muscleMapper";

// All muscle IDs that actually exist as selectable regions in AnatomyMap.tsx.
// The mapper must never emit an ID outside this set, or the body map will
// silently fail to highlight a muscle.
const VALID_IDS = new Set([
  "neck", "neck-back",
  "upper-traps", "traps-back", "traps-mid", "lower-traps",
  "upper-chest", "mid-lower-chest",
  "front-delt", "lateral-delt", "lat-delt-back", "post-delt",
  "biceps-long", "biceps-short",
  "triceps-long", "triceps-lat", "triceps-med",
  "forearm-ext", "forearm-flex", "forearm-ext-back", "forearm-flex-back",
  "upper-abs", "lower-abs", "obliques",
  "lats", "lower-back",
  "outer-quad", "rectus-femoris", "vmo", "adductors",
  "medial-ham", "lateral-ham",
  "glute-max", "glute-med",
  "gastrocnemius", "gastroc-back", "soleus", "soleus-back", "tibialis",
]);

describe("getMuscleIdsForExercise", () => {
  it("returns only IDs that exist on the anatomy map", () => {
    const samples = [
      ["pectorals", ["triceps", "front delts"]],
      ["lats", ["biceps", "rhomboids"]],
      ["quads", ["glutes", "calves"]],
      ["abs", ["obliques"]],
      ["hamstrings", ["adductors"]],
      ["forearms", ["wrist"]],
    ] as const;
    for (const [target, secondary] of samples) {
      const ids = getMuscleIdsForExercise(target, [...secondary]);
      for (const id of ids) {
        expect(VALID_IDS.has(id), `unexpected id "${id}"`).toBe(true);
      }
    }
  });

  it("maps chest to both chest regions", () => {
    const ids = getMuscleIdsForExercise("pectorals", []);
    expect(ids).toContain("upper-chest");
    expect(ids).toContain("mid-lower-chest");
  });

  it("respects upper/lower chest qualifiers", () => {
    expect(getMuscleIdsForExercise("upper chest", [])).toEqual(["upper-chest"]);
    expect(getMuscleIdsForExercise("lower chest", [])).toEqual(["mid-lower-chest"]);
  });

  it("maps biceps to both heads", () => {
    const ids = getMuscleIdsForExercise("biceps", []);
    expect(ids).toContain("biceps-long");
    expect(ids).toContain("biceps-short");
  });

  it("does not confuse 'lat' (lats) with 'lateral' (delt)", () => {
    const lats = getMuscleIdsForExercise("lats", []);
    expect(lats).toContain("lats");
    expect(lats).not.toContain("lateral-delt");

    const sideDelt = getMuscleIdsForExercise("lateral delts", []);
    expect(sideDelt).toContain("lateral-delt");
    expect(sideDelt).not.toContain("lats");
  });

  it("includes secondary muscles", () => {
    const ids = getMuscleIdsForExercise("pectorals", ["triceps"]);
    expect(ids).toContain("upper-chest");
    expect(ids).toContain("triceps-long");
  });

  it("returns an empty array for unknown muscles", () => {
    expect(getMuscleIdsForExercise("xyz-unknown", [])).toEqual([]);
  });

  it("deduplicates overlapping target and secondary muscles", () => {
    const ids = getMuscleIdsForExercise("biceps", ["biceps"]);
    expect(ids.length).toBe(new Set(ids).size);
  });

  it("maps glutes to both glute regions", () => {
    const ids = getMuscleIdsForExercise("glutes", []);
    expect(ids).toEqual(expect.arrayContaining(["glute-max", "glute-med"]));
  });
});
