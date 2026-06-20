/**
 * Movement Pattern Classifier.
 *
 * Categorizes exercises by fundamental movement patterns so the generator
 * can balance them across a training week (e.g., equal horizontal push/pull).
 *
 * Patterns (11 total):
 *   horizontal-push   horizontal-pull   vertical-push   vertical-pull
 *   knee-flexion      knee-extension    hip-hinge       hip-abduction
 *   elbow-flexion     elbow-extension   core-flexion    core-anti-rotation
 */

import type { Exercise } from "@/types/exercise";

export type MovementPattern =
  | "horizontal-push"
  | "horizontal-pull"
  | "vertical-push"
  | "vertical-pull"
  | "knee-flexion"
  | "knee-extension"
  | "hip-hinge"
  | "hip-abduction"
  | "elbow-flexion"
  | "elbow-extension"
  | "core-flexion"
  | "core-anti-rotation"
  | "other";

interface Rule {
  pattern: MovementPattern;
  nameKeywords: string[];
  targetKeywords: string[];
  equipment?: string[];
}

// Rules evaluated top-down; first match wins.
const RULES: Rule[] = [
  // Push patterns
  {
    pattern: "horizontal-push",
    nameKeywords: ["bench press", "push up", "pushup", "dumbbell press", "chest press", "fly"],
    targetKeywords: ["chest", "pectorals"],
  },
  {
    pattern: "vertical-push",
    nameKeywords: ["overhead press", "shoulder press", "military press", "lateral raise", "side raise", "arnold press"],
    targetKeywords: ["delts", "shoulders"],
  },
  // Pull patterns
  {
    pattern: "horizontal-pull",
    nameKeywords: ["row", "seated row", "bent over", "pendlay", "t-bar"],
    targetKeywords: ["back", "lats", "rhomboids"],
  },
  {
    pattern: "vertical-pull",
    nameKeywords: ["pull up", "pullup", "chin up", "chinup", "lat pulldown", "pulldown"],
    targetKeywords: ["lats"],
  },
  // Lower body
  {
    pattern: "knee-flexion",
    nameKeywords: ["leg curl", "hamstring curl", "glute ham", "nordic"],
    targetKeywords: ["hamstrings"],
  },
  {
    pattern: "knee-extension",
    nameKeywords: ["leg extension", "squat", "lunge", "split squat", "leg press", "hack squat", "goblet", "step up", "stepup", "pistol"],
    targetKeywords: ["quads", "quadriceps"],
  },
  {
    pattern: "hip-hinge",
    nameKeywords: ["deadlift", "rdl", "romanian deadlift", "good morning", "kettlebell swing", "hip thrust", "back extension", "reverse hyper"],
    targetKeywords: ["glutes", "lower back", "hamstrings"],
  },
  {
    pattern: "hip-abduction",
    nameKeywords: ["abduction", "adduction", "side lying", "clam", "cable kick", "hip abductor", "hip adductor"],
    targetKeywords: ["abductors", "adductors", "glute med"],
  },
  // Arms
  {
    pattern: "elbow-flexion",
    nameKeywords: ["curl", "preacher", "hammer curl", "concentration"],
    targetKeywords: ["biceps"],
  },
  {
    pattern: "elbow-extension",
    nameKeywords: ["extension", "skullcrusher", "kickback", "tricep pushdown", "french press", "overhead tricep"],
    targetKeywords: ["triceps"],
  },
  // Core
  {
    pattern: "core-flexion",
    nameKeywords: ["crunch", "sit up", "situp", "leg raise", "knee raise", "v-up", "toe touch", "hanging raise"],
    targetKeywords: ["abs", "abdominals"],
  },
  {
    pattern: "core-anti-rotation",
    nameKeywords: ["plank", "side plank", "pallof", "dead bug", "bird dog", "anti-rotation", "hollow hold"],
    targetKeywords: ["core", "obliques"],
  },
];

/** Classify an exercise into a movement pattern. */
export function classifyMovementPattern(exercise: Exercise): MovementPattern {
  const name = exercise.name.toLowerCase();
  const target = exercise.target.toLowerCase();
  const equipment = exercise.equipment.toLowerCase();

  for (const rule of RULES) {
    const nameMatch = rule.nameKeywords.some((kw) => name.includes(kw));
    const targetMatch = rule.targetKeywords.some((kw) => target.includes(kw));
    const equipMatch = rule.equipment
      ? rule.equipment.some((kw) => equipment.includes(kw))
      : true;

    if ((nameMatch || targetMatch) && equipMatch) {
      return rule.pattern;
    }
  }

  return "other";
}

/** Antagonistic pattern pairs — for superset matching. */
export const ANTAGONISTIC_PATTERN_PAIRS: Array<[MovementPattern, MovementPattern]> = [
  ["horizontal-push", "horizontal-pull"],
  ["vertical-push", "vertical-pull"],
  ["elbow-flexion", "elbow-extension"],
  ["knee-flexion", "knee-extension"],
  ["hip-hinge", "knee-extension"],
];

/** Returns true if two patterns form an antagonistic pair. */
export function areAntagonisticPatterns(
  a: MovementPattern,
  b: MovementPattern
): boolean {
  return ANTAGONISTIC_PATTERN_PAIRS.some(
    ([x, y]) => (x === a && y === b) || (x === b && y === a)
  );
}
