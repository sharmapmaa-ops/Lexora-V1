import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Languages, Upload, Download, AlertCircle } from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";

interface ProcessingJob {
  id: string;
  status: string;
  original_filename: string;
  billed_amount: string;
  error_message: string | null;
  result_metadata: { target_language?: string };
  created_at: string;
}

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger"> = {
  queued: "neutral",
  processing: "warning",
  completed: "success",
  failed: "danger",
};

const LANGUAGES = ["Spanish", "French", "German", "Hindi", "Arabic", "Chinese (Simplified)", "Japanese"];

export function TranslationUploadPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [targetLanguage, setTargetLanguage] = useState(LANGUAGES[0]);
  const [error, setError] = useState<string | null>(null);

  const { data: jobs } = useQuery<ProcessingJob[]>({
    queryKey: ["processing-jobs", "translation"],
    queryFn: () => api.get("/processing/jobs", { params: { service: "translation" } }).then((r) => r.data),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return api.post("/processing/translation/upload", formData, {
        params: { target_language: targetLanguage },
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["processing-jobs", "translation"] });
      queryClient.invalidateQueries({ queryKey: ["balance"] });
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    onError: (err) => setError(apiErrorMessage(err, "Could not translate this file.")),
  });

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
          <Languages size={22} />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-900">Translation</h1>
          <p className="text-brand-400">Upload a text document and choose a target language.</p>
        </div>
      </div>

      <div className="card mt-6">
        <label className="label">Target language</label>
        <select
          className="input max-w-xs"
          value={targetLanguage}
          onChange={(e) => setTargetLanguage(e.target.value)}
        >
          {LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
        </select>

        <label className="mt-5 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-brand-200 py-10 text-center cursor-pointer hover:border-brand-400 hover:bg-brand-50 transition-colors">
          <Upload size={28} className="text-brand-400" />
          <span className="mt-2 text-sm font-semibold text-brand-700">
            {uploadMutation.isPending ? "Translating…" : "Click to upload a .txt file"}
          </span>
          <span className="mt-1 text-xs text-brand-300">Max 10 MB</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt"
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
        <h3 className="font-display text-lg font-semibold text-brand-900">Recent translations</h3>
        <div className="mt-4 space-y-2">
          {jobs?.map((job) => (
            <div key={job.id} className="flex items-center justify-between rounded-lg border border-brand-50 px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-brand-800">
                  {job.original_filename}
                  {job.result_metadata?.target_language && ` \u2192 ${job.result_metadata.target_language}`}
                </div>
                <div className="text-xs text-brand-300">
                  {new Date(job.created_at).toLocaleString()}
                  {Number(job.billed_amount) > 0 && ` \u00b7 \u20b9${job.billed_amount} billed`}
                </div>
                {job.error_message && <div className="mt-1 text-xs text-danger-600">{job.error_message}</div>}
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={STATUS_TONE[job.status] ?? "neutral"}>{job.status}</Badge>
                {job.status === "completed" && (
                  <a
                    href={`/api/v1/processing/jobs/${job.id}/result`}
                    className="text-brand-500 hover:text-brand-700"
                    title="Download result"
                  >
                    <Download size={18} />
                  </a>
                )}
              </div>
            </div>
          ))}
          {!jobs?.length && <p className="text-sm text-brand-300">No files translated yet.</p>}
        </div>
      </div>
    </div>
  );
}
