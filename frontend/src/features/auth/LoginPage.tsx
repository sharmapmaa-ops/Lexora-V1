import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Sparkles, ArrowRight } from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";

export function LoginPage() {
  const navigate = useNavigate();
  const { setSession, setUser } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: tokens } = await api.post("/auth/login", { email, password });
      setSession({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token });
      const { data: user } = await api.get("/auth/me", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      setUser(user);
    },
    onSuccess: () => navigate("/dashboard"),
    onError: (err) => setError(apiErrorMessage(err, "Incorrect email or password.")),
  });

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      {/* Left - brand panel */}
      <div className="hidden flex-col justify-between bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800 p-12 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-accent-500 font-display font-bold">
            L
          </div>
          <span className="font-display text-lg font-semibold">Lexora AI Solutions</span>
        </div>
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium">
            <Sparkles size={14} /> Document intelligence, powered by AI
          </div>
          <h1 className="font-display text-4xl font-bold leading-tight">
            Lease abstraction, translation, OCR &amp; more — in minutes, not days.
          </h1>
          <p className="mt-4 max-w-md text-brand-200">
            Upload a document, pick a service, and let Lexora's pipelines do the rest. Track
            everything from one dashboard.
          </p>
        </div>
        <p className="text-xs text-brand-300">&copy; {new Date().getFullYear()} Lexora AI Solutions</p>
      </div>

      {/* Right - form */}
      <div className="flex items-center justify-center p-8">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            mutation.mutate();
          }}
          className="w-full max-w-sm"
        >
          <h2 className="font-display text-2xl font-bold text-brand-900">Welcome back</h2>
          <p className="mt-1.5 text-sm text-brand-400">Log in to your Lexora account.</p>

          {error && (
            <div className="mt-4 rounded-lg bg-danger-500/10 px-3.5 py-2.5 text-sm text-danger-600">{error}</div>
          )}

          <div className="mt-6 space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="label !mb-0">Password</label>
                <Link to="/forgot-password" className="text-xs font-semibold text-brand-500 hover:underline">
                  Forgot password?
                </Link>
              </div>
              <input
                className="input mt-1.5"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>

          <button type="submit" disabled={mutation.isPending} className="btn-primary mt-6 w-full">
            {mutation.isPending ? "Signing in…" : "Sign in"}
            <ArrowRight size={16} />
          </button>

          <p className="mt-6 text-center text-sm text-brand-400">
            Don't have an account?{" "}
            <Link to="/register" className="font-semibold text-brand-700 hover:underline">
              Create one
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
