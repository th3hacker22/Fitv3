import { useState, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Search,
  Plus,
  Save,
  Trash2,
  X,
  Link as LinkIcon,
  GripVertical,
  Dumbbell,
  Play,
} from "lucide-react";
import { Drawer } from "vaul";
import { Button } from "@/components/ui/Button";
import { useExerciseStore } from "@/store/useExerciseStore";
import { useRoutineStore } from "@/store/useRoutineStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useToastStore } from "@/store/useToastStore";
import { db, type RoutineExercise } from "@/db";
import { uid } from "@/utils/id";
import { cn } from "@/utils/cn";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ── Sortable Item Component ──
function SortableExerciseItem({
  exercise,
  onRemove,
  onUpdate,
  onToggleSuperset,
}: {
  exercise: RoutineExercise;
  onRemove: () => void;
  onUpdate: (updates: Partial<RoutineExercise>) => void;
  onToggleSuperset: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: exercise.order });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative rounded-[--radius-card] bg-bg-card p-4 shadow-sm border border-border/50",
        isDragging && "opacity-50 z-50 ring-2 ring-primary",
      )}
    >
      <div className="flex items-start gap-3">
        <button
          className="mt-1 cursor-grab text-text-muted hover:text-text-primary active:cursor-grabbing shrink-0"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" />
        </button>

        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">
              {exercise.exerciseName}
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={onToggleSuperset}
                className={cn(
                  "p-1.5 rounded-lg transition-colors border",
                  exercise.isSupersetWithNext
                    ? "bg-warning/20 text-warning border-warning/50"
                    : "bg-bg-elevated text-text-muted border-transparent hover:text-text-primary",
                )}
                title="Superset with next"
              >
                <LinkIcon className="h-4 w-4" />
              </button>
              <button
                onClick={onRemove}
                className="p-1.5 rounded-lg bg-danger/10 text-danger transition-colors hover:bg-danger/20"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-1">
                Sets
              </label>
              <input
                type="number"
                min="1"
                value={exercise.targetSets}
                onChange={(e) =>
                  onUpdate({ targetSets: Number(e.target.value) || 1 })
                }
                className="w-full rounded-lg border border-border bg-bg-elevated px-2 py-1.5 text-sm font-semibold tabular-nums text-text-primary outline-none focus:border-primary focus:ring-1 focus:ring-primary text-center"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-1">
                Reps
              </label>
              <input
                type="number"
                min="1"
                value={exercise.targetReps}
                onChange={(e) =>
                  onUpdate({ targetReps: Number(e.target.value) || 1 })
                }
                className="w-full rounded-lg border border-border bg-bg-elevated px-2 py-1.5 text-sm font-semibold tabular-nums text-text-primary outline-none focus:border-primary focus:ring-1 focus:ring-primary text-center"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-1">
                Rest (s)
              </label>
              <input
                type="number"
                min="0"
                step="5"
                value={exercise.restTimer}
                onChange={(e) =>
                  onUpdate({ restTimer: Number(e.target.value) || 0 })
                }
                className="w-full rounded-lg border border-border bg-bg-elevated px-2 py-1.5 text-sm font-semibold tabular-nums text-text-primary outline-none focus:border-primary focus:ring-1 focus:ring-primary text-center"
              />
            </div>
          </div>
        </div>
      </div>

      {exercise.isSupersetWithNext && (
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 z-10 w-8 h-8 rounded-full bg-warning border-4 border-bg flex items-center justify-center shadow-md">
          <LinkIcon className="h-3 w-3 text-bg" />
        </div>
      )}
    </div>
  );
}

export default function BuilderPage() {
  const navigate = useNavigate();
  const { exercises, loadExercises } = useExerciseStore();

  const [name, setName] = useState("");
  const [routineExercises, setRoutineExercises] = useState<RoutineExercise[]>(
    [],
  );
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeDragId, setActiveDragId] = useState<number | null>(null);

  useEffect(() => {
    loadExercises();
  }, [loadExercises]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = (event: any) => {
    setActiveDragId(event.active.id);
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    setActiveDragId(null);
    if (!over) return;

    if (active.id !== over.id) {
      setRoutineExercises((items) => {
        const oldIndex = items.findIndex((i) => i.order === active.id);
        const newIndex = items.findIndex((i) => i.order === over.id);

        let newItems = arrayMove(items, oldIndex, newIndex);
        // Resync orders
        newItems = newItems.map((item, idx) => ({ ...item, order: idx }));
        return newItems;
      });
    }
  };

  const getSmartDefaults = async (exerciseId: string) => {
    try {
      const sessions = await db.workoutSessions
        .orderBy("date")
        .reverse()
        .filter((s) => s.completed === true)
        .toArray();
      let bestSets = 3;
      let bestReps = 10;

      for (const session of sessions) {
        const ex = session.exercises.find(
          (e) => String(e.exerciseId) === String(exerciseId),
        );
        if (ex && ex.sets.length > 0) {
          bestSets = ex.sets.length;
          bestReps = Math.max(...ex.sets.map((s) => s.reps));
          break; // Found recent data
        }
      }
      return { targetSets: bestSets, targetReps: bestReps };
    } catch {
      return { targetSets: 3, targetReps: 10 };
    }
  };

  const addExercise = async (exercise: any) => {
    const defaults = await getSmartDefaults(exercise.id);
    const newItem: RoutineExercise = {
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      targetSets: defaults.targetSets,
      targetReps: defaults.targetReps,
      restTimer: 60,
      isSupersetWithNext: false,
      order: routineExercises.length,
      imageUrl: exercise.imageUrl,
      equipment: exercise.equipment,
    };

    setRoutineExercises([...routineExercises, newItem]);
    setIsSearchOpen(false);
    setSearchQuery("");
  };

  const updateExercise = (order: number, updates: Partial<RoutineExercise>) => {
    setRoutineExercises((items) =>
      items.map((item) =>
        item.order === order ? { ...item, ...updates } : item,
      ),
    );
  };

  const removeExercise = (order: number) => {
    setRoutineExercises((items) => {
      let newItems = items.filter((item) => item.order !== order);
      // Clean up superset if last item was removed or sync orders
      newItems = newItems.map((item, idx) => ({
        ...item,
        order: idx,
        isSupersetWithNext:
          idx === newItems.length - 1 ? false : item.isSupersetWithNext,
      }));
      return newItems;
    });
  };

  const saveRoutineState = useRoutineStore((s) => s.saveRoutine);
  const user = useAuthStore((s) => s.user);
  const startWorkout = useWorkoutStore((s) => s.startWorkout);

  const saveRoutine = async () => {
    if (!name.trim() || routineExercises.length === 0) {
      useToastStore
        .getState()
        .addToast("error", "Please provide a name and at least one exercise.");
      return;
    }

    try {
      await saveRoutineState(
        {
          id: uid(),
          name,
          exercises: routineExercises,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        user?.uid,
      );
      useToastStore.getState().addToast("success", "Routine saved!");
      navigate({ to: "/" });
    } catch (e) {
      console.error(e);
      useToastStore.getState().addToast("error", "Failed to save routine.");
    }
  };

  const handeStartSession = async () => {
    if (routineExercises.length === 0) return;
    const exerciseIds = routineExercises.map((ex) => String(ex.exerciseId));
    const sessionId = await startWorkout(exerciseIds);
    navigate({ to: `/workout/$sessionId`, params: { sessionId } });
  };

  const totalSets = routineExercises.reduce(
    (acc, curr) => acc + curr.targetSets,
    0,
  );

  const filteredExercises = exercises.filter((ex) =>
    ex.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="space-y-6 pb-24">
      {/* ── Page Header ── */}
      <div className="flex items-center gap-3">
        <Link
          to="/"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-bg-elevated text-text-secondary transition-colors hover:text-text-primary"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-text-primary uppercase tracking-wider">
            Custom Routine
          </h1>
          <p className="text-sm text-text-secondary">
            Build your perfect workout
          </p>
        </div>
      </div>

      {/* Routine Name */}
      <div className="glass-card p-4 rounded-[--radius-card]">
        <label className="text-[10px] font-bold text-text-primary uppercase tracking-wider block mb-2">
          Routine Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Push Day Alpha"
          className="w-full rounded-xl border border-border bg-bg-elevated px-4 py-3 text-sm font-semibold text-text-primary outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Stats Summary */}
      <div className="flex gap-4 p-4 glass-card rounded-[--radius-card] bg-primary/5">
        <div className="flex-1">
          <p className="text-[10px] uppercase font-bold text-primary mb-1">
            Total Exercises
          </p>
          <p className="text-xl font-bold tabular-nums text-text-primary">
            {routineExercises.length}
          </p>
        </div>
        <div className="w-px bg-border/50" />
        <div className="flex-1">
          <p className="text-[10px] uppercase font-bold text-primary mb-1">
            Total Sets
          </p>
          <p className="text-xl font-bold tabular-nums text-text-primary">
            {totalSets}
          </p>
        </div>
        <div className="w-px bg-border/50" />
        <div className="flex-1">
          <p className="text-[10px] uppercase font-bold text-primary mb-1">
            Est. Reps
          </p>
          <p className="text-xl font-bold tabular-nums text-text-primary">
            {routineExercises.reduce(
              (acc, curr) => acc + curr.targetSets * curr.targetReps,
              0,
            )}
          </p>
        </div>
      </div>

      {/* Exercises List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-text-primary uppercase tracking-wider">
            Exercises
          </h2>
          <Drawer.Root open={isSearchOpen} onOpenChange={setIsSearchOpen}>
            <Drawer.Trigger asChild>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider hover:bg-primary/20 transition-colors">
                <Plus className="h-3 w-3" />
                Add
              </button>
            </Drawer.Trigger>
            <Drawer.Portal>
              <Drawer.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
              <Drawer.Content className="fixed bottom-0 inset-x-0 mx-auto max-w-md max-h-[85vh] rounded-t-[2rem] bg-bg-card p-4 shadow-2xl flex flex-col z-50 outline-none">
                <div className="mx-auto mb-6 h-1 w-12 rounded-full bg-border" />

                <div className="flex items-center justify-between mb-4">
                  <Drawer.Title className="font-bold text-lg uppercase tracking-wider">
                    Add Exercise
                  </Drawer.Title>
                  <Drawer.Close asChild>
                    <button className="p-2 rounded-full bg-bg-elevated text-text-muted hover:text-text-primary transition-colors">
                      <X className="h-5 w-5" />
                    </button>
                  </Drawer.Close>
                </div>

                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                  <input
                    type="text"
                    placeholder="Search exercises..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-xl border border-border bg-bg-elevated pl-10 pr-4 py-3 text-sm text-text-primary outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                  />
                </div>

                <div className="flex-1 overflow-y-auto min-h-0 space-y-2 pb-8">
                  {filteredExercises.map((ex) => (
                    <button
                      key={ex.id}
                      onClick={() => addExercise(ex)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl bg-bg-elevated hover:bg-bg-elevated/80 transition-colors text-left"
                    >
                      <div className="h-12 w-12 rounded-lg bg-bg overflow-hidden flex-shrink-0">
                        {ex.imageUrl ? (
                          <img
                            src={ex.imageUrl}
                            alt={ex.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center">
                            <Dumbbell className="h-5 w-5 text-text-muted" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate">{ex.name}</p>
                        <p className="text-xs text-text-muted capitalize">
                          {ex.equipment}
                        </p>
                      </div>
                      <Plus className="h-5 w-5 text-primary shrink-0" />
                    </button>
                  ))}
                </div>
              </Drawer.Content>
            </Drawer.Portal>
          </Drawer.Root>
        </div>

        {routineExercises.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 border border-dashed border-border rounded-[--radius-card] bg-bg-elevated/30">
            <Dumbbell className="h-10 w-10 text-text-muted/30 mb-3" />
            <p className="text-sm text-text-secondary">
              No exercises added yet.
            </p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={routineExercises.map((ex) => ex.order)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-4">
                {routineExercises.map((exercise, index) => (
                  <SortableExerciseItem
                    key={exercise.order}
                    exercise={exercise}
                    onRemove={() => removeExercise(exercise.order)}
                    onUpdate={(updates) =>
                      updateExercise(exercise.order, updates)
                    }
                    onToggleSuperset={() =>
                      updateExercise(exercise.order, {
                        isSupersetWithNext:
                          index !== routineExercises.length - 1 &&
                          !exercise.isSupersetWithNext,
                      })
                    }
                  />
                ))}
              </div>
            </SortableContext>
            <DragOverlay>
              {activeDragId !== null ? (
                <div className="rounded-[--radius-card] bg-bg-card p-4 shadow-xl border border-primary/50 opacity-90 ring-2 ring-primary">
                  <p className="font-bold text-sm">
                    {
                      routineExercises.find((ex) => ex.order === activeDragId)
                        ?.exerciseName
                    }
                  </p>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* Fixed Action Bar */}
      <div className="fixed bottom-16 left-0 right-0 p-4 bg-gradient-to-t from-bg via-bg to-transparent z-40">
        <div className="max-w-md mx-auto flex gap-3">
          <Button
            onClick={saveRoutine}
            disabled={!name.trim() || routineExercises.length === 0}
            variant="primary"
            className="flex-1 py-4 text-base tracking-wider uppercase font-bold"
            icon={<Save className="h-5 w-5" />}
          >
            Save
          </Button>
          <Button
            onClick={handeStartSession}
            disabled={routineExercises.length === 0}
            className="flex-1 bg-text-primary text-[#050505] hover:opacity-90 py-4 text-base tracking-wider uppercase font-bold flex items-center justify-center gap-2"
          >
            <Play className="h-5 w-5 fill-current" /> Start
          </Button>
        </div>
      </div>
    </div>
  );
}
