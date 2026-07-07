import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useData } from "../store";
import { Search, Receipt, Eye, FilePlus2 } from "lucide-react";
import { formatCurrency, formatShortDate } from "../utils/id";
import { StatusBadge } from "./Dashboard";

export default function Invoices() {
  const invoices = useData((s) => s.invoices);
  const customers = useData((s) => s.customers);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"ALL" | "PAID" | "PARTIAL" | "UNPAID">("ALL");

  const filtered = useMemo(() => {
    let list = [...invoices];
    if (q) {
      const s = q.toLowerCase();
      list = list.filter((i) => {
        const c = customers.find((x) => x.id === i.customer_id);
        return (
          i.invoice_number.toLowerCase().includes(s) ||
          (c?.name || "").toLowerCase().includes(s) ||
          (c?.mobile || "").includes(s)
        );
      });
    }
    if (status !== "ALL") list = list.filter((i) => i.status === status);
    return list.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [invoices, customers, q, status]);

  const totals = useMemo(() => {
    return {
      total: filtered.reduce((s, i) => s + i.grand_total, 0),
      paid: filtered.reduce((s, i) => s + i.amount_paid, 0),
      due: filtered.reduce((s, i) => s + i.balance_amount, 0),
    };
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-6 text-white shadow-xl sm:p-8">
        <div className="bg-dots absolute inset-0 opacity-20" />
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-300/30 blur-3xl" />
        <div className="absolute -bottom-16 -left-10 h-56 w-56 rounded-full bg-cyan-400/30 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-md">
              <Receipt size={12} /> Sales Records
            </div>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Invoices</h1>
            <p className="mt-1 text-sm text-white/80">All sales transactions and payment status</p>
          </div>
          <Link
            to="/billing"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-emerald-700 shadow-lg transition hover:shadow-xl"
          >
            <FilePlus2 size={16} /> New Invoice
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Box label="Total Invoiced" value={formatCurrency(totals.total)} gradient="from-sky-500 to-blue-600" />
        <Box label="Amount Received" value={formatCurrency(totals.paid)} gradient="from-emerald-500 to-teal-600" />
        <Box label="Outstanding" value={formatCurrency(totals.due)} gradient="from-rose-500 to-pink-600" />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by invoice #, customer name, mobile..."
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(["ALL", "PAID", "PARTIAL", "UNPAID"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  status === s
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="scroll-thin overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Invoice #</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Date</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Total</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Paid</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Balance</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((inv) => {
                const c = customers.find((x) => x.id === inv.customer_id);
                return (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Receipt size={14} className="text-slate-400" />
                        <span className="font-mono text-xs font-semibold text-slate-900">{inv.invoice_number}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{c?.name || "—"}</div>
                      <div className="text-xs text-slate-500">{c?.mobile}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatShortDate(inv.created_at)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(inv.grand_total)}</td>
                    <td className="px-4 py-3 text-right text-emerald-700">{formatCurrency(inv.amount_paid)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${inv.balance_amount > 0 ? "text-rose-700" : "text-slate-500"}`}>
                      {formatCurrency(inv.balance_amount)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/invoices/${inv.id}`}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Eye size={12} /> View
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-400">
                    No invoices found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Box({ label, value, gradient }: any) {
  return (
    <div className="card-lift relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
      <div className={`absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br ${gradient} opacity-15 blur-2xl`} />
      <div className="relative">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</div>
        <div className={`mt-2 bg-gradient-to-br ${gradient} bg-clip-text text-3xl font-extrabold text-transparent`}>{value}</div>
      </div>
    </div>
  );
}
