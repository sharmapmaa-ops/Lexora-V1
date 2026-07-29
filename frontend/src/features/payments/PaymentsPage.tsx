import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Wallet, TrendingDown, PiggyBank, X, Download, Filter, RotateCcw } from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";

interface Balance {
  total_credit: string;
  total_debit: string;
  current_balance: string;
}

interface Transaction {
  id: string;
  type: string;
  status: string;
  description: string;
  payment_mode: string;
  credit: string;
  debit: string;
  created_at: string;
}

const money = (v: string | number) => `\u20b9${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

declare global {
  interface Window {
    Razorpay: any;
  }
}

export function PaymentsPage() {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // History filters
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const { data: balance } = useQuery<Balance>({
    queryKey: ["balance"],
    queryFn: () => api.get("/payments/balance").then((r) => r.data),
  });

  const { data: history } = useQuery<Transaction[]>({
    queryKey: ["payment-history"],
    queryFn: () => api.get("/payments/history").then((r) => r.data),
  });

  const filtered = useMemo(() => {
    return (history ?? []).filter((t) => {
      const d = t.created_at.slice(0, 10);
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      return true;
    });
  }, [history, fromDate, toDate, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  function clearFilters() {
    setFromDate("");
    setToDate("");
    setStatusFilter("all");
    setPage(1);
  }

  const verifyMutation = useMutation({
    mutationFn: (payload: object) => api.post("/payments/verify-payment", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["balance"] });
      queryClient.invalidateQueries({ queryKey: ["payment-history"] });
      setCheckoutOpen(false);
      setAmount("");
      setDescription("");
    },
    onError: (err) => setError(apiErrorMessage(err, "Payment verification failed.")),
  });

  async function handleAddBalance(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setError("Please enter a valid amount.");
      return;
    }
    try {
      const { data: order } = await api.post("/payments/create-order", { amount: parsedAmount });
      setCheckoutOpen(true);
      const rzp = new window.Razorpay({
        key: order.razorpay_key_id,
        amount: order.amount_paise,
        currency: order.currency,
        order_id: order.order_id,
        name: "Lexora AI Solutions",
        description: description || "Wallet top-up",
        handler: (response: any) => {
          verifyMutation.mutate({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            description: description || "Wallet top-up",
          });
        },
        modal: { ondismiss: () => setCheckoutOpen(false) },
      });
      rzp.on("payment.failed", () => setCheckoutOpen(false));
      rzp.open();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not start checkout."));
    }
  }

  return (
    <div className="max-w-6xl">
      <h1 className="font-display text-2xl font-bold text-brand-900">Payment</h1>

      {/* Balance Summary - 3 columns side by side, full width */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Credit" value={money(balance?.total_credit ?? 0)} icon={Wallet} tone="success" />
        <StatCard label="Total Debit" value={money(balance?.total_debit ?? 0)} icon={TrendingDown} tone="danger" />
        <StatCard label="Current Balance" value={money(balance?.current_balance ?? 0)} icon={PiggyBank} tone="brand" />
      </div>

      {/* Add Balance - below the summary, full width */}
      <div className="card mt-6">
        <h3 className="font-display text-lg font-semibold text-brand-900">Add Balance</h3>
        <p className="mt-1 text-sm text-brand-400">Add funds to your Lexora account for seamless payments.</p>
        {error && (
          <div className="mt-3 rounded-lg bg-danger-500/10 px-3.5 py-2.5 text-sm text-danger-600">{error}</div>
        )}
        <form onSubmit={handleAddBalance} className="mt-4 flex flex-wrap items-end gap-4">
          <div className="w-32">
            <label className="label">Amount (\u20b9)</label>
            <input
              className="input"
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="500"
            />
          </div>
          <div className="min-w-[220px] flex-1">
            <label className="label">Description</label>
            <input
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter description"
            />
          </div>
          <button type="submit" className="btn-primary h-[42px]">
            + Add Balance
          </button>
        </form>
      </div>

      {/* Payment History - filters + pagination */}
      <div className="card mt-6">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-brand-900">Payment History</h3>
          <a href="/api/v1/payments/invoice.pdf" className="btn-secondary !py-2">
            <Download size={15} /> Download
          </a>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg bg-brand-50 p-3">
          <div>
            <label className="label !mb-1 text-[10px]">From</label>
            <input type="date" className="input !py-1.5 text-sm" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} />
          </div>
          <div>
            <label className="label !mb-1 text-[10px]">To</label>
            <input type="date" className="input !py-1.5 text-sm" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} />
          </div>
          <div>
            <label className="label !mb-1 text-[10px]">Status</label>
            <select className="input !py-1.5 text-sm" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="all">All</option>
              <option value="success">Success</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <button onClick={clearFilters} className="btn-secondary !py-1.5 text-xs">
            <RotateCcw size={13} /> Clear
          </button>
          <span className="ml-auto flex items-center gap-1.5 text-xs text-brand-400">
            <Filter size={12} /> {filtered.length} of {history?.length ?? 0} transactions
          </span>
        </div>

        <div className="mt-4 max-h-[420px] overflow-auto rounded-lg border border-brand-100">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-brand-900 text-left text-white">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Date</th>
                <th className="px-4 py-2.5 font-semibold">Description</th>
                <th className="px-4 py-2.5 font-semibold">Credit</th>
                <th className="px-4 py-2.5 font-semibold">Debit</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((t) => (
                <tr key={t.id} className="border-t border-brand-50">
                  <td className="px-4 py-2.5 text-brand-500">{new Date(t.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2.5">{t.description}</td>
                  <td className="px-4 py-2.5 text-accent-600">{Number(t.credit) ? money(t.credit) : ""}</td>
                  <td className="px-4 py-2.5 text-danger-600">{Number(t.debit) ? money(t.debit) : ""}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={t.status === "success" ? "success" : t.status === "failed" ? "danger" : "neutral"}>
                      {t.status}
                    </Badge>
                  </td>
                </tr>
              ))}
              {!paged.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-brand-300">
                    No transactions match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <select
            className="input w-auto !py-1.5 text-xs"
            value={perPage}
            onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
          >
            {[5, 10, 25, 50].map((n) => (
              <option key={n} value={n}>{n} per page</option>
            ))}
          </select>
          <div className="flex items-center gap-2 text-xs text-brand-400">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn-secondary !py-1 !px-2.5 disabled:opacity-40">
              &lsaquo;
            </button>
            Page {page} of {totalPages}
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="btn-secondary !py-1 !px-2.5 disabled:opacity-40">
              &rsaquo;
            </button>
          </div>
        </div>
      </div>

      {/* Secure Checkout modal - hidden until Add Balance triggers it;
          explicit close button (a real gap in the old project) */}
      {checkoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/60 p-6">
          <div className="w-full max-w-sm rounded-xl2 bg-white p-6 shadow-popover">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display font-semibold text-brand-900">Secure Checkout</h3>
                <p className="text-xs text-brand-400">Safe &amp; secure payment via Razorpay</p>
              </div>
              <button
                onClick={() => setCheckoutOpen(false)}
                className="rounded-full bg-brand-50 p-1.5 text-brand-400 hover:bg-danger-500/10 hover:text-danger-600"
              >
                <X size={16} />
              </button>
            </div>
            <p className="mt-6 text-center text-sm text-brand-400">
              Complete the payment in the Razorpay window that opened.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
