"use client";
import { useState, useEffect } from "react";
import { useNavigate } from "@/router-shim";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Mail, Lock, Loader2, ArrowRight, RefreshCw } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifiedMessage, setVerifiedMessage] = useState("");
  const navigate = useNavigate();
  const emailVerificationNeeded = useAuthStore((s) => s.emailVerificationNeeded);

  useEffect(() => {
    if (!emailVerificationNeeded) return;
    const user = auth.currentUser;
    if (user && !user.emailVerified) {
      setError("Please verify your email before signing in. Check your inbox.");
    }
  }, [emailVerificationNeeded]);

  const handleResendVerification = async () => {
    const user = auth.currentUser;
    if (user) {
      await sendEmailVerification(user);
      setVerifiedMessage("Verification email resent! Check your inbox.");
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      const message = err instanceof Error ? err.message : "Google sign-in failed";
      if (code !== "auth/popup-closed-by-user") {
        setError(message);
      }
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
    if (!password.trim()) {
      setError("Please enter a password");
      return;
    }
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(cred.user);
        setVerifiedMessage("Verification email sent. Check your inbox and verify before signing in.");
        setIsLogin(true);
      }
    } catch (err) {
      const code = (err as { code?: string })?.code;
      const message = err instanceof Error ? err.message : "Authentication failed";
      const msg =
        code === "auth/user-not-found" || code === "auth/invalid-credential"
          ? "Invalid email or password"
          : code === "auth/email-already-in-use"
          ? "An account with this email already exists"
          : code === "auth/weak-password"
          ? "Password must be at least 6 characters"
          : message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="-mx-4 relative flex min-h-[100dvh] flex-col items-center justify-center bg-[#050505] overflow-hidden px-4 py-8 select-none">
      <div className="absolute inset-0 z-0 h-full w-full overflow-hidden">
        <img
          src="/images/auth-bg.jpg"
          alt="Athlete training"
          className="h-full w-full object-cover object-top filter brightness-[0.22] contrast-[1.15] saturate-[0.7]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/85 to-[#050505]/45" />
        <div className="absolute top-1/4 left-1/10 w-[300px] h-[300px] rounded-full bg-[#ccff00]/5 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/10 w-[350px] h-[350px] rounded-full bg-[#00f0ff]/5 blur-[140px] pointer-events-none" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md bg-zinc-950/75 border border-white/[0.08] backdrop-blur-xl shadow-[0_32px_64px_rgba(0,0,0,0.8)] px-6 py-10 rounded-none overflow-hidden"
      >
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#ccff00]/40 to-transparent" />

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

        <div className="mb-6 text-center">
          <h1 className="text-xl font-black italic uppercase text-white tracking-tight">
            {isLogin ? "WELCOME BACK" : "CREATE ACCOUNT"}
          </h1>
          <p className="text-[10px] text-text-secondary uppercase font-bold tracking-widest mt-1">
            {isLogin ? "Sign in to continue your journey" : "Start tracking your progress today"}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {verifiedMessage && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 overflow-hidden"
            >
              <p className="border border-[#ccff00]/30 bg-[#ccff00]/10 p-3 text-center text-xs font-bold uppercase tracking-wider text-[#ccff00] rounded-none">
                {verifiedMessage}
              </p>
            </motion.div>
          )}
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

        {emailVerificationNeeded && (
          <div className="mb-4 flex justify-center">
            <button
              type="button"
              onClick={handleResendVerification}
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#ccff00] hover:text-white transition-colors cursor-pointer"
            >
              <RefreshCw className="h-3 w-3" />
              Resend verification email
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-4">
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

            <div className="relative group">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary group-focus-within:text-[#ccff00] transition-colors" />
              <input
                id="password-input"
                type="password"
                placeholder="PASSWORD"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-none border border-white/10 bg-white/[0.03] py-4 pl-12 pr-4 text-xs text-white placeholder:text-text-muted focus:border-[#ccff00]/60 focus:bg-white/[0.05] focus:outline-none transition-all uppercase tracking-widest"
                required
              />
            </div>
          </div>

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

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-white/[0.08]" />
          </div>
          <div className="relative flex justify-center text-[9px] font-black uppercase tracking-widest">
            <span className="bg-[#09090b] px-3 text-text-muted">Or continue with</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full border border-white/10 hover:border-white/20 bg-white/[0.01] hover:bg-white/[0.04] active:scale-[0.98] text-white font-black italic uppercase text-xs py-4 px-6 rounded-none tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          CONTINUE WITH GOOGLE
        </button>

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
