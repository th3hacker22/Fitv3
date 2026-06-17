import { useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Zap, Mail, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { pullFromCloud } from "@/lib/syncEngine";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!auth) {
      setError("Firebase not initialized");
      return;
    }
    setLoading(true);
    try {
      const userCredential = isLogin
        ? await signInWithEmailAndPassword(auth, email, password)
        : await createUserWithEmailAndPassword(auth, email, password);

      await pullFromCloud(userCredential.user.uid);
      navigate({ to: "/" });
    } catch (err: any) {
      setError(
        err.message?.replace("Firebase:", "").trim() || "Something went wrong",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="-mx-4 flex min-h-[100dvh] flex-col">
      {/* ── Hero Image ── */}
      <div className="relative h-72 w-full shrink-0 overflow-hidden">
        <img
          src="/images/auth-bg.jpg"
          alt="Athlete training with a barbell in the gym"
          className="absolute inset-0 h-full w-full object-cover object-top"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-bg/20 via-bg/40 to-bg" />
        <div className="absolute bottom-5 left-5 right-5">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-text">
              <Zap className="h-5 w-5" />
            </span>
            <span className="text-xl font-bold tracking-tight text-text-primary">
              Pulse
            </span>
          </div>
          <h2 className="text-2xl font-bold leading-tight text-text-primary text-balance">
            Push your limits.
            <span className="text-primary"> Track every rep.</span>
          </h2>
        </div>
      </div>

      {/* ── Form ── */}
      <div className="flex flex-1 items-start justify-center px-5 pb-8 pt-2">
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          onSubmit={handleSubmit}
          className="w-full max-w-sm space-y-6"
        >
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-text-primary">
              {isLogin ? "Welcome Back" : "Create Account"}
            </h1>
            <p className="text-sm text-text-muted">
              {isLogin
                ? "Sign in to continue your journey"
                : "Start tracking your progress today"}
            </p>
          </div>

          {error && (
            <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-center text-sm text-danger">
              {error}
            </p>
          )}

          <div className="space-y-4">
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                id="email-input"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-border bg-bg-elevated py-3.5 pl-11 pr-4 text-text-primary placeholder:text-text-muted focus:border-primary"
                required
              />
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                id="password-input"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-border bg-bg-elevated py-3.5 pl-11 pr-4 text-text-primary placeholder:text-text-muted focus:border-primary"
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isLogin ? (
              "Login"
            ) : (
              "Sign Up"
            )}
          </Button>

          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError("");
            }}
            className="w-full text-center text-sm text-text-muted transition-colors hover:text-text-primary"
          >
            {isLogin ? (
              <>
                Don&apos;t have an account?{" "}
                <span className="font-semibold text-primary">Sign up</span>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <span className="font-semibold text-primary">Login</span>
              </>
            )}
          </button>
        </motion.form>
      </div>
    </div>
  );
}
