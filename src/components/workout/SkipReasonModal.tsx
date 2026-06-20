"use client";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle } from "lucide-react";
import { useState } from "react";

export type SkipReason =
  | "too-tired"
  | "equipment-busy"
  | "pain"
  | "dont-like"
  | "time"
  | "other";

interface SkipReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  exerciseName: string;
  onSelect: (reason: SkipReason, note?: string) => void;
}

const REASONS: Array<{ value: SkipReason; label: string; icon: string }> = [
  { value: "too-tired", label: "Too tired", icon: "😴" },
  { value: "equipment-busy", label: "Equipment busy", icon: "🏋️" },
  { value: "pain", label: "Pain / discomfort", icon: "⚠️" },
  { value: "dont-like", label: "Don't like this exercise", icon: "👎" },
  { value: "time", label: "Running out of time", icon: "⏰" },
  { value: "other", label: "Other reason", icon: "📝" },
];

export default function SkipReasonModal({
  isOpen,
  onClose,
  exerciseName,
  onSelect,
}: SkipReasonModalProps) {
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState("");

  const handleSelect = (reason: SkipReason) => {
    if (reason === "other") {
      setShowNote(true);
      return;
    }
    onSelect(reason);
    reset();
  };

  const handleSubmitNote = () => {
    onSelect("other", note);
    reset();
  };

  const reset = () => {
    setShowNote(false);
    setNote("");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => { onClose(); reset(); }}
          className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl border border-border bg-bg-card p-6 shadow-2xl"
          >
            {!showNote ? (
              <>
                {/* Header */}
                <div className="mb-5 flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-warning" />
                    <h2 className="text-base font-black uppercase tracking-tight text-text-primary">
                      Skip Exercise?
                    </h2>
                  </div>
                  <button
                    onClick={() => { onClose(); reset(); }}
                    aria-label="Close"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:text-text-primary"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <p className="mb-4 text-sm text-text-secondary">
                  You&apos;re skipping <span className="font-bold text-text-primary capitalize">{exerciseName}</span>.
                  Why? This helps us personalize your future workouts.
                </p>

                {/* Reason grid */}
                <div className="grid grid-cols-2 gap-2">
                  {REASONS.map((reason) => (
                    <button
                      key={reason.value}
                      onClick={() => handleSelect(reason.value)}
                      className="flex flex-col items-center gap-2 rounded-xl border border-border bg-bg-elevated/50 p-4 text-center transition-all hover:border-primary hover:bg-primary/5 active:scale-95"
                    >
                      <span className="text-2xl">{reason.icon}</span>
                      <span className="text-xs font-bold text-text-primary uppercase tracking-wider">
                        {reason.label}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                {/* Note input for "other" */}
                <div className="mb-5 flex items-start justify-between">
                  <h2 className="text-base font-black uppercase tracking-tight text-text-primary">
                    Tell us more
                  </h2>
                  <button
                    onClick={() => { onClose(); reset(); }}
                    aria-label="Close"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:text-text-primary"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What's the reason?"
                  autoFocus
                  className="mb-4 w-full min-h-[80px] resize-none rounded-xl border border-border bg-bg-elevated p-3 text-sm text-text-primary placeholder-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />

                <div className="flex gap-2">
                  <button
                    onClick={() => setShowNote(false)}
                    className="flex-1 rounded-xl bg-bg-elevated py-3 text-xs font-bold uppercase tracking-wider text-text-secondary hover:text-text-primary"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleSubmitNote}
                    disabled={!note.trim()}
                    className="flex-[2] rounded-xl bg-primary py-3 text-xs font-black uppercase tracking-wider text-black disabled:opacity-50"
                  >
                    Submit
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
