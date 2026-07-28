import type { LucideIcon } from "lucide-react";
import { clsx } from "clsx";

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: "brand" | "success" | "danger";
}

const toneClasses = {
  brand: "bg-brand-100 text-brand-600",
  success: "bg-accent-500/10 text-accent-600",
  danger: "bg-danger-500/10 text-danger-600",
};

const valueTone = {
  brand: "text-brand-900",
  success: "text-accent-600",
  danger: "text-danger-600",
};

export function StatCard({ label, value, icon: Icon, tone = "brand" }: StatCardProps) {
  return (
    <div className="card flex items-center gap-4 !p-5">
      <div className={clsx("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", toneClasses[tone])}>
        <Icon size={22} strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <div className={clsx("text-xl font-bold leading-tight truncate", valueTone[tone])}>{value}</div>
        <div className="text-sm text-brand-400 mt-0.5">{label}</div>
      </div>
    </div>
  );
}
