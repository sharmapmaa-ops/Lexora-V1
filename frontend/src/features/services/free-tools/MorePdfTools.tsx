import { useState } from "react";
import { PDFDocument, StandardFonts } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore - Vite's ?url suffix resolves to the worker script's URL at build time
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { FilePlus, Image as ImageIcon, Minimize2, Upload, Download, FileEdit, ClipboardEdit } from "lucide-react";

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
  const [quality, setQuality] = useState<"light" | "balanced" | "strong">("balanced");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [savings, setSavings] = useState<{ before: number; after: number } | null>(null);

  const PRESETS = { light: { q: 0.8, scale: 2 }, balanced: { q: 0.6, scale: 1.5 }, strong: { q: 0.45, scale: 1.2 } };

  async function handleCompress() {
    if (!file) return;
    setBusy(true);
    setSavings(null);
    setProgress(0);
    try {
      const { q, scale } = PRESETS[quality];
      const buffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
      const out = await PDFDocument.create();

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;

        const jpgBlob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/jpeg", q));
        const jpgBytes = new Uint8Array(await jpgBlob.arrayBuffer());
        const embedded = await out.embedJpg(jpgBytes);
        const outPage = out.addPage([embedded.width, embedded.height]);
        outPage.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });
        setProgress(Math.round((i / pdf.numPages) * 100));
      }

      const bytes = await out.save();
      setSavings({ before: file.size, after: bytes.byteLength });
      downloadBytes(bytes, `compressed-${file.name}`, "application/pdf");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolCard icon={Minimize2} title="Compress PDF" desc="Rebuilds each page as a compressed image - genuinely smaller files, especially for scanned/image-heavy PDFs.">
      <label className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-brand-200 py-6 text-center cursor-pointer hover:border-brand-400 hover:bg-brand-50">
        <Upload size={22} className="text-brand-400" />
        <span className="mt-1.5 text-sm font-semibold text-brand-700">{file ? file.name : "Choose a PDF"}</span>
        <input type="file" accept=".pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      <div className="mt-3">
        <label className="label">Compression</label>
        <select className="input" value={quality} onChange={(e) => setQuality(e.target.value as typeof quality)}>
          <option value="light">Light - best quality</option>
          <option value="balanced">Balanced</option>
          <option value="strong">Strong - smallest file</option>
        </select>
      </div>
      <p className="mt-2 text-xs text-brand-300">
        Pages are rebuilt as images, so text in the output is no longer selectable/searchable - use this for sharing, not archiving.
      </p>
      <button onClick={handleCompress} disabled={!file || busy} className="btn-primary mt-3">
        <Download size={15} /> {busy ? `Compressing… ${progress}%` : "Compress & Download"}
      </button>
      {savings && (
        <p className="mt-2 text-xs text-brand-400">
          {(savings.before / 1024).toFixed(0)} KB \u2192 {(savings.after / 1024).toFixed(0)} KB
          {savings.after < savings.before
            ? ` (${(100 - (savings.after / savings.before) * 100).toFixed(0)}% smaller)`
            : " (this PDF was already well-optimized)"}
        </p>
      )}
    </ToolCard>
  );
}

export function PdfToWord() {
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
      const escapeHtml = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const pageBlocks: string[] = [];
      let totalChars = 0;

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        // Group items into lines by y-position so line breaks survive,
        // rather than becoming one long run-on paragraph.
        const lines: string[] = [];
        let lastY: number | null = null;
        let buf: string[] = [];
        for (const item of textContent.items as any[]) {
          const y = Math.round(item.transform[5]);
          if (lastY !== null && Math.abs(y - lastY) > 3) {
            lines.push(buf.join(""));
            buf = [];
          }
          buf.push(item.str);
          lastY = y;
        }
        if (buf.length) lines.push(buf.join(""));

        const body = lines
          .map((l) => l.replace(/\s+/g, " ").trim())
          .filter(Boolean)
          .map((l) => {
            totalChars += l.length;
            return `<p>${escapeHtml(l)}</p>`;
          })
          .join("");
        pageBlocks.push(body || "<p></p>");
      }

      if (!totalChars) {
        setError("No selectable text found - this looks like a scanned PDF. Try OCR instead.");
        return;
      }

      // Word opens an HTML file saved with a .doc extension and the
      // application/msword MIME type directly - no real DOCX encoding
      // needed for a text-only conversion like this.
      const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
        <head><meta charset="utf-8"><title>${escapeHtml(file.name)}</title>
        <style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;} p{margin:0 0 6pt 0;} .pb{page-break-before:always;}</style></head>
        <body>${pageBlocks.map((h, i) => `<div${i ? ' class="pb"' : ""}>${h}</div>`).join("")}</body></html>`;

      const blob = new Blob(["\ufeff" + html], { type: "application/msword" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${file.name.replace(/\.pdf$/i, "")}.doc`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolCard icon={FileEdit} title="PDF to Word" desc="Extract text into an editable Word document.">
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-800">
        This extracts the <b>text</b>, not the layout — columns, tables, and images aren't
        reproduced. For a layout-faithful conversion of a scanned document, use the paid
        Translation service instead.
      </div>
      <label className="mt-3 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-brand-200 py-6 text-center cursor-pointer hover:border-brand-400 hover:bg-brand-50">
        <Upload size={22} className="text-brand-400" />
        <span className="mt-1.5 text-sm font-semibold text-brand-700">{file ? file.name : "Choose a PDF"}</span>
        <input type="file" accept=".pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      {error && <p className="mt-2 text-sm text-danger-600">{error}</p>}
      <button onClick={handleConvert} disabled={!file || busy} className="btn-primary mt-3">
        <Download size={15} /> {busy ? "Converting…" : "Convert to Word"}
      </button>
    </ToolCard>
  );
}

type FormField = { name: string; type: "text" | "checkbox"; value: string | boolean };

export function PdfFormFiller() {
  const [file, setFile] = useState<File | null>(null);
  const [fileBytes, setFileBytes] = useState<ArrayBuffer | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(f: File) {
    setFile(f);
    setError(null);
    setFields([]);
    try {
      const bytes = await f.arrayBuffer();
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const form = doc.getForm();
      const formFields = form.getFields();
      if (!formFields.length) {
        setError("This PDF has no fillable form fields.");
        return;
      }
      const parsed: FormField[] = formFields.map((fl) => {
        const ctor = fl.constructor.name;
        if (ctor === "PDFCheckBox") {
          return { name: fl.getName(), type: "checkbox", value: (fl as any).isChecked?.() ?? false };
        }
        let value = "";
        try {
          value = (fl as any).getText?.() ?? "";
        } catch {
          // unreadable field type for this simple reader - leave blank
        }
        return { name: fl.getName(), type: "text", value };
      });
      setFileBytes(bytes);
      setFields(parsed);
      const initialValues: Record<string, string | boolean> = {};
      parsed.forEach((f) => (initialValues[f.name] = f.value));
      setValues(initialValues);
    } catch {
      setError("Could not read this PDF's form fields.");
    }
  }

  async function handleFillAndDownload() {
    if (!fileBytes || !file) return;
    setBusy(true);
    try {
      const doc = await PDFDocument.load(fileBytes, { ignoreEncryption: true });
      const form = doc.getForm();
      for (const f of fields) {
        try {
          if (f.type === "checkbox") {
            const box = form.getCheckBox(f.name);
            if (values[f.name]) box.check();
            else box.uncheck();
          } else {
            form.getTextField(f.name).setText(String(values[f.name] ?? ""));
          }
        } catch {
          // a field type this simple form can't set - skip it rather than abort the whole fill
        }
      }
      const bytes = await doc.save();
      downloadBytes(bytes, `${file.name.replace(/\.pdf$/i, "")}_filled.pdf`, "application/pdf");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolCard icon={ClipboardEdit} title="PDF Form Filler" desc="Read a fillable PDF's form fields, type the values, and download the completed file.">
      <label className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-brand-200 py-6 text-center cursor-pointer hover:border-brand-400 hover:bg-brand-50">
        <Upload size={22} className="text-brand-400" />
        <span className="mt-1.5 text-sm font-semibold text-brand-700">{file ? file.name : "Choose a fillable PDF"}</span>
        <input type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      </label>
      {error && <p className="mt-2 text-sm text-danger-600">{error}</p>}
      {fields.length > 0 && (
        <>
          <div className="mt-3 max-h-56 space-y-2 overflow-y-auto rounded-lg border border-brand-100 p-3">
            {fields.map((f) =>
              f.type === "checkbox" ? (
                <label key={f.name} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(values[f.name])}
                    onChange={(e) => setValues({ ...values, [f.name]: e.target.checked })}
                  />
                  {f.name}
                </label>
              ) : (
                <div key={f.name}>
                  <label className="label">{f.name}</label>
                  <input
                    className="input !py-1.5"
                    value={String(values[f.name] ?? "")}
                    onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                  />
                </div>
              )
            )}
          </div>
          <button onClick={handleFillAndDownload} disabled={busy} className="btn-primary mt-3">
            <Download size={15} /> {busy ? "Filling…" : "Fill & Download"}
          </button>
        </>
      )}
    </ToolCard>
  );
}
