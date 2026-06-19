"use client";
import { useState } from "react";
import { useNavigate } from "@/router-shim";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Mail, Lock, Loader2, UserRound, ArrowRight } from "lucide-react";
import { useAuthStore, type LocalUser } from "@/store/useAuthStore";
import { socialService } from "@/services/socialService";
import { uid } from "@/utils/id";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const signInLocal = async (emailInput: string) => {
    const isGuest = !emailInput || emailInput === "guest@pulse.local";

    const mockUser: LocalUser = {
      uid: isGuest
        ? `local-guest-${uid()}`
        : `local-user-${emailInput.replace(/[^a-zA-Z0-9]/g, "")}`,
      email: emailInput || "guest@pulse.local",
      displayName: localStorage.getItem("pulse_user_name") || (emailInput && emailInput !== "guest@pulse.local"
        ? emailInput.split("@")[0]
        : "Pulse Athlete"),
      photoURL: null,
    };

    await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: mockUser.uid }),
    });

    localStorage.setItem("local_user", JSON.stringify(mockUser));
    useAuthStore.getState().setUser(mockUser);
    socialService
      .updatePublicProfile(mockUser.uid, mockUser.displayName || "Athlete", null)
      .catch(() => {});
    navigate({ to: "/" });
  };

  const handleGuestSignIn = async () => {
    setError("");
    setLoading(true);
    try {
      await signInLocal("");
    } catch {
      setError("Sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) {
      setError("Please enter an email");
      return;
    }
    setLoading(true);
    try {
      await signInLocal(email);
    } catch {
      setError("Sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="-mx-4 relative flex min-h-[100dvh] flex-col items-center justify-center bg-[#050505] overflow-hidden px-4 py-8 select-none">
      {/* ── Background Gym Image with High-Contrast Vignette ── */}
      <div className="absolute inset-0 z-0 h-full w-full overflow-hidden">
        <img
          src="/images/auth-bg.jpg"
          alt="Athlete training"
          className="h-full w-full object-cover object-top filter brightness-[0.22] contrast-[1.15] saturate-[0.7]"
        />
        {/* Sleek Gradient & Ambient Glows */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/85 to-[#050505]/45" />
        
        {/* Kinetic Neon Glow Orbs */}
        <div className="absolute top-1/4 left-1/10 w-[300px] h-[300px] rounded-full bg-[#ccff00]/5 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/10 w-[350px] h-[350px] rounded-full bg-[#00f0ff]/5 blur-[140px] pointer-events-none" />
      </div>

      {/* ── Main Authentication Box (Centered Glassmorphic Panel) ── */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md bg-zinc-950/75 border border-white/[0.08] backdrop-blur-xl shadow-[0_32px_64px_rgba(0,0,0,0.8)] px-6 py-10 rounded-none overflow-hidden"
      >
        {/* Subtle top border glow line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#ccff00]/40 to-transparent" />

        {/* ── Brand Logo & Heading ── */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex items-center gap-3">
            <motion.span 
              animate={{ boxShadow: ["0 0 15px rgba(204,255,0,0.3)", "0 0 25px rgba(204,255,0,0.6)", "0 0 15px rgba(204,255,0,0.3)"] }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
              className="flex h-12 w-12 items-center justify-center bg-[#ccff00] text-black rounded-none"
            >
              <Zap className="h-6 w-6 fill-current" />
            </motion.span>
            <span className="text-3xl font-black italic tracking-tighter text-white uppercase drop-shadow-[0_0_10px_rgba(204,255,0,0.2)]">
              PULSE
            </span>
          </div>
          <h2 className="text-2xl font-black italic leading-tight text-white uppercase tracking-tighter">
            Push your limits.
            <span className="text-[#ccff00] block mt-0.5"> Track every rep.</span>
          </h2>
        </div>

        {/* ── Form Heading ── */}
        <div className="mb-6 text-center">
          <h1 className="text-xl font-black italic uppercase text-white tracking-tight">
            {isLogin ? "WELCOME BACK" : "CREATE ACCOUNT"}
          </h1>
          <p className="text-[10px] text-text-secondary uppercase font-bold tracking-widest mt-1">
            {isLogin ? "Sign in to continue your journey" : "Start tracking your progress today"}
          </p>
        </div>

        {/* ── Offline-First Glass Banner ── */}
        <div className="mb-6 bg-white/[0.02] border-l-4 border-l-[#00f0ff] p-4 text-[11px] text-text-secondary leading-relaxed rounded-none border border-y-white/5 border-r-white/5">
          <span className="font-black text-[#00f0ff] uppercase block mb-1 tracking-wider text-[10px]">OFFLINE-FIRST MODE</span>
          Your account data is stored locally. Activities sync automatically to the cloud feed when published.
        </div>

        {/* ── Error Banner ── */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 overflow-hidden"
            >
              <p className="border border-red-500/30 bg-red-500/10 p-3 text-center text-xs font-bold uppercase tracking-wider text-red-400 rounded-none">
                {error}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Form Inputs ── */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-4">
            {/* Email Input */}
            <div className="relative group">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary group-focus-within:text-[#ccff00] transition-colors" />
              <input
                id="email-input"
                type="email"
                placeholder="EMAIL ADDRESS"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-none border border-white/10 bg-white/[0.03] py-4 pl-12 pr-4 text-xs text-white placeholder:text-text-muted focus:border-[#ccff00]/60 focus:bg-white/[0.05] focus:outline-none transition-all uppercase tracking-widest"
                required
              />
            </div>
            
            {/* Password Input */}
            <div className="relative group">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary group-focus-within:text-[#ccff00] transition-colors" />
              <input
                id="password-input"
                type="password"
                placeholder="PASSWORD (ANY VALUE WORKS)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-none border border-white/10 bg-white/[0.03] py-4 pl-12 pr-4 text-xs text-white placeholder:text-text-muted focus:border-[#ccff00]/60 focus:bg-white/[0.05] focus:outline-none transition-all uppercase tracking-widest"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#ccff00] hover:bg-[#b3e600] active:scale-[0.98] text-black font-black italic uppercase text-xs py-4 px-6 rounded-none tracking-widest transition-all shadow-[0_4px_20px_rgba(204,255,0,0.25)] hover:shadow-[0_4px_30px_rgba(204,255,0,0.45)] flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-black" />
            ) : (
              <>
                {isLogin ? "LOGIN" : "SIGN UP"}
                <ArrowRight className="h-4 w-4 stroke-[3px]" />
              </>
            )}
          </button>
        </form>

        {/* ── Divider ── */}
        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-white/[0.08]" />
          </div>
          <div className="relative flex justify-center text-[9px] font-black uppercase tracking-widest">
            <span className="bg-[#09090b] px-3 text-text-muted">Or continue with</span>
          </div>
        </div>

        {/* ── Guest Button ── */}
        <button
          type="button"
          onClick={handleGuestSignIn}
          disabled={loading}
          className="w-full border border-white/10 hover:border-white/20 bg-white/[0.01] hover:bg-white/[0.04] active:scale-[0.98] text-white font-black italic uppercase text-xs py-4 px-6 rounded-none tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <UserRound className="h-4 w-4 text-[#ccff00]" />
          CONTINUE AS GUEST
        </button>

        {/* ── Toggle Auth Mode ── */}
        <button
          type="button"
          onClick={() => {
            setIsLogin(!isLogin);
            setError("");
          }}
          className="w-full text-center text-xs font-bold uppercase tracking-widest text-text-secondary transition-colors hover:text-white mt-6"
        >
          {isLogin ? (
            <>
              Don&apos;t have an account?{" "}
              <span className="text-[#ccff00] underline font-black italic">Sign up</span>
            </>
          ) : (
            <>
              Already have an account? <span className="text-[#ccff00] underline font-black italic">Login</span>
            </>
          )}
        </button>
      </motion.div>
    </div>
  );
}
