import { useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Images, Shrink, Crop, ImageIcon, Upload, Download } from "lucide-react";

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

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ImageToPdf() {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  async function handleConvert() {
    setBusy(true);
    try {
      const doc = await PDFDocument.create();
      for (const file of files) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const image = file.type === "image/png" ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
        const page = doc.addPage([image.width, image.height]);
        page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
      }
      const out = await doc.save();
      downloadBlob(new Blob([out as BlobPart], { type: "application/pdf" }), "images.pdf");
    } catch {
      // no-op - button re-enables, user can retry
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolCard icon={Images} title="Image to PDF" desc="Combine JPG/PNG images into a single PDF.">
      <label className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-brand-200 py-6 text-center cursor-pointer hover:border-brand-400 hover:bg-brand-50">
        <Upload size={22} className="text-brand-400" />
        <span className="mt-1.5 text-sm font-semibold text-brand-700">Add images ({files.length} selected)</span>
        <input
          type="file"
          accept="image/jpeg,image/png"
          multiple
          className="hidden"
          onChange={(e) => setFiles([...files, ...Array.from(e.target.files ?? [])])}
        />
      </label>
      <button onClick={handleConvert} disabled={!files.length || busy} className="btn-primary mt-3">
        <Download size={15} /> {busy ? "Converting…" : "Convert to PDF"}
      </button>
    </ToolCard>
  );
}

export function ImageCompressor() {
  const [file, setFile] = useState<File | null>(null);
  const [quality, setQuality] = useState(0.7);
  const [resultSize, setResultSize] = useState<number | null>(null);

  async function handleCompress() {
    if (!file) return;
    const img = await loadImage(file);
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext("2d")!.drawImage(img, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          setResultSize(blob.size);
          downloadBlob(blob, `compressed-${file.name.replace(/\.[^.]+$/, "")}.jpg`);
        }
      },
      "image/jpeg",
      quality
    );
  }

  return (
    <ToolCard icon={Shrink} title="Image Compressor" desc="Reduce file size by re-encoding as JPEG at a chosen quality.">
      <label className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-brand-200 py-6 text-center cursor-pointer hover:border-brand-400 hover:bg-brand-50">
        <Upload size={22} className="text-brand-400" />
        <span className="mt-1.5 text-sm font-semibold text-brand-700">{file ? file.name : "Choose an image"}</span>
        <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      <div className="mt-3">
        <label className="label">Quality: {Math.round(quality * 100)}%</label>
        <input type="range" min={0.1} max={1} step={0.05} value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-full" />
      </div>
      <button onClick={handleCompress} disabled={!file} className="btn-primary mt-3">
        <Download size={15} /> Compress &amp; Download
      </button>
      {resultSize !== null && (
        <p className="mt-2 text-xs text-brand-400">
          Original: {(file!.size / 1024).toFixed(0)} KB \u2192 Compressed: {(resultSize / 1024).toFixed(0)} KB
        </p>
      )}
    </ToolCard>
  );
}

export function ImageCropper() {
  const [file, setFile] = useState<File | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0, width: 100, height: 100 });
  const canvasRef = useRef<HTMLCanvasElement>(null);

  async function handleFile(f: File) {
    setFile(f);
    const image = await loadImage(f);
    setImg(image);
    setCrop({ x: 0, y: 0, width: image.width, height: image.height });
  }

  function handleCrop() {
    if (!img) return;
    const canvas = canvasRef.current!;
    canvas.width = crop.width;
    canvas.height = crop.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
    canvas.toBlob((blob) => blob && downloadBlob(blob, `cropped-${file?.name ?? "image.png"}`));
  }

  return (
    <ToolCard icon={Crop} title="Image Cropper" desc="Crop to an exact pixel region.">
      <label className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-brand-200 py-6 text-center cursor-pointer hover:border-brand-400 hover:bg-brand-50">
        <Upload size={22} className="text-brand-400" />
        <span className="mt-1.5 text-sm font-semibold text-brand-700">{file ? file.name : "Choose an image"}</span>
        <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      </label>
      {img && (
        <>
          <p className="mt-2 text-xs text-brand-400">Original size: {img.width} \u00d7 {img.height}px</p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            <div><label className="label">X</label><input type="number" className="input !py-1.5" value={crop.x} onChange={(e) => setCrop({ ...crop, x: Number(e.target.value) })} /></div>
            <div><label className="label">Y</label><input type="number" className="input !py-1.5" value={crop.y} onChange={(e) => setCrop({ ...crop, y: Number(e.target.value) })} /></div>
            <div><label className="label">Width</label><input type="number" className="input !py-1.5" value={crop.width} onChange={(e) => setCrop({ ...crop, width: Number(e.target.value) })} /></div>
            <div><label className="label">Height</label><input type="number" className="input !py-1.5" value={crop.height} onChange={(e) => setCrop({ ...crop, height: Number(e.target.value) })} /></div>
          </div>
          <button onClick={handleCrop} className="btn-primary mt-3"><Download size={15} /> Crop &amp; Download</button>
        </>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </ToolCard>
  );
}

const PRESET_SIZES: Record<string, { w: number; h: number }> = {
  "Passport Photo (2x2 in @ 300dpi)": { w: 600, h: 600 },
  "US Visa Photo (2x2 in @ 300dpi)": { w: 600, h: 600 },
  "Custom": { w: 300, h: 300 },
};

export function ResizePhoto() {
  const [file, setFile] = useState<File | null>(null);
  const [preset, setPreset] = useState("Passport Photo (2x2 in @ 300dpi)");
  const [customW, setCustomW] = useState(300);
  const [customH, setCustomH] = useState(300);

  async function handleResize() {
    if (!file) return;
    const img = await loadImage(file);
    const { w, h } = preset === "Custom" ? { w: customW, h: customH } : PRESET_SIZES[preset];
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
    canvas.toBlob((blob) => blob && downloadBlob(blob, `resized-${w}x${h}.jpg`), "image/jpeg", 0.9);
  }

  return (
    <ToolCard icon={ImageIcon} title="Resize Photo" desc="Resize to standard ID photo dimensions or a custom size.">
      <label className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-brand-200 py-6 text-center cursor-pointer hover:border-brand-400 hover:bg-brand-50">
        <Upload size={22} className="text-brand-400" />
        <span className="mt-1.5 text-sm font-semibold text-brand-700">{file ? file.name : "Choose an image"}</span>
        <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      <div className="mt-3">
        <label className="label">Size</label>
        <select className="input" value={preset} onChange={(e) => setPreset(e.target.value)}>
          {Object.keys(PRESET_SIZES).map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </div>
      {preset === "Custom" && (
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div><label className="label">Width (px)</label><input type="number" className="input" value={customW} onChange={(e) => setCustomW(Number(e.target.value))} /></div>
          <div><label className="label">Height (px)</label><input type="number" className="input" value={customH} onChange={(e) => setCustomH(Number(e.target.value))} /></div>
        </div>
      )}
      <button onClick={handleResize} disabled={!file} className="btn-primary mt-3"><Download size={15} /> Resize &amp; Download</button>
    </ToolCard>
  );
}
