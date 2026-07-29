import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Search, X, Upload } from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";

interface TableInfo {
  name: string;
  display_name: string;
  row_count: number;
}

interface Column {
  name: string;
  type: string;
  field_type: "text" | "number" | "boolean" | "date" | "datetime" | "select" | "multiselect" | "json" | "image";
  options: string[] | null;
  primary_key: boolean;
  editable: boolean;
}

interface TableData {
  columns: Column[];
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  page_size: number;
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function rowKey(row: Record<string, unknown>, columns: Column[]): string {
  const pk = columns.find((c) => c.primary_key);
  return pk ? String(row[pk.name]) : JSON.stringify(row);
}

/** Type-aware input for a single field in the row-edit form - this is
 * the actual fix for "every field was a plain text box": a date column
 * gets a date picker, an enum gets a dropdown, a boolean gets a
 * checkbox, and an image column gets a file-select button instead of
 * a text box holding a storage key nobody should hand-edit. */
function FieldInput({
  col,
  value,
  onChange,
  onImageSelect,
  imageUrl,
}: {
  col: Column;
  value: string;
  onChange: (v: string) => void;
  onImageSelect: (file: File) => void;
  imageUrl: string | null;
}) {
  if (!col.editable) {
    return <input className="input bg-brand-50 !py-1.5 text-xs" value={value} disabled />;
  }

  switch (col.field_type) {
    case "boolean":
      return (
        <select className="input !py-1.5" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="true">True</option>
          <option value="false">False</option>
        </select>
      );
    case "select":
      return (
        <select className="input !py-1.5" value={value} onChange={(e) => onChange(e.target.value)}>
          {(col.options ?? []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    case "date":
      return <input type="date" className="input !py-1.5" value={value?.slice(0, 10) ?? ""} onChange={(e) => onChange(e.target.value)} />;
    case "datetime":
      return <input type="datetime-local" className="input !py-1.5" value={value?.slice(0, 16) ?? ""} onChange={(e) => onChange(e.target.value)} />;
    case "number":
      return <input type="number" step="any" className="input !py-1.5" value={value} onChange={(e) => onChange(e.target.value)} />;
    case "json":
    case "multiselect":
      return <textarea className="input !py-1.5 font-mono text-xs" rows={3} value={value} onChange={(e) => onChange(e.target.value)} />;
    case "image":
      return (
        <div className="flex items-center gap-2">
          {imageUrl && (
            <img src={imageUrl} alt="" className="h-10 w-10 rounded-lg border border-brand-100 object-cover" />
          )}
          <label className="btn-secondary !py-1.5 text-xs cursor-pointer">
            <Upload size={13} /> {value ? "Replace" : "Upload"} image
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onImageSelect(f); }}
            />
          </label>
        </div>
      );
    default:
      return <input className="input !py-1.5" value={value} onChange={(e) => onChange(e.target.value)} />;
  }
}

export function AdminPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [openRowKey, setOpenRowKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const queryClient = useQueryClient();

  const { data: tables } = useQuery<TableInfo[]>({
    queryKey: ["admin-tables"],
    queryFn: () => api.get("/admin/tables").then((r) => r.data),
  });

  useEffect(() => {
    if (!selected && tables?.length) setSelected(tables[0].name);
  }, [tables, selected]);

  const { data: tableData } = useQuery<TableData>({
    queryKey: ["admin-table", selected],
    queryFn: () => api.get(`/admin/tables/${selected}`).then((r) => r.data),
    enabled: !!selected,
  });

  const filteredRows = useMemo(() => {
    if (!tableData) return [];
    if (!search.trim()) return tableData.rows;
    const q = search.toLowerCase();
    return tableData.rows.filter((row) =>
      tableData.columns.some((c) => formatCell(row[c.name]).toLowerCase().includes(q))
    );
  }, [tableData, search]);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin-table", selected] });
    queryClient.invalidateQueries({ queryKey: ["admin-tables"] });
  }

  const saveMutation = useMutation({
    mutationFn: (row: Record<string, unknown>) => {
      const pk = tableData!.columns.find((c) => c.primary_key)!;
      return api.put(`/admin/tables/${selected}/${row[pk.name]}`, draft);
    },
    onSuccess: () => { setOpenRowKey(null); setError(null); invalidate(); },
    onError: (err) => setError(apiErrorMessage(err, "Could not save this row.")),
  });

  const deleteMutation = useMutation({
    mutationFn: (row: Record<string, unknown>) => {
      const pk = tableData!.columns.find((c) => c.primary_key)!;
      return api.delete(`/admin/tables/${selected}/${row[pk.name]}`);
    },
    onSuccess: () => { setOpenRowKey(null); setError(null); invalidate(); },
    onError: (err) => setError(apiErrorMessage(err, "Could not delete this row.")),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post(`/admin/tables/${selected}`, draft),
    onSuccess: () => { setIsCreating(false); setError(null); invalidate(); },
    onError: (err) => setError(apiErrorMessage(err, "Could not create this row.")),
  });

  const [imageCacheBust, setImageCacheBust] = useState(0);

  const imageUploadMutation = useMutation({
    mutationFn: ({ row, column, file }: { row: Record<string, unknown>; column: string; file: File }) => {
      const pk = tableData!.columns.find((c) => c.primary_key)!;
      const formData = new FormData();
      formData.append("file", file);
      return api.post(`/admin/tables/${selected}/${row[pk.name]}/upload/${column}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: () => { invalidate(); setImageCacheBust((n) => n + 1); },
    onError: (err) => setError(apiErrorMessage(err, "Could not upload this image.")),
  });

  function openRow(row: Record<string, unknown>) {
    const initial: Record<string, string> = {};
    tableData?.columns.forEach((c) => { initial[c.name] = formatCell(row[c.name]); });
    setDraft(initial);
    setOpenRowKey(rowKey(row, tableData?.columns ?? []));
    setError(null);
  }

  function startCreate() {
    const initial: Record<string, string> = {};
    tableData?.columns.forEach((c) => { initial[c.name] = ""; });
    setDraft(initial);
    setIsCreating(true);
    setError(null);
  }

  const activeRow = tableData?.rows.find((r) => rowKey(r, tableData.columns) === openRowKey);
  const pkColumn = tableData?.columns.find((c) => c.primary_key);

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-900">Admin Panel</h1>
          <p className="mt-1 text-brand-400">Every table below is served by one generic backend route.</p>
        </div>
        <button onClick={startCreate} disabled={!selected} className="btn-primary">
          <Plus size={15} /> Add Row
        </button>
      </div>

      <div className="mt-6 card">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-semibold text-brand-600">Table</label>
          <select
            className="input max-w-xs"
            value={selected ?? ""}
            onChange={(e) => { setSelected(e.target.value); setSearch(""); }}
          >
            {tables?.map((t) => (
              <option key={t.name} value={t.name}>{t.display_name}</option>
            ))}
          </select>

          {/* Filter bar */}
          <div className="relative ml-auto min-w-[220px]">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-300" />
            <input
              className="input !py-2 pl-8"
              placeholder="Filter rows…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border border-brand-100">
          <table className="w-full text-sm">
            <thead className="bg-brand-900 text-left text-white">
              <tr>
                {tableData?.columns.map((col) => (
                  <th key={col.name} className="whitespace-nowrap px-4 py-2.5 font-semibold">
                    {col.name}{col.primary_key && " \uD83D\uDD11"}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, i) => (
                <tr
                  key={i}
                  onClick={() => openRow(row)}
                  className="cursor-pointer border-t border-brand-50 hover:bg-brand-50"
                >
                  {tableData?.columns.map((col) => (
                    <td key={col.name} className="whitespace-nowrap px-4 py-2 text-brand-700">
                      {col.field_type === "image" && row[col.name] ? (
                        <span className="rounded bg-accent-500/10 px-2 py-0.5 text-xs text-accent-600">Image set</span>
                      ) : (
                        formatCell(row[col.name])
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              {!filteredRows.length && (
                <tr>
                  <td colSpan={tableData?.columns.length ?? 1} className="px-4 py-6 text-center text-brand-300">
                    No rows match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {tableData && (
          <p className="mt-2 text-xs text-brand-300">
            {filteredRows.length} of {tableData.total} row(s){search && " (filtered)"} — click a row to edit
          </p>
        )}
      </div>

      {/* Row-edit form modal - opens on row click (or Add Row), shows
          every field as a type-aware input rather than an inline text
          box, per column's field_type from the backend. */}
      {(activeRow || isCreating) && tableData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/50 p-6">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl2 bg-white p-6 shadow-popover">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-brand-900">
                {isCreating ? "Add Row" : `Edit Row`}
              </h3>
              <button onClick={() => { setOpenRowKey(null); setIsCreating(false); }} className="text-brand-400 hover:text-danger-600">
                <X size={18} />
              </button>
            </div>

            {error && <div className="mt-3 rounded-lg bg-danger-500/10 px-3.5 py-2.5 text-sm text-danger-600">{error}</div>}

            <div className="mt-4 space-y-3">
              {tableData.columns.map((col) => (
                <div key={col.name}>
                  <label className="label">{col.name}{col.primary_key && " (primary key)"}</label>
                  <FieldInput
                    col={col}
                    value={draft[col.name] ?? ""}
                    onChange={(v) => setDraft({ ...draft, [col.name]: v })}
                    onImageSelect={(file) => {
                      if (activeRow) imageUploadMutation.mutate({ row: activeRow, column: col.name, file });
                    }}
                    imageUrl={
                      col.field_type === "image" && activeRow && pkColumn && activeRow[col.name]
                        ? `/api/v1/admin-image/${selected}/${activeRow[pkColumn.name]}/${col.name}?t=${imageCacheBust}`
                        : null
                    }
                  />
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between">
              {!isCreating && activeRow && (
                <button
                  onClick={() => { if (confirm("Delete this row? This cannot be undone.")) deleteMutation.mutate(activeRow); }}
                  className="btn-danger"
                >
                  <Trash2 size={15} /> Delete
                </button>
              )}
              <button
                onClick={() => (isCreating ? createMutation.mutate() : activeRow && saveMutation.mutate(activeRow))}
                disabled={saveMutation.isPending || createMutation.isPending}
                className="btn-primary ml-auto"
              >
                {isCreating ? "Create" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
