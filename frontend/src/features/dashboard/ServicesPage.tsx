import { FileText, Languages, ScanLine, Database, Landmark } from "lucide-react";
import { Link } from "react-router-dom";

const SERVICES = [
  { code: "lease_abstraction", label: "Lease Abstraction", icon: FileText, desc: "Extract structured lease data from PDF documents.", href: null },
  { code: "translation", label: "Translation", icon: Languages, desc: "Translate documents while preserving layout. Supports Spanish, French, German, Hindi, Arabic, Chinese, and Japanese.", href: "/services/translation" },
  { code: "ocr", label: "OCR", icon: ScanLine, desc: "Extract text from scanned documents and images.", href: "/services/ocr" },
  { code: "data_extraction", label: "Data Extraction", icon: Database, desc: "Pull structured fields from any document.", href: "/services/data-extraction" },
  { code: "bai2", label: "BAI2", icon: Landmark, desc: "Parse bank statement BAI2 files.", href: "/services/bai2" },
];

export function ServicesPage() {
  return (
    <div className="max-w-6xl">
      <h1 className="font-display text-2xl font-bold text-brand-900">Paid Services</h1>
      <p className="mt-1 text-brand-400">
        Pick a service to upload a document. Pricing is shown on the{" "}
        <a href="/plans" className="font-semibold text-brand-700 hover:underline">
          Plans &amp; Offers
        </a>{" "}
        page for your current plan.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SERVICES.map((s) => (
          <div key={s.code} className="card">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
              <s.icon size={22} />
            </div>
            <h3 className="mt-4 font-display font-semibold text-brand-900">{s.label}</h3>
            <p className="mt-1 text-sm text-brand-400">{s.desc}</p>
            {s.href ? (
              <Link to={s.href} className="btn-primary mt-4 inline-flex">
                Upload a file
              </Link>
            ) : (
              <button className="btn-secondary mt-4" disabled>
                Upload — coming soon
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
