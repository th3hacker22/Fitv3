"use client";
import { motion, AnimatePresence } from "framer-motion";
import { Lightbulb, Dumbbell, ChevronDown, ChevronUp, Plus, Flame, SkipForward, RotateCcw, MoreVertical, Shuffle } from "lucide-react";
import { useState, useCallback, memo, useMemo } from "react";
import { cn } from "@/utils/cn";
import { useWorkoutStore, type WorkoutExerciseItem } from "@/store/useWorkoutStore";
import ExerciseVideoPlayer from "@/components/exercise/ExerciseVideoPlayer";
import ReplaceExerciseSheet from "./ReplaceExerciseSheet";
import WarmupSheet from "./WarmupSheet";
import PlateCalculatorSheet from "./PlateCalculatorSheet";
import SetRow from "./SetRow";
import SetTypePicker from "./SetTypePicker";
import SkipReasonModal, { type SkipReason } from "./SkipReasonModal";
import { recordSkip } from "@/services/learningLoop";
import { useTranslation } from "react-i18next";
import { normalizeSetType, type SetType } from "@/config/setTypes";

interface Props {
  exercise: WorkoutExerciseItem;
  exerciseIndex: number;
}

export default memo(function ExerciseWorkoutCard({ exercise, exerciseIndex }: Props) {
  const { t } = useTranslation();
  const localizedName = exercise.exerciseName;

  const updateSet = useWorkoutStore((s) => s.updateSet);
  const toggleSetComplete = useWorkoutStore((s) => s.toggleSetComplete);
  const setSetType = useWorkoutStore((s) => s.setSetType);
  const addSet = useWorkoutStore((s) => s.addSet);
  const removeSet = useWorkoutStore((s) => s.removeSet);
  const setExerciseNotes = useWorkoutStore((s) => s.setExerciseNotes);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [showWarmup, setShowWarmup] = useState(false);
  const [showPlates, setShowPlates] = useState(false);
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isSkipped, setIsSkipped] = useState(false);

  // ── SetTypePicker state ──
  // The picker is owned by the card (not per-SetRow) so only one picker
  // instance exists per exercise. `typePickerSetId` tracks which set's chip
  // was tapped so we can highlight its current type and route the selection
  // back to the correct set via `setSetType`.
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [typePickerSetId, setTypePickerSetId] = useState<string | null>(null);

  // Warmup button only makes sense when there's a working weight to ramp up to.
  const firstSetWeight = Number(exercise.sets[0]?.weight) || 0;
  const showWarmupButton = firstSetWeight > 0;
  // Plate calculator only applies to barbell exercises with a working weight.
  const isBarbellExercise = exercise.equipment?.toLowerCase().includes("barbell");
  const showPlatesButton = isBarbellExercise && firstSetWeight > 0;

  const handleToggleComplete = useCallback(
    (setId: string) => {
      toggleSetComplete(exerciseIndex, setId);
    },
    [toggleSetComplete, exerciseIndex]
  );

  const handleUpdateWeight = useCallback(
    (setId: string, value: string) => {
      updateSet(exerciseIndex, setId, { weight: value });
    },
    [updateSet, exerciseIndex]
  );

  const handleUpdateReps = useCallback(
    (setId: string, value: string) => {
      updateSet(exerciseIndex, setId, { reps: value });
    },
    [updateSet, exerciseIndex]
  );

  const handleUpdateRpe = useCallback(
    (setId: string, value: string) => {
      updateSet(exerciseIndex, setId, { rpe: value });
    },
    [updateSet, exerciseIndex]
  );

  const handleRemoveSet = useCallback(
    (setId: string) => {
      removeSet(exerciseIndex, setId);
    },
    [removeSet, exerciseIndex]
  );

  const handleOpenTypePicker = useCallback((setId: string) => {
    setTypePickerSetId(setId);
    setShowTypePicker(true);
  }, []);

  const handleSelectType = useCallback(
    (type: SetType) => {
      if (typePickerSetId) {
        setSetType(exerciseIndex, typePickerSetId, type);
      }
      setShowTypePicker(false);
      setTypePickerSetId(null);
    },
    [exerciseIndex, typePickerSetId, setSetType]
  );

  // Resolve the current setType for the picked set so the picker can
  // highlight it. Falls back to "normal" when the set has no setType yet
  // (backward-compatible with workouts started before the setType field).
  const currentPickerType: SetType = useMemo(() => {
    if (!typePickerSetId) return "normal";
    const targetSet = exercise.sets.find((s) => s.id === typePickerSetId);
    return normalizeSetType(targetSet?.setType);
  }, [typePickerSetId, exercise.sets]);

  const handleTypePickerOpenChange = useCallback((open: boolean) => {
    setShowTypePicker(open);
    if (!open) setTypePickerSetId(null);
  }, []);

  // ── Smart Skip with Reason ──
  // When the user explicitly skips an exercise we record the reason to the
  // Learning Loop (so future workouts can de-prioritise disliked exercises)
  // and visually collapse the card. The exercise stays in the workout data
  // with no completed sets, so it won't count toward the session summary —
  // but the user can undo the skip if they change their mind.
  const handleSkipConfirm = useCallback(
    async (reason: SkipReason, note?: string) => {
      setShowSkipModal(false);
      setIsSkipped(true);
      const reasonLabel = note ? `${reason}: ${note}` : reason;
      try {
        await recordSkip(
          String(exercise.exerciseId),
          exercise.exerciseName,
          undefined,
          reasonLabel
        );
      } catch (err) {
        console.warn("[SmartSkip] Failed to record skip:", err);
      }
    },
    [exercise.exerciseId, exercise.exerciseName]
  );

  const handleUndoSkip = useCallback(() => {
    setIsSkipped(false);
  }, []);

  const completedSets = exercise.sets.filter((s) => s.completed).length;
  const totalSets = exercise.sets.length;

  // Subscribe to ONLY the superset flag of the previous exercise — not the
  // entire activeWorkout object (which would re-render every card on any
  // set update in any exercise).
  const prevExerciseSuperset = useWorkoutStore(
    (s) => s.activeWorkout?.exercises[exerciseIndex - 1]?.isSupersetWithNext ?? false
  );
  const isPartOrStartOfSuperset = exercise.isSupersetWithNext || prevExerciseSuperset;

  // ── Kebab menu actions ──
  // Each action closes the menu first, then opens the corresponding sheet.
  // Closing the menu before opening the sheet avoids z-index conflicts
  // (the menu's backdrop sits above the sheet otherwise).
  const handleMenuWarmup = useCallback(() => {
    setShowMenu(false);
    setShowWarmup(true);
  }, []);
  const handleMenuPlates = useCallback(() => {
    setShowMenu(false);
    setShowPlates(true);
  }, []);
  const handleMenuSkip = useCallback(() => {
    setShowMenu(false);
    setShowSkipModal(true);
  }, []);
  const handleMenuReplace = useCallback(() => {
    setShowMenu(false);
    setShowReplace(true);
  }, []);

  // ── Skipped state: collapsed banner with undo ──
  // The exercise stays in the workout data (so navigation / superset links
  // remain stable) but is visually replaced with a compact "skipped" row.
  // Undo restores the full card without losing any set data entered prior.
  if (isSkipped) {
    return (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        className="overflow-hidden rounded-[--radius-card] border border-border bg-bg-card/60"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <div className="flex items-center justify-between gap-3 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-warning/10 border border-warning/20">
              <SkipForward className="h-4 w-4 text-warning" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold text-text-primary capitalize">
                {localizedName}
              </h3>
              <p className="text-xs text-text-secondary uppercase tracking-wider">
                Skipped — won&apos;t count toward this workout
              </p>
            </div>
          </div>
          <button
            onClick={handleUndoSkip}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-xl border border-border bg-bg-elevated px-4 min-h-11 text-xs font-bold uppercase tracking-wider text-text-secondary transition-all hover:text-primary hover:border-primary active:scale-95"
            aria-label={`Undo skip for ${localizedName}`}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Undo
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className={cn(
        "overflow-hidden rounded-[--radius-card] border border-border bg-bg-card transition-all",
        isPartOrStartOfSuperset && "border-s-4 border-s-warning/80 bg-warning/5"
      )}
      style={{ boxShadow: "var(--shadow-card)" }}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: exerciseIndex * 0.1 }}
    >
      <div className="relative aspect-video bg-bg-elevated overflow-hidden">
        <ExerciseVideoPlayer
          exerciseName={localizedName}
          imageUrl={exercise.imageUrl}
          gifUrl={exercise.gifUrl}
          variant="compact"
          className="relative h-full w-full"
        />

        <div className="absolute top-2 end-2 z-10 rounded-full bg-bg/80 px-2.5 py-1 text-xs font-bold text-primary backdrop-blur-sm">
          {completedSets}/{totalSets}
        </div>
      </div>

      <div className="flex items-start gap-3 border-b border-border p-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold text-text-primary capitalize">
              {localizedName}
            </h3>
            {isPartOrStartOfSuperset && (
              <span className="rounded-full bg-warning/15 px-2.5 py-0.5 text-xs font-black uppercase tracking-widest text-warning border border-warning/20">
                {t("superset")}
              </span>
            )}
          </div>
          <p className="text-xs text-text-secondary">
            {exercise.equipment} · {exercise.target}
          </p>
        </div>
        {/* Kebab menu — single CTA replaces 4 competing buttons (Hick's Law). */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMenu((v) => !v)}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-bg-elevated text-text-secondary transition-all duration-200 hover:bg-bg-hover hover:text-primary active:scale-95"
            aria-label={`More actions for ${localizedName}`}
            aria-expanded={showMenu}
            aria-haspopup="menu"
          >
            <MoreVertical className="h-5 w-5" />
          </button>
          <AnimatePresence>
            {showMenu && (
              <>
                {/* Backdrop — closes the menu on outside tap without
                    intercepting the sheet overlays below. */}
                <div
                  className="fixed inset-0 z-[190]"
                  onClick={() => setShowMenu(false)}
                  aria-hidden="true"
                />
                <motion.div
                  role="menu"
                  aria-label={`Actions for ${localizedName}`}
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute end-0 top-12 z-[195] min-w-[200px] overflow-hidden rounded-xl border border-border bg-bg-card shadow-xl"
                >
                  {showWarmupButton && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleMenuWarmup}
                      className="flex w-full min-h-11 items-center gap-3 px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-warning transition-colors hover:bg-warning/10"
                    >
                      <Flame className="h-4 w-4" />
                      Warmup Sets
                    </button>
                  )}
                  {showPlatesButton && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleMenuPlates}
                      className="flex w-full min-h-11 items-center gap-3 px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-primary transition-colors hover:bg-primary/10"
                    >
                      <Dumbbell className="h-4 w-4" />
                      Plate Calculator
                    </button>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleMenuSkip}
                    className="flex w-full min-h-11 items-center gap-3 px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-text-secondary transition-colors hover:bg-bg-hover hover:text-warning"
                  >
                    <SkipForward className="h-4 w-4" />
                    Skip Exercise
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleMenuReplace}
                    className="flex w-full min-h-11 items-center gap-3 px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-text-secondary transition-colors hover:bg-bg-hover hover:text-primary"
                  >
                    <Shuffle className="h-4 w-4" />
                    Replace Exercise
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {exercise.tips.length > 0 && (
        <div className="border-b border-border">
          <button
            onClick={() => setTipsOpen(!tipsOpen)}
            aria-expanded={tipsOpen}
            aria-controls={`tips-${exercise.id}`}
            className="flex w-full items-center gap-2 px-4 py-3 text-right transition-colors hover:bg-bg-elevated/50"
          >
            <Lightbulb className="h-4 w-4 flex-shrink-0 text-warning" aria-hidden="true" />
            <span className="flex-1 text-xs font-medium text-warning text-left uppercase tracking-wider">
              Captain's Tip
            </span>
            {tipsOpen ? (
              <ChevronUp className="h-4 w-4 text-text-secondary" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4 text-text-secondary" aria-hidden="true" />
            )}
          </button>

          <AnimatePresence>
            {tipsOpen && (
              <motion.div
                id={`tips-${exercise.id}`}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="space-y-1.5 bg-warning/5 px-4 pb-3 pt-1">
                  {exercise.tips.map((tip, i) => (
                    <p key={i} className="text-xs leading-relaxed text-text-secondary">
                      • {tip}
                    </p>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Notes Section */}
      <div className="border-b border-border">
        <button
          onClick={() => setNotesOpen(!notesOpen)}
          aria-expanded={notesOpen}
          aria-controls={`notes-${exercise.id}`}
          className="flex w-full items-center gap-2 px-4 py-3 transition-colors hover:bg-bg-elevated/50"
        >
          <span className="flex-1 text-xs font-semibold text-text-secondary text-left uppercase tracking-wider">
            {exercise.notes ? "Edit Notes" : "Add Notes"}
          </span>
          {notesOpen ? (
            <ChevronUp className="h-4 w-4 text-text-secondary" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4 text-text-secondary" aria-hidden="true" />
          )}
        </button>

        <AnimatePresence>
          {notesOpen && (
            <motion.div
              id={`notes-${exercise.id}`}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-3">
                <textarea
                  value={exercise.notes || ""}
                  onChange={(e) => setExerciseNotes(exerciseIndex, e.target.value)}
                  placeholder="E.g., Seat setting 4, use straps on heaviest set..."
                  aria-label="Exercise notes"
                  className="w-full min-h-[60px] resize-none rounded-xl border border-border bg-bg-elevated p-3 text-sm text-text-primary placeholder-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-[2rem_1fr_1fr_3rem_3rem_2rem] gap-2 border-b border-border bg-bg-elevated/30 px-4 py-2">
        <span className="text-center text-xs font-semibold text-text-secondary uppercase tracking-wider">
          #
        </span>
        <span className="text-center text-xs font-semibold text-text-secondary uppercase tracking-wider">
          kg
        </span>
        <span className="text-center text-xs font-semibold text-text-secondary uppercase tracking-wider">
          reps
        </span>
        <span className="text-center text-xs font-semibold text-text-secondary uppercase tracking-wider">
          RPE
        </span>
        <span className="text-center text-xs font-semibold text-text-secondary uppercase tracking-wider">
          ✓
        </span>
        <span className="text-center text-xs font-semibold text-text-secondary uppercase tracking-wider"></span>
      </div>

      <div className="divide-y divide-border/50">
        <AnimatePresence initial={false}>
          {exercise.sets.map((set, setIdx) => (
            <SetRow
              key={set.id}
              set={set}
              setIndex={setIdx}
              ghostWeight={set.previousWeight}
              ghostReps={set.previousReps}
              onToggleComplete={handleToggleComplete}
              onUpdateWeight={handleUpdateWeight}
              onUpdateReps={handleUpdateReps}
              onUpdateRpe={handleUpdateRpe}
              onOpenTypePicker={handleOpenTypePicker}
              onRemoveSet={handleRemoveSet}
            />
          ))}
        </AnimatePresence>
      </div>

      <div className="border-t border-border p-3">
        <button
          onClick={() => addSet(exerciseIndex)}
          className="flex w-full min-h-11 items-center justify-center gap-2 rounded-xl bg-bg-elevated py-2 text-xs font-semibold text-text-secondary transition-colors hover:bg-bg-hover hover:text-primary active:scale-[0.98] uppercase tracking-wider"
        >
          <Plus className="h-4 w-4" />
          Add Set
        </button>
      </div>

      <WarmupSheet
        isOpen={showWarmup}
        onClose={() => setShowWarmup(false)}
        workingWeight={firstSetWeight}
        exerciseName={localizedName}
        exerciseEquipment={exercise.equipment}
      />
      <PlateCalculatorSheet
        isOpen={showPlates}
        onClose={() => setShowPlates(false)}
        targetWeight={firstSetWeight}
        exerciseName={localizedName}
        exerciseEquipment={exercise.equipment}
      />
      <SkipReasonModal
        isOpen={showSkipModal}
        onClose={() => setShowSkipModal(false)}
        exerciseName={localizedName}
        onSelect={handleSkipConfirm}
      />
      <ReplaceExerciseSheet
        exerciseIndex={exerciseIndex}
        currentExerciseId={exercise.exerciseId}
        target={exercise.target}
        isOpen={showReplace}
        onClose={() => setShowReplace(false)}
      />
      <SetTypePicker
        open={showTypePicker}
        onOpenChange={handleTypePickerOpenChange}
        onSelect={handleSelectType}
        currentType={currentPickerType}
      />
    </motion.div>
  );
});
