import { useState } from "react";
import { PDFDocument, degrees } from "pdf-lib";
import { Combine, Scissors, RotateCw, Upload, Download, X } from "lucide-react";

function downloadBytes(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function MergeTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleMerge() {
    setError(null);
    setBusy(true);
    try {
      const merged = await PDFDocument.create();
      for (const file of files) {
        const bytes = await file.arrayBuffer();
        const src = await PDFDocument.load(bytes);
        const pages = await merged.copyPages(src, src.getPageIndices());
        pages.forEach((p) => merged.addPage(p));
      }
      const out = await merged.save();
      downloadBytes(out, "merged.pdf");
    } catch (err) {
      setError("Could not merge these files — make sure they're all valid PDFs.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
          <Combine size={20} />
        </div>
        <div>
          <h3 className="font-display font-semibold text-brand-900">Merge PDF</h3>
          <p className="text-sm text-brand-400">Combine multiple PDFs into one, in the order you add them.</p>
        </div>
      </div>

      <label className="mt-4 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-brand-200 py-6 text-center cursor-pointer hover:border-brand-400 hover:bg-brand-50">
        <Upload size={22} className="text-brand-400" />
        <span className="mt-1.5 text-sm font-semibold text-brand-700">Add PDF files</span>
        <input
          type="file"
          accept=".pdf"
          multiple
          className="hidden"
          onChange={(e) => setFiles([...files, ...Array.from(e.target.files ?? [])])}
        />
      </label>

      {files.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {files.map((f, i) => (
            <li key={i} className="flex items-center justify-between rounded-lg bg-brand-50 px-3 py-1.5 text-sm text-brand-700">
              {f.name}
              <button onClick={() => setFiles(files.filter((_, idx) => idx !== i))} className="text-brand-400 hover:text-danger-600">
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-2 text-sm text-danger-600">{error}</p>}
      <button
        onClick={handleMerge}
        disabled={files.length < 2 || busy}
        className="btn-primary mt-4"
      >
        <Download size={15} /> {busy ? "Merging…" : `Merge ${files.length || ""} PDFs`}
      </button>
    </div>
  );
}

function SplitTool() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [ranges, setRanges] = useState("1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(f: File) {
    setFile(f);
    setError(null);
    const bytes = await f.arrayBuffer();
    const doc = await PDFDocument.load(bytes);
    setPageCount(doc.getPageCount());
  }

  function parseRanges(input: string, max: number): number[] {
    const indices: number[] = [];
    for (const part of input.split(",").map((p) => p.trim()).filter(Boolean)) {
      const rangeMatch = part.match(/^(\d+)-(\d+)$/);
      if (rangeMatch) {
        const start = Number(rangeMatch[1]);
        const end = Number(rangeMatch[2]);
        for (let i = start; i <= end; i++) if (i >= 1 && i <= max) indices.push(i - 1);
      } else if (/^\d+$/.test(part)) {
        const n = Number(part);
        if (n >= 1 && n <= max) indices.push(n - 1);
      }
    }
    return indices;
  }

  async function handleSplit() {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const indices = parseRanges(ranges, pageCount);
      if (!indices.length) {
        setError(`Enter valid page numbers between 1 and ${pageCount} (e.g. "1-3, 5").`);
        setBusy(false);
        return;
      }
      const bytes = await file.arrayBuffer();
      const src = await PDFDocument.load(bytes);
      const out = await PDFDocument.create();
      const pages = await out.copyPages(src, indices);
      pages.forEach((p) => out.addPage(p));
      const outBytes = await out.save();
      downloadBytes(outBytes, "extracted-pages.pdf");
    } catch {
      setError("Could not split this file — make sure it's a valid PDF.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
          <Scissors size={20} />
        </div>
        <div>
          <h3 className="font-display font-semibold text-brand-900">Split PDF</h3>
          <p className="text-sm text-brand-400">Extract specific pages into a new PDF.</p>
        </div>
      </div>

      <label className="mt-4 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-brand-200 py-6 text-center cursor-pointer hover:border-brand-400 hover:bg-brand-50">
        <Upload size={22} className="text-brand-400" />
        <span className="mt-1.5 text-sm font-semibold text-brand-700">
          {file ? file.name : "Choose a PDF file"}
        </span>
        <input
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </label>

      {file && (
        <div className="mt-3">
          <label className="label">Pages to extract ({pageCount} total)</label>
          <input className="input" value={ranges} onChange={(e) => setRanges(e.target.value)} placeholder="e.g. 1-3, 5" />
        </div>
      )}
      {error && <p className="mt-2 text-sm text-danger-600">{error}</p>}
      <button onClick={handleSplit} disabled={!file || busy} className="btn-primary mt-4">
        <Download size={15} /> {busy ? "Extracting…" : "Extract pages"}
      </button>
    </div>
  );
}

function RotateTool() {
  const [file, setFile] = useState<File | null>(null);
  const [angle, setAngle] = useState(90);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRotate() {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const bytes = await file.arrayBuffer();
      const doc = await PDFDocument.load(bytes);
      doc.getPages().forEach((page) => {
        page.setRotation(degrees((page.getRotation().angle + angle) % 360));
      });
      const out = await doc.save();
      downloadBytes(out, "rotated.pdf");
    } catch {
      setError("Could not rotate this file — make sure it's a valid PDF.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
          <RotateCw size={20} />
        </div>
        <div>
          <h3 className="font-display font-semibold text-brand-900">Rotate PDF</h3>
          <p className="text-sm text-brand-400">Rotate every page by 90, 180, or 270 degrees.</p>
        </div>
      </div>

      <label className="mt-4 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-brand-200 py-6 text-center cursor-pointer hover:border-brand-400 hover:bg-brand-50">
        <Upload size={22} className="text-brand-400" />
        <span className="mt-1.5 text-sm font-semibold text-brand-700">{file ? file.name : "Choose a PDF file"}</span>
        <input
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>

      <div className="mt-3">
        <label className="label">Rotation</label>
        <select className="input" value={angle} onChange={(e) => setAngle(Number(e.target.value))}>
          <option value={90}>90° clockwise</option>
          <option value={180}>180°</option>
          <option value={270}>270° clockwise</option>
        </select>
      </div>
      {error && <p className="mt-2 text-sm text-danger-600">{error}</p>}
      <button onClick={handleRotate} disabled={!file || busy} className="btn-primary mt-4">
        <Download size={15} /> {busy ? "Rotating…" : "Rotate & download"}
      </button>
    </div>
  );
}

export function FreeServicesPage() {
  return (
    <div className="max-w-5xl">
      <h1 className="font-display text-2xl font-bold text-brand-900">Free Services</h1>
      <p className="mt-1 text-brand-400">
        Everything below runs entirely in your browser — files never leave your device, and it's
        always free, regardless of your plan.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MergeTool />
        <SplitTool />
        <RotateTool />
      </div>
    </div>
  );
}
