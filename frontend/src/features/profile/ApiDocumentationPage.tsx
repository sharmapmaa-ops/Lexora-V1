import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Key, Copy, RefreshCw, Trash2, ExternalLink, Lock } from "lucide-react";
import { useState } from "react";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { Link } from "react-router-dom";

interface Plan {
  id: string;
  name: string;
}

const GATED_PLANS = ["standard", "professional"];

export function ApiDocumentationPage() {
  const { user, setUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: plans } = useQuery<Plan[]>({
    queryKey: ["plans"],
    queryFn: () => api.get("/plans").then((r) => r.data),
  });

  const hasAccess = GATED_PLANS.includes(user?.plan_id ?? "");
  const currentPlanName = plans?.find((p) => p.id === user?.plan_id)?.name ?? user?.plan_id;

  const generateMutation = useMutation({
    mutationFn: () => api.post("/users/me/api-key"),
    onSuccess: (res) => {
      setUser(res.data);
      setError(null);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const revokeMutation = useMutation({
    mutationFn: () => api.delete("/users/me/api-key"),
    onSuccess: (res) => {
      setUser(res.data);
      queryClient.invalidateQueries();
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  if (!hasAccess) {
    return (
      <div className="max-w-2xl">
        <div className="card flex flex-col items-center py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-brand-600">
            <Lock size={26} />
          </div>
          <h2 className="mt-4 font-display text-xl font-bold text-brand-900">
            API Documentation is a Standard/Professional feature
          </h2>
          <p className="mt-2 max-w-md text-sm text-brand-400">
            Your current plan ({currentPlanName}) doesn't include API access. Upgrade to
            Standard or Professional to generate an API key and use the REST endpoints.
          </p>
          <Link to="/plans" className="btn-primary mt-5">
            View Plans &amp; Upgrade
          </Link>
        </div>
      </div>
    );
  }

  const hasActiveKey = user?.api_key && user?.api_key_status === "active";

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-2xl font-bold text-brand-900">API Documentation</h1>
      <p className="mt-1 text-brand-400">Generate a key to authenticate your requests, and explore the full API reference.</p>

      <div className="card mt-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
            <Key size={22} />
          </div>
          <div>
            <h3 className="font-display font-semibold text-brand-900">Your API Key</h3>
            <p className="text-sm text-brand-400">Keep it secret — treat it like a password.</p>
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-lg bg-danger-500/10 px-3.5 py-2.5 text-sm text-danger-600">{error}</div>
        )}

        <div className="mt-4 flex items-center gap-2">
          <code className="flex-1 truncate rounded-lg border border-brand-200 bg-brand-50 px-3.5 py-2.5 text-sm">
            {hasActiveKey ? user!.api_key : "No active API key. Generate one below."}
          </code>
          {hasActiveKey && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(user!.api_key!);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="btn-secondary !px-3"
              title="Copy"
            >
              <Copy size={15} />
            </button>
          )}
        </div>
        {copied && <p className="mt-1 text-xs text-accent-600">Copied to clipboard.</p>}

        <div className="mt-4 flex gap-3">
          <button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending} className="btn-primary">
            <RefreshCw size={15} /> Generate New Key
          </button>
          {hasActiveKey && (
            <button onClick={() => revokeMutation.mutate()} disabled={revokeMutation.isPending} className="btn-danger">
              <Trash2 size={15} /> Revoke
            </button>
          )}
        </div>
      </div>

      <div className="card mt-6">
        <h3 className="font-display font-semibold text-brand-900">Full API Reference</h3>
        <p className="mt-1 text-sm text-brand-400">
          Every endpoint, request/response shape, and a try-it-out console — generated directly
          from the live API, so it's always accurate.
        </p>
        <a href="/api/docs" target="_blank" rel="noreferrer" className="btn-secondary mt-4 inline-flex">
          Open API Docs <ExternalLink size={15} />
        </a>
      </div>
    </div>
  );
}
