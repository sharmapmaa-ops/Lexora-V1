import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Wallet, TrendingDown, PiggyBank, X, Download } from "lucide-react";
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

  const { data: balance } = useQuery<Balance>({
    queryKey: ["balance"],
    queryFn: () => api.get("/payments/balance").then((r) => r.data),
  });

  const { data: history } = useQuery<Transaction[]>({
    queryKey: ["payment-history"],
    queryFn: () => api.get("/payments/history").then((r) => r.data),
  });

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

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)]">
        {/* Balance Summary - own column, stacked vertically */}
        <div className="card flex flex-col gap-4">
          <StatCard label="Total Credit" value={money(balance?.total_credit ?? 0)} icon={Wallet} tone="success" />
          <StatCard label="Total Debit" value={money(balance?.total_debit ?? 0)} icon={TrendingDown} tone="danger" />
          <StatCard label="Current Balance" value={money(balance?.current_balance ?? 0)} icon={PiggyBank} tone="brand" />
        </div>

        {/* Add Balance - full width of its column, Amount smaller than Description */}
        <div className="card">
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
      </div>

      {/* Payment History - full width, below */}
      <div className="card mt-6">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-brand-900">Payment History</h3>
          <a href="/api/v1/payments/invoice.pdf" className="btn-secondary !py-2">
            <Download size={15} /> Download
          </a>
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
              {history?.map((t) => (
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
              {!history?.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-brand-300">
                    No transactions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
