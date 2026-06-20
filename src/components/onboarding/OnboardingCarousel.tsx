"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useCallback } from "react";
import { ArrowRight, Sparkles, Trophy, Users, User, TrendingUp } from "lucide-react";

interface OnboardingCarouselProps {
  onComplete: (name?: string) => void;
}

interface Slide {
  id: number;
  icon: typeof Sparkles;
  iconColor: string;
  glowColor: string;
  headline: string;
  headlineAccent: string;
  description: string;
  buttonText: string;
}

const SLIDES: Slide[] = [
  {
    id: 0,
    icon: Sparkles,
    iconColor: "text-primary",
    glowColor: "rgba(204,255,0,0.2)",
    headline: "AI-Powered",
    headlineAccent: "Workouts",
    description:
      "Your AI Coach analyzes 30+ data points — fatigue, RPE, muscle balance — to generate the perfect workout every time.",
    buttonText: "Continue",
  },
  {
    id: 1,
    icon: Trophy,
    iconColor: "text-warning",
    glowColor: "rgba(255,171,0,0.2)",
    headline: "Track Every",
    headlineAccent: "PR",
    description:
      "Celebrate personal records with confetti, voice announcements, and haptic feedback. Every rep counts.",
    buttonText: "Continue",
  },
  // Social Proof 1: Stats
  {
    id: 2,
    icon: TrendingUp,
    iconColor: "text-success",
    glowColor: "rgba(0,230,118,0.2)",
    headline: "2M+ Sets",
    headlineAccent: "Tracked",
    description:
      "Pulse athletes have tracked over 2 million sets this month alone. Every rep brings you closer to your goals.",
    buttonText: "Continue",
  },
  // Social Proof 2: Community
  {
    id: 3,
    icon: Users,
    iconColor: "text-secondary",
    glowColor: "rgba(0,240,255,0.2)",
    headline: "Join 50,000+",
    headlineAccent: "Athletes",
    description:
      "Compete in challenges, share your progress, and stay motivated with a community that pushes you forward.",
    buttonText: "Continue",
  },
];

/**
 * Pulse Fitness Onboarding Carousel.
 *
 * 4-step flow:
 * 1-3. Marketing slides (AI/PR/Community)
 * 4. Name input ("What's your name?")
 *
 * Stores the entered name in localStorage on completion.
 */
export default function OnboardingCarousel({ onComplete }: OnboardingCarouselProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [userName, setUserName] = useState("");

  const handleNext = useCallback(() => {
    if (currentSlide < SLIDES.length) {
      setCurrentSlide((prev) => prev + 1);
    } else {
      // Last step (name input) — complete with the entered name
      const trimmed = userName.trim();
      if (trimmed) {
        localStorage.setItem("pulse_user_name", trimmed);
      }
      onComplete(trimmed || undefined);
    }
  }, [currentSlide, userName, onComplete]);

  const handleSkip = useCallback(() => {
    onComplete();
  }, [onComplete]);

  const isNameStep = currentSlide === SLIDES.length;

  return (
    <div className="fixed inset-0 z-[150] flex flex-col bg-[#050505]">
      {/* Skip button */}
      <header className="fixed top-0 z-50 flex w-full justify-end px-5 py-4">
        <button
          onClick={handleSkip}
          className="text-xs font-bold uppercase tracking-widest text-text-secondary transition-opacity hover:opacity-80 active:scale-95"
        >
          Skip
        </button>
      </header>

      {/* Main content */}
      <main className="flex flex-1 flex-col items-center justify-center px-5 pt-16 pb-32">
        <AnimatePresence mode="wait">
          {isNameStep ? (
            <NameStep key="name-step" userName={userName} setUserName={setUserName} onSubmit={handleNext} />
          ) : (
            <motion.div
              key={currentSlide}
              className="flex flex-1 flex-col items-center justify-center"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ type: "spring", damping: 25, stiffness: 300, duration: 0.4 }}
            >
              <MarketingSlide slide={SLIDES[currentSlide]} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom navigation */}
      <footer className="fixed bottom-0 z-50 flex w-full flex-col items-center gap-8 bg-gradient-to-t from-[#050505] via-[#050505]/90 to-transparent px-5 pb-12 pt-8">
        {/* Page indicator dots */}
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: SLIDES.length + 1 }).map((_, i) => (
            <motion.div
              key={i}
              className="h-1 rounded-full"
              animate={{
                width: i === currentSlide ? 32 : 8,
                backgroundColor:
                  i === currentSlide ? "rgb(204, 255, 0)" : "rgba(255,255,255,0.15)",
                boxShadow:
                  i === currentSlide ? "0 0 12px rgba(204,255,0,0.6)" : "none",
              }}
              transition={{ duration: 0.3 }}
            />
          ))}
        </div>

        {/* Primary action button */}
        {isNameStep ? (
          <motion.button
            onClick={handleNext}
            whileTap={{ scale: 0.98 }}
            disabled={!userName.trim()}
            className="flex h-14 w-full max-w-md items-center justify-center gap-2 rounded-xl bg-primary py-3 text-base font-black uppercase italic tracking-wider text-black transition-transform hover:scale-[1.02] disabled:opacity-40 disabled:hover:scale-100"
            style={{ boxShadow: "0 0 20px rgba(204,255,0,0.3)" }}
          >
            Start Training
            <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
          </motion.button>
        ) : (
          <motion.button
            onClick={handleNext}
            whileTap={{ scale: 0.98 }}
            className="flex h-14 w-full max-w-md items-center justify-center gap-2 rounded-xl bg-primary py-3 text-base font-black uppercase italic tracking-wider text-black transition-transform hover:scale-[1.02]"
            style={{ boxShadow: "0 0 20px rgba(204,255,0,0.3)" }}
          >
            {SLIDES[currentSlide].buttonText}
            <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
          </motion.button>
        )}
      </footer>
    </div>
  );
}

// ── Marketing Slide Component ──
function MarketingSlide({ slide }: { slide: Slide }) {
  const Icon = slide.icon;
  return (
    <>
      {/* Illustration area */}
      <div className="relative mb-8 flex h-[300px] w-full max-w-[300px] items-center justify-center">
        <motion.div
          className="absolute inset-0 rounded-full blur-[80px]"
          style={{ background: slide.glowColor }}
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="absolute inset-0 scale-90 rounded-full border border-white/10 bg-white/5 backdrop-blur-md" />
        <motion.div
          className="relative z-10"
          animate={{ y: [0, -12, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          <div
            className={`flex h-32 w-32 items-center justify-center rounded-3xl border border-white/10 bg-bg-elevated/30 backdrop-blur-xl ${slide.iconColor}`}
            style={{ boxShadow: `0 0 40px ${slide.glowColor}` }}
          >
            <Icon className="h-16 w-16" strokeWidth={1.5} />
          </div>
        </motion.div>
      </div>

      {/* Text content */}
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <motion.h1
          className="text-4xl font-black italic uppercase tracking-tight text-white"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {slide.headline}
          <br />
          <span className={slide.iconColor}>{slide.headlineAccent}</span>
        </motion.h1>
        <motion.p
          className="max-w-xs text-sm leading-relaxed text-text-secondary"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          {slide.description}
        </motion.p>
      </div>
    </>
  );
}

// ── Name Input Step ──
function NameStep({
  userName,
  setUserName,
  onSubmit,
}: {
  userName: string;
  setUserName: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <motion.div
      key="name-step"
      className="flex flex-1 flex-col items-center justify-center"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ type: "spring", damping: 25, stiffness: 300, duration: 0.4 }}
    >
      {/* Illustration */}
      <div className="relative mb-8 flex h-[200px] w-full max-w-[200px] items-center justify-center">
        <motion.div
          className="absolute inset-0 rounded-full blur-[80px]"
          style={{ background: "rgba(204,255,0,0.15)" }}
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="absolute inset-0 scale-90 rounded-full border border-white/10 bg-white/5 backdrop-blur-md" />
        <motion.div
          className="relative z-10"
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          <div
            className="flex h-24 w-24 items-center justify-center rounded-3xl border border-primary/20 bg-bg-elevated/30 backdrop-blur-xl"
            style={{ boxShadow: "0 0 40px rgba(204,255,0,0.2)" }}
          >
            <User className="h-12 w-12 text-primary" strokeWidth={1.5} />
          </div>
        </motion.div>
      </div>

      {/* Text */}
      <div className="flex flex-col items-center gap-3 text-center">
        <motion.h1
          className="text-3xl font-black italic uppercase tracking-tight text-white"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          What's your <span className="text-primary">name?</span>
        </motion.h1>
        <motion.p
          className="max-w-xs text-sm leading-relaxed text-text-secondary"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          We'll personalize your experience and greet you properly.
        </motion.p>
      </div>

      {/* Name input */}
      <motion.div
        className="mt-8 w-full max-w-xs"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <input
          type="text"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          placeholder="Enter your name"
          maxLength={20}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && userName.trim()) {
              onSubmit();
            }
          }}
          className="w-full rounded-xl border border-border bg-bg-elevated/50 px-4 py-3.5 text-center text-lg font-bold text-text-primary placeholder-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
        />
      </motion.div>
    </motion.div>
  );
}
