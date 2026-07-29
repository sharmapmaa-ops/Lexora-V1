import { useQuery } from "@tanstack/react-query";
import { Users, IndianRupee, Ticket, Lock, UserPlus } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { api } from "@/lib/api";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";

interface OverviewData {
  total_users: number;
  locked_users: number;
  new_users_30d: number;
  plan_distribution: Record<string, number>;
  total_revenue: number;
  total_billed: number;
  open_tickets: number;
  total_tickets: number;
  jobs_by_status: Record<string, number>;
  jobs_by_service: Record<string, number>;
  recent_signups: { id: string; full_name: string; email: string; plan_id: string; created_at: string }[];
}

const PLAN_COLORS: Record<string, string> = {
  free: "#12c17f",
  standard: "#f59e0b",
  professional: "#2f47a3",
};

const money = (v: number) => `\u20b9${v.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

export function AdminOverviewPage() {
  const { data } = useQuery<OverviewData>({
    queryKey: ["admin-overview"],
    queryFn: () => api.get("/admin/overview").then((r) => r.data),
  });

  const planData = data
    ? Object.entries(data.plan_distribution).map(([id, count]) => ({ name: id, value: count }))
    : [];

  const jobsData = data
    ? Object.entries(data.jobs_by_service).map(([service, count]) => ({
        service: service.replace("_", " "),
        count,
      }))
    : [];

  return (
    <div className="max-w-6xl">
      <h1 className="font-display text-2xl font-bold text-brand-900">Admin Overview</h1>
      <p className="mt-1 text-brand-400">Platform-wide stats across every user and service.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Users" value={String(data?.total_users ?? 0)} icon={Users} tone="brand" />
        <StatCard label="Total Revenue" value={money(data?.total_revenue ?? 0)} icon={IndianRupee} tone="success" />
        <StatCard label="Open Tickets" value={String(data?.open_tickets ?? 0)} icon={Ticket} tone="danger" />
        <StatCard label="New Users (30d)" value={String(data?.new_users_30d ?? 0)} icon={UserPlus} tone="brand" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <h3 className="font-display text-lg font-semibold text-brand-900">Plan Distribution</h3>
          {planData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={planData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {planData.map((entry) => (
                    <Cell key={entry.name} fill={PLAN_COLORS[entry.name] ?? "#94a3b8"} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="mt-4 text-sm text-brand-300">No users yet.</p>
          )}
          <div className="mt-2 flex flex-wrap gap-3">
            {planData.map((p) => (
              <div key={p.name} className="flex items-center gap-1.5 text-xs text-brand-600">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: PLAN_COLORS[p.name] ?? "#94a3b8" }} />
                <span className="capitalize">{p.name}</span>: {p.value}
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 className="font-display text-lg font-semibold text-brand-900">Jobs Processed by Service</h3>
          {jobsData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={jobsData}>
                <XAxis dataKey="service" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#2f47a3" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="mt-4 text-sm text-brand-300">No jobs processed yet.</p>
          )}
        </div>
      </div>

      {/* Trending Services / Trending Plans - ranked lists reusing the
          same aggregate data as the charts above, just sorted and
          presented as a leaderboard rather than a chart. */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <h3 className="font-display text-lg font-semibold text-brand-900">Trending Services</h3>
          <div className="mt-3 space-y-2">
            {[...jobsData].sort((a, b) => b.count - a.count).map((s, i) => (
              <div key={s.service} className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-600">
                  {i + 1}
                </span>
                <span className="flex-1 text-sm capitalize text-brand-800">{s.service}</span>
                <span className="text-sm font-semibold text-brand-900">{s.count} job(s)</span>
              </div>
            ))}
            {!jobsData.length && <p className="text-sm text-brand-300">No jobs processed yet.</p>}
          </div>
        </div>

        <div className="card">
          <h3 className="font-display text-lg font-semibold text-brand-900">Trending Plans</h3>
          <div className="mt-3 space-y-2">
            {[...planData].sort((a, b) => b.value - a.value).map((p, i) => (
              <div key={p.name} className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-600">
                  {i + 1}
                </span>
                <span className="flex-1 text-sm capitalize text-brand-800">{p.name}</span>
                <span className="text-sm font-semibold text-brand-900">{p.value} user(s)</span>
              </div>
            ))}
            {!planData.length && <p className="text-sm text-brand-300">No users yet.</p>}
          </div>
        </div>
      </div>

      <div className="card mt-6">
        <h3 className="font-display text-lg font-semibold text-brand-900">Recent Signups</h3>
        <div className="mt-3 space-y-2">
          {data?.recent_signups.map((u) => (
            <div key={u.id} className="flex items-center justify-between rounded-lg border border-brand-50 px-4 py-2.5">
              <div>
                <div className="text-sm font-semibold text-brand-800">{u.full_name}</div>
                <div className="text-xs text-brand-300">{u.email}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-brand-300">{new Date(u.created_at).toLocaleDateString()}</span>
                <Badge tone="brand">{u.plan_id}</Badge>
              </div>
            </div>
          ))}
        </div>
      </div>

      {(data?.locked_users ?? 0) > 0 && (
        <div className="card mt-6 flex items-center gap-3 border-danger-500/20 bg-danger-500/5">
          <Lock size={20} className="text-danger-600" />
          <p className="text-sm text-danger-600">{data?.locked_users} account(s) are currently locked.</p>
        </div>
      )}
    </div>
  );
}
