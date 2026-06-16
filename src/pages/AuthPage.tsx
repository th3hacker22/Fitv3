import { useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/Button";
import { pullFromCloud } from "@/lib/syncEngine";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!auth) {
      setError("Firebase not initialized");
      return;
    }
    try {
      const userCredential = isLogin
        ? await signInWithEmailAndPassword(auth, email, password)
        : await createUserWithEmailAndPassword(auth, email, password);

      await pullFromCloud(userCredential.user.uid);
      navigate({ to: "/" });
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-6 rounded-3xl bg-bg-card p-8 border border-border shadow-2xl"
      >
        <h1 className="text-3xl font-bold text-text-primary text-center">
          {isLogin ? "Welcome Back" : "Create Account"}
        </h1>
        {error && <p className="text-sm text-red-500 text-center">{error}</p>}

        <input
          id="email-input"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl bg-bg-elevated p-4 text-text-primary placeholder:text-text-muted"
          required
        />
        <input
          id="password-input"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl bg-bg-elevated p-4 text-text-primary placeholder:text-text-muted"
          required
        />

        <Button type="submit" variant="primary" className="w-full">
          {isLogin ? "Login" : "Sign Up"}
        </Button>

        <button
          type="button"
          onClick={() => setIsLogin(!isLogin)}
          className="text-sm text-text-muted w-full text-center hover:text-text-primary"
        >
          {isLogin
            ? "Don't have an account? Sign up"
            : "Already have an account? Login"}
        </button>
      </form>
    </div>
  );
}
