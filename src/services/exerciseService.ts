import {
  type ExerciseRaw,
  type Exercise,
  transformExercise,
} from "@/types/exercise";

// ── GitHub Raw URL ──
const EXERCISES_JSON_URL =
  "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data/exercises.json";

// ── Cache Key ──
const CACHE_KEY = "pulse_exercises_cache";
const CACHE_EXPIRY_KEY = "pulse_exercises_cache_expiry";
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// ── Fetch all exercises from GitHub ──
export async function fetchExercisesFromGitHub(): Promise<Exercise[]> {
  try {
    // Check cache first
    const cached = getCachedExercises();
    if (cached) {
      console.log("Using cached exercises data");
      return cached;
    }

    console.log("Fetching exercises from GitHub...");
    const response = await fetch(EXERCISES_JSON_URL);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const rawExercises: ExerciseRaw[] = await response.json();
    const exercises = rawExercises.map(transformExercise);

    // Cache the result
    cacheExercises(exercises);

    console.log(`Loaded ${exercises.length} exercises from GitHub`);
    return exercises;
  } catch (error) {
    console.error("Failed to fetch exercises from GitHub:", error);

    // Try to return cached data even if expired
    const expired = localStorage.getItem(CACHE_KEY);
    if (expired) {
      return JSON.parse(expired);
    }

    return [];
  }
}

// ── Cache helpers ──
function getCachedExercises(): Exercise[] | null {
  try {
    const expiry = localStorage.getItem(CACHE_EXPIRY_KEY);
    if (!expiry || Date.now() > parseInt(expiry)) {
      return null;
    }

    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    return JSON.parse(cached);
  } catch {
    return null;
  }
}

function cacheExercises(exercises: Exercise[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(exercises));
    localStorage.setItem(CACHE_EXPIRY_KEY, String(Date.now() + CACHE_DURATION));
  } catch (error) {
    console.error("Failed to cache exercises:", error);
  }
}

// ── Get unique body parts ──
export function getBodyParts(
  exercises: Exercise[],
): { id: string; label: string }[] {
  const unique = [...new Set(exercises.map((e) => e.bodyPart))];
  return unique.map((bp) => ({
    id: bp,
    label: bp,
  }));
}

// ── Get unique equipment ──
export function getEquipmentTypes(exercises: Exercise[]): string[] {
  return [...new Set(exercises.map((e) => e.equipment))];
}

// ── Get unique target muscles ──
export function getTargetMuscles(exercises: Exercise[]): string[] {
  return [...new Set(exercises.map((e) => e.target))];
}

// ── Filter exercises ──
export interface ExerciseFilters {
  bodyPart?: string | string[];
  equipment?: string;
  target?: string;
  search?: string;
}

export function filterExercises(
  exercises: Exercise[],
  filters: ExerciseFilters,
): Exercise[] {
  return exercises.filter((exercise) => {
    // Body part filter
    if (filters.bodyPart && filters.bodyPart !== "all") {
      if (Array.isArray(filters.bodyPart)) {
        if (filters.bodyPart.length > 0 && !filters.bodyPart.includes(exercise.bodyPart)) {
          return false;
        }
      } else if (exercise.bodyPart !== filters.bodyPart) {
        return false;
      }
    }

    // Equipment filter
    if (filters.equipment && filters.equipment !== "all") {
      if (exercise.equipment !== filters.equipment) return false;
    }

    // Target muscle filter
    if (filters.target && filters.target !== "all") {
      if (exercise.target !== filters.target) return false;
    }

    // Search filter
    if (filters.search && filters.search.trim()) {
      const query = filters.search.toLowerCase();
      const matchesName = exercise.name.toLowerCase().includes(query);
      const matchesMuscle = exercise.target.toLowerCase().includes(query);
      const matchesEquipment = exercise.equipment.toLowerCase().includes(query);
      if (!matchesName && !matchesMuscle && !matchesEquipment) return false;
    }

    return true;
  });
}

// ── Get alternative exercises (same target muscle) ──
export function getAlternativeExercises(
  exercises: Exercise[],
  currentExerciseId: string,
  limit: number = 3,
): Exercise[] {
  const current = exercises.find((e) => e.id === currentExerciseId);
  if (!current) return [];

  return exercises
    .filter((e) => e.id !== currentExerciseId && e.target === current.target)
    .slice(0, limit);
}

// ── Get exercises by IDs ──
export function getExercisesByIds(
  exercises: Exercise[],
  ids: string[],
): Exercise[] {
  return ids
    .map((id) => exercises.find((e) => e.id === id))
    .filter((e): e is Exercise => e !== undefined);
}

// ── Get random exercises for quick workout ──
export function getRandomExercises(
  exercises: Exercise[],
  count: number = 5,
): Exercise[] {
  const shuffled = [...exercises].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// ── Get popular exercises (common gym exercises) ──
export function getPopularExercises(exercises: Exercise[]): Exercise[] {
  const popularNames = [
    "barbell bench press",
    "barbell squat",
    "barbell deadlift",
    "dumbbell curl",
    "pull-up",
    "push-up",
    "dumbbell shoulder press",
    "lat pulldown",
    "leg press",
    "barbell row",
    "cable triceps pushdown",
    "dumbbell lateral raise",
  ];

  return exercises.filter((e) =>
    popularNames.some((name) =>
      e.name.toLowerCase().includes(name.toLowerCase()),
    ),
  );
}
