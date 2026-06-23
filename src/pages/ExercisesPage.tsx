"use client";
import { useEffect, useState, useDeferredValue, useRef, useCallback, useMemo } from "react";
import { Link } from "@/router-shim";
import { motion, useReducedMotion } from "framer-motion";
import { Search, Dumbbell, ChevronRight, Loader2, X, Plus } from "lucide-react";
import { KineticEmptyState } from "@/components/ui-custom/KineticEmptyState";
import { Button } from "@/components/ui-custom/Button";
import { cn } from "@/utils/cn";
import { useExerciseStore } from "@/store/useExerciseStore";
import { SkeletonExerciseGrid } from "@/components/ui-custom/Skeleton";
import AnatomyMap from "@/components/AnatomyMap";
import { Drawer } from "vaul";
import { useTranslation } from "react-i18next";

// ── Custom Image Component ──
function ExerciseImage({ src, alt, equipment }: { src: string; alt: string; equipment: string }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden bg-bg-elevated/50">
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Dumbbell className="h-8 w-8 animate-pulse text-text-secondary/30" />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        className={cn(
          "h-full w-full object-cover transition-all duration-500 group-hover:scale-105 bg-white",
          isLoaded ? "opacity-100" : "opacity-0",
          hasError && "hidden"
        )}
      />
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-bg-elevated/30">
          <Dumbbell className="h-10 w-10 text-text-secondary/20" />
        </div>
      )}

      {/* Equipment Badge */}
      <span className="absolute bottom-2 left-2 rounded-[--radius-badge] bg-bg/80 px-2 py-1 text-xs font-medium text-text-primary backdrop-blur-md capitalize shadow-sm border border-border/50">
        {equipment}
      </span>
    </div>
  );
}

// ── Animation Variants ──
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.03 },
  },
  visibleNoStagger: {
    opacity: 1,
    transition: { staggerChildren: 0 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0 },
};

const ANATOMY_MAPPING: Record<string, string> = {
  // Chest
  "upper-chest": "chest",
  "mid-lower-chest": "chest",
  // Shoulders
  "front-delt": "shoulders",
  "lateral-delt": "shoulders",
  "post-delt": "shoulders",
  "lat-delt-back": "shoulders",
  // Back
  "lower-back": "back",
  lats: "back",
  "traps-mid": "back",
  "lower-traps": "back",
  // Arms
  "biceps-long": "upper arms",
  "biceps-short": "upper arms",
  "triceps-long": "upper arms",
  "triceps-lat": "upper arms",
  "triceps-med": "upper arms",
  "forearm-ext": "lower arms",
  "forearm-flex": "lower arms",
  "forearm-ext-back": "lower arms",
  "forearm-flex-back": "lower arms",
  // Waist/Abs
  "upper-abs": "waist",
  "lower-abs": "waist",
  obliques: "waist",
  // Legs
  "outer-quad": "upper legs",
  "rectus-femoris": "upper legs",
  vmo: "upper legs",
  adductors: "upper legs",
  "lateral-ham": "upper legs",
  "medial-ham": "upper legs",
  "glute-max": "upper legs",
  "glute-med": "upper legs",
  gastrocnemius: "lower legs",
  tibialis: "lower legs",
  soleus: "lower legs",
  "gastrocnemius-back": "lower legs",
  "soleus-back": "lower legs",
  // Misc
  neck: "neck",
  "neck-back": "neck",
  "upper-traps": "neck",
  "traps-back": "neck",
};

export default function ExercisesPage() {
  const { t, i18n } = useTranslation();
  // Individual selectors — bare useExerciseStore() subscribed to the entire
  // store (including 1324 exercises), causing re-renders on every state change.
  const exercises = useExerciseStore((s) => s.exercises);
  const filteredExercises = useExerciseStore((s) => s.filteredExercises);
  const isLoading = useExerciseStore((s) => s.isLoading);
  const error = useExerciseStore((s) => s.error);
  const filters = useExerciseStore((s) => s.filters);
  const loadExercises = useExerciseStore((s) => s.loadExercises);
  const setFilter = useExerciseStore((s) => s.setFilter);
  const addCustomExercise = useExerciseStore((s) => s.addCustomExercise);

  const [searchQuery, setSearchQuery] = useState("");
  const deferredQuery = useDeferredValue(searchQuery);
  const [visibleCount, setVisibleCount] = useState(30);
  const prefersReducedMotion = useReducedMotion();
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customExerciseData, setCustomExerciseData] = useState({
    name: "",
    bodyPart: "chest",
    equipment: "dumbbell",
    target: "chest",
    muscleGroup: "Chest",
    instructions: "",
  });

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customExerciseData.name.trim()) return;

    await addCustomExercise({
      name: customExerciseData.name.trim(),
      bodyPart: customExerciseData.bodyPart,
      equipment: customExerciseData.equipment,
      target: customExerciseData.target,
      muscleGroup: customExerciseData.muscleGroup,
      instructions: customExerciseData.instructions.trim(),
      instructionSteps: [customExerciseData.instructions.trim() || "Perform the exercise."],
      category: "strength",
      imageUrl: "",
      gifUrl: "",
      secondaryMuscles: [],
    });

    setCustomExerciseData({
      name: "",
      bodyPart: "chest",
      equipment: "dumbbell",
      target: "chest",
      muscleGroup: "Chest",
      instructions: "",
    });
    setShowCustomForm(false);
  };

  // Memoized highlighted muscle IDs for AnatomyMap
  const highlightedIds = useMemo(() => {
    const activeParts = Array.isArray(filters.bodyPart)
      ? filters.bodyPart
      : filters.bodyPart && filters.bodyPart !== "all"
        ? [filters.bodyPart]
        : [];
    return Object.keys(ANATOMY_MAPPING).filter((id) => activeParts.includes(ANATOMY_MAPPING[id]));
  }, [filters.bodyPart]);

  // Memoized handler for muscle selection
  const handleMuscleSelect = useCallback(
    (id: string, selectedIds: string[]) => {
      if (id === "all" || selectedIds.length === 0) {
        setFilter("bodyPart", "all");
      } else {
        const validBodyParts = Array.from(
          new Set(selectedIds.map((sid) => ANATOMY_MAPPING[sid] || sid))
        );
        setFilter("bodyPart", validBodyParts);
        setTimeout(() => {
          document
            .getElementById("exercise-results")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      }
    },
    [setFilter]
  );

  // Load exercises on mount
  useEffect(() => {
    loadExercises();
    try {
      const saved = localStorage.getItem("recentSearches");
      if (saved) setRecentSearches(JSON.parse(saved));
    } catch (e) {
      // Ignore localStorage read errors
    }
  }, [loadExercises]);

  const addRecentSearch = (query: string) => {
    if (!query.trim()) return;
    const nextSearches = [query, ...recentSearches.filter((s) => s !== query)].slice(0, 5);
    setRecentSearches(nextSearches);
    try {
      localStorage.setItem("recentSearches", JSON.stringify(nextSearches));
    } catch (e) {
      // Ignore localStorage write errors
    }
  };

  const handleSearchSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      addRecentSearch(searchQuery);
    }
  };

  // Update search filter when deferredQuery changes (debounced by useDeferredValue)
  useEffect(() => {
    setFilter("search", deferredQuery);
    setVisibleCount(30); // Reset visible count on search
  }, [deferredQuery, setFilter]);

  // Infinite scroll loader using IntersectionObserver
  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isLoading) return;
      if (observerRef.current) observerRef.current.disconnect();

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            setVisibleCount((prev) => Math.min(prev + 30, filteredExercises.length));
          }
        },
        { rootMargin: "200px" } // Prefetch early
      );

      if (node) observerRef.current.observe(node);
    },
    [isLoading, filteredExercises.length]
  );

  // ── Loading State ──
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary uppercase tracking-wider">
            Exercise Library
          </h1>
          <p className="mt-1 text-sm text-text-secondary">Loading exercises...</p>
        </div>
        <div className="flex items-center justify-center gap-2 py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-sm text-text-secondary">Loading 1300+ exercises...</span>
        </div>
        <SkeletonExerciseGrid />
      </div>
    );
  }

  // ── Error State ──
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <Dumbbell className="h-16 w-16 text-text-secondary" />
        <p className="text-lg font-bold text-text-primary">An Error Occurred</p>
        <p className="text-sm text-text-secondary">{error}</p>
        <Button onClick={() => loadExercises()} variant="primary" size="sm">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Page Title ── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text-primary uppercase tracking-wider">
            Exercise Library
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            {exercises.length}+ exercises with images/gifs
          </p>
        </div>
        <Button
          onClick={() => setShowCustomForm(true)}
          variant="outline"
          size="sm"
          icon={<Plus className="h-4 w-4" />}
          className="rounded-xl flex-shrink-0"
        >
          Create Custom
        </Button>
      </div>

      {/* ── Search Bar ── */}
      <div className="relative z-20">
        <div className="relative">
          <Search className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            placeholder="Search exercises... (e.g., bench press)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setTimeout(() => setIsSearchFocused(false), 150)}
            onKeyDown={handleSearchSubmit}
            className="w-full rounded-[--radius-card] border border-border bg-bg-card py-3 pl-4 pr-12 text-sm text-text-primary placeholder-text-muted outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
          />
        </div>

        {isSearchFocused && !searchQuery && recentSearches.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-bg-elevated border border-border rounded-xl shadow-lg overflow-hidden py-2">
            <div className="px-4 py-2 text-xs font-bold text-text-secondary uppercase tracking-wider">
              Recent Searches
            </div>
            {recentSearches.map((search) => (
              <button
                key={search}
                className="w-full text-left px-4 py-3 text-sm text-text-primary hover:bg-bg-surface-hover transition-colors flex items-center justify-between group"
                onClick={() => {
                  setSearchQuery(search);
                  addRecentSearch(search);
                }}
              >
                {search}
                <ChevronRight className="w-4 h-4 text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Quick Filter Chips ── */}
      <div className="flex overflow-x-auto pb-2 -mx-4 px-4 gap-2 no-scrollbar">
        <button
          onClick={() => setFilter("bodyPart", "all")}
          className={cn(
            "whitespace-nowrap px-4 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest transition-colors border",
            !filters.bodyPart || filters.bodyPart === "all"
              ? "bg-primary text-primary-text border-primary shadow-[0_0_12px_var(--c-primary-glow)]"
              : "bg-bg-elevated text-text-secondary border-border hover:border-border-active hover:text-text-primary"
          )}
        >
          All Muscles
        </button>
        {[
          "chest",
          "back",
          "shoulders",
          "upper arms",
          "lower arms",
          "waist",
          "upper legs",
          "lower legs",
          "cardio",
          "neck",
        ].map((part) => {
          const isActive = Array.isArray(filters.bodyPart)
            ? filters.bodyPart.includes(part)
            : filters.bodyPart === part;
          return (
            <button
              key={part}
              onClick={() => {
                setFilter("bodyPart", part);
              }}
              className={cn(
                "whitespace-nowrap px-4 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest transition-colors border",
                isActive
                  ? "bg-primary/20 text-primary border-primary/50 shadow-[0_0_12px_var(--c-primary-dim)]"
                  : "bg-bg-elevated text-text-secondary border-border hover:border-border-active hover:text-text-primary"
              )}
            >
              {part}
            </button>
          );
        })}
      </div>

      <div className="flex overflow-x-auto pb-2 -mx-4 px-4 gap-2 no-scrollbar">
        <button
          onClick={() => setFilter("equipment", "all")}
          className={cn(
            "whitespace-nowrap px-4 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest transition-colors border",
            !filters.equipment || filters.equipment === "all"
              ? "bg-primary text-primary-text border-primary"
              : "bg-bg-elevated text-text-secondary border-border hover:border-border-active hover:text-text-primary"
          )}
        >
          All Eqp
        </button>
        {["barbell", "dumbbell", "cable", "machine", "body weight", "kettlebell", "band"].map(
          (eq) => {
            const isActive = filters.equipment === eq;
            return (
              <button
                key={eq}
                onClick={() => {
                  setFilter("equipment", isActive ? "all" : eq);
                }}
                className={cn(
                  "whitespace-nowrap px-4 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest transition-colors border",
                  isActive
                    ? "bg-primary text-primary-text border-primary shadow-sm"
                    : "bg-bg-elevated text-text-secondary border-border hover:border-border-active hover:text-text-primary"
                )}
              >
                {eq}
              </button>
            );
          }
        )}
      </div>

      {/* ── Anatomy Filter ── */}
      <AnatomyMap highlightedMuscles={highlightedIds} onMuscleSelect={handleMuscleSelect} />

      {/* ── Exercise Count ── */}
      <div id="exercise-results" className="flex flex-col gap-2 pt-4 border-t border-border mt-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-text-secondary font-medium">
            {filteredExercises.length} Exercises
          </p>
        </div>

        {((filters.bodyPart && filters.bodyPart !== "all") ||
          (filters.equipment && filters.equipment !== "all")) && (
          <div className="flex flex-wrap items-center gap-2 sticky top-4 z-40 bg-bg-card/90 backdrop-blur-md py-2 border border-border shadow-md rounded-[--radius-button] px-3">
            <span className="text-xs text-text-secondary flex items-center font-bold tracking-widest uppercase">
              Showing:
            </span>

            {filters.bodyPart &&
              filters.bodyPart !== "all" &&
              (Array.isArray(filters.bodyPart) ? filters.bodyPart : [filters.bodyPart]).map(
                (bp) => (
                  <span
                    key={bp}
                    className="text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded flex items-center gap-1 font-bold uppercase tracking-wider"
                  >
                    {bp}
                    <button
                      className="hover:text-text-primary ml-0.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        const currentArray: string[] = Array.isArray(filters.bodyPart)
                          ? filters.bodyPart
                          : filters.bodyPart
                            ? [filters.bodyPart]
                            : [];
                        const nextArray = currentArray.filter((p) => p !== bp);
                        setFilter("bodyPart", nextArray.length > 0 ? nextArray : "all");
                      }}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )
              )}

            {filters.equipment && filters.equipment !== "all" && (
              <span className="text-xs bg-bg-elevated text-text-primary border border-border px-2 py-0.5 rounded flex items-center gap-1 font-bold uppercase tracking-wider">
                {filters.equipment}
                <button
                  className="hover:text-text-primary ml-0.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFilter("equipment", "all");
                  }}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            <button
              className="text-xs text-text-secondary hover:text-text-primary uppercase tracking-wider font-bold ml-auto"
              onClick={(e) => {
                e.stopPropagation();
                setFilter("bodyPart", "all");
                setFilter("equipment", "all");
              }}
            >
              Clear All
            </button>
          </div>
        )}
      </div>

      {/* ── Exercise Grid ── */}
      <motion.div
        className="grid grid-cols-2 gap-3 pb-8"
        variants={containerVariants}
        initial="hidden"
        animate={
          prefersReducedMotion
            ? "visibleNoStagger"
            : filteredExercises.length <= 40
              ? "visible"
              : "visibleNoStagger"
        }
        key="exercise-grid"
      >
        {filteredExercises.slice(0, visibleCount).map((exercise, index) => {
          const isLast = index === visibleCount - 1;
          return (
            <motion.div
              key={exercise.id}
              variants={prefersReducedMotion ? {} : itemVariants}
              ref={isLast ? lastElementRef : null}
              className="block h-full"
              style={{ contentVisibility: "auto", containIntrinsicSize: "auto 250px" }}
            >
              <Link
                to="/exercises/$exerciseId"
                params={{ exerciseId: exercise.id }}
                className="block h-full"
              >
                <div className="glass-card group relative overflow-hidden rounded-[--radius-card] transition-all duration-300 hover:ring-1 hover:ring-primary/30 active:scale-[0.97] h-full flex flex-col">
                  <ExerciseImage
                    src={exercise.imageUrl}
                    alt={exercise.name}
                    equipment={exercise.equipment}
                  />

                  {/* Exercise Info */}
                  <div className="p-4 flex-1 flex flex-col">
                    <h3 className="line-clamp-1 text-base font-bold text-text-primary transition-colors group-hover:text-primary capitalize">
                      {exercise.name}
                    </h3>
                    <p className="mt-1 text-xs text-text-secondary capitalize">
                      {exercise.target}
                    </p>
                    <div className="mt-auto pt-2 flex items-center gap-1">
                      <span className="rounded-full bg-primary-muted px-2 py-0.5 text-xs font-medium text-primary capitalize">
                        {exercise.bodyPart}
                      </span>
                    </div>
                  </div>

                  {/* Arrow indicator */}
                  <div className="absolute right-3 top-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <ChevronRight className="h-4 w-4 text-primary" />
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </motion.div>

      {/* ── Load More Hint ── */}
      {filteredExercises.length > visibleCount && (
        <p className="text-center text-xs text-text-secondary py-4">Loading more exercises...</p>
      )}

      {/* ── Empty State ── */}
      {filteredExercises.length === 0 && (
        <KineticEmptyState
          variant="custom"
          icon={Dumbbell}
          title="No Exercises Found"
          description="Try adjusting your filters or search term."
          actionLabel="Clear Filters"
          onAction={() => {
            setSearchQuery("");
            setFilter("search", "");
            setFilter("bodyPart", "all");
            setFilter("equipment", "all");
          }}
        />
      )}
      {/* ── Custom Exercise Creator Drawer ── */}
      <Drawer.Root open={showCustomForm} onOpenChange={setShowCustomForm}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90]" />
          <Drawer.Content className="fixed bottom-0 inset-x-0 mx-auto max-w-md max-h-[85vh] rounded-t-[2rem] bg-bg-card p-6 shadow-2xl flex flex-col z-[100] outline-none border border-border/50">
            <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-border" />

            <div className="flex items-center justify-between mb-4">
              <Drawer.Title className="font-bold text-base uppercase tracking-wider">
                Create Custom Exercise
              </Drawer.Title>
              <Drawer.Close asChild>
                <button className="p-2 rounded-full bg-bg-elevated text-text-secondary hover:text-text-primary transition-colors cursor-pointer">
                  <X className="h-4 w-4" />
                </button>
              </Drawer.Close>
            </div>

            <form
              onSubmit={handleCustomSubmit}
              className="space-y-4 pb-6 overflow-y-auto no-scrollbar"
            >
              <div>
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-1">
                  Exercise Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Incline Kettlebell Press"
                  value={customExerciseData.name}
                  onChange={(e) =>
                    setCustomExerciseData({ ...customExerciseData, name: e.target.value })
                  }
                  className="w-full rounded-xl border border-border bg-bg-elevated px-4 py-3 text-sm text-text-primary outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-1">
                    Muscle Group
                  </label>
                  <select
                    value={customExerciseData.bodyPart}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomExerciseData({
                        ...customExerciseData,
                        bodyPart: val,
                        muscleGroup: val.charAt(0).toUpperCase() + val.slice(1),
                        target: val,
                      });
                    }}
                    className="w-full rounded-xl border border-border bg-bg-elevated px-3 py-3 text-sm text-text-primary outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors cursor-pointer"
                  >
                    {[
                      "chest",
                      "back",
                      "shoulders",
                      "upper arms",
                      "lower arms",
                      "waist",
                      "upper legs",
                      "lower legs",
                      "cardio",
                      "neck",
                    ].map((part) => (
                      <option key={part} value={part} className="capitalize">
                        {part}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-1">
                    Equipment
                  </label>
                  <select
                    value={customExerciseData.equipment}
                    onChange={(e) =>
                      setCustomExerciseData({ ...customExerciseData, equipment: e.target.value })
                    }
                    className="w-full rounded-xl border border-border bg-bg-elevated px-3 py-3 text-sm text-text-primary outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors cursor-pointer"
                  >
                    {[
                      "dumbbell",
                      "barbell",
                      "cable",
                      "machine",
                      "body weight",
                      "kettlebell",
                      "band",
                    ].map((eq) => (
                      <option key={eq} value={eq} className="capitalize">
                        {eq}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-1">
                  Instructions (Optional)
                </label>
                <textarea
                  placeholder="Describe how to perform this exercise..."
                  value={customExerciseData.instructions}
                  onChange={(e) =>
                    setCustomExerciseData({ ...customExerciseData, instructions: e.target.value })
                  }
                  className="w-full min-h-[70px] resize-none rounded-xl border border-border bg-bg-elevated p-3 text-sm text-text-primary placeholder-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full py-3.5 text-xs uppercase tracking-widest font-black"
              >
                Create Exercise
              </Button>
            </form>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
}
