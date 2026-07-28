import { useState } from "react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Receipt, FileSignature, ScrollText, Mail, Pen } from "lucide-react";

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

function downloadBytes(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

interface LineItem {
  description: string;
  qty: number;
  rate: number;
}

/** Shared PDF layout for Invoice/Quotation/Receipt - only the title and
 * a couple of labels differ between the three, so one renderer avoids
 * three near-identical copies of the same layout code. */
async function buildBillingPdf(opts: {
  docTitle: string;
  docNumber: string;
  fromName: string;
  toName: string;
  date: string;
  items: LineItem[];
  notes: string;
}) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4 in points
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let y = 800;

  page.drawText(opts.docTitle, { x: 40, y, size: 22, font: bold, color: rgb(0.05, 0.08, 0.2) });
  page.drawText(`#${opts.docNumber}`, { x: 450, y, size: 12, font });
  y -= 30;
  page.drawText(`Date: ${opts.date}`, { x: 450, y, size: 10, font, color: rgb(0.4, 0.4, 0.4) });

  y -= 20;
  page.drawText("From:", { x: 40, y, size: 10, font: bold });
  page.drawText(opts.fromName, { x: 40, y: y - 14, size: 11, font });
  page.drawText("To:", { x: 300, y, size: 10, font: bold });
  page.drawText(opts.toName, { x: 300, y: y - 14, size: 11, font });

  y -= 50;
  page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 1, color: rgb(0.85, 0.85, 0.85) });
  y -= 20;
  page.drawText("Description", { x: 40, y, size: 10, font: bold });
  page.drawText("Qty", { x: 350, y, size: 10, font: bold });
  page.drawText("Rate", { x: 420, y, size: 10, font: bold });
  page.drawText("Amount", { x: 490, y, size: 10, font: bold });
  y -= 15;
  page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 1, color: rgb(0.85, 0.85, 0.85) });

  let total = 0;
  for (const item of opts.items) {
    y -= 20;
    const amount = item.qty * item.rate;
    total += amount;
    page.drawText(item.description, { x: 40, y, size: 10, font });
    page.drawText(String(item.qty), { x: 350, y, size: 10, font });
    page.drawText(item.rate.toFixed(2), { x: 420, y, size: 10, font });
    page.drawText(amount.toFixed(2), { x: 490, y, size: 10, font });
  }

  y -= 20;
  page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 1, color: rgb(0.85, 0.85, 0.85) });
  y -= 22;
  page.drawText("Total", { x: 420, y, size: 12, font: bold });
  page.drawText(total.toFixed(2), { x: 490, y, size: 12, font: bold });

  if (opts.notes) {
    y -= 40;
    page.drawText("Notes:", { x: 40, y, size: 10, font: bold });
    page.drawText(opts.notes, { x: 40, y: y - 14, size: 10, font, maxWidth: 500 });
  }

  return doc.save();
}

function LineItemsEditor({ items, setItems }: { items: LineItem[]; setItems: (items: LineItem[]) => void }) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="grid grid-cols-[1fr_70px_90px_auto] gap-2">
          <input
            className="input !py-1.5"
            placeholder="Description"
            value={item.description}
            onChange={(e) => setItems(items.map((it, idx) => (idx === i ? { ...it, description: e.target.value } : it)))}
          />
          <input
            type="number"
            className="input !py-1.5"
            placeholder="Qty"
            value={item.qty}
            onChange={(e) => setItems(items.map((it, idx) => (idx === i ? { ...it, qty: Number(e.target.value) } : it)))}
          />
          <input
            type="number"
            className="input !py-1.5"
            placeholder="Rate"
            value={item.rate}
            onChange={(e) => setItems(items.map((it, idx) => (idx === i ? { ...it, rate: Number(e.target.value) } : it)))}
          />
          <button onClick={() => setItems(items.filter((_, idx) => idx !== i))} className="text-brand-400 hover:text-danger-600">
            &times;
          </button>
        </div>
      ))}
      <button onClick={() => setItems([...items, { description: "", qty: 1, rate: 0 }])} className="btn-secondary !py-1.5 text-xs">
        + Add line item
      </button>
    </div>
  );
}

function BillingDocBuilder({ icon, title, desc, docTitle }: { icon: any; title: string; desc: string; docTitle: string }) {
  const [docNumber, setDocNumber] = useState("001");
  const [fromName, setFromName] = useState("");
  const [toName, setToName] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ description: "", qty: 1, rate: 0 }]);

  async function handleGenerate() {
    const bytes = await buildBillingPdf({ docTitle, docNumber, fromName, toName, date, items, notes });
    downloadBytes(bytes, `${docTitle.toLowerCase()}-${docNumber}.pdf`);
  }

  return (
    <ToolCard icon={icon} title={title} desc={desc}>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label">Number</label>
          <input className="input" value={docNumber} onChange={(e) => setDocNumber(e.target.value)} />
        </div>
        <div>
          <label className="label">Date</label>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <label className="label">From</label>
          <input className="input" value={fromName} onChange={(e) => setFromName(e.target.value)} />
        </div>
        <div>
          <label className="label">To</label>
          <input className="input" value={toName} onChange={(e) => setToName(e.target.value)} />
        </div>
      </div>
      <div className="mt-3">
        <label className="label">Line Items</label>
        <LineItemsEditor items={items} setItems={setItems} />
      </div>
      <div className="mt-3">
        <label className="label">Notes</label>
        <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <button onClick={handleGenerate} className="btn-primary mt-4">Generate PDF</button>
    </ToolCard>
  );
}

export const InvoiceGenerator = () => (
  <BillingDocBuilder icon={Receipt} title="Invoice Generator" desc="Create a professional invoice PDF." docTitle="Invoice" />
);
export const QuotationGenerator = () => (
  <BillingDocBuilder icon={FileSignature} title="Quotation Generator" desc="Create a price quotation PDF." docTitle="Quotation" />
);
export const ReceiptGenerator = () => (
  <BillingDocBuilder icon={ScrollText} title="Receipt Generator" desc="Create a payment receipt PDF." docTitle="Receipt" />
);

const EMAIL_TEMPLATES: Record<string, (name: string, sender: string) => string> = {
  "Follow-up": (name, sender) =>
    `Subject: Following up on our conversation\n\nHi ${name || "[Name]"},\n\nJust wanted to follow up on our earlier conversation. Let me know if you have any questions or need anything else from my side.\n\nBest,\n${sender || "[Your name]"}`,
  "Thank You": (name, sender) =>
    `Subject: Thank you!\n\nHi ${name || "[Name]"},\n\nThank you so much for your time and support. It's genuinely appreciated.\n\nBest,\n${sender || "[Your name]"}`,
  "Meeting Request": (name, sender) =>
    `Subject: Meeting request\n\nHi ${name || "[Name]"},\n\nWould you be available for a quick call this week to discuss next steps? Let me know a time that works for you.\n\nBest,\n${sender || "[Your name]"}`,
};

export function EmailTemplateBuilder() {
  const [templateName, setTemplateName] = useState("Follow-up");
  const [recipient, setRecipient] = useState("");
  const [sender, setSender] = useState("");
  const [copied, setCopied] = useState(false);

  const body = EMAIL_TEMPLATES[templateName](recipient, sender);

  return (
    <ToolCard icon={Mail} title="Email Template" desc="Ready-to-send email drafts for common situations.">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label">Template</label>
          <select className="input" value={templateName} onChange={(e) => setTemplateName(e.target.value)}>
            {Object.keys(EMAIL_TEMPLATES).map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Recipient Name</label>
          <input className="input" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
        </div>
        <div>
          <label className="label">Your Name</label>
          <input className="input" value={sender} onChange={(e) => setSender(e.target.value)} />
        </div>
      </div>
      <textarea className="input mt-3" rows={7} readOnly value={body} />
      <button
        onClick={() => { navigator.clipboard.writeText(body); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className="btn-secondary mt-3"
      >
        Copy
      </button>
      {copied && <p className="mt-1 text-xs text-accent-600">Copied.</p>}
    </ToolCard>
  );
}

export function LetterBuilder() {
  const [senderName, setSenderName] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  async function handleGenerate() {
    const doc = await PDFDocument.create();
    const page = doc.addPage([595, 842]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    let y = 780;
    page.drawText(new Date().toLocaleDateString(), { x: 40, y, size: 10, font });
    y -= 40;
    page.drawText(`To: ${recipientName}`, { x: 40, y, size: 11, font });
    y -= 30;
    if (subject) {
      page.drawText(`Subject: ${subject}`, { x: 40, y, size: 11, font: bold });
      y -= 30;
    }
    page.drawText(body, { x: 40, y, size: 11, font, maxWidth: 500, lineHeight: 16 });
    y -= 16 * (body.split("\n").length + 3);
    page.drawText(`Sincerely,\n${senderName}`, { x: 40, y: Math.max(y, 60), size: 11, font });
    const bytes = await doc.save();
    downloadBytes(bytes, "letter.pdf");
  }

  return (
    <ToolCard icon={Pen} title="Create Letters" desc="A simple formal letter, exported as a PDF.">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Your Name</label>
          <input className="input" value={senderName} onChange={(e) => setSenderName(e.target.value)} />
        </div>
        <div>
          <label className="label">Recipient</label>
          <input className="input" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
        </div>
      </div>
      <div className="mt-3">
        <label className="label">Subject (optional)</label>
        <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>
      <div className="mt-3">
        <label className="label">Body</label>
        <textarea className="input" rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      <button onClick={handleGenerate} className="btn-primary mt-3">Generate PDF</button>
    </ToolCard>
  );
}
