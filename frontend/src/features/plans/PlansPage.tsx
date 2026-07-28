import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Star, Sparkles } from "lucide-react";
import { clsx } from "clsx";
import { Link } from "react-router-dom";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { useState } from "react";

interface ServicePricing {
  service_code: string;
  unit: string;
  price: string;
}

interface Plan {
  id: string;
  name: string;
  icon: string;
  monthly_price: string;
  currency: string;
  is_featured: boolean;
  features: string[];
  service_pricing: ServicePricing[];
}

const SERVICE_LABELS: Record<string, string> = {
  translation: "Translation",
  ocr: "OCR",
  data_extraction: "Data Extraction",
  bai2: "BAI2",
  lease_abstraction: "Lease Abstraction",
};

const RUPEE = "\u20b9";

/** Multiple services on the same plan often share the exact same rate
 * (Translation/OCR/Data Extraction/BAI2 are all priced identically) -
 * rather than repeating that price on four separate lines, group by
 * (price, unit) and list the services together on one line. Lease
 * Abstraction is priced per-document rather than per-page, so it
 * naturally lands in its own group. */
function groupPricing(pricing: ServicePricing[]) {
  const groups = new Map<string, { price: string; unit: string; services: string[] }>();
  for (const sp of pricing) {
    const key = `${sp.price}-${sp.unit}`;
    if (!groups.has(key)) groups.set(key, { price: sp.price, unit: sp.unit, services: [] });
    groups.get(key)!.services.push(SERVICE_LABELS[sp.service_code] ?? sp.service_code);
  }
  return Array.from(groups.values());
}

export function PlansPage() {
  const { user, setUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data: plans } = useQuery<Plan[]>({
    queryKey: ["plans"],
    queryFn: () => api.get("/plans").then((r) => r.data),
  });

  const currentPlan = plans?.find((p) => p.id === user?.plan_id);

  const switchMutation = useMutation({
    mutationFn: (planId: string) => api.post("/plans/switch", { plan_id: planId }),
    onSuccess: async () => {
      setError(null);
      const { data } = await api.get("/auth/me");
      setUser(data);
      queryClient.invalidateQueries({ queryKey: ["balance"] });
    },
    onError: (err) => setError(apiErrorMessage(err, "Could not switch plans.")),
  });

  return (
    <div className="max-w-6xl">
      <h1 className="font-display text-2xl font-bold text-brand-900">Plans &amp; Offers</h1>
      <p className="mt-1 text-brand-400">
        Downgrading is always free — you're only ever charged when upgrading to a higher plan.
      </p>

      {error && (
        <div className="mt-4 rounded-lg bg-danger-500/10 px-4 py-3 text-sm text-danger-600">{error}</div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
        {plans?.map((plan) => {
          const isMine = plan.id === user?.plan_id;
          const isDowngrade = currentPlan ? Number(plan.monthly_price) < Number(currentPlan.monthly_price) : false;
          const ctaLabel = isMine
            ? "Current Plan"
            : isDowngrade
              ? "Downgrade Now"
              : Number(plan.monthly_price) > 0
                ? "Upgrade Now"
                : "Get Started";
          const pricingGroups = groupPricing(plan.service_pricing);

          return (
            <div
              key={plan.id}
              className={clsx(
                "card relative flex flex-col",
                plan.is_featured && "border-2 border-brand-400 shadow-card-hover"
              )}
            >
              {plan.is_featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-900 px-3 py-1 text-xs font-semibold text-white flex items-center gap-1">
                  <Star size={12} fill="currentColor" /> Most Popular
                </div>
              )}
              <div className="mb-3 text-3xl">{plan.icon}</div>
              <h3 className="font-display text-lg font-bold text-brand-900">{plan.name}</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="font-display text-3xl font-extrabold text-brand-900">
                  {RUPEE}{Number(plan.monthly_price).toLocaleString("en-IN")}
                </span>
                <span className="text-sm text-brand-400">/month</span>
              </div>

              <ul className="mt-5 space-y-2.5 border-t border-brand-100 pt-5">
                {pricingGroups.map((group) => (
                  <li key={`${group.price}-${group.unit}`} className="flex items-start gap-2 text-sm text-brand-800">
                    <Check size={16} className="mt-0.5 shrink-0 text-accent-600" />
                    {RUPEE}{Number(group.price)} / {group.unit} ({group.services.join(", ")})
                  </li>
                ))}
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-brand-800">
                    <Check size={16} className="mt-0.5 shrink-0 text-accent-600" />
                    {f}
                  </li>
                ))}
              </ul>

              {/* Free tools (Merge/Split/Rotate PDF, etc.) are available
                  on every plan, including Free - shown once per card so
                  it's clear an upgrade isn't required for these. */}
              <div className="mt-4 rounded-lg border border-dashed border-accent-500/30 bg-accent-500/5 p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-accent-600">
                  <Sparkles size={13} /> Free Services included
                </div>
                <p className="mt-1 text-xs text-brand-500">
                  Merge, split &amp; rotate PDFs — free on every plan, no charge, ever.{" "}
                  <Link to="/services/free" className="font-semibold underline">
                    Try them
                  </Link>
                </p>
              </div>

              <button
                disabled={isMine || switchMutation.isPending}
                onClick={() => switchMutation.mutate(plan.id)}
                className={clsx("mt-4", isMine ? "btn-secondary cursor-default" : "btn-primary")}
              >
                {ctaLabel}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
