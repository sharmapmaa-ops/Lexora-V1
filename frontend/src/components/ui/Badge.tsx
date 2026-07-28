import { clsx } from "clsx";
import type { ReactNode } from "react";

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "brand";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-brand-50 text-brand-700",
  success: "bg-accent-500/10 text-accent-600",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-danger-500/10 text-danger-600",
  brand: "bg-brand-900 text-white",
};

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        toneClasses[tone]
      )}
    >
      {children}
    </span>
  );
}
