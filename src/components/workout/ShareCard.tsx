import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toPng } from "html-to-image";
import { Button } from "../ui/Button";
import {
  Share2,
  Download,
  X,
  Dumbbell,
  Clock,
  Trophy,
  Flame,
} from "lucide-react";

interface ShareCardProps {
  isOpen: boolean;
  onClose: () => void;
  workoutData: {
    date: string;
    duration: number;
    totalVolume: number;
    exerciseCount: number;
    setCount: number;
    streak?: number;
  };
}

export default function ShareCard({
  isOpen,
  onClose,
  workoutData,
}: ShareCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    return `${mins} min`;
  };

  const formatVolume = (kg: number) => {
    if (kg >= 1000) return `${(kg / 1000).toFixed(1)} tons`;
    return `${kg.toLocaleString()} kg`;
  };

  // Generate and share image
  async function handleShare() {
    if (!cardRef.current) return;

    setIsGenerating(true);

    try {
      const dataUrl = await toPng(cardRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: "#0A0A0B",
      });

      // Convert to blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], "pulse-workout.png", { type: "image/png" });

      // Try native share
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: "My Pulse Workout 💪",
          text: `Just crushed a workout! Total Volume: ${formatVolume(workoutData.totalVolume)}`,
          files: [file],
        });
      } else {
        // Fallback: download
        downloadImage(dataUrl);
      }
    } catch (error) {
      console.error("Share failed:", error);
    } finally {
      setIsGenerating(false);
    }
  }

  // Download image
  async function handleDownload() {
    if (!cardRef.current) return;

    setIsGenerating(true);

    try {
      const dataUrl = await toPng(cardRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: "#0A0A0B",
      });
      downloadImage(dataUrl);
    } catch (error) {
      console.error("Download failed:", error);
    } finally {
      setIsGenerating(false);
    }
  }

  function downloadImage(dataUrl: string) {
    const link = document.createElement("a");
    link.download = `pulse-workout-${new Date().toISOString().split("T")[0]}.png`;
    link.href = dataUrl;
    link.click();
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-sm"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="mb-3 mr-auto flex h-10 w-10 items-center justify-center rounded-full bg-bg-card text-text-muted hover:text-text-primary"
            >
              <X className="h-5 w-5" />
            </button>

            {/* ── Shareable Card ── */}
            <div
              ref={cardRef}
              className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#1A1A24] via-[#0D0D14] to-[#12121A] p-8 border border-white/5"
              style={{
                boxShadow:
                  "0 20px 60px rgba(204, 255, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
              }}
            >
              {/* Graphic Background Elements */}
              <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-primary/20 blur-[60px]" />
              <div className="absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-cyan-500/20 blur-[60px]" />

              {/* Watermark */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.02] pointer-events-none flex items-center justify-center">
                <Dumbbell className="w-[300px] h-[300px]" />
              </div>

              {/* Header */}
              <div className="relative z-10 mb-8 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/20 shadow-[0_0_15px_rgba(204,255,0,0.3)] shrink-0">
                    <Dumbbell className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-xl font-black text-white uppercase tracking-widest">
                      Pulse
                    </p>
                    <p className="text-[10px] text-primary tracking-[0.3em] font-bold">
                      FITNESS
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] mb-1">
                    Workout Complete
                  </p>
                  <p className="text-sm font-medium text-white truncate max-w-[120px]">
                    {new Date(workoutData.date).toLocaleDateString("en-US", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>

              {/* Main Stats */}
              <div className="relative z-10 mb-8 flex flex-col items-center justify-center py-6 bg-black/20 rounded-3xl border border-white/5 backdrop-blur-sm">
                <p className="mb-2 text-[11px] font-bold text-primary uppercase tracking-[0.2em]">
                  Total Volume
                </p>
                <p className="text-5xl font-black text-white tabular-nums drop-shadow-md">
                  {formatVolume(workoutData.totalVolume)}
                </p>
              </div>

              {/* Stats Grid */}
              <div className="relative z-10 mb-8 grid grid-cols-3 gap-4">
                <div className="flex flex-col items-center justify-center rounded-2xl bg-white/5 p-4 border border-white/5 backdrop-blur-sm">
                  <Dumbbell className="mb-2 h-5 w-5 text-cyan-400" />
                  <p className="text-xl font-bold text-white tabular-nums">
                    {workoutData.exerciseCount}
                  </p>
                  <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest mt-1">
                    Exercises
                  </p>
                </div>
                <div className="flex flex-col items-center justify-center rounded-2xl bg-white/5 p-4 border border-white/5 backdrop-blur-sm">
                  <Trophy className="mb-2 h-5 w-5 text-warning" />
                  <p className="text-xl font-bold text-white tabular-nums">
                    {workoutData.setCount}
                  </p>
                  <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest mt-1">
                    Sets
                  </p>
                </div>
                <div className="flex flex-col items-center justify-center rounded-2xl bg-white/5 p-4 border border-white/5 backdrop-blur-sm">
                  <Clock className="mb-2 h-5 w-5 text-success" />
                  <p className="text-xl font-bold text-white tabular-nums">
                    {formatDuration(workoutData.duration)}
                  </p>
                  <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest mt-1">
                    Duration
                  </p>
                </div>
              </div>

              {/* Streak */}
              {workoutData.streak && workoutData.streak > 0 && (
                <div className="relative z-10 flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-warning/20 via-warning/10 to-warning/20 py-3 border border-warning/30 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
                  <Flame className="h-5 w-5 text-warning" />
                  <p className="text-sm font-black text-warning uppercase tracking-widest drop-shadow-sm">
                    {workoutData.streak} Day Streak 🔥
                  </p>
                </div>
              )}

              {/* Footer */}
              <div className="relative z-10 mt-8 flex items-center justify-center gap-2">
                <span className="h-px flex-1 bg-gradient-to-r from-transparent to-border/50"></span>
                <p className="text-[9px] font-bold text-text-muted uppercase tracking-[0.2em]">
                  Powered by <span className="text-primary">Pulse</span>
                </p>
                <span className="h-px flex-1 bg-gradient-to-l from-transparent to-border/50"></span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-4 flex gap-3">
              <Button
                onClick={handleShare}
                disabled={isGenerating}
                variant="primary"
                className="flex-1 py-3.5 text-sm font-semibold"
                icon={<Share2 className="h-4 w-4" />}
              >
                Share
              </Button>
              <Button
                onClick={handleDownload}
                disabled={isGenerating}
                variant="outline"
                className="px-4 py-3.5 bg-bg-elevated/50 text-text-secondary border-border"
                icon={<Download className="h-4 w-4" />}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
