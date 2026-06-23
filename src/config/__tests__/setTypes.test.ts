import { describe, it, expect } from "vitest";
import {
  SET_TYPES,
  SET_TYPE_MAP,
  normalizeSetType,
  getSetTypeMeta,
  nextSetType,
  countsInVolume,
  countsForPR,
  type SetType,
} from "../setTypes";

describe("setTypes config", () => {
  describe("SET_TYPES catalog", () => {
    it("contains exactly 11 set types", () => {
      expect(SET_TYPES).toHaveLength(11);
    });

    it("has unique ids", () => {
      const ids = SET_TYPES.map((m) => m.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("has unique badges", () => {
      const badges = SET_TYPES.map((m) => m.badge);
      expect(new Set(badges).size).toBe(badges.length);
    });

    it("every type has all required metadata fields", () => {
      for (const meta of SET_TYPES) {
        expect(typeof meta.id).toBe("string");
        expect(typeof meta.labelEn).toBe("string");
        expect(typeof meta.labelAr).toBe("string");
        expect(typeof meta.badge).toBe("string");
        expect(typeof meta.chipBg).toBe("string");
        expect(typeof meta.chipText).toBe("string");
        expect(typeof meta.countsInVolume).toBe("boolean");
        expect(typeof meta.countsForPR).toBe("boolean");
      }
    });

    it("includes all 11 required type ids", () => {
      const expected: SetType[] = [
        "normal",
        "warmup",
        "drop_set",
        "failure",
        "right",
        "left",
        "negative",
        "partial",
        "myo_reps",
        "top_set",
        "back_off",
      ];
      const actual = SET_TYPES.map((m) => m.id).sort();
      expect(actual).toEqual([...expected].sort());
    });
  });

  describe("normalizeSetType", () => {
    it("returns the type as-is when valid", () => {
      expect(normalizeSetType("normal")).toBe("normal");
      expect(normalizeSetType("warmup")).toBe("warmup");
      expect(normalizeSetType("drop_set")).toBe("drop_set");
      expect(normalizeSetType("myo_reps")).toBe("myo_reps");
    });

    it("defaults to 'normal' for undefined", () => {
      expect(normalizeSetType(undefined)).toBe("normal");
    });

    it("defaults to 'normal' for null", () => {
      expect(normalizeSetType(null)).toBe("normal");
    });

    it("defaults to 'normal' for unknown strings", () => {
      expect(normalizeSetType("unknown_type")).toBe("normal");
      expect(normalizeSetType("")).toBe("normal");
      expect(normalizeSetType("WARMUP")).toBe("normal"); // case-sensitive
    });

    it("defaults to 'normal' for non-string values", () => {
      expect(normalizeSetType(123)).toBe("normal");
      expect(normalizeSetType({})).toBe("normal");
      expect(normalizeSetType(true)).toBe("normal");
    });
  });

  describe("getSetTypeMeta", () => {
    it("returns metadata for valid types", () => {
      const meta = getSetTypeMeta("warmup");
      expect(meta.id).toBe("warmup");
      expect(meta.labelEn).toBe("Warmup");
      expect(meta.countsInVolume).toBe(false);
      expect(meta.countsForPR).toBe(false);
    });

    it("falls back to 'normal' for unknown types", () => {
      const meta = getSetTypeMeta("nonexistent");
      expect(meta.id).toBe("normal");
    });

    it("falls back to 'normal' for undefined", () => {
      const meta = getSetTypeMeta(undefined);
      expect(meta.id).toBe("normal");
    });
  });

  describe("nextSetType (cycle)", () => {
    it("cycles to the next type in order", () => {
      expect(nextSetType("normal")).toBe(SET_TYPES[1].id);
      expect(nextSetType(SET_TYPES[0].id)).toBe(SET_TYPES[1].id);
      expect(nextSetType(SET_TYPES[1].id)).toBe(SET_TYPES[2].id);
    });

    it("wraps around from last to first", () => {
      const last = SET_TYPES[SET_TYPES.length - 1].id;
      expect(nextSetType(last)).toBe(SET_TYPES[0].id);
    });

    it("returns 'normal' for unknown input (starts cycle from beginning)", () => {
      expect(nextSetType("nonexistent" as SetType)).toBe("normal");
    });

    it("full cycle visits all 11 types exactly once", () => {
      let current: SetType = "normal";
      const visited: SetType[] = [current];
      for (let i = 0; i < SET_TYPES.length; i++) {
        current = nextSetType(current);
        visited.push(current);
      }
      // After 11 hops we should be back at "normal"
      expect(current).toBe("normal");
      // The 11 intermediate values should be unique (covers all types)
      const intermediates = visited.slice(1, -1);
      expect(new Set(intermediates).size).toBe(SET_TYPES.length - 1);
    });
  });

  describe("countsInVolume", () => {
    it("returns true for normal working sets", () => {
      expect(countsInVolume("normal")).toBe(true);
      expect(countsInVolume("top_set")).toBe(true);
      expect(countsInVolume("drop_set")).toBe(true);
      expect(countsInVolume("failure")).toBe(true);
      expect(countsInVolume("myo_reps")).toBe(true);
      expect(countsInVolume("partial")).toBe(true);
      expect(countsInVolume("right")).toBe(true);
      expect(countsInVolume("left")).toBe(true);
      expect(countsInVolume("back_off")).toBe(true);
    });

    it("returns false for warmup", () => {
      expect(countsInVolume("warmup")).toBe(false);
    });

    it("returns false for negative (eccentric-only, no concentric volume)", () => {
      expect(countsInVolume("negative")).toBe(false);
    });

    it("defaults to true for unknown types (treated as normal)", () => {
      expect(countsInVolume(undefined)).toBe(true);
      expect(countsInVolume("unknown")).toBe(true);
    });
  });

  describe("countsForPR", () => {
    it("returns true only for fresh, full-ROM working sets", () => {
      expect(countsForPR("normal")).toBe(true);
      expect(countsForPR("top_set")).toBe(true);
      expect(countsForPR("right")).toBe(true);
      expect(countsForPR("left")).toBe(true);
    });

    it("returns false for warmup", () => {
      expect(countsForPR("warmup")).toBe(false);
    });

    it("returns false for drop_set (post-failure)", () => {
      expect(countsForPR("drop_set")).toBe(false);
    });

    it("returns false for failure sets", () => {
      expect(countsForPR("failure")).toBe(false);
    });

    it("returns false for negative (eccentric-only)", () => {
      expect(countsForPR("negative")).toBe(false);
    });

    it("returns false for partial (shortened ROM)", () => {
      expect(countsForPR("partial")).toBe(false);
    });

    it("returns false for back_off (lighter back-off set)", () => {
      expect(countsForPR("back_off")).toBe(false);
    });

    it("returns false for myo_reps (rest-pause variant)", () => {
      expect(countsForPR("myo_reps")).toBe(false);
    });

    it("defaults to true for unknown types (treated as normal)", () => {
      expect(countsForPR(undefined)).toBe(true);
      expect(countsForPR("unknown")).toBe(true);
    });
  });

  describe("SET_TYPE_MAP", () => {
    it("contains all 11 types", () => {
      expect(SET_TYPE_MAP.size).toBe(11);
    });

    it("lookup matches SET_TYPES entries", () => {
      for (const meta of SET_TYPES) {
        expect(SET_TYPE_MAP.get(meta.id)).toBe(meta);
      }
    });
  });

  describe("backward compatibility (old sessions without setType)", () => {
    it("undefined setType is treated as normal and counts for both volume and PR", () => {
      // Simulates an old session row that predates the setType field.
      const oldSetType: unknown = undefined;
      expect(normalizeSetType(oldSetType)).toBe("normal");
      expect(countsInVolume(oldSetType)).toBe(true);
      expect(countsForPR(oldSetType)).toBe(true);
    });
  });
});
