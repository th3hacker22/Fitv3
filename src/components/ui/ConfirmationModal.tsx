import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "./Button";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
}: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[101] flex items-center justify-center p-6"
          >
            <div className="w-full max-w-sm rounded-3xl bg-bg-card p-6 shadow-2xl border border-border">
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-xl font-bold text-text-primary">{title}</h2>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="rounded-full p-2 text-text-muted hover:bg-bg-elevated transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="text-sm text-text-muted mb-6">{description}</p>
              <div className="flex gap-3">
                <Button variant="ghost" className="flex-1" onClick={onClose}>
                  {cancelText}
                </Button>
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={onConfirm}
                >
                  {confirmText}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
