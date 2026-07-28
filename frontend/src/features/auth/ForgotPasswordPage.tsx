import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, KeyRound } from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const requestMutation = useMutation({
    mutationFn: () => api.post("/auth/forgot-password", { email }),
    onSuccess: (res) => {
      setError(null);
      setInfo(res.data.message);
      setStep("reset");
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const resetMutation = useMutation({
    mutationFn: () => api.post("/auth/reset-password", { email, code, new_password: newPassword }),
    onSuccess: () => navigate("/login", { state: { passwordReset: true } }),
    onError: (err) => setError(apiErrorMessage(err, "Could not reset your password.")),
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-subtle p-8">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-accent-500 font-display font-bold text-white">
            L
          </div>
          <span className="font-display text-lg font-semibold text-brand-900">Lexora AI Solutions</span>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
              <KeyRound size={20} />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-brand-900">
                {step === "request" ? "Forgot Password" : "Reset Password"}
              </h2>
              <p className="text-sm text-brand-400">
                {step === "request"
                  ? "Enter your account email to receive a reset code."
                  : "Enter the code we sent, and choose a new password."}
              </p>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-lg bg-danger-500/10 px-3.5 py-2.5 text-sm text-danger-600">{error}</div>
          )}
          {info && step === "reset" && (
            <div className="mt-4 rounded-lg bg-accent-500/10 px-3.5 py-2.5 text-sm text-accent-600">{info}</div>
          )}

          {step === "request" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                requestMutation.mutate();
              }}
              className="mt-5"
            >
              <label className="label">Email</label>
              <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              <button type="submit" disabled={requestMutation.isPending} className="btn-primary mt-4 w-full">
                {requestMutation.isPending ? "Sending…" : "Send reset code"} <ArrowRight size={15} />
              </button>
            </form>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                resetMutation.mutate();
              }}
              className="mt-5 space-y-4"
            >
              <div>
                <label className="label">Reset Code</label>
                <input className="input" required maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" />
              </div>
              <div>
                <label className="label">New Password</label>
                <input
                  className="input"
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <p className="mt-1 text-xs text-brand-300">At least 8 characters, with a letter and a number.</p>
              </div>
              <button type="submit" disabled={resetMutation.isPending} className="btn-primary w-full">
                {resetMutation.isPending ? "Resetting…" : "Reset password"} <ArrowRight size={15} />
              </button>
              <button
                type="button"
                onClick={() => setStep("request")}
                className="w-full text-center text-sm text-brand-400 hover:underline"
              >
                Didn't get a code? Try again
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-brand-400">
          Remembered your password?{" "}
          <Link to="/login" className="font-semibold text-brand-700 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
