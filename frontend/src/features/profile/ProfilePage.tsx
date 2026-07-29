import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Save, ShieldCheck, CheckCircle2 } from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";

export function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    first_name: user?.first_name ?? "",
    last_name: user?.last_name ?? "",
    mobile: user?.mobile ?? "",
    gender: user?.gender ?? "",
    birthdate: user?.birthdate ?? "",
  });
  const [twoFactor, setTwoFactor] = useState(false);
  const [twoFactorChannel, setTwoFactorChannel] = useState<"email" | "mobile">("email");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [passwordForm, setPasswordForm] = useState({ current_password: "", new_password: "" });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);

  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  const photoUrl = user?.photo_url ? `/api/v1/users/photo/${user?.id}?t=${Date.now()}` : null;

  const updateMutation = useMutation({
    mutationFn: () =>
      api.patch("/users/me/profile", {
        ...form,
        birthdate: form.birthdate || null,
        two_factor_enabled: twoFactor,
      }),
    onSuccess: (res) => {
      setUser(res.data);
      setError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (err) => setError(apiErrorMessage(err, "Could not update your profile.")),
  });

  const photoMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return api.post("/users/me/photo", formData, { headers: { "Content-Type": "multipart/form-data" } });
    },
    onSuccess: (res) => {
      setUser(res.data);
      queryClient.invalidateQueries();
    },
    onError: (err) => setError(apiErrorMessage(err, "Could not upload your photo.")),
  });

  const passwordMutation = useMutation({
    mutationFn: () => api.post("/users/me/change-password", passwordForm),
    onSuccess: () => {
      setPasswordError(null);
      setPasswordSaved(true);
      setPasswordForm({ current_password: "", new_password: "" });
      setTimeout(() => setPasswordSaved(false), 2500);
    },
    onError: (err) => setPasswordError(apiErrorMessage(err, "Could not change your password.")),
  });

  const sendOtpMutation = useMutation({
    mutationFn: () => api.post("/users/me/mobile/send-otp"),
    onSuccess: () => { setOtpSent(true); setOtpError(null); },
    onError: (err) => setOtpError(apiErrorMessage(err, "Could not send a verification code.")),
  });

  const verifyOtpMutation = useMutation({
    mutationFn: () => api.post("/users/me/mobile/verify-otp", { code: otpCode }),
    onSuccess: (res) => { setUser(res.data); setOtpSent(false); setOtpCode(""); setOtpError(null); },
    onError: (err) => setOtpError(apiErrorMessage(err, "Could not verify this code.")),
  });

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl font-bold text-brand-900">Profile</h1>
      <p className="mt-1 text-brand-400">Manage your personal details, security, and photo.</p>

      {/* Single card: photo + personal details + security + password -
          the old separate "Change Password" card added nothing that
          justified splitting it from the rest of the profile. */}
      <div className="card mt-6">
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-2xl font-bold text-brand-700">
              {photoUrl ? (
                <img src={photoUrl} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <span>{user?.first_name?.[0]}{user?.last_name?.[0]}</span>
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-brand-900 text-white shadow-card hover:bg-brand-800"
              title="Change photo"
            >
              <Camera size={14} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => { const file = e.target.files?.[0]; if (file) photoMutation.mutate(file); }}
            />
          </div>
          <div>
            <div className="font-display text-lg font-semibold text-brand-900">{user?.first_name} {user?.last_name}</div>
            <div className="text-sm text-brand-400">{user?.email}</div>
            {photoMutation.isPending && <div className="mt-1 text-xs text-brand-400">Uploading…</div>}
          </div>
        </div>

        {error && <div className="mt-4 rounded-lg bg-danger-500/10 px-3.5 py-2.5 text-sm text-danger-600">{error}</div>}
        {saved && <div className="mt-4 rounded-lg bg-accent-500/10 px-3.5 py-2.5 text-sm text-accent-600">Profile updated.</div>}

        <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(); }} className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">First name</label>
              <input className="input" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            </div>
            <div>
              <label className="label">Last name</label>
              <input className="input" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Gender</label>
              <select className="input" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="">Not specified</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="label">Date of Birth</label>
              <input
                type="date"
                className="input"
                value={form.birthdate ?? ""}
                onChange={(e) => setForm({ ...form, birthdate: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input bg-brand-50" value={user?.email ?? ""} disabled />
          </div>

          {/* Mobile with an inline "Verify" link right next to the
              field itself, not a separate full-width button below it. */}
          <div>
            <label className="label">Mobile</label>
            <div className="flex items-center gap-2">
              <input
                className="input"
                value={form.mobile}
                onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                placeholder="+91 00000 00000"
              />
              {form.mobile && (
                <button
                  type="button"
                  onClick={() => sendOtpMutation.mutate()}
                  disabled={sendOtpMutation.isPending}
                  className="shrink-0 text-sm font-semibold text-brand-500 hover:underline disabled:opacity-50"
                >
                  {sendOtpMutation.isPending ? "Sending…" : "Verify"}
                </button>
              )}
            </div>
            {otpSent && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  className="input max-w-[140px] !py-1.5"
                  placeholder="Enter code"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                />
                <button type="button" onClick={() => verifyOtpMutation.mutate()} className="btn-secondary !py-1.5 text-xs">
                  <CheckCircle2 size={13} /> Confirm
                </button>
              </div>
            )}
            {otpError && <p className="mt-1 text-xs text-danger-600">{otpError}</p>}
          </div>

          {/* Two-Factor Authentication - toggle plus which channel
              (email/mobile) verification codes go to, default email. */}
          <div className="rounded-lg border border-brand-100 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-brand-500" />
                <span className="text-sm font-medium text-brand-800">Two-Factor Authentication</span>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input type="checkbox" className="peer sr-only" checked={twoFactor} onChange={(e) => setTwoFactor(e.target.checked)} />
                <div className="h-6 w-11 rounded-full bg-brand-100 peer-checked:bg-accent-500 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-5" />
              </label>
            </div>
            {twoFactor && (
              <div className="mt-3 flex items-center gap-5 border-t border-brand-50 pt-3">
                <span className="text-xs font-semibold text-brand-500">Send codes via:</span>
                <label className="flex items-center gap-1.5 text-sm text-brand-800">
                  <input
                    type="radio"
                    name="twoFactorChannel"
                    checked={twoFactorChannel === "email"}
                    onChange={() => setTwoFactorChannel("email")}
                  />
                  Email
                </label>
                <label className="flex items-center gap-1.5 text-sm text-brand-800">
                  <input
                    type="radio"
                    name="twoFactorChannel"
                    checked={twoFactorChannel === "mobile"}
                    onChange={() => setTwoFactorChannel("mobile")}
                  />
                  Mobile
                </label>
              </div>
            )}
          </div>

          <button type="submit" disabled={updateMutation.isPending} className="btn-primary">
            <Save size={15} /> {updateMutation.isPending ? "Saving…" : "Save changes"}
          </button>

          {/* Change Password - inside the same card/form area, not a
              separate card. */}
          <div className="border-t border-brand-100 pt-4">
            <h3 className="font-display font-semibold text-brand-900">Change Password</h3>
            <p className="mt-0.5 text-xs text-brand-400">At least 8 characters, with a letter and a number.</p>
            {passwordError && <div className="mt-2 rounded-lg bg-danger-500/10 px-3.5 py-2.5 text-sm text-danger-600">{passwordError}</div>}
            {passwordSaved && <div className="mt-2 rounded-lg bg-accent-500/10 px-3.5 py-2.5 text-sm text-accent-600">Password changed.</div>}
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div>
                <label className="label">Current Password</label>
                <input
                  type="password"
                  className="input"
                  value={passwordForm.current_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                />
              </div>
              <div>
                <label className="label">New Password</label>
                <input
                  type="password"
                  className="input"
                  minLength={8}
                  value={passwordForm.new_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => passwordMutation.mutate()}
              disabled={passwordMutation.isPending || !passwordForm.current_password || !passwordForm.new_password}
              className="btn-secondary mt-3"
            >
              {passwordMutation.isPending ? "Updating…" : "Update Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
