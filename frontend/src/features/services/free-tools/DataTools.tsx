import { useState } from "react";
import { FileText, FileSpreadsheet, GitCompare } from "lucide-react";

function ToolCard({ icon: Icon, title, desc, children }: { icon: any; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
          <Icon size={20} />
        </div>
        <div>
          <h3 className="font-display font-semibold text-brand-900">{title}</h3>
          <p className="text-sm text-brand-400">{desc}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export function WordCounter() {
  const [text, setText] = useState("");
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const chars = text.length;
  const charsNoSpaces = text.replace(/\s/g, "").length;
  const sentences = text.trim() ? (text.match(/[.!?]+/g) ?? []).length : 0;
  const paragraphs = text.trim() ? text.split(/\n+/).filter((p) => p.trim()).length : 0;

  return (
    <ToolCard icon={FileText} title="Word Counter" desc="Words, characters, sentences, and paragraphs.">
      <textarea
        className="input"
        rows={6}
        placeholder="Paste or type text here…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="mt-3 grid grid-cols-4 gap-3 rounded-lg bg-brand-50 p-3 text-center text-sm">
        <div><div className="font-display text-lg font-bold text-brand-900">{words}</div><div className="text-xs text-brand-400">Words</div></div>
        <div><div className="font-display text-lg font-bold text-brand-900">{chars}</div><div className="text-xs text-brand-400">Characters</div></div>
        <div><div className="font-display text-lg font-bold text-brand-900">{charsNoSpaces}</div><div className="text-xs text-brand-400">No Spaces</div></div>
        <div><div className="font-display text-lg font-bold text-brand-900">{sentences}</div><div className="text-xs text-brand-400">Sentences</div></div>
      </div>
      <p className="mt-1 text-xs text-brand-300">{paragraphs} paragraph(s)</p>
    </ToolCard>
  );
}

function jsonToCsv(data: unknown[]): string {
  if (!data.length) return "";
  const headers = Array.from(new Set(data.flatMap((row) => Object.keys(row as object))));
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const row of data) {
    lines.push(headers.map((h) => escape((row as Record<string, unknown>)[h])).join(","));
  }
  return lines.join("\n");
}

function csvToJson(csv: string): unknown[] {
  const lines = csv.trim().split("\n");
  if (!lines.length) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(",");
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => (obj[h] = (values[i] ?? "").trim()));
    return obj;
  });
}

export function JsonCsvConverter() {
  const [mode, setMode] = useState<"json-to-csv" | "csv-to-json">("json-to-csv");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);

  function convert() {
    setError(null);
    try {
      if (mode === "json-to-csv") {
        const data = JSON.parse(input);
        setOutput(jsonToCsv(Array.isArray(data) ? data : [data]));
      } else {
        setOutput(JSON.stringify(csvToJson(input), null, 2));
      }
    } catch {
      setError(`Could not parse this as valid ${mode === "json-to-csv" ? "JSON" : "CSV"}.`);
      setOutput("");
    }
  }

  return (
    <ToolCard icon={FileSpreadsheet} title="JSON \u2194 CSV Converter" desc="Convert between JSON arrays and CSV.">
      <div className="mb-3 flex gap-2">
        <button
          onClick={() => setMode("json-to-csv")}
          className={mode === "json-to-csv" ? "btn-primary !py-1.5" : "btn-secondary !py-1.5"}
        >
          JSON \u2192 CSV
        </button>
        <button
          onClick={() => setMode("csv-to-json")}
          className={mode === "csv-to-json" ? "btn-primary !py-1.5" : "btn-secondary !py-1.5"}
        >
          CSV \u2192 JSON
        </button>
      </div>
      <textarea
        className="input font-mono text-xs"
        rows={5}
        placeholder={mode === "json-to-csv" ? '[{"name":"Alice","age":30}]' : "name,age\nAlice,30"}
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />
      {error && <p className="mt-2 text-sm text-danger-600">{error}</p>}
      <button onClick={convert} className="btn-primary mt-3">Convert</button>
      {output && <textarea className="input mt-3 font-mono text-xs" rows={5} readOnly value={output} />}
    </ToolCard>
  );
}

export function DataComparison() {
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");

  const leftLines = left.split("\n");
  const rightLines = right.split("\n");
  const maxLines = Math.max(leftLines.length, rightLines.length);
  const diffs: { line: number; left: string; right: string; same: boolean }[] = [];
  for (let i = 0; i < maxLines; i++) {
    const l = leftLines[i] ?? "";
    const r = rightLines[i] ?? "";
    diffs.push({ line: i + 1, left: l, right: r, same: l === r });
  }
  const diffCount = diffs.filter((d) => !d.same).length;

  return (
    <ToolCard icon={GitCompare} title="Data Comparison" desc="Line-by-line comparison of two blocks of text.">
      <div className="grid grid-cols-2 gap-3">
        <textarea className="input font-mono text-xs" rows={6} placeholder="Original text" value={left} onChange={(e) => setLeft(e.target.value)} />
        <textarea className="input font-mono text-xs" rows={6} placeholder="Compare against" value={right} onChange={(e) => setRight(e.target.value)} />
      </div>
      {(left || right) && (
        <>
          <p className="mt-2 text-xs text-brand-400">{diffCount} line(s) differ out of {maxLines}.</p>
          <div className="mt-2 max-h-48 space-y-1 overflow-auto rounded-lg border border-brand-100 p-2 font-mono text-xs">
            {diffs.filter((d) => !d.same).map((d) => (
              <div key={d.line} className="rounded bg-danger-500/5 p-1.5">
                <span className="text-brand-300">L{d.line}:</span>{" "}
                <span className="text-danger-600 line-through">{d.left || "(empty)"}</span>{" "}
                <span className="text-accent-600">{d.right || "(empty)"}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </ToolCard>
  );
}
