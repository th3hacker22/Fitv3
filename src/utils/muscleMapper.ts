export function getMuscleIdsForExercise(target: string | null | undefined, secondaryMuscles: string[]): string[] {
  if (!target && (!secondaryMuscles || secondaryMuscles.length === 0)) return [];
  const ids = new Set<string>();

  const matches = (value: string, ...keywords: string[]) => {
    if (!value) return false;
    const v = value.toLowerCase();
    return keywords.some((k) => {
      if (k === "lat") {
        return /\b(lat|lats)\b/.test(v);
      }
      if (k === "quad") {
        return /\b(quad|quads|quadriceps)\b/.test(v);
      }
      if (k === "trap") {
        return /\b(trap|traps|trapezius)\b/.test(v);
      }
      if (k === "delt") {
        return /\b(delt|delts|deltoid|deltoids)\b/.test(v);
      }
      if (k === "bicep" || k === "tricep") {
        return new RegExp(`\\b${k}s?\\b`).test(v);
      }
      if (k === "chest") {
        return /\b(chest|pectorals?|pecs?)\b/.test(v);
      }
      if (k === "abs") {
        return /\b(abs|abdominals?)\b/.test(v);
      }

      const prefixRegex = new RegExp(`\\b${k}`, "i");
      return prefixRegex.test(v);
    });
  };

  const mapMuscle = (m: string) => {
    // Chest
    if (matches(m, "pectoral", "chest")) {
      if (matches(m, "upper")) {
        ids.add("upper-chest");
      } else if (matches(m, "lower")) {
        ids.add("mid-lower-chest");
      } else {
        ids.add("upper-chest");
        ids.add("mid-lower-chest");
      }
    }
    // Shoulders / Delts
    if (matches(m, "delt", "shoulder", "rotator cuff")) {
      if (matches(m, "rear", "post")) ids.add("post-delt");
      else if (matches(m, "front", "ant")) ids.add("front-delt");
      else if (matches(m, "lateral", "side")) {
        ids.add("lateral-delt");
        ids.add("lat-delt-back");
      } else {
        ids.add("front-delt");
        ids.add("lateral-delt");
        ids.add("lat-delt-back");
        ids.add("post-delt");
      }
    }
    // Traps / Back
    if (matches(m, "trap", "rhomboid", "levator scapulae")) {
      ids.add("upper-traps");
      ids.add("traps-back");
      ids.add("traps-mid");
      ids.add("lower-traps");
    }
    if (matches(m, "latissimus", "lats")) {
      ids.add("lats");
    }
    if (matches(m, "upper back")) {
      ids.add("traps-mid");
      ids.add("lower-traps");
      ids.add("lats");
    }
    if (matches(m, "lower back", "spine")) {
      ids.add("lower-back");
    }
    // General back (if it's just "back")
    if (m.toLowerCase().trim() === "back") {
      ids.add("lats");
      ids.add("traps-mid");
      ids.add("lower-traps");
      ids.add("lower-back");
    }

    // Arms
    if (matches(m, "bicep", "brachialis")) {
      ids.add("biceps-long");
      ids.add("biceps-short");
    }
    if (matches(m, "tricep")) {
      ids.add("triceps-long");
      ids.add("triceps-lat");
      ids.add("triceps-med");
    }
    if (matches(m, "forearm", "wrist", "grip", "hand")) {
      ids.add("forearm-ext");
      ids.add("forearm-flex");
      ids.add("forearm-ext-back");
      ids.add("forearm-flex-back");
    }

    // Core
    if (matches(m, "abs", "abdominal", "core")) {
      if (matches(m, "lower")) ids.add("lower-abs");
      else if (matches(m, "upper")) ids.add("upper-abs");
      else {
        ids.add("upper-abs");
        ids.add("lower-abs");
      }
    }
    if (matches(m, "oblique", "serratus")) {
      ids.add("obliques");
    }

    // Legs
    if (matches(m, "quad")) {
      ids.add("outer-quad");
      ids.add("rectus-femoris");
      ids.add("vmo");
    }
    if (matches(m, "hamstring", "rear thigh")) {
      ids.add("medial-ham");
      ids.add("lateral-ham");
    }
    if (matches(m, "glute")) {
      ids.add("glute-max");
      ids.add("glute-med");
    }
    if (matches(m, "adductor", "abductor", "inner thigh", "groin")) {
      ids.add("adductors");
    }
    if (matches(m, "calf", "soleus", "ankle", "feet")) {
      if (matches(m, "soleus")) {
        ids.add("soleus");
        ids.add("soleus-back");
      } else {
        ids.add("gastrocnemius");
        ids.add("gastroc-back");
        ids.add("soleus");
        ids.add("soleus-back");
      }
    }
    if (matches(m, "shin", "tibialis")) ids.add("tibialis");

    // Neck
    if (matches(m, "neck", "sternocleidomastoid")) {
      ids.add("neck");
      ids.add("neck-back");
    }
  };

  if (target) mapMuscle(target);
  if (secondaryMuscles) {
    secondaryMuscles.forEach(mapMuscle);
  }

  return Array.from(ids);
}
