"use client";
import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, TrendingUp } from "lucide-react";
import AnatomyMap from "@/components/AnatomyMap";
import type { Exercise } from "@/types/exercise";
import type { WorkoutSession } from "@/db";
import { getMuscleIdsForExercise } from "@/utils/muscleMapper";

interface MuscleVolumeMapProps {
  sessions: WorkoutSession[];
  exercises: Exercise[];
}

// Map muscle group names (from muscleGroupStats) to AnatomyMap muscle IDs
const MUSCLE_GROUP_TO_IDS: Record<string, string[]> = {
  Chest: ["upper-chest", "mid-lower-chest"],
  Back: ["lats", "traps-mid", "lower-traps", "lower-back"],
  Legs: ["outer-quad", "rectus-femoris", "vmo", "medial-ham", "lateral-ham", "glute-max", "glute-med", "gastrocnemius", "soleus"],
  Shoulders: ["front-delt", "lateral-delt", "post-delt"],
  Arms: ["biceps-long", "biceps-short", "triceps-long", "triceps-lat", "triceps-med", "forearm-ext", "forearm-flex"],
  Core: ["upper-abs", "lower-abs", "obliques"],
  Waist: ["upper-abs", "lower-abs", "obliques"],
  // Additional mappings for specific muscle groups
  "Pectorals": ["upper-chest", "mid-lower-chest"],
  "Lats": ["lats"],
  "Traps": ["upper-traps", "traps-mid", "lower-traps"],
  "Quads": ["outer-quad", "rectus-femoris", "vmo"],
  "Hamstrings": ["medial-ham", "lateral-ham"],
  "Glutes": ["glute-max", "glute-med"],
  "Calves": ["gastrocnemius", "soleus", "gastroc-back", "soleus-back"],
  "Biceps": ["biceps-long", "biceps-short"],
  "Triceps": ["triceps-long", "triceps-lat", "triceps-med"],
  "Delts": ["front-delt", "lateral-delt", "post-delt"],
  "Forearms": ["forearm-ext", "forearm-flex", "forearm-ext-back", "forearm-flex-back"],
  "Abductors": ["glute-med"],
  "Adductors": ["adductors"],
  "Neck": ["neck", "neck-back"],
};

// Reverse map: AnatomyMap muscle ID → display name
const MUSCLE_ID_TO_NAME: Record<string, string> = {
  "upper-chest": "Upper Chest",
  "mid-lower-chest": "Mid/Lower Chest",
  "lats": "Lats",
  "traps-mid": "Mid Traps",
  "lower-traps": "Lower Traps",
  "lower-back": "Lower Back",
  "outer-quad": "Outer Quad",
  "rectus-femoris": "Rectus Femoris",
  "vmo": "VMO",
  "medial-ham": "Medial Hamstring",
  "lateral-ham": "Lateral Hamstring",
  "glute-max": "Glute Max",
  "glute-med": "Glute Med",
  "gastrocnemius": "Gastrocnemius",
  "soleus": "Soleus",
  "front-delt": "Front Delt",
  "lateral-delt": "Lateral Delt",
  "post-delt": "Rear Delt",
  "biceps-long": "Biceps Long",
  "biceps-short": "Biceps Short",
  "triceps-long": "Triceps Long",
  "triceps-lat": "Triceps Lateral",
  "triceps-med": "Triceps Medial",
  "forearm-ext": "Forearm Extensors",
  "forearm-flex": "Forearm Flexors",
  "upper-abs": "Upper Abs",
  "lower-abs": "Lower Abs",
  "obliques": "Obliques",
  "upper-traps": "Upper Traps",
  "adductors": "Adductors",
  "neck": "Neck",
};

/**
 * Muscle Volume Map — visualizes training volume per muscle on the AnatomyMap.
 *
 * Replaces the basic RadarChart with an interactive anatomy visualization:
 * - High volume muscles glow lime neon
 * - Medium volume muscles glow cyan
 * - Low volume muscles are dim
 * - Imbalanced muscles (< 30% of max) get a red warning badge
 */
export default function MuscleVolumeMap({ sessions, exercises }: MuscleVolumeMapProps) {
  const [view, setView] = useState<"front" | "back">("front");

  // Calculate per-muscle volume from sessions
  const { volumePerMuscleId, maxVolume, muscleGroupVolumes, imbalanceMuscle } = useMemo(() => {
    const volumeMap = new Map<string, number>(); // muscleId → volume
    const groupVolumeMap = new Map<string, number>(); // group name → volume

    const completed = sessions.filter((s) => s.completed === true && !s.isFreeze);
    const exerciseMap = new Map(exercises.map((e) => [String(e.id), e]));

    for (const session of completed) {
      // Only look at sessions from the last 30 days
      const sessionDate = new Date(session.date);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      if (sessionDate < thirtyDaysAgo) continue;

      for (const ex of session.exercises) {
        const exerciseDef = exerciseMap.get(String(ex.exerciseId));
        if (!exerciseDef) continue;

        const completedSets = ex.sets.filter((s) => s.completed);
        if (completedSets.length === 0) continue;

        const exVolume = completedSets.reduce((sum, s) => sum + s.weight * s.reps, 0);

        // Map to AnatomyMap muscle IDs
        const muscleIds = getMuscleIdsForExercise(exerciseDef.target, exerciseDef.secondaryMuscles);
        for (const muscleId of muscleIds) {
          volumeMap.set(muscleId, (volumeMap.get(muscleId) || 0) + exVolume);
        }

        // Also track by muscle group name (for the summary)
        const groupName = exerciseDef.muscleGroup;
        groupVolumeMap.set(groupName, (groupVolumeMap.get(groupName) || 0) + exVolume);
      }
    }

    const max = Math.max(...volumeMap.values(), 1);

    // Build heatmap intensity (0-1)
    const heatmapIntensity: Record<string, number> = {};
    for (const [id, vol] of volumeMap) {
      heatmapIntensity[id] = vol / max;
    }

    // Find imbalanced muscle groups (< 30% of max group volume)
    const groupVolumes = Array.from(groupVolumeMap.entries())
      .map(([name, vol]) => ({ name, volume: vol, percent: (vol / Math.max(...groupVolumeMap.values(), 1)) * 100 }))
      .sort((a, b) => b.volume - a.volume);

    const maxGroupVol = Math.max(...groupVolumeMap.values(), 1);
    let imbalance: string | null = null;
    for (const g of groupVolumes) {
      if (g.percent < 30 && g.volume > 0) {
        imbalance = g.name;
        break;
      }
    }
    // Also check if any major group is completely missing
    const majorGroups = ["Chest", "Back", "Legs", "Shoulders"];
    for (const mg of majorGroups) {
      if (!groupVolumeMap.has(mg) || groupVolumeMap.get(mg) === 0) {
        imbalance = mg;
        break;
      }
    }

    return {
      volumePerMuscleId: volumeMap,
      maxVolume: max,
      muscleGroupVolumes: groupVolumes,
      imbalanceMuscle: imbalance,
    };
  }, [sessions, exercises]);

  // Build highlighted muscles (high volume = primary, medium = secondary)
  const { highlightedMuscles, secondaryHighlightedMuscles } = useMemo(() => {
    const primary: string[] = [];
    const secondary: string[] = [];
    for (const [id, vol] of volumePerMuscleId) {
      const intensity = vol / maxVolume;
      if (intensity > 0.6) primary.push(id);
      else if (intensity > 0.3) secondary.push(id);
    }
    return { highlightedMuscles: primary, secondaryHighlightedMuscles: secondary };
  }, [volumePerMuscleId, maxVolume]);

  // If no data, show empty state
  if (volumePerMuscleId.size === 0) {
    return (
      <div className="glass-card flex flex-col items-center justify-center rounded-2xl border border-border p-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-bg-elevated mb-3">
          <TrendingUp className="h-6 w-6 text-text-secondary" />
        </div>
        <p className="text-sm font-bold text-text-secondary uppercase tracking-wider">No Training Data</p>
        <p className="text-xs text-text-muted mt-1">Complete workouts to see your muscle distribution</p>
      </div>
    );
  }

  return (
    <div className="glass-card relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-border p-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-bold uppercase italic text-text-primary">Muscle Focus</h2>
          <span className="text-[9px] font-bold uppercase tracking-widest text-text-secondary">
            30 Day Distribution
          </span>
        </div>

        {/* Imbalance warning badge */}
        <AnimatePresence>
          {imbalanceMuscle && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-1 rounded-full border border-danger/30 bg-danger/10 px-2.5 py-1"
            >
              <AlertTriangle className="h-3 w-3 text-danger" />
              <span className="text-[9px] font-bold uppercase text-danger">
                {imbalanceMuscle} Imbalance
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* View toggle */}
      <div className="flex gap-1">
        <button
          onClick={() => setView("front")}
          className={`flex-1 rounded-lg py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${
            view === "front"
              ? "bg-primary text-black"
              : "bg-bg-elevated text-text-secondary hover:text-text-primary"
          }`}
        >
          Front
        </button>
        <button
          onClick={() => setView("back")}
          className={`flex-1 rounded-lg py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${
            view === "back"
              ? "bg-primary text-black"
              : "bg-bg-elevated text-text-secondary hover:text-text-primary"
          }`}
        >
          Back
        </button>
      </div>

      {/* AnatomyMap with volume heatmap */}
      <div className="rounded-2xl bg-bg-elevated/30 border border-border/50 p-2 min-h-[300px]">
        <AnatomyMap
          readOnly
          highlightedMuscles={highlightedMuscles}
          secondaryHighlightedMuscles={secondaryHighlightedMuscles}
        />
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-3 text-[9px] font-bold uppercase tracking-widest">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-primary" style={{ boxShadow: "0 0 6px rgba(204,255,0,0.5)" }} />
          High Volume
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-secondary/60" />
          Medium
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-bg-elevated border border-border" />
          Low / None
        </span>
      </div>

      {/* Volume breakdown by muscle group */}
      <div className="border-t border-border pt-3">
        <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-text-secondary">
          Volume Breakdown
        </h3>
        <div className="space-y-1.5 max-h-32 overflow-y-auto no-scrollbar">
          {muscleGroupVolumes.map((group, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-16 text-[10px] font-bold uppercase text-text-secondary truncate">
                {group.name}
              </span>
              <div className="flex-1 h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${
                    group.percent < 30 ? "bg-danger" : group.percent > 70 ? "bg-primary" : "bg-secondary"
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${group.percent}%` }}
                  transition={{ duration: 0.6, delay: i * 0.05 }}
                  style={{
                    boxShadow: group.percent > 70 ? "0 0 6px rgba(204,255,0,0.4)" : "none",
                  }}
                />
              </div>
              <span className="w-12 text-right text-[10px] font-bold tabular-nums text-text-primary">
                {group.volume >= 1000 ? `${(group.volume / 1000).toFixed(1)}K` : Math.round(group.volume)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
