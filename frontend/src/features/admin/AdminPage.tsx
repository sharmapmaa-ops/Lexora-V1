import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Save, X, Trash2, Plus } from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";

interface TableInfo {
  name: string;
  display_name: string;
  row_count: number;
}

interface Column {
  name: string;
  type: string;
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

export function AdminPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
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

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin-table", selected] });
    queryClient.invalidateQueries({ queryKey: ["admin-tables"] });
  }

  const saveMutation = useMutation({
    mutationFn: (row: Record<string, unknown>) => {
      const pk = tableData!.columns.find((c) => c.primary_key)!;
      return api.put(`/admin/tables/${selected}/${row[pk.name]}`, draft);
    },
    onSuccess: () => {
      setEditingKey(null);
      setError(null);
      invalidate();
    },
    onError: (err) => setError(apiErrorMessage(err, "Could not save this row.")),
  });

  const deleteMutation = useMutation({
    mutationFn: (row: Record<string, unknown>) => {
      const pk = tableData!.columns.find((c) => c.primary_key)!;
      return api.delete(`/admin/tables/${selected}/${row[pk.name]}`);
    },
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err) => setError(apiErrorMessage(err, "Could not delete this row.")),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post(`/admin/tables/${selected}`, draft),
    onSuccess: () => {
      setEditingKey(null);
      setError(null);
      invalidate();
    },
    onError: (err) => setError(apiErrorMessage(err, "Could not create this row.")),
  });

  function startEdit(row: Record<string, unknown>) {
    const initial: Record<string, string> = {};
    tableData?.columns.forEach((c) => {
      initial[c.name] = formatCell(row[c.name]);
    });
    setDraft(initial);
    setEditingKey(rowKey(row, tableData?.columns ?? []));
    setError(null);
  }

  function startCreate() {
    const initial: Record<string, string> = {};
    tableData?.columns.forEach((c) => {
      initial[c.name] = "";
    });
    setDraft(initial);
    setEditingKey("__new__");
    setError(null);
  }

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
        <div className="flex items-center gap-3">
          <label className="text-sm font-semibold text-brand-600">Table</label>
          <select
            className="input max-w-xs"
            value={selected ?? ""}
            onChange={(e) => {
              setSelected(e.target.value);
              setEditingKey(null);
            }}
          >
            {tables?.map((t) => (
              <option key={t.name} value={t.name}>
                {t.display_name}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="mt-3 rounded-lg bg-danger-500/10 px-3.5 py-2.5 text-sm text-danger-600">{error}</div>
        )}

        <div className="mt-4 overflow-x-auto rounded-lg border border-brand-100">
          <table className="w-full text-sm">
            <thead className="bg-brand-900 text-left text-white">
              <tr>
                {tableData?.columns.map((col) => (
                  <th key={col.name} className="whitespace-nowrap px-4 py-2.5 font-semibold">
                    {col.name}
                    {col.primary_key && " \uD83D\uDD11"}
                  </th>
                ))}
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {editingKey === "__new__" && (
                <tr className="border-t border-brand-50 bg-accent-500/5">
                  {tableData?.columns.map((col) => (
                    <td key={col.name} className="px-4 py-2">
                      <input
                        className="input !py-1 text-xs"
                        disabled={!col.editable}
                        value={draft[col.name] ?? ""}
                        onChange={(e) => setDraft({ ...draft, [col.name]: e.target.value })}
                      />
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-4 py-2">
                    <button onClick={() => createMutation.mutate()} className="mr-2 text-accent-600 hover:text-accent-700">
                      <Save size={16} />
                    </button>
                    <button onClick={() => setEditingKey(null)} className="text-brand-400 hover:text-danger-600">
                      <X size={16} />
                    </button>
                  </td>
                </tr>
              )}
              {tableData?.rows.map((row, i) => {
                const key = rowKey(row, tableData.columns);
                const isEditing = editingKey === key;
                return (
                  <tr key={i} className="border-t border-brand-50">
                    {tableData.columns.map((col) => (
                      <td key={col.name} className="whitespace-nowrap px-4 py-2 text-brand-700">
                        {isEditing ? (
                          <input
                            className="input !py-1 text-xs"
                            disabled={!col.editable}
                            value={draft[col.name] ?? ""}
                            onChange={(e) => setDraft({ ...draft, [col.name]: e.target.value })}
                          />
                        ) : (
                          formatCell(row[col.name])
                        )}
                      </td>
                    ))}
                    <td className="whitespace-nowrap px-4 py-2">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => saveMutation.mutate(row)}
                            className="mr-2 text-accent-600 hover:text-accent-700"
                            title="Save"
                          >
                            <Save size={16} />
                          </button>
                          <button onClick={() => setEditingKey(null)} className="text-brand-400 hover:text-danger-600" title="Cancel">
                            <X size={16} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(row)} className="mr-2 text-brand-500 hover:text-brand-700" title="Edit">
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm("Delete this row? This cannot be undone.")) deleteMutation.mutate(row);
                            }}
                            className="text-brand-400 hover:text-danger-600"
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {tableData && <p className="mt-2 text-xs text-brand-300">{tableData.total} row(s)</p>}
      </div>
    </div>
  );
}
