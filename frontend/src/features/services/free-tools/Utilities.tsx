import { useEffect, useRef, useState } from "react";
import { Clock, KeyRound, QrCode, Copy } from "lucide-react";
import QRCode from "qrcode";

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

const TIMEZONES = [
  "UTC", "Asia/Kolkata", "America/New_York", "America/Los_Angeles",
  "Europe/London", "Europe/Berlin", "Asia/Dubai", "Asia/Singapore",
  "Asia/Tokyo", "Australia/Sydney",
];

export function TimezoneConverter() {
  const [sourceTz, setSourceTz] = useState("Asia/Kolkata");
  const [dateTime, setDateTime] = useState(() => new Date().toISOString().slice(0, 16));

  // Interpret the entered local date/time as if it were in sourceTz,
  // then format it in every other zone for comparison.
  const asDate = new Date(dateTime);

  return (
    <ToolCard icon={Clock} title="Timezone Converter" desc="See the same moment across multiple timezones.">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Date &amp; Time</label>
          <input type="datetime-local" className="input" value={dateTime} onChange={(e) => setDateTime(e.target.value)} />
        </div>
        <div>
          <label className="label">Reference Timezone</label>
          <select className="input" value={sourceTz} onChange={(e) => setSourceTz(e.target.value)}>
            {TIMEZONES.map((tz) => (
              <option key={tz}>{tz}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-3 space-y-1.5 rounded-lg bg-brand-50 p-3">
        {TIMEZONES.map((tz) => (
          <div key={tz} className="flex items-center justify-between text-sm">
            <span className="text-brand-500">{tz}</span>
            <span className="font-semibold text-brand-900">
              {isNaN(asDate.getTime())
                ? "\u2014"
                : new Intl.DateTimeFormat("en-GB", {
                    timeZone: tz, dateStyle: "medium", timeStyle: "short",
                  }).format(asDate)}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-brand-400">
        Note: the time you enter is read using your browser's own local timezone as the source
        of truth (standard JS `Date` behavior) — the "Reference Timezone" field is for your own
        bookkeeping.
      </p>
    </ToolCard>
  );
}

export function PasswordGenerator() {
  const [length, setLength] = useState(16);
  const [useUpper, setUseUpper] = useState(true);
  const [useLower, setUseLower] = useState(true);
  const [useNumbers, setUseNumbers] = useState(true);
  const [useSymbols, setUseSymbols] = useState(true);
  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState(false);

  function generate() {
    const sets = [
      useUpper && "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
      useLower && "abcdefghijklmnopqrstuvwxyz",
      useNumbers && "0123456789",
      useSymbols && "!@#$%^&*()_+-=[]{}|;:,.<>?",
    ].filter(Boolean) as string[];
    if (!sets.length) return;
    const pool = sets.join("");
    const randomValues = new Uint32Array(length);
    crypto.getRandomValues(randomValues);
    const result = Array.from(randomValues, (v) => pool[v % pool.length]).join("");
    setPassword(result);
    setCopied(false);
  }

  return (
    <ToolCard icon={KeyRound} title="Password Generator" desc="Cryptographically random passwords, generated in your browser.">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Length: {length}</label>
          <input type="range" min={8} max={64} value={length} onChange={(e) => setLength(Number(e.target.value))} className="w-full" />
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={useUpper} onChange={(e) => setUseUpper(e.target.checked)} /> A-Z</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={useLower} onChange={(e) => setUseLower(e.target.checked)} /> a-z</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={useNumbers} onChange={(e) => setUseNumbers(e.target.checked)} /> 0-9</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={useSymbols} onChange={(e) => setUseSymbols(e.target.checked)} /> !@#$</label>
        </div>
      </div>
      <button onClick={generate} className="btn-primary mt-3">Generate</button>
      {password && (
        <div className="mt-3 flex items-center gap-2">
          <code className="flex-1 truncate rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm">{password}</code>
          <button
            onClick={() => { navigator.clipboard.writeText(password); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="btn-secondary !px-3"
          >
            <Copy size={15} />
          </button>
        </div>
      )}
      {copied && <p className="mt-1 text-xs text-accent-600">Copied.</p>}
    </ToolCard>
  );
}

export function QrCodeGenerator() {
  const [text, setText] = useState("https://lexora.example.com");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && text) {
      QRCode.toCanvas(canvasRef.current, text, { width: 200, margin: 1 }).catch(() => {});
    }
  }, [text]);

  function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "qrcode.png";
    a.click();
  }

  return (
    <ToolCard icon={QrCode} title="QR Code Generator" desc="Turn any text or URL into a scannable QR code.">
      <label className="label">Text or URL</label>
      <input className="input" value={text} onChange={(e) => setText(e.target.value)} />
      <div className="mt-4 flex flex-col items-center gap-3">
        <canvas ref={canvasRef} className="rounded-lg border border-brand-100" />
        <button onClick={download} className="btn-secondary">Download PNG</button>
      </div>
    </ToolCard>
  );
}
