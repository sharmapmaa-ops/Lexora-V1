import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Upload, Download, AlertCircle, ChevronDown } from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";

interface ProcessingJob {
  id: string;
  status: string;
  original_filename: string;
  page_count: number | null;
  billed_amount: string;
  error_message: string | null;
  result_metadata: { extracted?: Record<string, unknown> };
  created_at: string;
}

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger"> = {
  queued: "neutral",
  processing: "warning",
  completed: "success",
  failed: "danger",
};

const FIELD_LABELS: Record<string, string> = {
  landlord_name: "Landlord",
  tenant_name: "Tenant",
  property_address: "Property Address",
  lease_start_date: "Lease Start",
  lease_end_date: "Lease End",
  base_rent: "Base Rent",
  rent_currency: "Currency",
  security_deposit: "Security Deposit",
  renewal_option: "Renewal Option",
  escalation_terms: "Escalation Terms",
};

export function LeaseAbstractionUploadPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  const { data: jobs } = useQuery<ProcessingJob[]>({
    queryKey: ["processing-jobs", "lease_abstraction"],
    queryFn: () => api.get("/processing/jobs", { params: { service: "lease_abstraction" } }).then((r) => r.data),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return api.post("/processing/lease-abstraction/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["processing-jobs", "lease_abstraction"] });
      queryClient.invalidateQueries({ queryKey: ["balance"] });
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    onError: (err) => setError(apiErrorMessage(err, "Could not abstract this lease.")),
  });

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
          <FileText size={22} />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-900">Lease Abstraction</h1>
          <p className="text-brand-400">Upload a lease PDF — billed once per document, regardless of page count.</p>
        </div>
      </div>

      <div className="card mt-6">
        <label className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-brand-200 py-10 text-center cursor-pointer hover:border-brand-400 hover:bg-brand-50 transition-colors">
          <Upload size={28} className="text-brand-400" />
          <span className="mt-2 text-sm font-semibold text-brand-700">
            {uploadMutation.isPending ? "Abstracting lease…" : "Click to upload a lease .pdf"}
          </span>
          <span className="mt-1 text-xs text-brand-300">Max 10 MB, up to 50 pages</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            disabled={uploadMutation.isPending}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadMutation.mutate(file);
            }}
          />
        </label>
        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-danger-500/10 px-3.5 py-2.5 text-sm text-danger-600">
            <AlertCircle size={16} /> {error}
          </div>
        )}
      </div>

      <div className="card mt-6">
        <h3 className="font-display text-lg font-semibold text-brand-900">Recent abstracts</h3>
        <div className="mt-4 space-y-2">
          {jobs?.map((job) => (
            <div key={job.id} className="rounded-lg border border-brand-50 px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-brand-800">{job.original_filename}</div>
                  <div className="text-xs text-brand-300">
                    {new Date(job.created_at).toLocaleString()}
                    {job.page_count != null && ` \u00b7 ${job.page_count} page(s)`}
                    {Number(job.billed_amount) > 0 && ` \u00b7 \u20b9${job.billed_amount} billed`}
                  </div>
                  {job.error_message && <div className="mt-1 text-xs text-danger-600">{job.error_message}</div>}
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={STATUS_TONE[job.status] ?? "neutral"}>{job.status}</Badge>
                  {job.status === "completed" && (
                    <>
                      <button
                        onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                        className="text-brand-500 hover:text-brand-700"
                      >
                        <ChevronDown size={18} className={expandedJob === job.id ? "rotate-180 transition-transform" : "transition-transform"} />
                      </button>
                      <a href={`/api/v1/processing/jobs/${job.id}/result`} className="text-brand-500 hover:text-brand-700" title="Download result">
                        <Download size={18} />
                      </a>
                    </>
                  )}
                </div>
              </div>
              {expandedJob === job.id && job.result_metadata?.extracted && (
                <dl className="mt-3 grid grid-cols-1 gap-3 rounded-lg bg-brand-50 p-4 sm:grid-cols-2">
                  {Object.entries(job.result_metadata.extracted).map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-brand-400">
                        {FIELD_LABELS[key] ?? key}
                      </dt>
                      <dd className="text-sm text-brand-800">{value != null ? String(value) : "\u2014"}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          ))}
          {!jobs?.length && <p className="text-sm text-brand-300">No leases processed yet.</p>}
        </div>
      </div>
    </div>
  );
}
