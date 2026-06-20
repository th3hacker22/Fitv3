"use client";
import { useState, useEffect, useMemo } from "react";
import { format, subDays, addDays } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui-custom/Button";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Apple,
  Flame,
  Edit,
  Trash2,
  Calculator,
  Dumbbell,
  Droplet,
  Sun,
  Moon,
  Coffee,
  Utensils,
  Settings,
} from "lucide-react";
import { useNutritionStore } from "@/store/useNutritionStore";
import { useAuthStore } from "@/store/useAuthStore";
import { cn } from "@/utils/cn";
import type { FoodEntry } from "@/db";

// Hoisted to module scope — defining MacroBar inside the component caused
// silent remounts on every render, making the progress bars re-animate from
// 0% to their value on every parent state change (entry add, day switch, etc).
function MacroBar({
  label,
  current,
  max,
  color,
}: {
  label: string;
  current: number;
  max: number;
  color: string;
}) {
  const percent = Math.min(100, Math.max(0, (current / max) * 100)) || 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs font-bold text-text-secondary uppercase tracking-wider">
        <span>{label}</span>
        <span>
          {current} / {max}g
        </span>
      </div>
      <div
        className="h-2 w-full rounded-full bg-border overflow-hidden"
        role="progressbar"
        aria-label={label}
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          className={`h-full ${color}`}
        />
      </div>
    </div>
  );
}

export default function NutritionPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);

  // Individual selectors — bare useNutritionStore() re-rendered the page on
  // every store change, including unrelated isLoading state transitions.
  const entries = useNutritionStore((s) => s.entries);
  const goal = useNutritionStore((s) => s.goal);
  const loadEntries = useNutritionStore((s) => s.loadEntries);
  const loadGoal = useNutritionStore((s) => s.loadGoal);
  const addFoodEntry = useNutritionStore((s) => s.addFoodEntry);
  const deleteFoodEntry = useNutritionStore((s) => s.deleteFoodEntry);
  const setGoal = useNutritionStore((s) => s.setGoal);
  const user = useAuthStore((s) => s.user);

  const [showCalculator, setShowCalculator] = useState(false);

  // Water tracker state — persisted per day in localStorage
  const [waterGlasses, setWaterGlasses] = useState(0);

  const waterKey = `pulse_water_${format(currentDate, "yyyy-MM-dd")}`;

  useEffect(() => {
    const stored = localStorage.getItem(waterKey);
    const count = stored ? parseInt(stored) : 0;
    setTimeout(() => {
      setWaterGlasses(count);
    }, 0);
  }, [waterKey]);

  const handleWaterToggle = (index: number) => {
    // Clicking a filled glass at index N removes it (sets count to N)
    // Clicking an empty glass at index N fills up to N+1
    const newCount = index < waterGlasses ? index : index + 1;
    setWaterGlasses(newCount);
    localStorage.setItem(waterKey, String(newCount));
  };

  const [calcWeight, setCalcWeight] = useState(70);
  const [calcHeight, setCalcHeight] = useState(170);
  const [calcAge, setCalcAge] = useState(25);
  const [calcGender, setCalcGender] = useState<"male" | "female">("male");
  const [calcActivity, setCalcActivity] = useState<
    "sedentary" | "light" | "moderate" | "active" | "extra"
  >("moderate");
  const [calcGoal, setCalcGoal] = useState<"lose" | "maintain" | "gain">("lose");

  const calculateMacros = () => {
    let bmr = 10 * calcWeight + 6.25 * calcHeight - 5 * calcAge;
    if (calcGender === "male") {
      bmr += 5;
    } else {
      bmr -= 161;
    }

    const activityFactors = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      extra: 1.9,
    };
    const factor = activityFactors[calcActivity] || 1.2;
    const tdee = bmr * factor;

    let calories = tdee;
    if (calcGoal === "lose") {
      calories -= 500;
    } else if (calcGoal === "gain") {
      calories += 300;
    }
    calories = Math.max(1200, Math.round(calories));

    let protein = Math.round(2.0 * calcWeight);
    const proteinKcal = protein * 4;
    if (proteinKcal > calories * 0.35) {
      protein = Math.round((calories * 0.3) / 4);
    } else if (proteinKcal < calories * 0.15) {
      protein = Math.round((calories * 0.2) / 4);
    }

    const fatKcal = calories * 0.25;
    const fat = Math.round(fatKcal / 9);

    const carbKcal = calories - protein * 4 - fat * 9;
    const carbs = Math.max(0, Math.round(carbKcal / 4));

    return { calories, protein, carbs, fat };
  };

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
        mealType: formData.get("mealType") as FoodEntry["mealType"],
      },
      user?.uid
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
      user?.uid
    );
    setShowGoalModal(false);
  };

  return (
    <motion.div
      className="mx-auto flex w-full max-w-lg flex-col gap-5 pb-24"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-black italic uppercase tracking-tighter text-text-primary">
          NUTRITION
        </h1>
        <p className="text-xs text-text-secondary">Track your daily fuel</p>
      </div>

      {/* Date Picker */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-bg-elevated/50 p-2">
        <button
          onClick={handlePrevDay}
          aria-label="Previous day"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:text-text-primary"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-xs font-bold uppercase tracking-widest text-text-primary">
          {format(currentDate, "MMM dd, yyyy")}
        </span>
        <button
          onClick={handleNextDay}
          aria-label="Next day"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:text-text-primary"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Calorie Ring */}
      <div className="flex flex-col items-center justify-center">
        <div className="relative flex h-[180px] w-[180px] items-center justify-center">
          {/* Background ring */}
          <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 200 200">
            <circle cx="100" cy="100" fill="none" r="90" stroke="#1f2937" strokeWidth="10" />
          </svg>
          {/* Progress ring */}
          <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 200 200">
            <motion.circle
              cx="100"
              cy="100"
              fill="none"
              r="90"
              stroke={totalCalories > safeGoal.dailyCalories ? "#ff5252" : "#ccff00"}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 90}
              initial={{ strokeDashoffset: 2 * Math.PI * 90 }}
              animate={{
                strokeDashoffset:
                  2 * Math.PI * 90 -
                  (2 * Math.PI * 90 * Math.min(100, (totalCalories / safeGoal.dailyCalories) * 100)) / 100,
              }}
              transition={{ duration: 1, ease: "easeOut" }}
              style={{ filter: `drop-shadow(0 0 8px ${totalCalories > safeGoal.dailyCalories ? "rgba(255,82,82,0.5)" : "rgba(204,255,0,0.5)"})` }}
            />
          </svg>
          {/* Center text */}
          <div className="z-10 flex flex-col items-center justify-center text-center">
            <span
              className={`text-3xl font-black italic tabular-nums ${totalCalories > safeGoal.dailyCalories ? "text-danger" : "text-primary"}`}
              style={{ textShadow: "0 0 10px rgba(204,255,0,0.3)" }}
            >
              {totalCalories}
            </span>
            <span className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-text-secondary">
              of {safeGoal.dailyCalories} kcal
            </span>
            <button
              onClick={() => setShowGoalModal(true)}
              className="mt-2 flex h-7 w-7 items-center justify-center rounded-lg bg-bg-elevated text-text-secondary transition-colors hover:text-primary"
              aria-label="Edit goals"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Macro Breakdown (3 cards) */}
      <div className="grid grid-cols-3 gap-3">
        {/* Protein */}
        <div className="glass-card flex flex-col gap-2 rounded-xl border-t-2 border-t-primary p-3">
          <div className="flex items-center justify-between">
            <Dumbbell className="h-3.5 w-3.5 text-primary" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-text-secondary">Protein</span>
          </div>
          <div className="text-sm font-black italic tabular-nums text-primary">
            {totalProtein}
            <span className="text-[9px] font-normal text-text-secondary">/{safeGoal.protein}g</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-bg-elevated">
            <motion.div
              className="h-full rounded-full bg-primary"
              style={{ boxShadow: "0 0 6px rgba(204,255,0,0.4)" }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (totalProtein / safeGoal.protein) * 100)}%` }}
              transition={{ duration: 0.8 }}
            />
          </div>
        </div>
        {/* Carbs */}
        <div className="glass-card flex flex-col gap-2 rounded-xl border-t-2 border-t-secondary p-3">
          <div className="flex items-center justify-between">
            <Flame className="h-3.5 w-3.5 text-secondary" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-text-secondary">Carbs</span>
          </div>
          <div className="text-sm font-black italic tabular-nums text-secondary">
            {totalCarbs}
            <span className="text-[9px] font-normal text-text-secondary">/{safeGoal.carbs}g</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-bg-elevated">
            <motion.div
              className="h-full rounded-full bg-secondary"
              style={{ boxShadow: "0 0 6px rgba(0,240,255,0.4)" }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (totalCarbs / safeGoal.carbs) * 100)}%` }}
              transition={{ duration: 0.8, delay: 0.1 }}
            />
          </div>
        </div>
        {/* Fat */}
        <div className="glass-card flex flex-col gap-2 rounded-xl border-t-2 border-t-warning p-3">
          <div className="flex items-center justify-between">
            <Apple className="h-3.5 w-3.5 text-warning" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-text-secondary">Fat</span>
          </div>
          <div className="text-sm font-black italic tabular-nums text-warning">
            {totalFat}
            <span className="text-[9px] font-normal text-text-secondary">/{safeGoal.fat}g</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-bg-elevated">
            <motion.div
              className="h-full rounded-full bg-warning"
              style={{ boxShadow: "0 0 6px rgba(255,171,0,0.4)" }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (totalFat / safeGoal.fat) * 100)}%` }}
              transition={{ duration: 0.8, delay: 0.2 }}
            />
          </div>
        </div>
      </div>

      {/* Meals List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <h2 className="text-sm font-bold uppercase italic text-text-primary">Today's Fuel</h2>
          <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">
            {entries.length} entries
          </span>
        </div>
        {mealTypes.map((meal) => {
          const mealEntries = entries.filter((e) => e.mealType === meal);
          const mealCals = mealEntries.reduce((acc, sum) => acc + sum.calories, 0);
          const mealIcons: Record<string, React.ElementType> = {
            breakfast: Sun,
            lunch: Utensils,
            dinner: Moon,
            snack: Coffee,
          };
          const MealIcon = mealIcons[meal] || Utensils;

          return (
            <div key={meal} className="glass-card flex flex-col gap-3 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-bg-elevated">
                    <MealIcon className="h-4 w-4 text-text-secondary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold capitalize text-text-primary">{meal}</h3>
                    {mealEntries.length > 0 && (
                      <p className="text-[10px] text-text-secondary">
                        {mealEntries.map((e) => e.name).join(", ")}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-base font-black italic text-primary">{mealCals}</span>
                  <span className="ml-1 text-[9px] font-bold uppercase text-text-secondary">KCAL</span>
                </div>
              </div>

              {mealEntries.length === 0 ? (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 rounded-lg border border-dashed border-border py-2 text-xs text-text-secondary transition-colors hover:border-primary/30 hover:text-primary"
                >
                  <Plus className="h-3 w-3" />
                  Add food
                </button>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {mealEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="group flex items-center justify-between rounded-lg bg-bg-elevated/30 p-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold text-text-primary">{entry.name}</div>
                        <div className="text-[9px] font-mono text-text-secondary">
                          {entry.protein}P • {entry.carbs}C • {entry.fat}F
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-text-primary">{entry.calories}</span>
                        <button
                          onClick={() => deleteFoodEntry(entry.id, user?.uid)}
                          aria-label="Delete food entry"
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-text-secondary opacity-0 transition-opacity hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
                        >
                          <Trash2 className="h-3 w-3" />
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

      {/* Water Tracker */}
      <div className="glass-card rounded-xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Droplet className="h-4 w-4 text-secondary" />
            <h2 className="text-sm font-bold uppercase italic text-text-primary">Hydration</h2>
          </div>
          <span className="text-[10px] font-bold text-secondary">
            {waterGlasses} / 8 glasses
          </span>
        </div>
        <div className="flex items-center justify-between gap-1">
          {Array.from({ length: 8 }).map((_, i) => {
            const filled = i < waterGlasses;
            return (
              <button
                key={i}
                onClick={() => handleWaterToggle(i)}
                className="transition-transform active:scale-90"
                aria-label={`Glass ${i + 1}`}
              >
                <Droplet
                  className={`h-7 w-7 ${filled ? "text-secondary" : "text-text-muted"}`}
                  fill={filled ? "currentColor" : "none"}
                  style={filled ? { filter: "drop-shadow(0 0 6px rgba(0,240,255,0.4))" } : undefined}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Floating Add Button */}
      <div className="fixed bottom-24 left-0 right-0 z-40 flex justify-center">
        <Button
          onClick={() => setShowAddModal(true)}
          variant="primary"
          className="pointer-events-auto flex items-center gap-2 rounded-full px-6 py-3.5 text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20 backdrop-blur-md"
          icon={<Plus className="h-4 w-4" />}
        >
          Quick Add
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
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-black text-text-primary uppercase tracking-wider">
                  {showCalculator ? "Calculate Goals" : "Edit Goals"}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowCalculator(!showCalculator)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  {showCalculator ? (
                    <>Manual Edit</>
                  ) : (
                    <>
                      <Calculator className="w-3.5 h-3.5" />
                      Auto-Calc
                    </>
                  )}
                </button>
              </div>

              {showCalculator ? (
                <div className="flex flex-col gap-4 text-left">
                  {/* Gender Selection */}
                  <div>
                    <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-1">
                      Gender
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setCalcGender("male")}
                        className={cn(
                          "py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border cursor-pointer",
                          calcGender === "male"
                            ? "bg-primary text-primary-text border-primary shadow-sm"
                            : "bg-bg-elevated text-text-secondary border-border"
                        )}
                      >
                        Male
                      </button>
                      <button
                        type="button"
                        onClick={() => setCalcGender("female")}
                        className={cn(
                          "py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border cursor-pointer",
                          calcGender === "female"
                            ? "bg-primary text-primary-text border-primary shadow-sm"
                            : "bg-bg-elevated text-text-secondary border-border"
                        )}
                      >
                        Female
                      </button>
                    </div>
                  </div>

                  {/* Weight, Height, Age Inputs */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-1">
                        Weight (kg)
                      </label>
                      <input
                        type="number"
                        required
                        min="30"
                        max="300"
                        value={calcWeight}
                        onChange={(e) => setCalcWeight(Number(e.target.value))}
                        className="w-full rounded-xl border border-border bg-bg-elevated px-3 py-2.5 text-sm text-text-primary outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-1">
                        Height (cm)
                      </label>
                      <input
                        type="number"
                        required
                        min="100"
                        max="250"
                        value={calcHeight}
                        onChange={(e) => setCalcHeight(Number(e.target.value))}
                        className="w-full rounded-xl border border-border bg-bg-elevated px-3 py-2.5 text-sm text-text-primary outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-1">
                        Age (yrs)
                      </label>
                      <input
                        type="number"
                        required
                        min="10"
                        max="100"
                        value={calcAge}
                        onChange={(e) => setCalcAge(Number(e.target.value))}
                        className="w-full rounded-xl border border-border bg-bg-elevated px-3 py-2.5 text-sm text-text-primary outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                      />
                    </div>
                  </div>

                  {/* Activity Level Dropdown */}
                  <div>
                    <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-1">
                      Activity Level
                    </label>
                    <select
                      value={calcActivity}
                      onChange={(e) => setCalcActivity(e.target.value as "sedentary" | "light" | "moderate" | "active" | "extra")}
                      className="w-full rounded-xl border border-border bg-bg-elevated px-3 py-2.5 text-sm text-text-primary outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors cursor-pointer capitalize"
                    >
                      <option value="sedentary">Sedentary (No exercise)</option>
                      <option value="light">Lightly Active (1-3 days/wk)</option>
                      <option value="moderate">Moderately Active (3-5 days/wk)</option>
                      <option value="active">Very Active (6-7 days/wk)</option>
                      <option value="extra">Extra Active (Hard labor/workouts)</option>
                    </select>
                  </div>

                  {/* Fitness Goal Tabs */}
                  <div>
                    <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-1">
                      Goal
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["lose", "maintain", "gain"] as const).map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setCalcGoal(g)}
                          className={cn(
                            "py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border cursor-pointer capitalize",
                            calcGoal === g
                              ? "bg-primary text-primary-text border-primary shadow-sm"
                              : "bg-bg-elevated text-text-secondary border-border"
                          )}
                        >
                          {g === "lose"
                            ? "Lose Fat"
                            : g === "maintain"
                              ? "Maintain"
                              : "Build Muscle"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Results Preview */}
                  {(() => {
                    const results = calculateMacros();
                    const protKcal = results.protein * 4;
                    const carbKcal = results.carbs * 4;
                    const fatKcal = results.fat * 9;
                    const totalKcal = protKcal + carbKcal + fatKcal || 1;
                    const pPct = Math.round((protKcal / totalKcal) * 100);
                    const fPct = Math.round((fatKcal / totalKcal) * 100);
                    const cPct = 100 - pPct - fPct;

                    return (
                      <div className="mt-2 p-4 rounded-2xl bg-bg border border-border flex flex-col gap-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                            Estimated Needs
                          </span>
                          <span className="text-base font-black text-primary">
                            {results.calories} kcal
                          </span>
                        </div>

                        {/* Progress bar split */}
                        <div className="h-2 w-full rounded-full bg-border flex overflow-hidden">
                          <div
                            className="bg-primary h-full transition-all duration-300"
                            style={{ width: `${pPct}%` }}
                          />
                          <div
                            className="bg-secondary h-full transition-all duration-300"
                            style={{ width: `${cPct}%` }}
                          />
                          <div
                            className="bg-warning h-full transition-all duration-300"
                            style={{ width: `${fPct}%` }}
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-primary">Protein ({pPct}%)</span>
                            <span className="font-black text-text-primary">{results.protein}g</span>
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-secondary">Carbs ({cPct}%)</span>
                            <span className="font-black text-text-primary">{results.carbs}g</span>
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-warning">Fat ({fPct}%)</span>
                            <span className="font-black text-text-primary">{results.fat}g</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Apply & Save Button */}
                  <div className="flex gap-3 mt-2">
                    <button
                      type="button"
                      onClick={() => setShowGoalModal(false)}
                      className="flex-1 rounded-xl bg-bg-elevated py-3 text-sm font-bold text-text-primary uppercase tracking-wider hover:bg-bg-elevated/50 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <Button
                      type="button"
                      onClick={async () => {
                        const results = calculateMacros();
                        await setGoal(
                          {
                            dailyCalories: results.calories,
                            protein: results.protein,
                            carbs: results.carbs,
                            fat: results.fat,
                          },
                          user?.uid
                        );
                        setShowGoalModal(false);
                      }}
                      variant="primary"
                      className="flex-1 py-3 text-sm font-black uppercase tracking-wider"
                    >
                      Apply & Save
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleGoalSubmit} className="flex flex-col gap-4">
                  <div>
                    <label className="text-xs font-bold text-text-secondary mb-1 block uppercase">
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
                      <label className="text-xs font-bold text-text-secondary mb-1 block uppercase text-primary">
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
                      <label className="text-xs font-bold text-text-secondary mb-1 block uppercase text-secondary">
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
                      <label className="text-xs font-bold text-text-secondary mb-1 block uppercase text-warning">
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
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
