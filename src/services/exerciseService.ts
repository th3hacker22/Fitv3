import { type ExerciseRaw, type Exercise, transformExercise } from "@/types/exercise";

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
export function getBodyParts(exercises: Exercise[]): { id: string; label: string }[] {
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

// ── Tokenized search index (O(1) per token lookup) ──
// Builds a Map<token, Set<exerciseId>> once per exercise list, then reuses it
// for all subsequent searches. Replaces the O(N × Q) substring scan that ran
// on every keystroke.
interface SearchIndex {
  tokens: Map<string, Set<Exercise>>; // token → exercises containing it
  version: number; // bumped when the underlying exercise list changes
}

let _searchIndex: SearchIndex | null = null;
let _searchIndexExercisesRef: Exercise[] | null = null;

/** Tokenize a string into lowercase word-stems (very light stemming: trims 's'). */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length >= 2)
    .map((t) => (t.endsWith("s") && t.length > 3 ? t.slice(0, -1) : t));
}

/** Build (or rebuild) the search index for a given exercise list. */
function buildSearchIndex(exercises: Exercise[]): SearchIndex {
  const tokens = new Map<string, Set<Exercise>>();
  for (const ex of exercises) {
    const haystack = [ex.name, ex.target, ex.equipment, ex.bodyPart, ex.muscleGroup]
      .filter(Boolean)
      .join(" ");
    const exTokens = new Set(tokenize(haystack));
    for (const tok of exTokens) {
      let set = tokens.get(tok);
      if (!set) {
        set = new Set();
        tokens.set(tok, set);
      }
      set.add(ex);
    }
  }
  return { tokens, version: Date.now() };
}

/** Get or rebuild the search index — auto-detects when the exercise list changes. */
function getSearchIndex(exercises: Exercise[]): SearchIndex {
  if (_searchIndex && _searchIndexExercisesRef === exercises) {
    return _searchIndex;
  }
  _searchIndex = buildSearchIndex(exercises);
  _searchIndexExercisesRef = exercises;
  return _searchIndex;
}

/**
 * Tokenized search: returns exercises matching ALL query tokens.
 * Falls back to substring matching if no tokens match (single-token typo tolerance).
 */
function searchExercises(exercises: Exercise[], query: string): Exercise[] {
  const trimmed = query.trim();
  if (!trimmed) return exercises;

  const index = getSearchIndex(exercises);
  const queryTokens = tokenize(trimmed);
  if (queryTokens.length === 0) {
    // Query has no alphabetic tokens — fall back to substring scan
    const q = trimmed.toLowerCase();
    return exercises.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.target.toLowerCase().includes(q) ||
        e.equipment.toLowerCase().includes(q)
    );
  }

  // Intersect sets for each token — exercises containing ALL tokens rank first
  const candidateSets: Set<Exercise>[] = [];
  for (const tok of queryTokens) {
    const set = index.tokens.get(tok);
    if (set) candidateSets.push(set);
  }

  if (candidateSets.length === 0) {
    // No token matched — fall back to substring (handles partial-word queries)
    const q = trimmed.toLowerCase();
    return exercises.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.target.toLowerCase().includes(q) ||
        e.equipment.toLowerCase().includes(q)
    );
  }

  // Start with the smallest set, then intersect
  candidateSets.sort((a, b) => a.size - b.size);
  let result: Set<Exercise> | null = null;
  for (const set of candidateSets) {
    if (result === null) {
      result = new Set(set);
    } else {
      const next = new Set<Exercise>();
      for (const ex of set) {
        if (result.has(ex)) next.add(ex);
      }
      result = next;
    }
  }

  // If we matched only some tokens, also include exercises matching any token
  // (lower priority — appended after the AND matches)
  const andMatches = result ? Array.from(result) : [];
  if (candidateSets.length < queryTokens.length) {
    const anyMatchSet = new Set<Exercise>();
    for (const set of candidateSets) {
      for (const ex of set) anyMatchSet.add(ex);
    }
    // Append OR matches that aren't already in AND matches
    for (const ex of anyMatchSet) {
      if (!result || !result.has(ex)) andMatches.push(ex);
    }
  }

  return andMatches;
}

export function filterExercises(exercises: Exercise[], filters: ExerciseFilters): Exercise[] {
  // Pre-filter by search first (uses the O(1) token index), then apply the
  // cheap equality filters on the reduced candidate set.
  let candidates: Exercise[];
  if (filters.search && filters.search.trim()) {
    candidates = searchExercises(exercises, filters.search);
  } else {
    candidates = exercises;
  }

  return candidates.filter((exercise) => {
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

    return true;
  });
}

/** Invalidate the search index (call when exercises list changes). */
export function invalidateSearchIndex(): void {
  _searchIndex = null;
  _searchIndexExercisesRef = null;
}

// ── Get alternative exercises (same target muscle) ──
export function getAlternativeExercises(
  exercises: Exercise[],
  currentExerciseId: string,
  limit: number = 3
): Exercise[] {
  const current = exercises.find((e) => e.id === currentExerciseId);
  if (!current) return [];

  return exercises
    .filter((e) => e.id !== currentExerciseId && e.target === current.target)
    .slice(0, limit);
}

// ── Get exercises by IDs ──
export function getExercisesByIds(exercises: Exercise[], ids: string[]): Exercise[] {
  return ids
    .map((id) => exercises.find((e) => e.id === id))
    .filter((e): e is Exercise => e !== undefined);
}

// ── Get random exercises for quick workout ──
export function getRandomExercises(exercises: Exercise[], count: number = 5): Exercise[] {
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
    popularNames.some((name) => e.name.toLowerCase().includes(name.toLowerCase()))
  );
}
