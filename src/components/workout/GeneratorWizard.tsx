import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ArrowLeft, ArrowRight, CheckCircle2, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { useGeneratorStore } from "../../store/useGeneratorStore";
import { useExerciseStore } from "../../store/useExerciseStore";
import { useSettingsStore } from "../../store/useSettingsStore";
import AnatomyMap from "../AnatomyMap";
import { generateProgram } from "../../services/workoutGenerator";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "../ui/Button";

const STEPS = [
  "Gender", "Age", "Body Stats", "Body Fat", "Experience", 
  "Goal", "Physique Focus", "Key Muscles", "Frequency", "Duration", 
  "Environment", "Health/Safety", "Preferences", "Review"
];

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}

export const GeneratorWizard = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [advancedHealthOpen, setAdvancedHealthOpen] = useState(false);

  const profile = useGeneratorStore();
  const { exercises, loadExercises } = useExerciseStore();
  const weightUnit = useSettingsStore(s => s.weightUnit);

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
      // Simulate slight delay for "AI" feel
      await new Promise(r => setTimeout(r, 1000));
      const program = generateProgram(exercises, profile);
      profile.setProgram(program);
      profile.updateProfile({ generatorSeed: Math.random() });
      navigate({ to: "/generator/result" });
    } catch (error) {
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const OptionBtn = ({ active, onClick, label, desc }: { active: boolean, onClick: () => void, label: string, desc?: string }) => (
    <button
      onClick={onClick}
      className={cn(
        "w-full p-4 border rounded-xl text-left transition-all mb-3 last:mb-0",
        active 
          ? "border-primary bg-primary/10 text-primary shadow-[0_0_15px_rgba(204,255,0,0.15)]" 
          : "border-border bg-bg-elevated text-text-muted hover:border-border-active hover:text-text-primary"
      )}
    >
      <div className="font-bold tracking-wide uppercase text-sm">{label}</div>
      {desc && <div className={cn("text-xs mt-1", active ? "text-primary/80" : "text-text-muted/70")}>{desc}</div>}
    </button>
  );

  const renderStep = () => {
    switch (currentStep) {
      case 0: // Gender
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-black italic tracking-tight uppercase">Biological Gender</h2>
            <p className="text-xs text-text-muted">Used for baseline metabolic/volume estimates.</p>
            <div className="flex gap-4">
              <OptionBtn active={profile.gender === "male"} onClick={() => profile.updateProfile({ gender: "male" })} label="Male" />
              <OptionBtn active={profile.gender === "female"} onClick={() => profile.updateProfile({ gender: "female" })} label="Female" />
            </div>
          </div>
        );
      case 1: // Age
        return (
          <div className="space-y-4 text-center">
            <h2 className="text-xl font-black italic tracking-tight uppercase text-left">Your Age</h2>
            <p className="text-6xl font-black italic text-primary my-8">{profile.age}</p>
            <input
              type="range"
              min="15" max="90"
              value={profile.age}
              onChange={(e) => profile.updateProfile({ age: parseInt(e.target.value) })}
              className="w-full accent-primary"
            />
          </div>
        );
      case 2: // Body Stats
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-black italic tracking-tight uppercase">Body Stats</h2>
            <div className="space-y-4 bg-bg-elevated p-4 rounded-xl border border-border">
              <div>
                <label className="text-xs font-bold text-text-muted uppercase tracking-wider block mb-2">Height (cm)</label>
                <input
                  type="number"
                  value={profile.heightCm}
                  onChange={(e) => profile.updateProfile({ heightCm: parseInt(e.target.value) || 0 })}
                  className="w-full bg-bg border border-border rounded-lg p-3 text-text-primary focus:border-primary outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-text-muted uppercase tracking-wider block mb-2">Weight ({weightUnit})</label>
                <input
                  type="number"
                  value={weightUnit === "lbs" ? Math.round(profile.weightKg * 2.20462) : profile.weightKg}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    profile.updateProfile({ weightKg: weightUnit === "lbs" ? Math.round(val / 2.20462) : val });
                  }}
                  className="w-full bg-bg border border-border rounded-lg p-3 text-text-primary focus:border-primary outline-none"
                />
              </div>
            </div>
          </div>
        );
      case 3: // Body Fat
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-black italic tracking-tight uppercase">Estimated Body Fat</h2>
            {(["low", "medium", "high", "unknown"] as const).map(l => (
              <OptionBtn key={l} active={profile.bodyFatLevel === l} onClick={() => profile.updateProfile({ bodyFatLevel: l })} label={l} />
            ))}
          </div>
        );
      case 4: // Experience
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-black italic tracking-tight uppercase">Training Experience</h2>
            <div className="mb-4">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider block mb-2">Years lifting: {profile.trainingYears}</label>
              <input
                type="range"
                min="0" max="20" step="0.5"
                value={profile.trainingYears}
                onChange={(e) => profile.updateProfile({ trainingYears: parseFloat(e.target.value) })}
                className="w-full accent-primary"
              />
            </div>
            {(["Novice", "Beginner", "Intermediate", "Advanced"] as const).map(l => (
              <OptionBtn key={l} active={profile.fitnessLevel === l} onClick={() => profile.updateProfile({ fitnessLevel: l })} label={l} />
            ))}
          </div>
        );
      case 5: // Goal
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-black italic tracking-tight uppercase">Primary Goal</h2>
            {(["Strength", "Hypertrophy", "Fat Loss", "Recomp", "General Fitness", "Endurance"] as const).map(g => (
              <OptionBtn key={g} active={profile.goal === g} onClick={() => profile.updateProfile({ goal: g })} label={g} />
            ))}
          </div>
        );
      case 6: // Physique Focus
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-black italic tracking-tight uppercase">Physique Focus</h2>
            <div className="grid grid-cols-2 gap-3">
              {(["balanced", "upper", "lower", "push", "pull", "glutes", "arms", "core"] as const).map(f => (
                <OptionBtn key={f} active={profile.physiqueFocus === f} onClick={() => profile.updateProfile({ physiqueFocus: f })} label={f} />
              ))}
            </div>
          </div>
        );
      case 7: // Muscles
        return (
          <div className="space-y-4 h-full flex flex-col">
            <div>
              <h2 className="text-xl font-black italic tracking-tight uppercase">Priority Muscles</h2>
              <p className="text-xs text-text-muted">Tap to emphasize (receives extra volume). Optional.</p>
            </div>
            <div className="flex-1 flex flex-col justify-center max-h-[300px]">
              <AnatomyMap onMuscleSelect={(m) => m && profile.toggleMuscle(m)} />
            </div>
            {profile.priorityMuscles.length > 0 && (
              <div className="flex flex-wrap gap-2 text-xs font-bold text-primary">
                {profile.priorityMuscles.map(m => <span key={m} className="px-2 border border-primary/30 rounded">{m}</span>)}
              </div>
            )}
          </div>
        );
      case 8: // Frequency
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-black italic tracking-tight uppercase">Days Per Week</h2>
            <div className="grid grid-cols-5 gap-2 mt-8">
              {([2,3,4,5,6] as const).map(d => (
                <button
                  key={d}
                  onClick={() => profile.updateProfile({ daysPerWeek: d })}
                  className={cn("p-4 border rounded-xl text-xl font-black italic transition-all", profile.daysPerWeek === d ? "bg-primary/20 border-primary text-primary" : "border-border text-text-muted bg-bg-elevated")}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        );
      case 9: // Duration
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-black italic tracking-tight uppercase">Session Length</h2>
            <p className="text-xs text-text-muted">How many minutes per workout?</p>
            <div className="grid grid-cols-2 gap-3 mt-4">
              {([30,45,60,75,90] as const).map(m => (
                <OptionBtn key={m} active={profile.sessionLengthMin === m} onClick={() => profile.updateProfile({ sessionLengthMin: m })} label={`${m} Min`} />
              ))}
            </div>
          </div>
        );
      case 10: // Environment
        return (
          <div className="space-y-4 overflow-y-auto pr-2" style={{ maxHeight: "400px" }}>
            <h2 className="text-xl font-black italic tracking-tight uppercase">Environment</h2>
            <div className="flex gap-2 mb-4">
              {(["home", "gym", "outdoor"] as const).map(loc => (
                <button
                  key={loc} onClick={() => profile.updateProfile({ location: loc })}
                  className={cn("flex-1 py-2 rounded font-bold uppercase text-xs border", profile.location === loc ? "bg-primary/20 text-primary border-primary" : "bg-bg text-text-muted border-border")}
                >
                  {loc}
                </button>
              ))}
            </div>
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Available Equipment</h3>
            {(["Full Gym", "Bodyweight", "Dumbbells", "Barbell", "Kettlebell", "Machines", "Cables", "Bands", "Pull-up Bar", "Bench"]).map(eq => (
              <OptionBtn key={eq} active={profile.equipment.includes(eq)} onClick={() => profile.toggleEquipment(eq)} label={eq} />
            ))}
          </div>
        );
      case 11: // Health
        return (
          <div className="space-y-4 overflow-y-auto pr-2" style={{ maxHeight: "400px" }}>
            <h2 className="text-xl font-black italic tracking-tight uppercase text-danger">Safety & Limits</h2>
            <p className="text-xs text-text-muted">We will filter out contraindicated movements.</p>
            
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mt-4">Previous Injuries</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {["none", "lower back", "knee", "shoulder", "elbow", "wrist", "neck", "hip", "ankle"].map(inj => {
                const isActive = profile.injuries.includes(inj);
                return (
                  <button
                    key={inj}
                    onClick={() => {
                      if (inj === "none") profile.updateProfile({ injuries: ["none"] });
                      else {
                        const newInj = profile.injuries.filter(i => i !== "none");
                        profile.updateProfile({ injuries: isActive ? newInj.filter(i => i !== inj) : [...newInj, inj] });
                      }
                    }}
                    className={cn("px-3 py-1.5 rounded-full text-xs font-bold uppercase border transition-colors", isActive ? "bg-danger/20 text-danger border-danger/50" : "bg-bg text-text-muted border-border")}
                  >
                    {inj}
                  </button>
                )
              })}
            </div>

            <button onClick={() => profile.updateProfile({ mobilityLimited: !profile.mobilityLimited })} className="flex items-center gap-3 p-3 bg-bg-elevated border border-border rounded-xl">
              <div className={cn("w-5 h-5 rounded flex items-center justify-center border", profile.mobilityLimited ? "bg-primary border-primary text-black" : "border-border")} >
                {profile.mobilityLimited && <CheckCircle2 className="w-4 h-4" />}
              </div>
              <span className="text-sm font-bold">I have limited mobility</span>
            </button>

            <button onClick={() => setAdvancedHealthOpen(!advancedHealthOpen)} className="flex items-center justify-between w-full p-3 bg-bg-elevated border border-border rounded-xl mt-4">
              <span className="text-sm font-bold text-text-secondary">Medical Conditions</span>
              {advancedHealthOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {advancedHealthOpen && (
              <div className="p-3 bg-bg rounded-xl border border-border flex flex-wrap gap-2">
                {["hypertension", "pregnancy", "hernia", "recent surgery"].map(cond => {
                  const isActive = profile.medicalCautions.includes(cond);
                  return (
                    <button key={cond} onClick={() => {
                      profile.updateProfile({ medicalCautions: isActive ? profile.medicalCautions.filter(c => c !== cond) : [...profile.medicalCautions, cond] });
                    }}
                    className={cn("px-3 py-1.5 rounded-full text-xs font-bold uppercase border", isActive ? "bg-warning/20 text-warning border-warning/50" : "bg-bg-elevated text-text-muted border-border")}>
                      {cond}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        );
      case 12: // Prefs
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-black italic tracking-tight uppercase">Preferences</h2>
            
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">Style</h3>
            <div className="grid grid-cols-3 gap-2">
              {(["straight sets", "supersets", "circuits"] as const).map(st => (
                <OptionBtn key={st} active={profile.intensityStyle === st} onClick={() => profile.updateProfile({ intensityStyle: st })} label={st} />
              ))}
            </div>

            <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mt-4">Include:</h3>
            <div className="space-y-2">
              {[
                { k: "includeWarmup", l: "Warm-up Routine" },
                { k: "includeCoreFinisher", l: "Core Finisher" },
                { k: "includeCardio", l: "Post-Workout Cardio" }
              ].map(({k, l}) => {
                const pKey = k as keyof typeof profile;
                const active = !!profile[pKey];
                return (
                  <button key={k} onClick={() => profile.updateProfile({ [k]: !active })} className="flex items-center gap-3 w-full p-3 bg-bg-elevated border border-border rounded-xl">
                    <div className={cn("w-5 h-5 rounded flex items-center justify-center border", active ? "bg-primary border-primary text-black" : "border-border")} >
                      {active && <CheckCircle2 className="w-4 h-4" />}
                    </div>
                    <span className="text-sm font-bold text-text-secondary">{l}</span>
                  </button>
                )
              })}
            </div>
          </div>
        );
      case 13: // Review
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-black italic tracking-tight uppercase text-primary mb-4 flex items-center gap-2">
              <CheckCircle2 /> Ready
            </h2>
            <div className="bg-bg-elevated border border-border rounded-xl p-4 text-sm space-y-3">
              <div className="flex justify-between border-b border-border/50 pb-2">
                <span className="text-text-muted font-bold">Goal</span>
                <span className="text-text-primary capitalize">{profile.goal || "Not set"}</span>
              </div>
              <div className="flex justify-between border-b border-border/50 pb-2">
                <span className="text-text-muted font-bold">Split</span>
                <span className="text-text-primary">{profile.daysPerWeek} Days / {profile.sessionLengthMin} Min</span>
              </div>
              <div className="flex justify-between border-b border-border/50 pb-2">
                <span className="text-text-muted font-bold">Experience</span>
                <span className="text-text-primary capitalize">{profile.fitnessLevel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted font-bold">Focus</span>
                <span className="text-text-primary capitalize">{profile.physiqueFocus}</span>
              </div>
            </div>
            
            {profile.injuries.length > 0 && profile.injuries[0] !== "none" && (
              <div className="p-3 bg-warning/10 border border-warning/20 rounded-xl flex items-start gap-3 mt-4">
                <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                <p className="text-xs text-warning/90 font-medium">
                  We will optimize your program to avoid exasperating your listed injuries: <span className="font-bold">{profile.injuries.join(', ')}</span>.
                </p>
              </div>
            )}
          </div>
        );
      default: return null;
    }
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 0: return !!profile.gender;
      case 3: return !!profile.bodyFatLevel;
      case 4: return !!profile.fitnessLevel;
      case 5: return !!profile.goal;
      default: return true;
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 sm:p-6 bg-bg-card rounded-[2rem] shadow-2xl border border-border flex flex-col h-[650px]">
      <div className="mb-4 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-black italic tracking-tighter uppercase">AI Generator</h1>
          <p className="text-[10px] font-bold text-primary px-2 py-1 bg-primary/10 rounded-md">
            STEP {currentStep + 1} OF {STEPS.length}
          </p>
        </div>
        <div className="h-1 bg-bg-elevated rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="absolute inset-0 overflow-y-auto no-scrollbar pb-10"
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-4 pt-4 border-t border-border/50 shrink-0 flex gap-3 bg-bg-card">
        <Button
          onClick={handleBack}
          disabled={currentStep === 0 || isGenerating}
          variant="outline"
          className="flex-1 border-border text-text-secondary"
          icon={<ArrowLeft className="w-4 h-4" />}
        >
        </Button>
        {currentStep === STEPS.length - 1 ? (
          <Button
            onClick={handleGenerate}
            disabled={exercises.length === 0 || isGenerating}
            variant="primary"
            className="flex-[3] font-black uppercase tracking-widest text-xs"
            icon={isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          >
            {isGenerating ? "Building..." : "Generate Program"}
          </Button>
        ) : (
          <Button
            onClick={handleNext}
            disabled={!isStepValid()}
            variant="primary"
            className="flex-[3] font-black uppercase tracking-widest text-xs opacity-90"
            icon={<ArrowRight className="w-4 h-4" />}
          >
            Next
          </Button>
        )}
      </div>
    </div>
  );
};
