"use client";
import { motion, AnimatePresence } from "framer-motion";
import { X, Dumbbell, AlertTriangle } from "lucide-react";
import { useState, useMemo } from "react";
import {
  calculatePlates,
  formatPlateStack,
  plateColor,
  GYM_PRESETS,
  type PlateConfig,
} from "@/services/plateCalculator";

interface PlateCalculatorSheetProps {
  isOpen: boolean;
  onClose: () => void;
  targetWeight: number;
  exerciseName: string;
  exerciseEquipment: string;
}

type PresetName = keyof typeof GYM_PRESETS;

const PRESET_LABELS: Record<PresetName, string> = {
  commercial: "Commercial Gym",
  home: "Home Gym",
  powerlifting: "Powerlifting",
  womensBar: "Women's Bar (15kg)",
};

export default function PlateCalculatorSheet({
  isOpen,
  onClose,
  targetWeight,
  exerciseName,
  exerciseEquipment,
}: PlateCalculatorSheetProps) {
  const [preset, setPreset] = useState<PresetName>("commercial");

  const config: PlateConfig = GYM_PRESETS[preset];
  const result = useMemo(
    () => calculatePlates(targetWeight, config),
    [targetWeight, config]
  );

  const isBarbellExercise = exerciseEquipment?.toLowerCase().includes("barbell");

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-[95] mx-auto max-w-md rounded-t-3xl border-t border-border bg-bg-card p-5 pb-safe shadow-2xl"
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-border" />

            {/* Header */}
            <div className="mb-4 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Dumbbell className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-black uppercase tracking-tight text-text-primary">
                    Plate Calculator
                  </h2>
                </div>
                <p className="mt-0.5 text-xs font-medium text-text-secondary capitalize">
                  {exerciseName} · Target: {targetWeight}kg
                </p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close plate calculator"
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-bg-elevated text-text-secondary hover:text-text-primary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {!isBarbellExercise ? (
              <div className="rounded-2xl border border-border bg-bg-elevated/50 p-6 text-center">
                <Dumbbell className="mx-auto h-8 w-8 text-text-muted mb-2" />
                <p className="text-sm font-medium text-text-secondary">
                  This exercise doesn't use a barbell.
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  Plate calculator is only for barbell exercises.
                </p>
              </div>
            ) : (
              <>
                {/* Preset selector */}
                <div className="mb-4 flex gap-1.5 overflow-x-auto no-scrollbar">
                  {(Object.keys(PRESET_LABELS) as PresetName[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPreset(p)}
                      className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                        preset === p
                          ? "bg-primary text-black"
                          : "bg-bg-elevated text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      {PRESET_LABELS[p]}
                    </button>
                  ))}
                </div>

                {/* Not exact warning */}
                {!result.exact && (
                  <div className="mb-3 flex items-center gap-2 rounded-xl bg-warning/10 px-3 py-2 text-xs font-semibold text-warning">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Can't reach {targetWeight}kg exactly. Actual: {result.actualWeight}kg (short by {result.shortfall}kg).
                  </div>
                )}

                {/* Barbell visual */}
                <div className="mb-4 rounded-2xl border border-border bg-bg-elevated/30 p-4">
                  {/* Total weight */}
                  <div className="mb-3 text-center">
                    <span className="text-3xl font-black tabular-nums text-text-primary">
                      {result.actualWeight}
                    </span>
                    <span className="ml-1 text-sm font-bold text-text-secondary">kg total</span>
                  </div>

                  {/* Barbell + plates visualization */}
                  <div className="flex items-center justify-center gap-1 py-3">
                    {/* Left plates */}
                    <div className="flex items-center gap-0.5 flex-row-reverse">
                      {result.platesPerSide.map((plate, i) => (
                        <div
                          key={i}
                          className={`h-10 w-3 rounded-sm ${plateColor(plate)}`}
                          title={`${plate}kg`}
                        />
                      ))}
                    </div>

                    {/* Left collar */}
                    <div className="h-2 w-1 bg-gray-600 rounded" />

                    {/* Bar */}
                    <div className="h-1.5 w-20 bg-gradient-to-r from-gray-600 to-gray-400 rounded" />

                    {/* Bar label */}
                    <div className="absolute" />

                    {/* Right collar */}
                    <div className="h-2 w-1 bg-gray-600 rounded" />

                    {/* Right plates */}
                    <div className="flex items-center gap-0.5">
                      {result.platesPerSide.map((plate, i) => (
                        <div
                          key={i}
                          className={`h-10 w-3 rounded-sm ${plateColor(plate)}`}
                          title={`${plate}kg`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Bar weight label */}
                  <div className="text-center text-xs text-text-muted">
                    Bar: {config.barWeight}kg · Per side: {result.perSide}kg
                  </div>
                </div>

                {/* Plate list */}
                <div className="space-y-1.5">
                  <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">
                    Load per side:
                  </p>
                  {result.platesPerSide.length === 0 ? (
                    <p className="text-sm text-text-muted text-center py-2">
                      Empty bar only ({config.barWeight}kg)
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {result.platesPerSide.map((plate, i) => (
                        <div
                          key={i}
                          className={`flex items-center gap-1.5 rounded-lg ${plateColor(plate)} px-2.5 py-1.5 text-xs font-bold ${
                            plate === 5 ? "text-gray-800" : "text-white"
                          }`}
                        >
                          {plate}kg
                        </div>
                      ))}
                    </div>
                  )}
                  {result.platesPerSide.length > 0 && (
                    <p className="mt-2 text-center text-xs text-text-muted">
                      {formatPlateStack(result.platesPerSide)} per side
                    </p>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
