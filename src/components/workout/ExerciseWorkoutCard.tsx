import { motion, AnimatePresence } from "framer-motion";
import {
  Lightbulb,
  Dumbbell,
  ChevronDown,
  ChevronUp,
  Play,
  Plus,
} from "lucide-react";
import { useState, useCallback, memo } from "react";
import { cn } from "@/utils/cn";
import {
  useWorkoutStore,
  type WorkoutExerciseItem,
} from "@/store/useWorkoutStore";
import ReplaceExerciseSheet from "./ReplaceExerciseSheet";
import SetRow from "./SetRow";

interface Props {
  exercise: WorkoutExerciseItem;
  exerciseIndex: number;
}

export default memo(function ExerciseWorkoutCard({
  exercise,
  exerciseIndex,
}: Props) {
  const updateSet = useWorkoutStore((s) => s.updateSet);
  const toggleSetComplete = useWorkoutStore((s) => s.toggleSetComplete);
  const addSet = useWorkoutStore((s) => s.addSet);
  const removeSet = useWorkoutStore((s) => s.removeSet);
  const setExerciseNotes = useWorkoutStore((s) => s.setExerciseNotes);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [showGif, setShowGif] = useState(false);

  const handleToggleComplete = useCallback(
    (setId: string) => {
      toggleSetComplete(exerciseIndex, setId);
    },
    [toggleSetComplete, exerciseIndex],
  );

  const handleUpdateWeight = useCallback(
    (setId: string, value: string) => {
      updateSet(exerciseIndex, setId, { weight: value });
    },
    [updateSet, exerciseIndex],
  );

  const handleUpdateReps = useCallback(
    (setId: string, value: string) => {
      updateSet(exerciseIndex, setId, { reps: value });
    },
    [updateSet, exerciseIndex],
  );

  const handleUpdateRpe = useCallback(
    (setId: string, value: string) => {
      updateSet(exerciseIndex, setId, { rpe: value });
    },
    [updateSet, exerciseIndex],
  );

  const handleRemoveSet = useCallback(
    (setId: string) => {
      removeSet(exerciseIndex, setId);
    },
    [removeSet, exerciseIndex],
  );

  const completedSets = exercise.sets.filter((s) => s.completed).length;
  const totalSets = exercise.sets.length;

  return (
    <motion.div
      className="overflow-hidden rounded-[--radius-card] border border-border bg-bg-card"
      style={{ boxShadow: "var(--shadow-card)" }}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: exerciseIndex * 0.1 }}
    >
      <div className="relative aspect-video bg-bg-elevated overflow-hidden">
        <img
          src={showGif ? exercise.gifUrl : exercise.imageUrl}
          alt={exercise.exerciseName}
          className="h-full w-full object-contain"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        <div className="absolute inset-0 -z-10 flex items-center justify-center">
          <Dumbbell className="h-12 w-12 text-text-muted/20" />
        </div>

        <button
          onClick={() => setShowGif(!showGif)}
          className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-lg bg-bg/80 px-2.5 py-1.5 text-[10px] font-semibold text-text-primary backdrop-blur-sm tracking-wider uppercase border border-border/50"
        >
          {showGif ? (
            "Image"
          ) : (
            <>
              <Play className="h-3 w-3 fill-primary text-primary" /> Anim
            </>
          )}
        </button>

        <div className="absolute top-2 right-2 rounded-full bg-bg/80 px-2.5 py-1 text-[10px] font-bold text-primary backdrop-blur-sm">
          {completedSets}/{totalSets}
        </div>
      </div>

      <div className="flex items-start gap-3 border-b border-border p-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-text-primary capitalize">
            {exercise.exerciseName}
          </h3>
          <p className="text-xs text-text-muted">
            {exercise.equipment} · {exercise.target}
          </p>
        </div>
        <ReplaceExerciseSheet
          exerciseIndex={exerciseIndex}
          currentExerciseId={exercise.exerciseId}
          target={exercise.target}
        />
      </div>

      {exercise.tips.length > 0 && (
        <div className="border-b border-border">
          <button
            onClick={() => setTipsOpen(!tipsOpen)}
            className="flex w-full items-center gap-2 px-4 py-3 text-right transition-colors hover:bg-bg-elevated/50"
          >
            <Lightbulb className="h-4 w-4 flex-shrink-0 text-warning" />
            <span className="flex-1 text-xs font-medium text-warning text-left uppercase tracking-wider">
              Captain's Tip
            </span>
            {tipsOpen ? (
              <ChevronUp className="h-4 w-4 text-text-muted" />
            ) : (
              <ChevronDown className="h-4 w-4 text-text-muted" />
            )}
          </button>

          <AnimatePresence>
            {tipsOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="space-y-1.5 bg-warning/5 px-4 pb-3 pt-1">
                  {exercise.tips.map((tip, i) => (
                    <p
                      key={i}
                      className="text-[11px] leading-relaxed text-text-secondary"
                    >
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
          className="flex w-full items-center gap-2 px-4 py-3 transition-colors hover:bg-bg-elevated/50"
        >
          <span className="flex-1 text-xs font-semibold text-text-secondary text-left uppercase tracking-wider">
            {exercise.notes ? "Edit Notes" : "Add Notes"}
          </span>
          {notesOpen ? (
            <ChevronUp className="h-4 w-4 text-text-muted" />
          ) : (
            <ChevronDown className="h-4 w-4 text-text-muted" />
          )}
        </button>

        <AnimatePresence>
          {notesOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-3">
                <textarea
                  value={exercise.notes || ""}
                  onChange={(e) =>
                    setExerciseNotes(exerciseIndex, e.target.value)
                  }
                  placeholder="E.g., Seat setting 4, use straps on heaviest set..."
                  className="w-full min-h-[60px] resize-none rounded-xl border border-border bg-bg-elevated p-3 text-sm text-text-primary placeholder-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-[2rem_1fr_1fr_3rem_3rem_2rem] gap-2 border-b border-border bg-bg-elevated/30 px-4 py-2">
        <span className="text-center text-[10px] font-semibold text-text-muted uppercase tracking-wider">
          #
        </span>
        <span className="text-center text-[10px] font-semibold text-text-muted uppercase tracking-wider">
          kg
        </span>
        <span className="text-center text-[10px] font-semibold text-text-muted uppercase tracking-wider">
          reps
        </span>
        <span className="text-center text-[10px] font-semibold text-text-muted uppercase tracking-wider">
          RPE
        </span>
        <span className="text-center text-[10px] font-semibold text-text-muted uppercase tracking-wider">
          ✓
        </span>
        <span className="text-center text-[10px] font-semibold text-text-muted uppercase tracking-wider"></span>
      </div>

      <div className="divide-y divide-border/50">
        <AnimatePresence initial={false}>
          {exercise.sets.map((set, setIdx) => (
            <SetRow
              key={set.id}
              set={set}
              setIndex={setIdx}
              exerciseIndex={exerciseIndex}
              ghostWeight={set.previousWeight}
              ghostReps={set.previousReps}
              onToggleComplete={() => handleToggleComplete(set.id)}
              onUpdateWeight={(val) => handleUpdateWeight(set.id, val)}
              onUpdateReps={(val) => handleUpdateReps(set.id, val)}
              onUpdateRpe={(val) => handleUpdateRpe(set.id, val)}
              onRemoveSet={() => handleRemoveSet(set.id)}
            />
          ))}
        </AnimatePresence>
      </div>

      <div className="border-t border-border p-3">
        <button
          onClick={() => addSet(exerciseIndex)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-bg-elevated py-2.5 text-xs font-semibold text-text-secondary transition-colors hover:bg-bg-hover hover:text-primary active:scale-[0.98] uppercase tracking-wider"
        >
          <Plus className="h-4 w-4" />
          Add Set
        </button>
      </div>
    </motion.div>
  );
});
