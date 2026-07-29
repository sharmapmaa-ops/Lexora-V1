import { useState } from "react";
import { PDFDocument, degrees } from "pdf-lib";
import { Combine, Scissors, RotateCw, Upload, Download, X, ArrowLeft } from "lucide-react";
import { clsx } from "clsx";
import { CreatePdf, PdfToImage, CompressPdf, PdfToWord, PdfFormFiller } from "@/features/services/free-tools/MorePdfTools";
import { ImageToPdf, ImageCompressor, ImageCropper, ResizePhoto } from "@/features/services/free-tools/ImageTools";
import { EmiCalculator, GratuityCalculator, AgeCalculator, UnitConverter, CurrencyConverter } from "@/features/services/free-tools/Calculators";
import { WordCounter, JsonCsvConverter, DataComparison } from "@/features/services/free-tools/DataTools";
import { InvoiceGenerator, QuotationGenerator, ReceiptGenerator, EmailTemplateBuilder, LetterBuilder } from "@/features/services/free-tools/DocumentBuilders";
import { TimezoneConverter, PasswordGenerator, QrCodeGenerator } from "@/features/services/free-tools/Utilities";

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
    } catch {
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
  const [splitMode, setSplitMode] = useState<"combined" | "separate">("combined");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(f: File) {
    setFile(f);
    setError(null);
    const bytes = await f.arrayBuffer();
    const doc = await PDFDocument.load(bytes);
    setPageCount(doc.getPageCount());
  }

  function parseGroups(input: string, max: number): number[][] {
    // Each comma-separated group becomes its own output file in
    // "separate" mode (e.g. "1-3, 5" -> two files: pages 1-3, and page 5).
    // In "combined" mode all groups are merged into a single output.
    const groups: number[][] = [];
    for (const part of input.split(",").map((p) => p.trim()).filter(Boolean)) {
      const rangeMatch = part.match(/^(\d+)-(\d+)$/);
      const indices: number[] = [];
      if (rangeMatch) {
        const start = Number(rangeMatch[1]);
        const end = Number(rangeMatch[2]);
        for (let i = start; i <= end; i++) if (i >= 1 && i <= max) indices.push(i - 1);
      } else if (/^\d+$/.test(part)) {
        const n = Number(part);
        if (n >= 1 && n <= max) indices.push(n - 1);
      }
      if (indices.length) groups.push(indices);
    }
    return groups;
  }

  async function handleSplit() {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const groups = parseGroups(ranges, pageCount);
      if (!groups.length) {
        setError(`Enter valid page numbers between 1 and ${pageCount} (e.g. "1-3, 5").`);
        setBusy(false);
        return;
      }
      const bytes = await file.arrayBuffer();
      const src = await PDFDocument.load(bytes);

      if (splitMode === "combined") {
        const out = await PDFDocument.create();
        const allIndices = groups.flat();
        const pages = await out.copyPages(src, allIndices);
        pages.forEach((p) => out.addPage(p));
        downloadBytes(await out.save(), "extracted-pages.pdf");
      } else {
        // One PDF per comma-separated group - genuinely "split into
        // multiple files", not just one combined extraction.
        for (let i = 0; i < groups.length; i++) {
          const out = await PDFDocument.create();
          const pages = await out.copyPages(src, groups[i]);
          pages.forEach((p) => out.addPage(p));
          downloadBytes(await out.save(), `split-part-${i + 1}.pdf`);
        }
      }
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
          <p className="text-sm text-brand-400">Extract specific pages — as one combined file, or as separate files per group.</p>
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
        <>
          <div className="mt-3">
            <label className="label">Page groups ({pageCount} total)</label>
            <input className="input" value={ranges} onChange={(e) => setRanges(e.target.value)} placeholder="e.g. 1-3, 5" />
            <p className="mt-1 text-xs text-brand-300">
              Each comma-separated group (e.g. "1-3" and "5") becomes its own file in Separate mode.
            </p>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setSplitMode("combined")}
              className={splitMode === "combined" ? "btn-primary !py-1.5 text-xs" : "btn-secondary !py-1.5 text-xs"}
            >
              Merge into one file
            </button>
            <button
              onClick={() => setSplitMode("separate")}
              className={splitMode === "separate" ? "btn-primary !py-1.5 text-xs" : "btn-secondary !py-1.5 text-xs"}
            >
              Separate file per group
            </button>
          </div>
        </>
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

type ToolMeta = {
  id: string;
  label: string;
  icon: string;
  desc: string;
  comingSoon?: boolean;
  Component?: () => JSX.Element;
};

const CATEGORIES: Record<string, { icon: string; tools: ToolMeta[] }> = {
  "PDF Tools": {
    icon: "\uD83D\uDCC4",
    tools: [
      { id: "merge", label: "Merge PDF", icon: "\uD83D\uDD17", desc: "Combine several PDFs into one.", Component: MergeTool },
      { id: "split", label: "Split PDF", icon: "\u2702\uFE0F", desc: "Extract selected pages into a new PDF.", Component: SplitTool },
      { id: "rotate", label: "Rotate PDF", icon: "\uD83D\uDD04", desc: "Rotate every page by 90/180/270\u00b0.", Component: RotateTool },
      { id: "compress", label: "Compress PDF", icon: "\uD83D\uDDDC\uFE0F", desc: "Reduce file size by re-rendering pages.", Component: CompressPdf },
      { id: "pdf-to-image", label: "PDF to Image", icon: "\uD83D\uDCF8", desc: "Export every page as a PNG.", Component: PdfToImage },
      { id: "pdf-to-word", label: "PDF to Word", icon: "\uD83D\uDCC3", desc: "Extract text into an editable Word doc.", Component: PdfToWord },
      { id: "form-filler", label: "PDF Form Filler", icon: "\uD83D\uDCDD", desc: "Fill in fillable PDF form fields.", Component: PdfFormFiller },
      { id: "create-pdf", label: "Create PDF", icon: "\u2795", desc: "Turn plain text into a formatted PDF.", Component: CreatePdf },
    ],
  },
  "Image Tools": {
    icon: "\uD83D\uDDBC\uFE0F",
    tools: [
      { id: "image-to-pdf", label: "Image to PDF", icon: "\uD83D\uDDBC\uFE0F", desc: "JPG/PNG images into a single PDF.", Component: ImageToPdf },
      { id: "image-compressor", label: "Image Compressor", icon: "\uD83D\uDDDC\uFE0F", desc: "Reduce image file size.", Component: ImageCompressor },
      { id: "image-cropper", label: "Image Cropper", icon: "\u2702\uFE0F", desc: "Crop to an exact pixel region.", Component: ImageCropper },
      { id: "resize-photo", label: "Resize Photo", icon: "\uD83D\uDCD0", desc: "Standard ID photo sizes or custom.", Component: ResizePhoto },
    ],
  },
  Calculators: {
    icon: "\uD83E\uDDEE",
    tools: [
      { id: "emi", label: "EMI Calculator", icon: "\uD83C\uDFE6", desc: "Monthly instalment and total interest.", Component: EmiCalculator },
      { id: "gratuity", label: "Gratuity Calculator", icon: "\uD83D\uDCBC", desc: "Estimate a gratuity payout.", Component: GratuityCalculator },
      { id: "age", label: "Age Calculator", icon: "\uD83C\uDF82", desc: "Exact age in years/months/days.", Component: AgeCalculator },
      { id: "unit", label: "Unit Converter", icon: "\uD83D\uDCCF", desc: "Length, weight, and temperature.", Component: UnitConverter },
      { id: "currency", label: "Currency Converter", icon: "\uD83D\uDCB1", desc: "Quick currency estimate.", Component: CurrencyConverter },
    ],
  },
  "Data Tools": {
    icon: "\uD83D\uDCCA",
    tools: [
      { id: "word-counter", label: "Word Counter", icon: "\uD83D\uDCC4", desc: "Words, characters, sentences.", Component: WordCounter },
      { id: "json-csv", label: "JSON \u2194 CSV", icon: "\uD83D\uDCC8", desc: "Convert between JSON and CSV.", Component: JsonCsvConverter },
      { id: "data-comparison", label: "Data Comparison", icon: "\uD83D\uDD00", desc: "Line-by-line text comparison.", Component: DataComparison },
      { id: "etl", label: "ETL", icon: "\u2699\uFE0F", desc: "Extract, transform, and load data between formats.", comingSoon: true },
    ],
  },
  "Document Builders": {
    icon: "\uD83D\uDCDD",
    tools: [
      { id: "invoice", label: "Invoice Generator", icon: "\uD83E\uDDFE", desc: "Create a professional invoice PDF.", Component: InvoiceGenerator },
      { id: "quotation", label: "Quotation Generator", icon: "\uD83D\uDCCB", desc: "Create a price quotation PDF.", Component: QuotationGenerator },
      { id: "receipt", label: "Receipt Generator", icon: "\uD83E\uDDFE", desc: "Create a payment receipt PDF.", Component: ReceiptGenerator },
      { id: "email", label: "Email Template", icon: "\u2709\uFE0F", desc: "Ready-to-send email drafts.", Component: EmailTemplateBuilder },
      { id: "letter", label: "Create Letters", icon: "\u270D\uFE0F", desc: "A simple formal letter as PDF.", Component: LetterBuilder },
    ],
  },
  Utilities: {
    icon: "\uD83D\uDD27",
    tools: [
      { id: "timezone", label: "Timezone Converter", icon: "\uD83D\uDD5A\uFE0F", desc: "Compare times across zones.", Component: TimezoneConverter },
      { id: "password", label: "Password Generator", icon: "\uD83D\uDD11", desc: "Cryptographically random passwords.", Component: PasswordGenerator },
      { id: "qr", label: "QR Code Generator", icon: "\uD83D\uDD32", desc: "Turn text/URL into a QR code.", Component: QrCodeGenerator },
      { id: "barcode", label: "Barcode Generator", icon: "\uD83D\uDCCA", desc: "Generate common 1D barcode formats.", comingSoon: true },
    ],
  },
};

export function FreeServicesPage() {
  const [category, setCategory] = useState<keyof typeof CATEGORIES>("PDF Tools");
  const [selectedTool, setSelectedTool] = useState<string | null>(null);

  const tools = CATEGORIES[category].tools;
  const activeTool = tools.find((t) => t.id === selectedTool);

  function selectCategory(cat: keyof typeof CATEGORIES) {
    setCategory(cat);
    setSelectedTool(null); // picking a new category always goes back to its thumbnail grid
  }

  return (
    <div className="max-w-5xl">
      <h1 className="font-display text-2xl font-bold text-brand-900">Free Services</h1>
      <p className="mt-1 text-brand-400">
        Everything below runs entirely in your browser — files never leave your device, and it's
        always free, regardless of your plan.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {Object.keys(CATEGORIES).map((cat) => (
          <button
            key={cat}
            onClick={() => selectCategory(cat as keyof typeof CATEGORIES)}
            className={category === cat ? "btn-primary !py-2" : "btn-secondary !py-2"}
          >
            {CATEGORIES[cat].icon} {cat}
          </button>
        ))}
      </div>

      {/* Step 1: category selected -> show thumbnails for every tool in
          it. Step 2: a specific thumbnail clicked -> show that tool's
          actual working UI, with a way back to the thumbnail grid. */}
      {activeTool ? (
        <div className="mt-6">
          <button
            onClick={() => setSelectedTool(null)}
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-500 hover:text-brand-700"
          >
            <ArrowLeft size={15} /> Back to {category}
          </button>
          {activeTool.Component ? (
            <activeTool.Component />
          ) : (
            <div className="card border-dashed opacity-60">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{activeTool.icon}</span>
                <div>
                  <h3 className="font-display font-semibold text-brand-700">{activeTool.label}</h3>
                  <p className="text-sm text-brand-400">{activeTool.desc}</p>
                </div>
              </div>
              <span className="mt-4 inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-400">
                Coming soon
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => setSelectedTool(tool.id)}
              className={clsx(
                "card !p-4 text-left transition-transform hover:-translate-y-0.5",
                tool.comingSoon && "border-dashed opacity-60"
              )}
            >
              <span className="text-2xl">{tool.icon}</span>
              <div className="mt-2 font-display text-sm font-semibold text-brand-900">{tool.label}</div>
              <p className="mt-1 text-xs text-brand-400">{tool.desc}</p>
              {tool.comingSoon && (
                <span className="mt-2 inline-block rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-400">
                  Coming soon
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
