import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Save, Upload } from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";

interface Company {
  name: string;
  logo_url: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  working_hours: string | null;
  working_days: string | null;
  currency: string;
  social_links: Record<string, string>;
}

const EMPTY: Company = {
  name: "",
  logo_url: null,
  email: "",
  phone: "",
  whatsapp: "",
  address: "",
  working_hours: "",
  working_days: "",
  currency: "INR",
  social_links: {},
};

export function CompanySettingsPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<Company>(EMPTY);
  const [saved, setSaved] = useState(false);

  const { data } = useQuery<Company>({
    queryKey: ["company"],
    queryFn: () => api.get("/admin/company").then((r) => r.data).catch(() => EMPTY),
    retry: false,
  });

  useEffect(() => {
    if (data) setForm({ ...EMPTY, ...data, social_links: data.social_links ?? {} });
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => api.patch("/admin/company", form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const logoMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return api.post("/admin/company/logo", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["company"] }),
  });

  const logoUrl = form.logo_url ? `/api/v1/admin/company/logo?t=${Date.now()}` : null;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
          <Building2 size={22} />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-900">Company Settings</h1>
          <p className="text-brand-400">Shown on invoices and the login page.</p>
        </div>
      </div>

      <div className="card mt-6">
        <label className="label">Logo</label>
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-brand-100 bg-brand-50">
            {logoUrl ? (
              <img src={logoUrl} alt="Company logo" className="h-full w-full object-contain" />
            ) : (
              <Building2 size={24} className="text-brand-300" />
            )}
          </div>
          <button onClick={() => fileInputRef.current?.click()} className="btn-secondary">
            <Upload size={15} /> {logoMutation.isPending ? "Uploading…" : "Upload logo"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) logoMutation.mutate(file);
            }}
          />
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          saveMutation.mutate();
        }}
        className="card mt-6 space-y-4"
      >
        {saveMutation.isError && (
          <div className="rounded-lg bg-danger-500/10 px-3.5 py-2.5 text-sm text-danger-600">
            {apiErrorMessage(saveMutation.error)}
          </div>
        )}
        {saved && (
          <div className="rounded-lg bg-accent-500/10 px-3.5 py-2.5 text-sm text-accent-600">
            Company details saved.
          </div>
        )}

        <div>
          <label className="label">Company Name</label>
          <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Email</label>
            <input className="input" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label">WhatsApp</label>
          <input className="input" value={form.whatsapp ?? ""} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
        </div>
        <div>
          <label className="label">Address</label>
          <textarea className="input" rows={2} value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Working Hours</label>
            <input className="input" placeholder="9 AM - 6 PM" value={form.working_hours ?? ""} onChange={(e) => setForm({ ...form, working_hours: e.target.value })} />
          </div>
          <div>
            <label className="label">Working Days</label>
            <input className="input" placeholder="Mon - Fri" value={form.working_days ?? ""} onChange={(e) => setForm({ ...form, working_days: e.target.value })} />
          </div>
        </div>
        <div className="w-32">
          <label className="label">Currency</label>
          <input className="input" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
        </div>

        <div className="border-t border-brand-100 pt-4">
          <label className="label">Social Links</label>
          <div className="grid grid-cols-2 gap-3">
            {["facebook", "instagram", "linkedin", "youtube"].map((platform) => (
              <input
                key={platform}
                className="input"
                placeholder={`${platform[0].toUpperCase()}${platform.slice(1)} URL`}
                value={form.social_links[platform] ?? ""}
                onChange={(e) =>
                  setForm({ ...form, social_links: { ...form.social_links, [platform]: e.target.value } })
                }
              />
            ))}
          </div>
        </div>

        <button type="submit" disabled={saveMutation.isPending} className="btn-primary">
          <Save size={15} /> {saveMutation.isPending ? "Saving…" : "Save changes"}
        </button>
      </form>
    </div>
  );
}
