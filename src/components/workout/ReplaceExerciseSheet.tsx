"use client";
import { Drawer } from "vaul";
import { RefreshCw, X, Dumbbell } from "lucide-react";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useExerciseStore } from "@/store/useExerciseStore";
import { getAlternativeExercises } from "@/services/exerciseService";

interface Props {
  exerciseIndex: number;
  currentExerciseId: string;
  target: string;
}

export default function ReplaceExerciseSheet({ exerciseIndex, currentExerciseId, target }: Props) {
  const replaceExercise = useWorkoutStore((s) => s.replaceExercise);
  const exercises = useExerciseStore((s) => s.exercises);

  // Find alternatives: same target muscle, exclude current
  const alternatives = getAlternativeExercises(exercises, currentExerciseId, 4);

  const handleReplace = async (newId: string) => {
    await replaceExercise(exerciseIndex, newId);
  };

  return (
    <Drawer.Root shouldScaleBackground>
      <Drawer.Trigger asChild>
        <button className="flex h-12 w-12 items-center justify-center rounded-xl bg-bg-elevated text-text-secondary transition-all duration-200 hover:bg-primary-muted hover:text-primary active:scale-90">
          <RefreshCw className="h-4 w-4" />
        </button>
      </Drawer.Trigger>

      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-[201] mx-auto max-w-md rounded-t-2xl bg-bg-card">
          {/* Drag Handle */}
          <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-border" />

          <div className="p-5">
            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
              <Drawer.Title className="text-base font-bold text-text-primary uppercase tracking-wider">
                🔄 Alternative Exercises
              </Drawer.Title>
              <Drawer.Close asChild>
                <button className="flex h-12 w-12 items-center justify-center rounded-xl text-text-secondary hover:text-text-primary">
                  <X className="h-5 w-5" />
                </button>
              </Drawer.Close>
            </div>

            <p className="mb-4 text-xs text-text-secondary uppercase tracking-wider">
              Choose an alternative for ({target})
            </p>

            {/* Alternatives List */}
            <div className="space-y-2 pb-6 max-h-[50vh] overflow-y-auto">
              {alternatives.length > 0 ? (
                alternatives.map((ex) => (
                  <Drawer.Close asChild key={ex.id}>
                    <button
                      onClick={() => handleReplace(ex.id)}
                      className="flex w-full items-center gap-3 rounded-xl bg-bg-elevated p-4 transition-all duration-200 hover:bg-bg-hover hover:ring-1 hover:ring-primary/30 active:scale-[0.98]"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-bg-card overflow-hidden">
                        <img
                          src={ex.imageUrl}
                          alt={ex.name}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                        <Dumbbell className="absolute h-6 w-6 text-primary/30" />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-sm font-bold text-text-primary capitalize truncate">
                          {ex.name}
                        </p>
                        <p className="text-xs text-text-secondary capitalize">{ex.equipment}</p>
                      </div>
                      <span className="rounded-full bg-primary-muted px-2 py-0.5 text-xs font-medium text-primary shrink-0 capitalize">
                        {ex.target}
                      </span>
                    </button>
                  </Drawer.Close>
                ))
              ) : (
                <div className="flex flex-col items-center gap-2 py-10">
                  <Dumbbell className="h-10 w-10 text-text-secondary/30" />
                  <p className="text-sm text-text-secondary uppercase tracking-wider">
                    No alternatives found
                  </p>
                </div>
              )}
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
