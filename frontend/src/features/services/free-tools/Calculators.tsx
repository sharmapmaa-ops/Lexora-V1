import { useState } from "react";
import { Landmark, Briefcase, Cake, Ruler, Coins } from "lucide-react";

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

const money = (v: number) => `\u20b9${v.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export function EmiCalculator() {
  const [principal, setPrincipal] = useState(500000);
  const [rate, setRate] = useState(9.5);
  const [years, setYears] = useState(5);

  const monthlyRate = rate / 12 / 100;
  const months = years * 12;
  const emi =
    monthlyRate === 0
      ? principal / months
      : (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
  const totalPayment = emi * months;
  const totalInterest = totalPayment - principal;

  return (
    <ToolCard icon={Landmark} title="EMI Calculator" desc="Monthly instalment and total interest.">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label">Loan Amount</label>
          <input type="number" className="input" value={principal} onChange={(e) => setPrincipal(Number(e.target.value))} />
        </div>
        <div>
          <label className="label">Rate (% p.a.)</label>
          <input type="number" step="0.1" className="input" value={rate} onChange={(e) => setRate(Number(e.target.value))} />
        </div>
        <div>
          <label className="label">Tenure (years)</label>
          <input type="number" className="input" value={years} onChange={(e) => setYears(Number(e.target.value))} />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 rounded-lg bg-brand-50 p-3 text-center">
        <div>
          <div className="text-xs text-brand-400">Monthly EMI</div>
          <div className="font-display font-bold text-brand-900">{money(emi)}</div>
        </div>
        <div>
          <div className="text-xs text-brand-400">Total Interest</div>
          <div className="font-display font-bold text-brand-900">{money(totalInterest)}</div>
        </div>
        <div>
          <div className="text-xs text-brand-400">Total Payment</div>
          <div className="font-display font-bold text-brand-900">{money(totalPayment)}</div>
        </div>
      </div>
    </ToolCard>
  );
}

export function GratuityCalculator() {
  const [salary, setSalary] = useState(50000);
  const [years, setYears] = useState(7);
  // Standard Indian gratuity formula: (15 * last drawn salary * years of service) / 26
  const gratuity = (15 * salary * Math.floor(years)) / 26;

  return (
    <ToolCard icon={Briefcase} title="Gratuity Calculator" desc="Estimate a gratuity payout (India, standard formula).">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Last Drawn Monthly Salary</label>
          <input type="number" className="input" value={salary} onChange={(e) => setSalary(Number(e.target.value))} />
        </div>
        <div>
          <label className="label">Years of Service</label>
          <input type="number" className="input" value={years} onChange={(e) => setYears(Number(e.target.value))} />
        </div>
      </div>
      <div className="mt-4 rounded-lg bg-brand-50 p-3 text-center">
        <div className="text-xs text-brand-400">Estimated Gratuity</div>
        <div className="font-display text-xl font-bold text-brand-900">{money(gratuity)}</div>
      </div>
      {years < 5 && <p className="mt-2 text-xs text-brand-400">Note: gratuity is typically only payable after 5 years of continuous service.</p>}
    </ToolCard>
  );
}

export function AgeCalculator() {
  const [dob, setDob] = useState("");
  let result: { years: number; months: number; days: number } | null = null;
  if (dob) {
    const birth = new Date(dob);
    const today = new Date();
    let years = today.getFullYear() - birth.getFullYear();
    let months = today.getMonth() - birth.getMonth();
    let days = today.getDate() - birth.getDate();
    if (days < 0) {
      months -= 1;
      days += new Date(today.getFullYear(), today.getMonth(), 0).getDate();
    }
    if (months < 0) {
      years -= 1;
      months += 12;
    }
    result = { years, months, days };
  }

  return (
    <ToolCard icon={Cake} title="Age Calculator" desc="Exact age in years, months, and days.">
      <label className="label">Date of Birth</label>
      <input type="date" className="input max-w-xs" value={dob} onChange={(e) => setDob(e.target.value)} />
      {result && (
        <div className="mt-4 grid grid-cols-3 gap-3 rounded-lg bg-brand-50 p-3 text-center">
          <div>
            <div className="text-xs text-brand-400">Years</div>
            <div className="font-display text-xl font-bold text-brand-900">{result.years}</div>
          </div>
          <div>
            <div className="text-xs text-brand-400">Months</div>
            <div className="font-display text-xl font-bold text-brand-900">{result.months}</div>
          </div>
          <div>
            <div className="text-xs text-brand-400">Days</div>
            <div className="font-display text-xl font-bold text-brand-900">{result.days}</div>
          </div>
        </div>
      )}
    </ToolCard>
  );
}

const UNIT_GROUPS: Record<string, Record<string, number>> = {
  Length: { Meters: 1, Kilometers: 1000, Centimeters: 0.01, Miles: 1609.34, Feet: 0.3048, Inches: 0.0254 },
  Weight: { Kilograms: 1, Grams: 0.001, Pounds: 0.453592, Ounces: 0.0283495 },
  Temperature: {}, // handled specially below
};

export function UnitConverter() {
  const [group, setGroup] = useState("Length");
  const [from, setFrom] = useState("Meters");
  const [to, setTo] = useState("Kilometers");
  const [value, setValue] = useState(1);

  const units = Object.keys(UNIT_GROUPS[group]);

  let result: number | null = null;
  if (group === "Temperature") {
    // Celsius <-> Fahrenheit <-> Kelvin, distinct enough to special-case.
    const toCelsius: Record<string, (v: number) => number> = {
      Celsius: (v) => v,
      Fahrenheit: (v) => ((v - 32) * 5) / 9,
      Kelvin: (v) => v - 273.15,
    };
    const fromCelsius: Record<string, (v: number) => number> = {
      Celsius: (v) => v,
      Fahrenheit: (v) => (v * 9) / 5 + 32,
      Kelvin: (v) => v + 273.15,
    };
    result = fromCelsius[to]?.(toCelsius[from]?.(value) ?? value) ?? null;
  } else {
    const base = value * (UNIT_GROUPS[group][from] ?? 1);
    result = base / (UNIT_GROUPS[group][to] ?? 1);
  }

  return (
    <ToolCard icon={Ruler} title="Unit Converter" desc="Length, weight, and temperature conversions.">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Category</label>
          <select
            className="input"
            value={group}
            onChange={(e) => {
              const g = e.target.value;
              setGroup(g);
              const opts = g === "Temperature" ? ["Celsius", "Fahrenheit", "Kelvin"] : Object.keys(UNIT_GROUPS[g]);
              setFrom(opts[0]);
              setTo(opts[1] ?? opts[0]);
            }}
          >
            {Object.keys(UNIT_GROUPS).map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Value</label>
          <input type="number" className="input" value={value} onChange={(e) => setValue(Number(e.target.value))} />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <label className="label">From</label>
          <select className="input" value={from} onChange={(e) => setFrom(e.target.value)}>
            {(group === "Temperature" ? ["Celsius", "Fahrenheit", "Kelvin"] : units).map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">To</label>
          <select className="input" value={to} onChange={(e) => setTo(e.target.value)}>
            {(group === "Temperature" ? ["Celsius", "Fahrenheit", "Kelvin"] : units).map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </div>
      </div>
      {result !== null && (
        <div className="mt-4 rounded-lg bg-brand-50 p-3 text-center font-display text-lg font-bold text-brand-900">
          {value} {from} = {result.toLocaleString(undefined, { maximumFractionDigits: 4 })} {to}
        </div>
      )}
    </ToolCard>
  );
}

// Static reference rates (INR base) - genuinely accurate live rates need
// a paid FX API; these are clearly labeled as approximate so the tool
// is still useful for quick estimates without implying real-time accuracy.
const FX_RATES_PER_INR: Record<string, number> = {
  INR: 1,
  USD: 1 / 83.5,
  EUR: 1 / 90.5,
  GBP: 1 / 105.8,
  AED: 1 / 22.7,
};

export function CurrencyConverter() {
  const [amount, setAmount] = useState(1000);
  const [from, setFrom] = useState("INR");
  const [to, setTo] = useState("USD");

  const inInr = amount / FX_RATES_PER_INR[from];
  const result = inInr * FX_RATES_PER_INR[to];

  return (
    <ToolCard icon={Coins} title="Currency Converter" desc="Quick estimate using approximate reference rates.">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label">Amount</label>
          <input type="number" className="input" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
        </div>
        <div>
          <label className="label">From</label>
          <select className="input" value={from} onChange={(e) => setFrom(e.target.value)}>
            {Object.keys(FX_RATES_PER_INR).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">To</label>
          <select className="input" value={to} onChange={(e) => setTo(e.target.value)}>
            {Object.keys(FX_RATES_PER_INR).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-4 rounded-lg bg-brand-50 p-3 text-center font-display text-lg font-bold text-brand-900">
        {amount} {from} \u2248 {result.toLocaleString(undefined, { maximumFractionDigits: 2 })} {to}
      </div>
      <p className="mt-2 text-xs text-brand-400">Approximate reference rates — not for financial transactions.</p>
    </ToolCard>
  );
}
