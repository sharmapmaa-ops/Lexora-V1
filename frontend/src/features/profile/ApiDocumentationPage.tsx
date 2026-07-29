import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Key, Copy, RefreshCw, Trash2, Lock, ChevronDown } from "lucide-react";
import { useState } from "react";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { Link } from "react-router-dom";

interface Plan {
  id: string;
  name: string;
}

const GATED_PLANS = ["standard", "professional"];

/** Only the 5 processing services get documented here - deliberately
 * NOT the auto-generated Swagger UI at /api/docs, which covers every
 * route in the app (auth, admin, users, payments, ...). A developer
 * integrating with Lexora needs the services API, not our internal
 * account-management surface. */
interface ServiceDoc {
  code: string;
  label: string;
  method: string;
  path: string;
  params: string;
  exampleRequest: string;
  exampleResponse: string;
}

const SERVICE_DOCS: ServiceDoc[] = [
  {
    code: "bai2",
    label: "BAI2 Statement Parser",
    method: "POST",
    path: "/api/v1/processing/bai2/upload",
    params: "multipart/form-data: file",
    exampleRequest: `curl -X POST https://your-domain.com/api/v1/processing/bai2/upload \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -F "file=@statement.bai2"`,
    exampleResponse: `{
  "id": "b3f1...",
  "service_code": "bai2",
  "status": "completed",
  "billed_amount": "400.00",
  "result_metadata": { "groups": [ ... ] }
}`,
  },
  {
    code: "translation",
    label: "Translation",
    method: "POST",
    path: "/api/v1/processing/translation/upload?target_language=Spanish",
    params: "multipart/form-data: file | query: target_language",
    exampleRequest: `curl -X POST "https://your-domain.com/api/v1/processing/translation/upload?target_language=Spanish" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -F "file=@document.txt"`,
    exampleResponse: `{
  "id": "a91c...",
  "service_code": "translation",
  "status": "completed",
  "billed_amount": "400.00",
  "result_metadata": { "target_language": "Spanish", "translated_text": "..." }
}`,
  },
  {
    code: "ocr",
    label: "OCR",
    method: "POST",
    path: "/api/v1/processing/ocr/upload",
    params: "multipart/form-data: file (PDF)",
    exampleRequest: `curl -X POST https://your-domain.com/api/v1/processing/ocr/upload \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -F "file=@scan.pdf"`,
    exampleResponse: `{
  "id": "77de...",
  "service_code": "ocr",
  "status": "completed",
  "page_count": 3,
  "billed_amount": "1200.00",
  "result_metadata": { "pages": [ { "page_number": 1, "text": "..." } ] }
}`,
  },
  {
    code: "data_extraction",
    label: "Data Extraction",
    method: "POST",
    path: "/api/v1/processing/data-extraction/upload?fields=invoice_number,total",
    params: "multipart/form-data: file | query: fields (comma-separated)",
    exampleRequest: `curl -X POST "https://your-domain.com/api/v1/processing/data-extraction/upload?fields=invoice_number,total" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -F "file=@invoice.txt"`,
    exampleResponse: `{
  "id": "1fa2...",
  "service_code": "data_extraction",
  "status": "completed",
  "result_metadata": { "extracted": { "invoice_number": "123", "total": "$500" } }
}`,
  },
];

const COMMON_DOCS = {
  auth: {
    label: "Authenticating requests",
    body: "Every services API call needs your API key as a Bearer token in the Authorization header:\nAuthorization: Bearer YOUR_API_KEY",
  },
  jobs: {
    label: "Checking job status & listing jobs",
    method: "GET",
    path: "/api/v1/processing/jobs?service=bai2",
    body: "List your past jobs, optionally filtered by service code (bai2, translation, ocr, data_extraction).",
  },
  result: {
    label: "Downloading a job's result",
    method: "GET",
    path: "/api/v1/processing/jobs/{job_id}/result",
    body: "Returns the raw JSON result file for a completed job.",
  },
};

export function ApiDocumentationPage() {
  const { user, setUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedService, setExpandedService] = useState<string | null>(SERVICE_DOCS[0].code);

  const { data: plans } = useQuery<Plan[]>({
    queryKey: ["plans"],
    queryFn: () => api.get("/plans").then((r) => r.data),
  });

  const hasAccess = GATED_PLANS.includes(user?.plan_id ?? "");
  const currentPlanName = plans?.find((p) => p.id === user?.plan_id)?.name ?? user?.plan_id;

  const generateMutation = useMutation({
    mutationFn: () => api.post("/users/me/api-key"),
    onSuccess: (res) => { if (user) setUser({ ...user, ...res.data }); setError(null); },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const revokeMutation = useMutation({
    mutationFn: () => api.delete("/users/me/api-key"),
    onSuccess: (res) => { if (user) setUser({ ...user, ...res.data }); queryClient.invalidateQueries(); },
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
          <Link to="/plans" className="btn-primary mt-5">View Plans &amp; Upgrade</Link>
        </div>
      </div>
    );
  }

  const hasActiveKey = user?.api_key && user?.api_key_status === "active";

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-2xl font-bold text-brand-900">API Documentation</h1>
      <p className="mt-1 text-brand-400">Generate a key, then call our processing services directly from your own systems.</p>

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

        {error && <div className="mt-3 rounded-lg bg-danger-500/10 px-3.5 py-2.5 text-sm text-danger-600">{error}</div>}

        <div className="mt-4 flex items-center gap-2">
          <code className="flex-1 truncate rounded-lg border border-brand-200 bg-brand-50 px-3.5 py-2.5 text-sm">
            {hasActiveKey ? user!.api_key : "No active API key. Generate one below."}
          </code>
          {hasActiveKey && (
            <button
              onClick={() => { navigator.clipboard.writeText(user!.api_key!); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
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
        <h3 className="font-display font-semibold text-brand-900">Authenticating requests</h3>
        <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-brand-950 p-3 text-xs text-brand-100">{COMMON_DOCS.auth.body}</pre>
      </div>

      <div className="card mt-6">
        <h3 className="font-display font-semibold text-brand-900">Services</h3>
        <p className="mt-1 text-sm text-brand-400">Only the document-processing services are documented here — this isn't the full app's internal API.</p>

        <div className="mt-4 space-y-2">
          {SERVICE_DOCS.map((svc) => (
            <div key={svc.code} className="rounded-lg border border-brand-100">
              <button
                onClick={() => setExpandedService(expandedService === svc.code ? null : svc.code)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <span className="flex items-center gap-2">
                  <span className="rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-700">{svc.method}</span>
                  <span className="font-semibold text-brand-900">{svc.label}</span>
                </span>
                <ChevronDown size={16} className={expandedService === svc.code ? "rotate-180 text-brand-400 transition-transform" : "text-brand-400 transition-transform"} />
              </button>
              {expandedService === svc.code && (
                <div className="border-t border-brand-50 px-4 py-3">
                  <code className="block text-xs text-brand-600">{svc.path}</code>
                  <p className="mt-1 text-xs text-brand-400">{svc.params}</p>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-brand-400">Example request</p>
                  <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-lg bg-brand-950 p-3 text-xs text-brand-100">{svc.exampleRequest}</pre>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-brand-400">Example response</p>
                  <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-lg bg-brand-950 p-3 text-xs text-brand-100">{svc.exampleResponse}</pre>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card mt-6">
        <h3 className="font-display font-semibold text-brand-900">Job status &amp; results</h3>
        <div className="mt-3 space-y-3 text-sm">
          <div>
            <code className="text-xs text-brand-600">{COMMON_DOCS.jobs.method} {COMMON_DOCS.jobs.path}</code>
            <p className="mt-0.5 text-xs text-brand-400">{COMMON_DOCS.jobs.body}</p>
          </div>
          <div>
            <code className="text-xs text-brand-600">{COMMON_DOCS.result.method} {COMMON_DOCS.result.path}</code>
            <p className="mt-0.5 text-xs text-brand-400">{COMMON_DOCS.result.body}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
