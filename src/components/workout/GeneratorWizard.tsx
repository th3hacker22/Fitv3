"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Minus,
  Plus,
  SkipForward,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";
import { useGeneratorStore } from "@/store/useGeneratorStore";
import { useExerciseStore } from "@/store/useExerciseStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import AnatomyMap from "@/components/AnatomyMap";
import { generateProgram } from "@/services/workoutGenerator";
import { useRouter } from "@/router";
import { Button } from "@/components/ui-custom/Button";
import { Skeleton } from "@/components/ui-custom/Skeleton";

// ═══════════════════════════════════════════════════════════════
// 5-STEP WIZARD (reduced from 14 steps)
// ═══════════════════════════════════════════════════════════════
const STEPS = ["Goal & Experience", "Schedule & Equipment", "Muscles & Style", "Health & Safety", "Review"];

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}

// ── Option Button (hoisted to module scope) ──
function OptionBtn({
  active,
  onClick,
  label,
  desc,
  compact,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  desc?: string;
  compact?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full border rounded-xl transition-all",
        compact ? "p-3 text-center" : "p-4 mb-2.5 last:mb-0 text-center",
        active
          ? "border-primary bg-primary/10 text-primary shadow-[0_0_15px_var(--c-primary-glow)]"
          : "border-border bg-bg-elevated text-text-secondary hover:border-border-active hover:text-text-primary"
      )}
    >
      <div className={cn("font-bold tracking-wide uppercase", compact ? "text-xs" : "text-sm")}>
        {label}
      </div>
      {desc && (
        <div className={cn("text-xs mt-0.5", active ? "text-primary/80" : "text-text-secondary/70")}>
          {desc}
        </div>
      )}
    </button>
  );
}

// ── Age Stepper (replaces slider — more precise on mobile) ──
function AgeStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <div className="flex items-center gap-6">
        <button
          onClick={() => onChange(Math.max(13, value - 1))}
          aria-label="Decrease age by 1"
          className="flex h-12 w-12 items-center justify-center rounded-xl bg-bg-elevated border border-border text-text-primary hover:bg-bg-surface-hover active:scale-95 transition-all"
        >
          <Minus className="h-5 w-5" aria-hidden="true" />
          <span className="sr-only">-1</span>
        </button>

        <div className="flex flex-col items-center min-w-[100px]">
          <input
            type="number"
            value={value}
            onChange={(e) => {
              const v = parseInt(e.target.value) || 0;
              onChange(Math.min(100, Math.max(13, v)));
            }}
            aria-label="Age in years"
            className="w-20 bg-transparent text-center text-5xl font-black italic text-primary outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-xs text-text-secondary uppercase tracking-wider font-bold">years old</span>
        </div>

        <button
          onClick={() => onChange(Math.min(100, value + 1))}
          aria-label="Increase age by 1"
          className="flex h-12 w-12 items-center justify-center rounded-xl bg-bg-elevated border border-border text-text-primary hover:bg-bg-surface-hover active:scale-95 transition-all"
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
          <span className="sr-only">+1</span>
        </button>
      </div>
      <p className="text-xs text-text-secondary text-center max-w-[250px] leading-relaxed">
        Age helps us calibrate intensity, volume tolerance, and recovery recommendations.
      </p>
    </div>
  );
}

// ── Smart defaults based on goal ──
function applySmartDefaults(
  goal: string,
  profile: ReturnType<typeof useGeneratorStore.getState>
) {
  const updates: Partial<ReturnType<typeof useGeneratorStore.getState>> = {};
  switch (goal) {
    case "Strength":
      updates.daysPerWeek = 4;
      updates.sessionLengthMin = 75;
      updates.repBiasOverride = "low";
      break;
    case "Hypertrophy":
    case "Recomp":
      updates.daysPerWeek = 4;
      updates.sessionLengthMin = 60;
      updates.repBiasOverride = "moderate";
      break;
    case "Fat Loss":
      updates.daysPerWeek = 3;
      updates.sessionLengthMin = 45;
      updates.includeCardio = true;
      updates.repBiasOverride = "high";
      break;
    case "Endurance":
      updates.daysPerWeek = 5;
      updates.sessionLengthMin = 60;
      updates.repBiasOverride = "high";
      break;
    case "General Fitness":
      updates.daysPerWeek = 3;
      updates.sessionLengthMin = 45;
      updates.repBiasOverride = "moderate";
      break;
  }
  profile.updateProfile(updates);
}

export const GeneratorWizard = () => {
  const navigate = useRouter((s) => s.navigate);
  const [currentStep, setCurrentStep] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  const profile = useGeneratorStore();
  const exercises = useExerciseStore((s) => s.exercises);
  const loadExercises = useExerciseStore((s) => s.loadExercises);
  const weightUnit = useSettingsStore((s) => s.weightUnit);

  useEffect(() => {
    loadExercises();
  }, [loadExercises]);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) setCurrentStep(currentStep + 1);
  };
  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const handleGenerate = async () => {
    if (exercises.length === 0) return;
    setIsGenerating(true);
    try {
      // ── Try AI Coach first (reads user's complete data) ──
      // If AI is unavailable, falls back to heuristic generateProgram.
      const { generateWorkoutAICoach } = await import("@/services/aiWorkoutService");

      // Gather user's complete data from IndexedDB
      let userData: {
        recentSessions: Array<{
          date: string;
          name: string;
          exercises: Array<{
            exerciseId: string;
            exerciseName: string;
            sets: Array<{ weight: number; reps: number; completed: boolean }>;
          }>;
          duration: number;
          completed: boolean;
        }>;
        personalRecords: Array<{
          exerciseId: string;
          exerciseName: string;
          maxWeight: number;
          max1RM: number;
          date: string;
        }>;
        analytics: {
          streak: number;
          totalWorkouts: number;
          totalVolume: number;
          totalDuration: number;
          muscleGroupStats: Array<{ muscle: string; volume: number }>;
          weeklyTonnage: Array<{ week: string; tonnage: number }>;
        };
      } = {
        recentSessions: [],
        personalRecords: [],
        analytics: {
          streak: 0,
          totalWorkouts: 0,
          totalVolume: 0,
          totalDuration: 0,
          muscleGroupStats: [],
          weeklyTonnage: [],
        },
      };

      try {
        const { db, getWorkoutStreak, getPersonalRecords, getTotalStats, getMuscleGroupStats, getWeeklyTonnage } =
          await import("@/db");
        const [sessions, prs, streak, stats, muscleStats, tonnage] = await Promise.all([
          db.workoutSessions.filter((s) => s.completed === true).reverse().limit(10).toArray(),
          getPersonalRecords(),
          getWorkoutStreak(),
          getTotalStats(),
          getMuscleGroupStats(exercises),
          getWeeklyTonnage(4),
        ]);

        userData = {
          recentSessions: sessions.map((s) => ({
            date: s.date,
            name: s.name,
            exercises: s.exercises.map((e) => ({
              exerciseId: String(e.exerciseId),
              exerciseName: e.exerciseName,
              sets: e.sets.map((set) => ({
                weight: set.weight,
                reps: set.reps,
                completed: set.completed,
              })),
            })),
            duration: s.duration,
            completed: s.completed,
          })),
          personalRecords: prs.map((pr) => ({ ...pr, exerciseId: String(pr.exerciseId) })),
          analytics: {
            streak,
            totalWorkouts: stats.totalWorkouts,
            totalVolume: stats.totalVolume,
            totalDuration: stats.totalDuration,
            muscleGroupStats: muscleStats,
            weeklyTonnage: tonnage,
          },
        };
      } catch (err) {
        console.warn("Could not load user data for AI coach, using profile only:", err);
      }

      // Build the AI profile from the wizard
      const aiProfile = {
        gender: profile.gender,
        age: profile.age,
        goal: profile.goal,
        fitnessLevel: profile.fitnessLevel,
        trainingYears: profile.trainingYears,
        equipment: profile.equipment,
        priorityMuscles: profile.priorityMuscles,
        physiqueFocus: profile.physiqueFocus,
        injuries: profile.injuries,
        medicalCautions: profile.medicalCautions,
        mobilityLimited: profile.mobilityLimited,
        daysPerWeek: profile.daysPerWeek,
        sessionLengthMin: profile.sessionLengthMin,
        intensityStyle: profile.intensityStyle,
        includeCardio: profile.includeCardio,
        includeWarmup: profile.includeWarmup,
        includeCoreFinisher: profile.includeCoreFinisher,
        bodyFatLevel: profile.bodyFatLevel,
        heightCm: profile.heightCm,
        weightKg: profile.weightKg,
      };

      const result = await generateWorkoutAICoach(
        aiProfile,
        exercises,
        userData,
        `Generate a ${profile.goal} workout for ${profile.daysPerWeek} days/week, ${profile.sessionLengthMin} min/session`
      );

      // Convert AI routine to program format — create ALL days based on daysPerWeek
      const daysPerWeek = profile.daysPerWeek;
      const splitNames = ["Push", "Pull", "Legs", "Upper", "Lower", "Full Body"];
      const weeklyDays = Array.from({ length: daysPerWeek }, (_, i) => ({
        name: `Day ${i + 1} — ${splitNames[i % splitNames.length]}`,
        focus: profile.priorityMuscles.length > 0 ? profile.priorityMuscles : ["Full Body"],
        exercises: result.routine.exercises.map((e, idx) => ({
          exercise: e.exercise,
          sets: e.sets,
          reps: e.reps,
          restSeconds: e.restSeconds || 90,
          tempo: "2-0-1",
          role: (idx === 0 ? "compound" : "isolation") as "compound" | "isolation",
          note: e.progression,
        })),
        estimatedMinutes: profile.sessionLengthMin,
      }));

      const program = {
        title: `${profile.goal || "Custom"} AI Program`,
        summary: `Personalized by AI Coach (via ${result.provider}). Analyzed ${userData.recentSessions.length} recent sessions.`,
        weeklyDays,
        progressionModel: "AI-driven progressive overload based on your training history",
        warnings: profile.injuries.length > 0 && profile.injuries[0] !== "none"
          ? [`Program optimized to avoid aggravating: ${profile.injuries.join(", ")}`]
          : ["Always consult a physical therapist before beginning a new strenuous routine."],
      };

      profile.setProgram(program);
      profile.updateProfile({ generatorSeed: Math.random() });
      navigate("generator-result");
    } catch (error) {
      console.error("Generation failed, falling back to heuristic:", error);
      // Fallback to heuristic — pass RAW sessions to the new ACWR + RPE engines.
      // The engines build exercise history + fatigue assessment internally,
      // preserving RPE / estimated1RM / set-completion data that the simplified
      // userData.recentSessions shape would have lost.
      const { generateProgram } = await import("@/services/workoutGenerator");

      let rawSessions: import("@/db/schema").WorkoutSession[] = [];
      try {
        const { db } = await import("@/db");
        // Fetch up to 30 completed sessions — enough for ACWR (28-day chronic window)
        // and 3-session trend detection.
        rawSessions = await db.workoutSessions
          .filter((s) => s.completed === true)
          .reverse()
          .limit(30)
          .toArray();
      } catch (dbErr) {
        console.warn("Could not load raw sessions for engine:", dbErr);
      }

      // Build exerciseMap for per-muscle volume lookup.
      const exerciseMap = new Map(exercises.map((e) => [String(e.id), e]));

      // ── Load Learning Loop preferences (best-effort, non-blocking) ──
      let learningLoop: import("@/services/learningLoop").LearningLoopSummary | undefined = undefined;
      try {
        const { buildLearningLoopSummary } = await import("@/services/learningLoop");
        learningLoop = await buildLearningLoopSummary(90);
      } catch (llErr) {
        console.warn("Could not load learning loop summary:", llErr);
      }

      const program = generateProgram(exercises, profile, {
        sessions: rawSessions,
        exerciseMap,
        learningLoop,
      });
      profile.setProgram(program);
      profile.updateProfile({ generatorSeed: Math.random() });
      navigate("generator-result");
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Estimated workout preview ──
  const estimatedMinutes = profile.sessionLengthMin;
  const estimatedExercises = Math.max(3, Math.min(8, Math.floor(profile.sessionLengthMin / 10)));
  const estimatedVolume = estimatedExercises * 3 * 10; // rough estimate

  const renderStep = () => {
    switch (currentStep) {
      // ═══════════════════════════════════════════════════
      // STEP 1: Goal & Experience (merged 7 → 1)
      // ═══════════════════════════════════════════════════
      case 0:
        return (
          <div className="space-y-6">
            {/* Gender + Age in a compact row */}
            <div>
              <h2 className="text-xl font-black italic tracking-tight uppercase mb-1">
                Tell us about you
              </h2>
              <p className="text-xs text-text-secondary mb-4">
                We'll use this to personalize your workout plan.
              </p>

              {/* Gender toggle */}
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-2">
                Biological Gender
              </label>
              <div className="flex gap-3 mb-6">
                {(["male", "female"] as const).map((g) => (
                  <OptionBtn
                    key={g}
                    compact
                    active={profile.gender === g}
                    onClick={() => profile.updateProfile({ gender: g })}
                    label={g}
                  />
                ))}
              </div>

              {/* Age stepper */}
              <label htmlFor="age-stepper" className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-1">
                Your Age
              </label>
              <AgeStepper value={profile.age} onChange={(v) => profile.updateProfile({ age: v })} />
            </div>

            {/* Goal */}
            <div>
              <h2 className="text-base font-black italic tracking-tight uppercase mb-3">
                Primary Goal
              </h2>
              <div className="grid grid-cols-1 gap-2">
                {([
                  ["Strength", "Build raw power and lift heavier"],
                  ["Hypertrophy", "Maximize muscle growth and size"],
                  ["Fat Loss", "Burn fat while preserving muscle"],
                  ["Recomp", "Build muscle and lose fat simultaneously"],
                  ["General Fitness", "Stay active and feel great"],
                  ["Endurance", "Improve stamina and conditioning"],
                ] as const).map(([g, desc]) => (
                  <OptionBtn
                    key={g}
                    active={profile.goal === g}
                    onClick={() => {
                      profile.updateProfile({ goal: g });
                      applySmartDefaults(g, profile);
                    }}
                    label={g}
                    desc={desc}
                  />
                ))}
              </div>
            </div>

            {/* Experience */}
            <div>
              <h2 className="text-base font-black italic tracking-tight uppercase mb-3">
                Experience Level
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {(["Novice", "Beginner", "Intermediate", "Advanced"] as const).map((l) => (
                  <OptionBtn
                    key={l}
                    compact
                    active={profile.fitnessLevel === l}
                    onClick={() =>
                      profile.updateProfile({
                        fitnessLevel: l,
                        trainingYears:
                          l === "Novice" ? 0 : l === "Beginner" ? 1 : l === "Intermediate" ? 3 : 6,
                      })
                    }
                    label={l}
                  />
                ))}
              </div>
            </div>
          </div>
        );

      // ═══════════════════════════════════════════════════
      // STEP 2: Schedule & Equipment (merged 3 → 1)
      // ═══════════════════════════════════════════════════
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black italic tracking-tight uppercase mb-1">
                Schedule & Equipment
              </h2>
              <p className="text-xs text-text-secondary mb-4">
                Smart defaults applied based on your goal ({profile.goal}).
              </p>
            </div>

            {/* Days per week */}
            <div>
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-2">
                Days Per Week
              </label>
              <div className="grid grid-cols-5 gap-2">
                {([2, 3, 4, 5, 6] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => profile.updateProfile({ daysPerWeek: d })}
                    className={cn(
                      "py-4 border rounded-xl text-2xl font-black italic transition-all relative",
                      profile.daysPerWeek === d
                        ? "bg-primary/20 border-primary text-primary"
                        : "border-border text-text-secondary bg-bg-elevated hover:text-text-primary"
                    )}
                  >
                    {d}
                    {[3, 4, 5].includes(d) && (
                      <span className="absolute -top-2 -right-1 text-[8px] font-black uppercase tracking-widest text-primary bg-primary/10 px-1 py-0.5 rounded border border-primary/30">
                        ✓
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-text-muted mt-1.5 text-center">3-5 days recommended for optimal results</p>
            </div>

            {/* Commitment Psychology — "How long can you commit?" */}
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-3">
                How long can you commit? 🎯
              </label>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {([
                  { val: 1, label: "1 Month", desc: "Quick start" },
                  { val: 3, label: "3 Months", desc: "Real progress" },
                  { val: 12, label: "1 Year", desc: "Total transform" },
                ] as const).map((c) => (
                  <button
                    key={c.val}
                    onClick={() => profile.updateProfile({ generatorSeed: profile.generatorSeed })} // no-op; visual only
                    className={cn(
                      "py-3 border rounded-xl text-center transition-all",
                      c.val === 3
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-text-secondary bg-bg-elevated hover:text-text-primary"
                    )}
                  >
                    <div className="text-sm font-black italic">{c.label}</div>
                    <div className="text-[9px] uppercase tracking-widest mt-0.5">{c.desc}</div>
                  </button>
                ))}
              </div>
              {/* Visual comparison chart — 3 months >> few weeks */}
              <div className="flex items-end gap-2 h-16">
                <div className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full rounded-t bg-text-secondary/20" style={{ height: "20%" }} />
                  <span className="text-[9px] font-bold uppercase text-text-secondary">Weeks</span>
                </div>
                <div className="flex-1 flex flex-col items-center gap-1">
                  <motion.div
                    className="w-full rounded-t bg-primary"
                    style={{ boxShadow: "0 0 10px rgba(204,255,0,0.3)" }}
                    initial={{ height: 0 }}
                    animate={{ height: "100%" }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                  />
                  <span className="text-[9px] font-bold uppercase text-primary">3 Months</span>
                </div>
              </div>
              <p className="text-[10px] text-center text-text-secondary mt-2">
                3 months builds real, lasting progress. 💪
              </p>
            </div>

            {/* Session length */}
            <div>
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-2">
                Session Length
              </label>
              <div className="grid grid-cols-5 gap-2">
                {([30, 45, 60, 75, 90] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => profile.updateProfile({ sessionLengthMin: m })}
                    className={cn(
                      "py-3 border rounded-xl text-xs font-bold uppercase tracking-wider transition-all",
                      profile.sessionLengthMin === m
                        ? "bg-primary/20 border-primary text-primary"
                        : "border-border text-text-secondary bg-bg-elevated hover:text-text-primary"
                    )}
                  >
                    {m >= 60 ? `${m / 60}h` : `${m}m`}
                  </button>
                ))}
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-2">
                Where do you train?
              </label>
              <div className="flex gap-2">
                {(["gym", "home", "outdoor"] as const).map((loc) => (
                  <OptionBtn
                    key={loc}
                    compact
                    active={profile.location === loc}
                    onClick={() => profile.updateProfile({ location: loc })}
                    label={loc}
                  />
                ))}
              </div>
            </div>

            {/* Equipment */}
            <div>
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-2">
                Available Equipment (select all that apply)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  "Full Gym",
                  "Bodyweight",
                  "Dumbbells",
                  "Barbell",
                  "Kettlebell",
                  "Machines",
                  "Cables",
                  "Bands",
                ].map((eq) => (
                  <OptionBtn
                    key={eq}
                    compact
                    active={profile.equipment.includes(eq)}
                    onClick={() => profile.toggleEquipment(eq)}
                    label={eq}
                  />
                ))}
              </div>
            </div>

            {/* Real-time preview */}
            <div className="glass-card rounded-xl p-4 bg-primary/5 border border-primary/20">
              <p className="text-xs font-bold text-primary uppercase tracking-widest mb-2">
                Preview
              </p>
              <div className="flex justify-between text-xs">
                <div>
                  <p className="text-text-secondary">Est. exercises</p>
                  <p className="font-bold text-text-primary text-lg">{estimatedExercises}</p>
                </div>
                <div>
                  <p className="text-text-secondary">Est. time</p>
                  <p className="font-bold text-text-primary text-lg">{estimatedMinutes}m</p>
                </div>
                <div>
                  <p className="text-text-secondary">Days/week</p>
                  <p className="font-bold text-text-primary text-lg">{profile.daysPerWeek}</p>
                </div>
              </div>
            </div>
          </div>
        );

      // ═══════════════════════════════════════════════════
      // STEP 3: Muscles & Style (optional — can skip)
      // ═══════════════════════════════════════════════════
      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black italic tracking-tight uppercase mb-1">
                Muscles & Style
              </h2>
              <p className="text-xs text-text-secondary mb-2">
                Optional — tap to emphasize specific muscle groups.
              </p>
            </div>

            {/* Anatomy Map */}
            <AnatomyMap
              highlightedMuscles={profile.priorityMuscles}
              onMuscleSelect={(m) => m && profile.toggleMuscle(m)}
            />

            {profile.priorityMuscles.length > 0 && (
              <div className="flex flex-wrap gap-2 text-xs font-bold text-primary">
                {profile.priorityMuscles.map((m) => (
                  <span key={m} className="px-2 border border-primary/30 rounded">
                    {m}
                  </span>
                ))}
              </div>
            )}

            {/* Workout style */}
            <div>
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-2">
                Workout Style
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["straight sets", "supersets", "circuits"] as const).map((st) => (
                  <OptionBtn
                    key={st}
                    compact
                    active={profile.intensityStyle === st}
                    onClick={() => profile.updateProfile({ intensityStyle: st })}
                    label={st}
                  />
                ))}
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-2">
              {[
                { k: "includeWarmup", l: "Warm-up Routine" },
                { k: "includeCoreFinisher", l: "Core Finisher" },
                { k: "includeCardio", l: "Post-Workout Cardio" },
              ].map(({ k, l }) => {
                const active = !!profile[k as keyof typeof profile];
                return (
                  <button
                    key={k}
                    onClick={() => profile.updateProfile({ [k]: !active } as Partial<import("@/store/useGeneratorStore").GeneratorProfile>)}
                    className="flex items-center gap-3 w-full p-4 bg-bg-elevated border border-border rounded-xl"
                  >
                    <div
                      className={cn(
                        "w-5 h-5 rounded flex items-center justify-center border",
                        active ? "bg-primary border-primary text-black" : "border-border"
                      )}
                    >
                      {active && <CheckCircle2 className="w-4 h-4" aria-hidden="true" />}
                    </div>
                    <span className="text-sm font-bold text-text-secondary">{l}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );

      // ═══════════════════════════════════════════════════
      // STEP 4: Health & Safety (can skip)
      // ═══════════════════════════════════════════════════
      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black italic tracking-tight uppercase mb-1">
                Health & Safety
              </h2>
              <p className="text-xs text-text-secondary mb-4">
                We'll filter out exercises that may aggravate injuries.
              </p>
            </div>

            {/* Injuries */}
            <div>
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-2">
                Previous Injuries (select all that apply)
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  "none",
                  "lower back",
                  "knee",
                  "shoulder",
                  "elbow",
                  "wrist",
                  "neck",
                  "hip",
                  "ankle",
                ].map((inj) => {
                  const isActive = profile.injuries.includes(inj);
                  return (
                    <button
                      key={inj}
                      onClick={() => {
                        if (inj === "none") profile.updateProfile({ injuries: ["none"] });
                        else {
                          const newInj = profile.injuries.filter((i) => i !== "none");
                          profile.updateProfile({
                            injuries: isActive
                              ? newInj.filter((i) => i !== inj)
                              : [...newInj, inj],
                          });
                        }
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-bold uppercase border transition-colors",
                        isActive
                          ? "bg-danger/20 text-danger border-danger/50"
                          : "bg-bg text-text-secondary border-border"
                      )}
                    >
                      {inj}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mobility */}
            <button
              onClick={() => profile.updateProfile({ mobilityLimited: !profile.mobilityLimited })}
              className="flex items-center gap-3 w-full p-3 bg-bg-elevated border border-border rounded-xl"
            >
              <div
                className={cn(
                  "w-5 h-5 rounded flex items-center justify-center border",
                  profile.mobilityLimited
                    ? "bg-primary border-primary text-black"
                    : "border-border"
                )}
              >
                {profile.mobilityLimited && <CheckCircle2 className="w-4 h-4" aria-hidden="true" />}
              </div>
              <span className="text-sm font-bold text-text-secondary">
                I have limited mobility
              </span>
            </button>

            {profile.injuries.length > 0 && profile.injuries[0] !== "none" && (
              <div className="p-3 bg-warning/10 border border-warning/20 rounded-xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-xs text-warning/90 font-medium">
                  We'll optimize your program to avoid aggravating:{" "}
                  <span className="font-bold">{profile.injuries.join(", ")}</span>.
                </p>
              </div>
            )}
          </div>
        );

      // ═══════════════════════════════════════════════════
      // STEP 5: Review & Generate
      // ═══════════════════════════════════════════════════
      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black italic tracking-tight uppercase mb-1 flex items-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-primary" aria-hidden="true" />
                Ready to Generate
              </h2>
              <p className="text-xs text-text-secondary">
                Review your selections below and generate your personalized program.
              </p>
            </div>

            {/* Summary cards */}
            <div className="glass-card rounded-xl p-4 border border-border/50 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Goal</span>
                <span className="text-sm font-bold text-text-primary capitalize">{profile.goal || "Not set"}</span>
              </div>
              <div className="border-t border-border/30" />
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Experience</span>
                <span className="text-sm font-bold text-text-primary">{profile.fitnessLevel}</span>
              </div>
              <div className="border-t border-border/30" />
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Schedule</span>
                <span className="text-sm font-bold text-text-primary">
                  {profile.daysPerWeek} days × {profile.sessionLengthMin}m
                </span>
              </div>
              <div className="border-t border-border/30" />
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Equipment</span>
                <span className="text-sm font-bold text-text-primary text-right">
                  {profile.equipment.length > 0 ? profile.equipment.join(", ") : "Any"}
                </span>
              </div>
              {profile.injuries.length > 0 && profile.injuries[0] !== "none" && (
                <>
                  <div className="border-t border-border/30" />
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Injuries</span>
                    <span className="text-sm font-bold text-warning">{profile.injuries.join(", ")}</span>
                  </div>
                </>
              )}
            </div>

            {/* Estimated stats */}
            <div className="glass-card rounded-xl p-4 bg-primary/5 border border-primary/20">
              <p className="text-xs font-bold text-primary uppercase tracking-widest mb-3">
                Estimated Program
              </p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-2xl font-black text-text-primary">{profile.daysPerWeek}</p>
                  <p className="text-xs text-text-secondary uppercase">days/week</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-text-primary">~{estimatedExercises}</p>
                  <p className="text-xs text-text-secondary uppercase">exercises/day</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-text-primary">{estimatedMinutes}m</p>
                  <p className="text-xs text-text-secondary uppercase">per session</p>
                </div>
              </div>
            </div>

            {profile.injuries.length > 0 && profile.injuries[0] !== "none" && (
              <div className="p-3 bg-warning/10 border border-warning/20 rounded-xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-xs text-warning/90 font-medium">
                  We will optimize your program to avoid exasperating your listed injuries:{" "}
                  <span className="font-bold">{profile.injuries.join(", ")}</span>.
                </p>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 0:
        return !!profile.gender && !!profile.goal && !!profile.fitnessLevel;
      default:
        return true;
    }
  };

  // Steps 2 and 3 are optional — allow skipping
  const isOptionalStep = currentStep === 2 || currentStep === 3;

  // Feature teaser shown between certain steps (transient)
  const [showTeaser, setShowTeaser] = useState(false);
  const [teaserContent, setTeaserContent] = useState<{ icon: React.ReactNode; title: string; desc: string } | null>(null);

  const showFeatureTeaser = (content: { icon: React.ReactNode; title: string; desc: string }) => {
    setTeaserContent(content);
    setShowTeaser(true);
  };

  const dismissTeaser = () => {
    setShowTeaser(false);
    setTeaserContent(null);
  };

  // Show teaser after certain steps
  const handleNextWithTeaser = () => {
    if (currentStep < STEPS.length - 1) {
      // After Step 1 (Goal & Experience) — show AI teaser
      if (currentStep === 0) {
        showFeatureTeaser({
          icon: <Sparkles className="h-8 w-8 text-primary" />,
          title: "AI Coach Ready",
          desc: "Your AI Coach will analyze 30+ data points to build the perfect program.",
        });
        return;
      }
      // After Step 3 (Muscles & Style) — show PR teaser
      if (currentStep === 2) {
        showFeatureTeaser({
          icon: <Trophy className="h-8 w-8 text-warning" />,
          title: "PR Celebrations",
          desc: "You'll get confetti, voice announcements, and haptics on every new PR!",
        });
        return;
      }
      setCurrentStep(currentStep + 1);
    }
  };

  const dismissTeaserAndProceed = () => {
    dismissTeaser();
    setCurrentStep(currentStep + 1);
  };

  return (
    <div className="relative mx-auto flex min-h-[600px] max-w-md flex-col overflow-hidden rounded-[2rem] border border-border bg-bg-card p-4 shadow-2xl sm:p-6">
      {/* Atmospheric glow background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-primary/5 blur-[120px]" />
      </div>

      {/* Header + Progress */}
      <div className="relative z-10 mb-4 shrink-0">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("home")}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-bg-elevated text-text-secondary transition-colors hover:text-text-primary"
              aria-label="Exit generator"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex flex-col">
              <h1 className="text-xl font-black italic tracking-tighter uppercase">AI Generator</h1>
              <span className="text-[9px] font-bold uppercase tracking-widest text-primary">
                STEP {currentStep + 1} OF {STEPS.length}
              </span>
            </div>
          </div>
        </div>

        {/* Circular step markers with connecting bar */}
        <div className="relative flex items-center justify-between px-2">
          {/* Background bar */}
          <div className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-bg-elevated" />
          {/* Progress bar */}
          <motion.div
            className="absolute left-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-primary"
            style={{ boxShadow: "0 0 8px rgba(204,255,0,0.4)" }}
            initial={{ width: 0 }}
            animate={{ width: `${(currentStep / (STEPS.length - 1)) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
          {/* Step circles */}
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={cn(
                "relative z-10 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all",
                i === currentStep
                  ? "bg-primary text-black scale-110"
                  : i < currentStep
                    ? "bg-primary/80 text-black"
                    : "bg-bg-elevated text-text-secondary border border-border"
              )}
              style={
                i === currentStep || i < currentStep
                  ? { boxShadow: "0 0 10px rgba(204,255,0,0.5)" }
                  : undefined
              }
            >
              {i < currentStep ? "✓" : i + 1}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1" style={{ minHeight: "420px" }}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-y-auto no-scrollbar pb-10"
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer: Back + Next/Generate/Skip */}
      <div className="relative z-10 mt-4 shrink-0 flex gap-3 border-t border-border/50 bg-bg-card/80 pt-4 backdrop-blur-sm">
        <Button
          onClick={handleBack}
          disabled={currentStep === 0 || isGenerating}
          variant="outline"
          className="flex-1 border-border text-text-secondary"
          icon={<ArrowLeft className="w-4 h-4" aria-hidden="true" />}
        ></Button>

        {isOptionalStep && currentStep !== STEPS.length - 1 ? (
          <Button
            onClick={handleNextWithTeaser}
            variant="ghost"
            className="flex-1 text-xs font-bold uppercase tracking-wider text-text-secondary"
            icon={<SkipForward className="w-3.5 h-3.5" aria-hidden="true" />}
          >
            Skip
          </Button>
        ) : null}

        {currentStep === STEPS.length - 1 ? (
          <Button
            onClick={handleGenerate}
            disabled={exercises.length === 0 || isGenerating}
            variant="primary"
            className="flex-[3] font-black uppercase tracking-widest text-xs"
            icon={isGenerating ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : null}
          >
            {isGenerating ? "Building..." : "Generate Program"}
          </Button>
        ) : (
          <Button
            onClick={handleNextWithTeaser}
            disabled={!isStepValid()}
            variant="primary"
            className="flex-[3] font-black uppercase tracking-widest text-xs"
            icon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
          >
            Next
          </Button>
        )}
      </div>      {/* Feature Teaser Overlay */}
      <AnimatePresence>
        {showTeaser && teaserContent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center rounded-[2rem] bg-bg-card/95 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className="flex flex-col items-center gap-4 p-8 text-center"
            >
              {/* Glow */}
              <motion.div
                className="absolute h-32 w-32 rounded-full bg-primary/10 blur-[40px]"
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              {/* Icon */}
              <motion.div
                className="relative z-10 flex h-20 w-20 items-center justify-center rounded-3xl border border-border bg-bg-elevated/50"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              >
                {teaserContent.icon}
              </motion.div>
              {/* Title */}
              <h3 className="relative z-10 text-xl font-black italic uppercase tracking-tight text-text-primary">
                {teaserContent.title}
              </h3>
              {/* Description */}
              <p className="relative z-10 max-w-xs text-sm text-text-secondary">
                {teaserContent.desc}
              </p>
              {/* Continue button */}
              <Button
                onClick={dismissTeaserAndProceed}
                variant="primary"
                className="mt-2 w-full max-w-[200px] py-3 text-xs font-black uppercase tracking-widest"
                icon={<ArrowRight className="w-3.5 h-3.5" />}
              >
                Continue
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Generation Loading Overlay */}
      <AnimatePresence>
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-[2rem] bg-bg-card/95 p-6 text-center backdrop-blur-md"
          >
            {isGenerating && (
              <div className="space-y-4 p-4 w-full max-w-md">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="space-y-2 p-3 border border-border rounded-lg">
                    <Skeleton className="h-5 w-2/3" />
                    <div className="flex gap-4">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </div>
                ))}
                <Skeleton className="h-12 w-full" />
              </div>
            )}
            <AILoadingAnimation />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const LOADING_STEPS = [
  "Analyzing baseline metrics...",
  "Calibrating fatigue & recovery profile...",
  "Balancing agonist & antagonist volumes...",
  "Optimizing exercise selection...",
  "Structuring progressive overload curves...",
  "Finalizing your premium program..."
];

function AILoadingAnimation() {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIndex((prev) => (prev < LOADING_STEPS.length - 1 ? prev + 1 : prev));
    }, 600);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-xs space-y-6">
      {/* Immersive radial glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[2rem]">
        <motion.div
          className="absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(204,255,0,0.1) 0%, rgba(0,240,255,0.02) 50%, transparent 80%)",
          }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.6, 0.9, 0.6],
          }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Rotating and Pulsing AI Core */}
      <div className="relative flex items-center justify-center w-24 h-24">
        {/* Outer glowing ring */}
        <motion.div
          className="absolute inset-0 rounded-full border border-dashed border-primary/30"
          animate={{ rotate: 360 }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        />
        {/* Inner rotating ring */}
        <motion.div
          className="absolute inset-2 rounded-full border border-primary/50 border-t-transparent border-b-transparent"
          animate={{ rotate: -360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        />
        {/* Central glowing pod */}
        <motion.div
          className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/40 bg-bg-elevated/80 shadow-[0_0_25px_rgba(204,255,0,0.2)]"
          animate={{ scale: [0.95, 1.05, 0.95] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <Sparkles className="h-6 w-6 text-primary" strokeWidth={2} />
        </motion.div>
      </div>

      {/* Text and status */}
      <div className="space-y-2 z-10">
        <h3 className="text-sm font-black italic uppercase tracking-wider text-primary">
          AI Coach is building your plan
        </h3>
        <AnimatePresence mode="wait">
          <motion.p
            key={stepIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="text-xs text-text-secondary h-4 font-medium"
          >
            {LOADING_STEPS[stepIndex]}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Sleek lime progress bar */}
      <div className="w-full h-1.5 bg-bg-elevated rounded-full overflow-hidden border border-border/30 relative z-10">
        <motion.div
          className="h-full bg-primary rounded-full"
          style={{ boxShadow: "0 0 10px rgba(204,255,0,0.8)" }}
          initial={{ width: "0%" }}
          animate={{ width: "95%" }}
          transition={{ duration: 4, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
