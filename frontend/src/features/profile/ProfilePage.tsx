import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Save } from "lucide-react";
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
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const photoUrl = user?.photo_url
    ? `/api/v1/users/photo/${user?.id}?t=${Date.now()}`
    : null;

  const updateMutation = useMutation({
    mutationFn: () => api.patch("/users/me/profile", form),
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
      return api.post("/users/me/photo", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: (res) => {
      setUser(res.data);
      queryClient.invalidateQueries();
    },
    onError: (err) => setError(apiErrorMessage(err, "Could not upload your photo.")),
  });

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl font-bold text-brand-900">Profile</h1>
      <p className="mt-1 text-brand-400">Manage your personal details and photo.</p>

      <div className="card mt-6">
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-2xl font-bold text-brand-700">
              {photoUrl ? (
                <img src={photoUrl} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <span>
                  {user?.first_name?.[0]}
                  {user?.last_name?.[0]}
                </span>
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
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) photoMutation.mutate(file);
              }}
            />
          </div>
          <div>
            <div className="font-display text-lg font-semibold text-brand-900">
              {user?.first_name} {user?.last_name}
            </div>
            <div className="text-sm text-brand-400">{user?.email}</div>
            {photoMutation.isPending && <div className="mt-1 text-xs text-brand-400">Uploading…</div>}
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-danger-500/10 px-3.5 py-2.5 text-sm text-danger-600">{error}</div>
        )}
        {saved && (
          <div className="mt-4 rounded-lg bg-accent-500/10 px-3.5 py-2.5 text-sm text-accent-600">
            Profile updated.
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateMutation.mutate();
          }}
          className="mt-6 space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">First name</label>
              <input
                className="input"
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Last name</label>
              <input
                className="input"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="label">Mobile</label>
            <input
              className="input"
              value={form.mobile}
              onChange={(e) => setForm({ ...form, mobile: e.target.value })}
              placeholder="+91 00000 00000"
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input bg-brand-50" value={user?.email ?? ""} disabled />
            <p className="mt-1 text-xs text-brand-300">Email cannot be changed.</p>
          </div>
          <button type="submit" disabled={updateMutation.isPending} className="btn-primary">
            <Save size={15} /> {updateMutation.isPending ? "Saving…" : "Save changes"}
          </button>
        </form>
      </div>
    </div>
  );
}
