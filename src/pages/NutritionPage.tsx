import { useState, useEffect } from "react";
import { format, subDays, addDays } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Apple,
  Flame,
  Edit,
  Trash2,
} from "lucide-react";
import { useNutritionStore } from "@/store/useNutritionStore";
import { useAuthStore } from "@/store/useAuthStore";

export default function NutritionPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);

  const {
    entries,
    goal,
    loadEntries,
    loadGoal,
    addFoodEntry,
    deleteFoodEntry,
    setGoal,
  } = useNutritionStore();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    const formattedDate = format(currentDate, "yyyy-MM-dd");
    loadEntries(formattedDate);
  }, [currentDate, loadEntries]);

  useEffect(() => {
    loadGoal();
  }, [loadGoal]);

  const handlePrevDay = () => setCurrentDate((prev) => subDays(prev, 1));
  const handleNextDay = () => setCurrentDate((prev) => addDays(prev, 1));

  const safeGoal = goal || {
    dailyCalories: 2000,
    protein: 150,
    carbs: 200,
    fat: 65,
    id: "temp",
    updatedAt: "",
  };

  const totalCalories = entries.reduce((acc, sum) => acc + sum.calories, 0);
  const totalProtein = entries.reduce((acc, sum) => acc + sum.protein, 0);
  const totalCarbs = entries.reduce((acc, sum) => acc + sum.carbs, 0);
  const totalFat = entries.reduce((acc, sum) => acc + sum.fat, 0);

  const mealTypes = ["breakfast", "lunch", "dinner", "snack"] as const;

  const handleAddSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    await addFoodEntry(
      {
        date: format(currentDate, "yyyy-MM-dd"),
        name: formData.get("name") as string,
        calories: Number(formData.get("calories")),
        protein: Number(formData.get("protein")),
        carbs: Number(formData.get("carbs")),
        fat: Number(formData.get("fat")),
        mealType: formData.get("mealType") as any,
      },
      user?.uid,
    );
    setShowAddModal(false);
  };

  const handleGoalSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    await setGoal(
      {
        dailyCalories: Number(formData.get("calories")),
        protein: Number(formData.get("protein")),
        carbs: Number(formData.get("carbs")),
        fat: Number(formData.get("fat")),
      },
      user?.uid,
    );
    setShowGoalModal(false);
  };

  const MacroBar = ({
    label,
    current,
    max,
    color,
  }: {
    label: string;
    current: number;
    max: number;
    color: string;
  }) => {
    const percent = Math.min(100, Math.max(0, (current / max) * 100)) || 0;
    return (
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-xs font-bold text-text-secondary uppercase tracking-wider">
          <span>{label}</span>
          <span>
            {current} / {max}g
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-border overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            className={`h-full ${color}`}
          />
        </div>
      </div>
    );
  };

  return (
    <motion.div
      className="mx-auto flex w-full max-w-lg flex-col gap-6 pb-24" // Extra padding for footer + fab
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-black text-text-primary uppercase tracking-tight">
          Nutrition
        </h1>
        <p className="text-sm text-text-muted">Track your daily intake</p>
      </div>

      {/* Date Picker */}
      <div className="flex items-center justify-between bg-bg-elevated rounded-xl p-2 border border-border">
        <button
          onClick={handlePrevDay}
          className="p-2 text-text-muted hover:text-text-primary transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="font-bold text-sm text-text-primary uppercase tracking-wider">
          {format(currentDate, "MMM dd, yyyy")}
        </span>
        <button
          onClick={handleNextDay}
          className="p-2 text-text-muted hover:text-text-primary transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Summary Widget */}
      <div className="glass-card p-5 rounded-2xl flex flex-col gap-6">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1">
              Calories Remaining
            </div>
            <div className="text-3xl font-black text-text-primary">
              {Math.max(0, safeGoal.dailyCalories - totalCalories)}
            </div>
            <div className="text-xs text-text-muted mt-1">
              {totalCalories} consumed • Goal: {safeGoal.dailyCalories}
            </div>
          </div>
          <button
            onClick={() => setShowGoalModal(true)}
            className="p-2 rounded-lg bg-bg text-text-muted hover:text-text-primary transition-colors"
          >
            <Edit className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <MacroBar
            label="Protein"
            current={totalProtein}
            max={safeGoal.protein}
            color="bg-primary"
          />
          <MacroBar
            label="Carbs"
            current={totalCarbs}
            max={safeGoal.carbs}
            color="bg-secondary"
          />
          <MacroBar
            label="Fat"
            current={totalFat}
            max={safeGoal.fat}
            color="bg-warning"
          />
        </div>
      </div>

      {/* Meals List */}
      <div className="flex flex-col gap-4">
        {mealTypes.map((meal) => {
          const mealEntries = entries.filter((e) => e.mealType === meal);
          const mealCals = mealEntries.reduce(
            (acc, sum) => acc + sum.calories,
            0,
          );

          return (
            <div
              key={meal}
              className="border border-border/50 rounded-2xl p-4 bg-bg"
            >
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-sm text-text-primary uppercase tracking-wider mb-0">
                  {meal}
                </h3>
                <span className="text-xs font-bold text-text-muted">
                  {mealCals} kcal
                </span>
              </div>

              {mealEntries.length === 0 ? (
                <div className="text-xs text-text-muted/50 italic">
                  No entries yet
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {mealEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex justify-between items-center group bg-bg-elevated/30 p-2 rounded-lg"
                    >
                      <div>
                        <div className="text-sm font-semibold text-text-secondary">
                          {entry.name}
                        </div>
                        <div className="text-[10px] text-text-muted font-mono mt-0.5">
                          {entry.protein}P • {entry.carbs}C • {entry.fat}F
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-text-primary">
                          {entry.calories}
                        </span>
                        <button
                          onClick={() => deleteFoodEntry(entry.id, user?.uid)}
                          className="opacity-0 group-hover:opacity-100 text-danger/70 hover:text-danger transition-opacity"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating Add Action */}
      <div className="fixed bottom-20 left-0 right-0 pointer-events-none flex justify-center z-40">
        <Button
          onClick={() => setShowAddModal(true)}
          variant="primary"
          className="pointer-events-auto rounded-full px-6 py-4 font-bold uppercase tracking-wider shadow-lg shadow-primary/20 backdrop-blur-md"
          icon={<Plus className="h-5 w-5" />}
        >
          Add Food
        </Button>
      </div>

      {/* Add Food Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="glass-card w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-border"
            >
              <h2 className="text-lg font-black text-text-primary uppercase tracking-wider mb-4">
                Add Food
              </h2>
              <form onSubmit={handleAddSubmit} className="flex flex-col gap-4">
                <input
                  required
                  name="name"
                  type="text"
                  placeholder="Food Name"
                  className="w-full rounded-xl border border-border bg-bg p-3 text-sm text-text-primary focus:border-primary focus:outline-none"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    required
                    name="calories"
                    type="number"
                    placeholder="Calories"
                    className="w-full rounded-xl border border-border bg-bg p-3 text-sm text-text-primary focus:border-primary focus:outline-none"
                  />
                  <select
                    required
                    name="mealType"
                    className="w-full rounded-xl border border-border bg-bg p-3 text-sm text-text-primary focus:border-primary focus:outline-none"
                  >
                    <option value="breakfast">Breakfast</option>
                    <option value="lunch">Lunch</option>
                    <option value="dinner">Dinner</option>
                    <option value="snack">Snack</option>
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <input
                    required
                    name="protein"
                    type="number"
                    placeholder="Protein (g)"
                    className="w-full rounded-xl border border-border bg-bg p-3 text-sm text-text-primary focus:border-primary focus:outline-none"
                  />
                  <input
                    required
                    name="carbs"
                    type="number"
                    placeholder="Carbs (g)"
                    className="w-full rounded-xl border border-border bg-bg p-3 text-sm text-text-primary focus:border-primary focus:outline-none"
                  />
                  <input
                    required
                    name="fat"
                    type="number"
                    placeholder="Fat (g)"
                    className="w-full rounded-xl border border-border bg-bg p-3 text-sm text-text-primary focus:border-primary focus:outline-none"
                  />
                </div>
                <div className="flex gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 rounded-xl bg-bg-elevated py-3 text-sm font-bold text-text-primary uppercase tracking-wider hover:bg-bg-elevated/50"
                  >
                    Cancel
                  </button>
                  <Button
                    type="submit"
                    variant="primary"
                    className="flex-1 w-full py-3 text-sm font-black uppercase tracking-wider"
                  >
                    Add
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Goals Modal */}
      <AnimatePresence>
        {showGoalModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="glass-card w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-border"
            >
              <h2 className="text-lg font-black text-text-primary uppercase tracking-wider mb-4">
                Edit Goals
              </h2>
              <form onSubmit={handleGoalSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-bold text-text-muted mb-1 block uppercase">
                    Daily Calories
                  </label>
                  <input
                    required
                    defaultValue={safeGoal.dailyCalories}
                    name="calories"
                    type="number"
                    className="w-full rounded-xl border border-border bg-bg p-3 text-sm text-text-primary focus:border-primary focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold text-text-muted mb-1 block uppercase text-primary">
                      Protein (g)
                    </label>
                    <input
                      required
                      defaultValue={safeGoal.protein}
                      name="protein"
                      type="number"
                      className="w-full rounded-xl border border-border bg-bg p-3 text-sm text-text-primary focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-text-muted mb-1 block uppercase text-secondary">
                      Carbs (g)
                    </label>
                    <input
                      required
                      defaultValue={safeGoal.carbs}
                      name="carbs"
                      type="number"
                      className="w-full rounded-xl border border-border bg-bg p-3 text-sm text-text-primary focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-text-muted mb-1 block uppercase text-warning">
                      Fat (g)
                    </label>
                    <input
                      required
                      defaultValue={safeGoal.fat}
                      name="fat"
                      type="number"
                      className="w-full rounded-xl border border-border bg-bg p-3 text-sm text-text-primary focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => setShowGoalModal(false)}
                    className="flex-1 rounded-xl bg-bg-elevated py-3 text-sm font-bold text-text-primary uppercase tracking-wider hover:bg-bg-elevated/50"
                  >
                    Cancel
                  </button>
                  <Button
                    type="submit"
                    variant="primary"
                    className="flex-1 w-full py-3 text-sm font-black uppercase tracking-wider"
                  >
                    Save
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
