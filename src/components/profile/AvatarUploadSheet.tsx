"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef } from "react";
import { X, Camera, Trash2, Upload } from "lucide-react";
import { resizeImage, saveAvatar, removeAvatar, hasAvatar } from "@/services/avatarService";
import { notifyAvatarUpdated } from "@/components/ui-custom/Avatar";
import { useAuthStore } from "@/store/useAuthStore";

interface AvatarUploadSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AvatarUploadSheet({ isOpen, onClose }: AvatarUploadSheetProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const currentUser = useAuthStore((s) => s.user);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsProcessing(true);

    try {
      if (!file.type.startsWith("image/")) {
        setError("Please select an image file");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setError("Image too large (max 10MB)");
        return;
      }

      if (!currentUser?.uid) {
        setError("You must be signed in to upload an avatar");
        return;
      }

      const resized = await resizeImage(file, 256);
      await saveAvatar(resized, currentUser.uid);
      notifyAvatarUpdated();
      onClose();
    } catch (err) {
      console.error("[avatar] Upload failed:", err);
      setError("Failed to process image. Please try another.");
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  };

  const handleRemove = () => {
    removeAvatar();
    notifyAvatarUpdated();
    onClose();
  };

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

            <div className="mb-5 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Camera className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-black uppercase tracking-tight text-text-primary">
                    Profile Photo
                  </h2>
                </div>
                <p className="mt-0.5 text-xs text-text-secondary">
                  Choose a photo from your gallery or take a new one
                </p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-bg-elevated text-text-secondary hover:text-text-primary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-bold text-danger">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <button
                onClick={() => cameraInputRef.current?.click()}
                disabled={isProcessing}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-bg-elevated/50 p-4 transition-colors hover:border-primary/30 hover:bg-primary/5 disabled:opacity-50"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Camera className="h-5 w-5 text-primary" />
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-bold text-text-primary">Take Photo</h3>
                  <p className="text-xs text-text-secondary">Use your camera</p>
                </div>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-bg-elevated/50 p-4 transition-colors hover:border-secondary/30 hover:bg-secondary/5 disabled:opacity-50"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/10">
                  <Upload className="h-5 w-5 text-secondary" />
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-bold text-text-primary">Choose from Gallery</h3>
                  <p className="text-xs text-text-secondary">Select an existing photo</p>
                </div>
              </button>

              {hasAvatar() && (
                <button
                  onClick={handleRemove}
                  disabled={isProcessing}
                  className="flex w-full items-center gap-3 rounded-xl border border-danger/30 bg-danger/5 p-4 transition-colors hover:bg-danger/10 disabled:opacity-50"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-danger/10">
                    <Trash2 className="h-5 w-5 text-danger" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-sm font-bold text-danger">Remove Photo</h3>
                    <p className="text-xs text-text-secondary">Use default avatar</p>
                  </div>
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />

            {isProcessing && (
              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-text-secondary">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Processing image...
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
