import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Sparkles, ArrowRight } from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";

export function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => api.post("/auth/register", form),
    onSuccess: () => navigate("/login", { state: { justRegistered: true } }),
    onError: (err) => setError(apiErrorMessage(err, "Could not create your account.")),
  });

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800 p-12 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-accent-500 font-display font-bold">
            L
          </div>
          <span className="font-display text-lg font-semibold">Lexora AI Solutions</span>
        </div>
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium">
            <Sparkles size={14} /> Free to start, no card required
          </div>
          <h1 className="font-display text-4xl font-bold leading-tight">
            Create your account and start processing documents today.
          </h1>
        </div>
        <p className="text-xs text-brand-300">&copy; {new Date().getFullYear()} Lexora AI Solutions</p>
      </div>

      <div className="flex items-center justify-center p-8">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            mutation.mutate();
          }}
          className="w-full max-w-sm"
        >
          <h2 className="font-display text-2xl font-bold text-brand-900">Create your account</h2>
          <p className="mt-1.5 text-sm text-brand-400">Starts on the Free plan — upgrade anytime.</p>

          {error && (
            <div className="mt-4 rounded-lg bg-danger-500/10 px-3.5 py-2.5 text-sm text-danger-600">{error}</div>
          )}

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div>
              <label className="label">First name</label>
              <input
                className="input"
                required
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Last name</label>
              <input
                className="input"
                required
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="mt-4">
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <p className="mt-1.5 text-xs text-brand-300">At least 8 characters, with a letter and a number.</p>
          </div>

          <button type="submit" disabled={mutation.isPending} className="btn-primary mt-6 w-full">
            {mutation.isPending ? "Creating account…" : "Create account"}
            <ArrowRight size={16} />
          </button>

          <p className="mt-6 text-center text-sm text-brand-400">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-brand-700 hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
