import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Send } from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { useAuthStore } from "@/lib/authStore";

interface Ticket {
  id: string;
  subject: string;
  status: string;
  created_at: string;
  messages: { id: string; body: string; created_at: string }[];
  requester_name?: string | null;
  requester_email?: string | null;
}

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger"> = {
  open: "warning",
  in_progress: "neutral",
  resolved: "success",
  closed: "neutral",
};

const STATUSES = ["open", "in_progress", "resolved", "closed"];

function TicketReplyBox({ ticketId }: { ticketId: string }) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const replyMutation = useMutation({
    mutationFn: () => api.post(`/support/${ticketId}/messages`, { body }),
    onSuccess: () => {
      setBody("");
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    },
  });
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (body.trim()) replyMutation.mutate(); }}
      className="mt-3 flex items-end gap-2"
    >
      <input
        className="input !py-1.5 flex-1"
        placeholder="Write a reply…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <button type="submit" disabled={replyMutation.isPending || !body.trim()} className="btn-secondary !py-1.5">
        <Send size={14} />
      </button>
    </form>
  );
}

export function SupportPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isStaff = user?.role === "admin" || user?.role === "developer";
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const { data: tickets } = useQuery<Ticket[]>({
    queryKey: ["support-tickets"],
    queryFn: () => api.get("/support").then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post("/support", { subject, message }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      setShowForm(false);
      setSubject("");
      setMessage("");
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ ticketId, status }: { ticketId: string; status: string }) =>
      api.patch(`/support/${ticketId}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["support-tickets"] }),
  });

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-900">Support</h1>
          <p className="mt-1 text-brand-400">
            {isStaff ? "All tickets from every user." : "Raise an issue or track your existing tickets."}
          </p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="btn-primary">
          <Plus size={16} /> New Ticket
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
          className="card mt-4"
        >
          <label className="label">Subject</label>
          <input className="input" required value={subject} onChange={(e) => setSubject(e.target.value)} />
          <label className="label mt-4">Message</label>
          <textarea
            className="input"
            rows={4}
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button type="submit" disabled={createMutation.isPending} className="btn-primary mt-4">
            {createMutation.isPending ? "Submitting…" : "Submit"}
          </button>
          {createMutation.isError && (
            <p className="mt-2 text-sm text-danger-600">{apiErrorMessage(createMutation.error)}</p>
          )}
        </form>
      )}

      <div className="mt-6 space-y-3">
        {tickets?.map((t) => (
          <div key={t.id} className="card">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-brand-900">{t.subject}</h3>
                {isStaff && (
                  <p className="text-xs text-brand-400">
                    {t.requester_name} &middot; {t.requester_email}
                  </p>
                )}
              </div>
              {isStaff ? (
                <select
                  className="input !py-1 !w-auto text-xs"
                  value={t.status}
                  onChange={(e) => statusMutation.mutate({ ticketId: t.id, status: e.target.value })}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s.replace("_", " ")}</option>
                  ))}
                </select>
              ) : (
                <Badge tone={STATUS_TONE[t.status] ?? "neutral"}>{t.status.replace("_", " ")}</Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-brand-300">{new Date(t.created_at).toLocaleString()}</p>
            {t.messages.map((m) => (
              <p key={m.id} className="mt-2 text-sm text-brand-700">
                {m.body}
              </p>
            ))}
            <TicketReplyBox ticketId={t.id} />
          </div>
        ))}
        {!tickets?.length && <p className="text-brand-300">No support tickets yet.</p>}
      </div>
    </div>
  );
}
