import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, Upload, Download, AlertCircle, Plus, X, ArrowLeft } from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";

interface ProcessingJob {
  id: string;
  status: string;
  original_filename: string;
  billed_amount: string;
  error_message: string | null;
  result_metadata: { requested_fields?: string[]; extracted?: Record<string, unknown> };
  created_at: string;
}

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger"> = {
  queued: "neutral",
  processing: "warning",
  completed: "success",
  failed: "danger",
};

export function DataExtractionUploadPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fields, setFields] = useState<string[]>(["invoice_number", "total", "due_date"]);
  const [newField, setNewField] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: jobs } = useQuery<ProcessingJob[]>({
    queryKey: ["processing-jobs", "data_extraction"],
    queryFn: () => api.get("/processing/jobs", { params: { service: "data_extraction" } }).then((r) => r.data),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return api.post("/processing/data-extraction/upload", formData, {
        params: { fields: fields.join(",") },
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["processing-jobs", "data_extraction"] });
      queryClient.invalidateQueries({ queryKey: ["balance"] });
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    onError: (err) => setError(apiErrorMessage(err, "Could not extract data from this file.")),
  });

  function addField() {
    const trimmed = newField.trim();
    if (trimmed && !fields.includes(trimmed)) {
      setFields([...fields, trimmed]);
      setNewField("");
    }
  }

  return (
    <div className="max-w-4xl">
      <Link to="/services" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-500 hover:text-brand-700">
        <ArrowLeft size={15} /> Back to Services
      </Link>
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
          <Database size={22} />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-900">Data Extraction</h1>
          <p className="text-brand-400">Tell us which fields to pull out, then upload the document.</p>
        </div>
      </div>

      <div className="card mt-6">
        <label className="label">Fields to extract</label>
        <div className="flex flex-wrap gap-2">
          {fields.map((f) => (
            <span key={f} className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1.5 text-sm font-medium text-brand-700">
              {f}
              <button onClick={() => setFields(fields.filter((x) => x !== f))} className="text-brand-400 hover:text-danger-600">
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            className="input max-w-xs"
            value={newField}
            onChange={(e) => setNewField(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addField())}
            placeholder="e.g. vendor_name"
          />
          <button onClick={addField} className="btn-secondary">
            <Plus size={15} /> Add field
          </button>
        </div>

        <label className="mt-5 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-brand-200 py-10 text-center cursor-pointer hover:border-brand-400 hover:bg-brand-50 transition-colors">
          <Upload size={28} className="text-brand-400" />
          <span className="mt-2 text-sm font-semibold text-brand-700">
            {uploadMutation.isPending ? "Extracting…" : "Click to upload a .txt file"}
          </span>
          <span className="mt-1 text-xs text-brand-300">Max 10 MB</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt"
            className="hidden"
            disabled={uploadMutation.isPending || !fields.length}
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
        <h3 className="font-display text-lg font-semibold text-brand-900">Recent extractions</h3>
        <div className="mt-4 space-y-2">
          {jobs?.map((job) => (
            <div key={job.id} className="rounded-lg border border-brand-50 px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-brand-800">{job.original_filename}</div>
                  <div className="text-xs text-brand-300">
                    {new Date(job.created_at).toLocaleString()}
                    {Number(job.billed_amount) > 0 && ` \u00b7 \u20b9${job.billed_amount} billed`}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={STATUS_TONE[job.status] ?? "neutral"}>{job.status}</Badge>
                  {job.status === "completed" && (
                    <a href={`/api/v1/processing/jobs/${job.id}/result`} className="text-brand-500 hover:text-brand-700" title="Download result">
                      <Download size={18} />
                    </a>
                  )}
                </div>
              </div>
              {job.error_message && <div className="mt-1 text-xs text-danger-600">{job.error_message}</div>}
              {job.result_metadata?.extracted && (
                <dl className="mt-2 grid grid-cols-2 gap-2 rounded-lg bg-brand-50 p-3 sm:grid-cols-3">
                  {Object.entries(job.result_metadata.extracted).map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-brand-400">{key}</dt>
                      <dd className="text-sm text-brand-800">{String(value ?? "\u2014")}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          ))}
          {!jobs?.length && <p className="text-sm text-brand-300">No files processed yet.</p>}
        </div>
      </div>
    </div>
  );
}
