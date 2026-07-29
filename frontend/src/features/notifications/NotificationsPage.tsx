import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, Trash2, CheckCheck } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { clsx } from "clsx";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  severity: "info" | "success" | "warning" | "error";
  is_read: boolean;
  created_at: string;
}

const SEVERITY_TONE: Record<string, "neutral" | "success" | "warning" | "danger"> = {
  info: "neutral",
  success: "success",
  warning: "warning",
  error: "danger",
};

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"all" | "unread">("all");

  const { data: notifications } = useQuery<NotificationItem[]>({
    queryKey: ["notifications", tab],
    queryFn: () => api.get("/notifications", { params: tab === "unread" ? { unread_only: true } : {} }).then((r) => r.data),
  });

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
  }

  const readMutation = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: invalidateAll,
  });
  const unreadMutation = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/unread`),
    onSuccess: invalidateAll,
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/notifications/${id}`),
    onSuccess: invalidateAll,
  });
  const markAllReadMutation = useMutation({
    mutationFn: () => api.post("/notifications/mark-all-read"),
    onSuccess: invalidateAll,
  });

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-900">Notifications</h1>
          <p className="mt-1 text-brand-400">Updates about your account, plan, and payments.</p>
        </div>
        <button onClick={() => markAllReadMutation.mutate()} className="btn-secondary">
          <CheckCheck size={15} /> Mark all as read
        </button>
      </div>

      <div className="mt-6 flex gap-2">
        <button onClick={() => setTab("all")} className={tab === "all" ? "btn-primary !py-2" : "btn-secondary !py-2"}>All</button>
        <button onClick={() => setTab("unread")} className={tab === "unread" ? "btn-primary !py-2" : "btn-secondary !py-2"}>Unread</button>
      </div>

      <div className="mt-4 space-y-2">
        {notifications?.map((n) => (
          <div
            key={n.id}
            className={clsx("card !p-4 flex items-start gap-3", !n.is_read && "border-l-4 border-l-brand-400")}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600">
              <Bell size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-brand-900">{n.title}</span>
                <Badge tone={SEVERITY_TONE[n.severity]}>{n.severity}</Badge>
                {!n.is_read && <span className="h-2 w-2 rounded-full bg-brand-500" />}
              </div>
              <p className="mt-1 text-sm text-brand-500">{n.message}</p>
              <p className="mt-1 text-xs text-brand-300">{new Date(n.created_at).toLocaleString()}</p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <button
                onClick={() => (n.is_read ? unreadMutation.mutate(n.id) : readMutation.mutate(n.id))}
                title={n.is_read ? "Mark unread" : "Mark read"}
                className="rounded-lg p-1.5 text-brand-400 hover:bg-brand-50 hover:text-brand-700"
              >
                <Check size={15} />
              </button>
              <button
                onClick={() => deleteMutation.mutate(n.id)}
                title="Delete"
                className="rounded-lg p-1.5 text-brand-400 hover:bg-danger-500/10 hover:text-danger-600"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
        {!notifications?.length && (
          <div className="card text-center text-brand-300">No notifications{tab === "unread" ? " — you're all caught up." : " yet."}</div>
        )}
      </div>
    </div>
  );
}
