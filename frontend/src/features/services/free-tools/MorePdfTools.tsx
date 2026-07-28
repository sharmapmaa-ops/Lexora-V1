import { useState } from "react";
import { PDFDocument, StandardFonts } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore - Vite's ?url suffix resolves to the worker script's URL at build time
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { FilePlus, Image as ImageIcon, Minimize2, Upload, Download } from "lucide-react";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

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

function downloadBytes(bytes: Uint8Array, filename: string, mime: string) {
  const blob = new Blob([bytes as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function CreatePdf() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    setBusy(true);
    try {
      const doc = await PDFDocument.create();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const fontSize = 12;
      const margin = 50;
      const pageWidth = 595;
      const pageHeight = 842;
      const maxWidth = pageWidth - margin * 2;

      // Simple word-wrap - pdf-lib doesn't wrap text for you.
      const words = text.split(/\s+/);
      const lines: string[] = [];
      let current = "";
      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, fontSize) > maxWidth) {
          lines.push(current);
          current = word;
        } else {
          current = candidate;
        }
      }
      if (current) lines.push(current);

      let page = doc.addPage([pageWidth, pageHeight]);
      let y = pageHeight - margin;
      const lineHeight = fontSize * 1.4;
      for (const line of lines) {
        if (y < margin) {
          page = doc.addPage([pageWidth, pageHeight]);
          y = pageHeight - margin;
        }
        page.drawText(line, { x: margin, y, size: fontSize, font });
        y -= lineHeight;
      }

      const bytes = await doc.save();
      downloadBytes(bytes, "document.pdf", "application/pdf");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolCard icon={FilePlus} title="Create PDF" desc="Turn plain text into a formatted PDF document.">
      <textarea
        className="input"
        rows={8}
        placeholder="Type or paste your text here…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button onClick={handleCreate} disabled={!text.trim() || busy} className="btn-primary mt-3">
        <Download size={15} /> {busy ? "Creating…" : "Create PDF"}
      </button>
    </ToolCard>
  );
}

export function PdfToImage() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConvert() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d")!;
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        await new Promise<void>((resolve) => {
          canvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `page-${i}.png`;
              a.click();
              URL.revokeObjectURL(url);
            }
            resolve();
          }, "image/png");
        });
      }
    } catch {
      setError("Could not convert this PDF - make sure it's a valid file.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolCard icon={ImageIcon} title="PDF to Image" desc="Export every page as a separate PNG (downloads one file per page).">
      <label className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-brand-200 py-6 text-center cursor-pointer hover:border-brand-400 hover:bg-brand-50">
        <Upload size={22} className="text-brand-400" />
        <span className="mt-1.5 text-sm font-semibold text-brand-700">{file ? file.name : "Choose a PDF"}</span>
        <input type="file" accept=".pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      {error && <p className="mt-2 text-sm text-danger-600">{error}</p>}
      <button onClick={handleConvert} disabled={!file || busy} className="btn-primary mt-3">
        <Download size={15} /> {busy ? "Converting…" : "Convert to Images"}
      </button>
    </ToolCard>
  );
}

export function CompressPdf() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [savings, setSavings] = useState<{ before: number; after: number } | null>(null);

  async function handleCompress() {
    if (!file) return;
    setBusy(true);
    setSavings(null);
    try {
      const bytes = await file.arrayBuffer();
      const doc = await PDFDocument.load(bytes);
      // pdf-lib can't re-encode embedded images (real compression needs
      // that), but object-stream compaction + removing duplicate/unused
      // objects on save genuinely does shrink most real-world PDFs -
      // useSameOrigin/updateFieldAppearances defaults are fine here.
      const out = await doc.save({ useObjectStreams: true });
      setSavings({ before: bytes.byteLength, after: out.byteLength });
      downloadBytes(out, `compressed-${file.name}`, "application/pdf");
    } catch {
      // no-op
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolCard icon={Minimize2} title="Compress PDF" desc="Reduce file size by optimizing the PDF's internal structure.">
      <label className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-brand-200 py-6 text-center cursor-pointer hover:border-brand-400 hover:bg-brand-50">
        <Upload size={22} className="text-brand-400" />
        <span className="mt-1.5 text-sm font-semibold text-brand-700">{file ? file.name : "Choose a PDF"}</span>
        <input type="file" accept=".pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      <button onClick={handleCompress} disabled={!file || busy} className="btn-primary mt-3">
        <Download size={15} /> {busy ? "Compressing…" : "Compress & Download"}
      </button>
      {savings && (
        <p className="mt-2 text-xs text-brand-400">
          {(savings.before / 1024).toFixed(0)} KB \u2192 {(savings.after / 1024).toFixed(0)} KB
          {savings.after < savings.before
            ? ` (${(100 - (savings.after / savings.before) * 100).toFixed(0)}% smaller)`
            : " (this PDF was already well-optimized)"}
        </p>
      )}
      <p className="mt-2 text-xs text-brand-300">
        Note: this optimizes the PDF's structure, not embedded image quality - results vary a lot
        by document. For PDFs full of large scanned images, savings will be modest.
      </p>
    </ToolCard>
  );
}
