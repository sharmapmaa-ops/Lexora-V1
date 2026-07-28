import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

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

export function AdminPage() {
  const [selected, setSelected] = useState<string | null>(null);

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

  return (
    <div className="max-w-6xl">
      <h1 className="font-display text-2xl font-bold text-brand-900">Admin Panel</h1>
      <p className="mt-1 text-brand-400">Every table below is served by one generic backend route.</p>

      {/* One dropdown for every table - no per-table tabs/buttons. */}
      <div className="mt-6 card">
        <div className="flex items-center gap-3">
          <label className="text-sm font-semibold text-brand-600">Table</label>
          <select
            className="input max-w-xs"
            value={selected ?? ""}
            onChange={(e) => setSelected(e.target.value)}
          >
            {tables?.map((t) => (
              <option key={t.name} value={t.name}>
                {t.display_name}
              </option>
            ))}
          </select>
        </div>

        {/* Card sizes to its content - no forced height, no
            card-level scrollbar (a real lesson from the old project:
            let the page scroll, only the table body scrolls). */}
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
              </tr>
            </thead>
            <tbody>
              {tableData?.rows.map((row, i) => (
                <tr key={i} className="border-t border-brand-50">
                  {tableData.columns.map((col) => (
                    <td key={col.name} className="whitespace-nowrap px-4 py-2 text-brand-700">
                      {formatCell(row[col.name])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tableData && (
          <p className="mt-2 text-xs text-brand-300">{tableData.total} row(s)</p>
        )}
      </div>
    </div>
  );
}
