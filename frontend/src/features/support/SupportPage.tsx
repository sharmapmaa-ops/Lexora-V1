import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";

interface Ticket {
  id: string;
  subject: string;
  status: string;
  created_at: string;
  messages: { id: string; body: string; created_at: string }[];
}

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger"> = {
  open: "warning",
  in_progress: "neutral",
  resolved: "success",
  closed: "neutral",
};

export function SupportPage() {
  const queryClient = useQueryClient();
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

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-900">Support</h1>
          <p className="mt-1 text-brand-400">Raise an issue or track your existing tickets.</p>
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
              <h3 className="font-semibold text-brand-900">{t.subject}</h3>
              <Badge tone={STATUS_TONE[t.status] ?? "neutral"}>{t.status.replace("_", " ")}</Badge>
            </div>
            <p className="mt-1 text-xs text-brand-300">{new Date(t.created_at).toLocaleString()}</p>
            {t.messages.map((m) => (
              <p key={m.id} className="mt-2 text-sm text-brand-700">
                {m.body}
              </p>
            ))}
          </div>
        ))}
        {!tickets?.length && <p className="text-brand-300">No support tickets yet.</p>}
      </div>
    </div>
  );
}
