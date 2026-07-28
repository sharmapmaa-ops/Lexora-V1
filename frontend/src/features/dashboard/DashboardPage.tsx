import { useQuery } from "@tanstack/react-query";
import { Wallet, TrendingDown, PiggyBank, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { StatCard } from "@/components/ui/StatCard";
import { useAuthStore } from "@/lib/authStore";

interface Balance {
  total_credit: string;
  total_debit: string;
  current_balance: string;
}

const money = (v: string) => `\u20b9${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

export function DashboardPage() {
  const { user } = useAuthStore();
  const { data: balance } = useQuery<Balance>({
    queryKey: ["balance"],
    queryFn: () => api.get("/payments/balance").then((r) => r.data),
  });

  return (
    <div className="max-w-6xl">
      <h1 className="font-display text-2xl font-bold text-brand-900">
        Welcome back, {user?.first_name} 👋
      </h1>
      <p className="mt-1 text-brand-400">Here's what's happening with your account.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Credit" value={money(balance?.total_credit ?? "0")} icon={Wallet} tone="success" />
        <StatCard label="Total Debit" value={money(balance?.total_debit ?? "0")} icon={TrendingDown} tone="danger" />
        <StatCard label="Current Balance" value={money(balance?.current_balance ?? "0")} icon={PiggyBank} tone="brand" />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card">
          <h3 className="font-display text-lg font-semibold text-brand-900">Your plan</h3>
          <p className="mt-1 text-sm text-brand-400">
            You're on the <span className="font-semibold capitalize text-brand-700">{user?.plan_id}</span> plan.
          </p>
          <Link to="/plans" className="btn-secondary mt-4 inline-flex">
            View plans &amp; upgrade <ArrowRight size={15} />
          </Link>
        </div>
        <div className="card">
          <h3 className="font-display text-lg font-semibold text-brand-900">Need to add funds?</h3>
          <p className="mt-1 text-sm text-brand-400">Top up your wallet to keep processing documents.</p>
          <Link to="/payments" className="btn-primary mt-4 inline-flex">
            Add balance <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </div>
  );
}
