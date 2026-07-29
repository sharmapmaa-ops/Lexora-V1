import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Sparkles, ArrowRight, Check, Clock } from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";

interface PublicCompany {
  name: string;
  logo_url: string | null;
  social_links: Record<string, string>;
}

interface ServiceInfo {
  code: string;
  label: string;
  desc: string;
  coming_soon?: boolean;
}

interface ServicesResponse {
  services: ServiceInfo[];
  rates_by_plan: Record<string, { plan_name: string; rate: number | null }>;
}

export function LoginPage() {
  const navigate = useNavigate();
  const { setSession, setUser } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: company } = useQuery<PublicCompany>({
    queryKey: ["public-company"],
    queryFn: () => api.get("/company").then((r) => r.data),
  });
  const { data: servicesData } = useQuery<ServicesResponse>({
    queryKey: ["public-services"],
    queryFn: () => api.get("/services").then((r) => r.data),
  });
  const startingRate = servicesData?.rates_by_plan?.free?.rate;

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
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.3fr_1fr]">
      {/* Left - brand panel + services showcase. Shown BEFORE anyone
          logs in specifically so a visitor can see what Lexora
          actually does before deciding to create an account. */}
      <div className="hidden flex-col bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800 p-12 text-white lg:flex overflow-y-auto">
        <div className="flex items-center gap-2.5">
          {company?.logo_url ? (
            <img src={company.logo_url} alt={company.name} className="h-9 w-9 rounded-xl object-contain bg-white/10 p-1" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-accent-500 font-display font-bold">
              L
            </div>
          )}
          <span className="font-display text-lg font-semibold">{company?.name ?? "Lexora AI Solutions"}</span>
        </div>

        <div className="mt-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium">
            <Sparkles size={14} /> Document intelligence, powered by AI
          </div>
          <h1 className="font-display text-3xl font-bold leading-tight">
            Lease abstraction, translation, OCR &amp; more — in minutes, not days.
          </h1>
          <p className="mt-3 max-w-md text-sm text-brand-200">
            Upload a document, pick a service, and let our pipelines do the rest.
            {startingRate != null && ` Paid services start at just \u20b9${startingRate}/document.`}
          </p>
        </div>

        {/* Services showcase - the whole point of showing this before
            signup is so a visitor can see what's on offer without
            having to create an account first. */}
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {servicesData?.services.map((s) => (
            <div key={s.code} className="rounded-xl bg-white/5 p-4">
              <div className="flex items-center justify-between">
                <span className="font-display text-sm font-semibold">{s.label}</span>
                {s.coming_soon ? (
                  <span className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-brand-200">
                    <Clock size={10} /> Coming soon
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded-full bg-accent-500/20 px-2 py-0.5 text-[10px] font-semibold text-accent-300">
                    <Check size={10} /> Available
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-xs text-brand-300">{s.desc}</p>
              {!s.coming_soon && startingRate != null && (
                <p className="mt-1.5 text-xs font-semibold text-brand-100">From \u20b9{startingRate}/document</p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-dashed border-white/20 bg-white/5 p-4">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-accent-300">
            <Sparkles size={14} /> Plus 26 free tools
          </div>
          <p className="mt-1 text-xs text-brand-300">
            PDF merge/split/rotate, calculators, invoice generators, and more — free for everyone,
            no account required to try them out once you're in.
          </p>
        </div>

        <p className="mt-auto pt-8 text-xs text-brand-300">
          &copy; {new Date().getFullYear()} {company?.name ?? "Lexora AI Solutions"}
        </p>
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
