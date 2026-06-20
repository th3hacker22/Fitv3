"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { Zap } from "lucide-react";

interface SplashScreenProps {
  onComplete: () => void;
  duration?: number;
}

/**
 * Pulse Fitness Splash Screen.
 *
 * Full-screen black overlay with:
 * - Animated radial glow background (CSS-only, no WebGL for perf)
 * - Lightning bolt logo with neon glow + spring entrance
 * - "PULSE" wordmark in italic black uppercase
 * - "PUSH YOUR LIMITS. TRACK EVERY REP." tagline
 * - Animated loading bar (lime neon, shimmer)
 *
 * Auto-dismisses after `duration` ms (default 2500).
 */
export default function SplashScreen({ onComplete, duration = 2500 }: SplashScreenProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      // Wait for fade-out animation before calling onComplete
      setTimeout(onComplete, 500);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#050505] transition-opacity duration-500"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Animated radial glow background */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <motion.div
              className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(204,255,0,0.15) 0%, rgba(0,240,255,0.05) 40%, transparent 70%)",
              }}
              animate={{
                scale: [1, 1.15, 1],
                opacity: [0.6, 0.9, 0.6],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            />
            {/* Floating particles */}
            {Array.from({ length: 6 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute h-1 w-1 rounded-full bg-primary"
                style={{
                  left: `${20 + i * 15}%`,
                  top: `${30 + (i % 3) * 20}%`,
                  boxShadow: "0 0 8px rgba(204,255,0,0.8)",
                }}
                animate={{
                  y: [0, -20, 0],
                  opacity: [0, 1, 0],
                }}
                transition={{
                  duration: 2 + i * 0.3,
                  repeat: Infinity,
                  delay: i * 0.4,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>

          {/* Main content */}
          <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-[448px] px-5">
            {/* Logo with glow */}
            <motion.div
              className="relative"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                type: "spring",
                damping: 15,
                stiffness: 200,
                delay: 0.2,
              }}
            >
              {/* Glow behind logo */}
              <div className="absolute inset-0 rounded-[24px] bg-primary/30 blur-2xl" />
              {/* Logo container */}
              <div
                className="relative z-10 flex h-[120px] w-[120px] items-center justify-center rounded-[24px] border border-primary/30 bg-bg-elevated/50 backdrop-blur-xl"
                style={{ boxShadow: "0 0 60px rgba(204,255,0,0.4)" }}
              >
                <Zap className="h-14 w-14 text-primary" strokeWidth={2.5} />
              </div>
            </motion.div>

            {/* PULSE wordmark */}
            <motion.h1
              className="mt-6 text-7xl font-black italic uppercase tracking-tighter text-white"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.4 }}
              style={{ textShadow: "0 0 30px rgba(204,255,0,0.3)" }}
            >
              PULSE
            </motion.h1>

            {/* Tagline */}
            <motion.p
              className="mt-3 text-center text-xs font-bold uppercase tracking-[0.3em] text-text-secondary"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9, duration: 0.4 }}
            >
              PUSH YOUR LIMITS. TRACK EVERY REP.
            </motion.p>

            {/* Loading bar */}
            <motion.div
              className="absolute bottom-12 left-1/2 h-[2px] w-[200px] -translate-x-1/2 overflow-hidden rounded-full bg-white/10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
            >
              <motion.div
                className="h-full rounded-full bg-primary"
                style={{ boxShadow: "0 0 10px rgba(204,255,0,0.8)" }}
                animate={{
                  x: ["-100%", "100%"],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
