import { useQuery } from "@tanstack/react-query";
import { Wallet, TrendingDown, PiggyBank, ArrowRight, Receipt, TrendingUp, Hourglass } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { useAuthStore } from "@/lib/authStore";

interface Balance {
  total_credit: string;
  total_debit: string;
  current_balance: string;
}

interface Transaction {
  id: string;
  type: string;
  status: string;
  description: string;
  payment_mode: string;
  credit: string;
  debit: string;
  created_at: string;
}

const money = (v: string | number) => `\u20b9${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export function DashboardPage() {
  const { user } = useAuthStore();
  const { data: balance } = useQuery<Balance>({
    queryKey: ["balance"],
    queryFn: () => api.get("/payments/balance").then((r) => r.data),
  });
  const { data: history } = useQuery<Transaction[]>({
    queryKey: ["payment-history"],
    queryFn: () => api.get("/payments/history").then((r) => r.data),
  });

  const todayTxns = (history ?? []).filter((t) => isToday(t.created_at));
  const todayCredit = todayTxns.reduce((sum, t) => sum + Number(t.credit), 0);
  const todayDebit = todayTxns.reduce((sum, t) => sum + Number(t.debit), 0);
  const pendingCount = todayTxns.filter((t) => t.status !== "success" && t.status !== "failed").length;

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

      {/* Today's Transactions table */}
      <div className="card mt-6">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-brand-900">Today's Transactions</h3>
          <Link to="/payments" className="text-sm font-semibold text-brand-600 hover:underline">
            View All Transactions &rarr;
          </Link>
        </div>
        <div className="mt-4 max-h-72 overflow-auto rounded-lg border border-brand-100">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-brand-900 text-left text-white">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Date &amp; Time</th>
                <th className="px-4 py-2.5 font-semibold">Description</th>
                <th className="px-4 py-2.5 font-semibold">Credit</th>
                <th className="px-4 py-2.5 font-semibold">Debit</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {todayTxns.map((t) => (
                <tr key={t.id} className="border-t border-brand-50">
                  <td className="px-4 py-2.5 text-brand-500">{new Date(t.created_at).toLocaleTimeString()}</td>
                  <td className="px-4 py-2.5">{t.description}</td>
                  <td className="px-4 py-2.5 text-accent-600">{Number(t.credit) ? money(t.credit) : ""}</td>
                  <td className="px-4 py-2.5 text-danger-600">{Number(t.debit) ? money(t.debit) : ""}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={t.status === "success" ? "success" : t.status === "failed" ? "danger" : "neutral"}>
                      {t.status}
                    </Badge>
                  </td>
                </tr>
              ))}
              {!todayTxns.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-brand-300">
                    No transactions today yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Today's summary cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Today's Transactions" value={String(todayTxns.length)} icon={Receipt} tone="brand" />
        <StatCard label="Today's Credits" value={money(todayCredit)} icon={TrendingUp} tone="success" />
        <StatCard label="Today's Debits" value={money(todayDebit)} icon={TrendingDown} tone="danger" />
        <StatCard label="Pending Activities" value={String(pendingCount)} icon={Hourglass} tone="brand" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
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
