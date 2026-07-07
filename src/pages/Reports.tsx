import { useMemo, useState } from "react";
import { useData } from "../store";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { formatCurrency } from "../utils/id";
import { Download, Calendar, TrendingUp, Package, Users } from "lucide-react";

type Range = "TODAY" | "7D" | "30D" | "ALL";

export default function Reports() {
  const invoices = useData((s) => s.invoices);
  const invoiceItems = useData((s) => s.invoiceItems);
  const products = useData((s) => s.products);
  const customers = useData((s) => s.customers);
  const returns = useData((s) => s.salesReturns);
  const [tab, setTab] = useState<"OVERVIEW" | "INVENTORY" | "CUSTOMERS" | "PROFIT">("OVERVIEW");
  const [range, setRange] = useState<Range>("30D");

  const filtered = useMemo(() => {
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    let start = new Date(0);
    if (range === "TODAY") {
      start = new Date();
      start.setHours(0, 0, 0, 0);
    } else if (range === "7D") {
      start = new Date();
      start.setDate(start.getDate() - 7);
    } else if (range === "30D") {
      start = new Date();
      start.setDate(start.getDate() - 30);
    }
    return {
      invoices: invoices.filter((i) => new Date(i.created_at) >= start && new Date(i.created_at) <= now),
      returns: returns.filter((r) => new Date(r.created_at) >= start && new Date(r.created_at) <= now),
    };
  }, [invoices, returns, range]);

  // Daily series
  const dailySeries = useMemo(() => {
    const days: Record<string, { date: string; sales: number; profit: number; returns: number }> = {};
    filtered.invoices.forEach((inv) => {
      const d = new Date(inv.created_at);
      const k = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
      const items = invoiceItems.filter((ii) => ii.invoice_id === inv.id);
      const cost = items.reduce((s, ii) => s + ii.quantity * ii.cost_price, 0);
      const sale = inv.grand_total;
      if (!days[k]) days[k] = { date: k, sales: 0, profit: 0, returns: 0 };
      days[k].sales += sale;
      days[k].profit += sale - cost;
    });
    filtered.returns.forEach((r) => {
      const d = new Date(r.created_at);
      const k = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
      if (!days[k]) days[k] = { date: k, sales: 0, profit: 0, returns: 0 };
      days[k].returns += r.total_amount;
    });
    return Object.values(days).slice(-30);
  }, [filtered, invoiceItems]);

  const summary = useMemo(() => {
    const totalSales = filtered.invoices.reduce((s, i) => s + i.grand_total, 0);
    const totalReturns = filtered.returns.reduce((s, r) => s + r.total_amount, 0);
    const totalPaid = filtered.invoices.reduce((s, i) => s + i.amount_paid, 0);
    const totalCost = filtered.invoices.reduce((sum, inv) => {
      const items = invoiceItems.filter((ii) => ii.invoice_id === inv.id);
      return sum + items.reduce((a, ii) => a + ii.quantity * ii.cost_price, 0);
    }, 0);
    const profit = totalSales - totalCost - totalReturns;
    return { totalSales, totalReturns, totalPaid, totalCost, profit, invoiceCount: filtered.invoices.length };
  }, [filtered, invoiceItems]);

  // Inventory report
  const inventoryRows = useMemo(() => {
    return products.map((p) => {
      const sold = invoiceItems.filter((ii) => ii.product_id === p.id)
        .reduce((s, ii) => s + ii.quantity, 0);
      const stockValue = p.stock_quantity * p.cost_price;
      return { ...p, sold, stockValue };
    }).sort((a, b) => b.sold - a.sold);
  }, [products, invoiceItems]);

  // Customer report
  const customerRows = useMemo(() => {
    return customers.map((c) => {
      const inv = filtered.invoices.filter((i) => i.customer_id === c.id);
      const total = inv.reduce((s, i) => s + i.grand_total, 0);
      return { ...c, totalPurchases: total, invoiceCount: inv.length };
    }).sort((a, b) => b.totalPurchases - a.totalPurchases);
  }, [customers, filtered]);

  // Product sales for profit
  const productProfit = useMemo(() => {
    return products.map((p) => {
      const items = invoiceItems.filter((ii) => ii.product_id === p.id);
      const qty = items.reduce((s, ii) => s + ii.quantity, 0);
      const revenue = items.reduce((s, ii) => s + ii.total, 0);
      const cost = qty * p.cost_price;
      return { name: p.name, revenue, cost, profit: revenue - cost, qty };
    }).sort((a, b) => b.profit - a.profit);
  }, [products, invoiceItems]);

  const exportCsv = () => {
    let csv = "";
    if (tab === "INVENTORY") {
      csv = "Product,SKU,Category,Stock,Min,Cost,Price,Stock Value,Sold\n";
      inventoryRows.forEach((p) =>
        csv += `"${p.name}","${p.sku}","${p.category || ""}",${p.stock_quantity},${p.low_stock_threshold},${p.cost_price},${p.selling_price},${p.stockValue},${p.sold}\n`
      );
    } else if (tab === "CUSTOMERS") {
      csv = "Customer,Mobile,Address,Outstanding,Period Purchases,Invoices\n";
      customerRows.forEach((c) =>
        csv += `"${c.name}","${c.mobile}","${c.address}",${c.credit_balance},${c.totalPurchases},${c.invoiceCount}\n`
      );
    } else {
      csv = "Date,Sales,Returns,Profit\n";
      dailySeries.forEach((d) =>
        csv += `"${d.date}",${d.sales},${d.returns},${d.profit}\n`
      );
    }
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tab.toLowerCase()}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tabs: { key: typeof tab; label: string; icon: any }[] = [
    { key: "OVERVIEW", label: "Daily Report", icon: Calendar },
    { key: "INVENTORY", label: "Inventory", icon: Package },
    { key: "CUSTOMERS", label: "Customers", icon: Users },
    { key: "PROFIT", label: "Profit & Loss", icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-700 p-6 text-white shadow-xl sm:p-8">
        <div className="bg-dots absolute inset-0 opacity-20" />
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-violet-300/30 blur-3xl" />
        <div className="absolute -bottom-16 -left-10 h-56 w-56 rounded-full bg-fuchsia-400/30 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-md">
              <TrendingUp size={12} /> Business Intelligence
            </div>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Reports</h1>
            <p className="mt-1 text-sm text-white/80">Insights & analytics to grow smarter</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex overflow-hidden rounded-xl border border-white/20 bg-white/15 backdrop-blur-md">
              {(["TODAY", "7D", "30D", "ALL"] as Range[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-3 py-2 text-xs font-bold transition ${
                    range === r ? "bg-white text-indigo-700 shadow" : "text-white hover:bg-white/10"
                  }`}
                >
                  {r === "TODAY" ? "Today" : r === "7D" ? "7 Days" : r === "30D" ? "30 Days" : "All Time"}
                </button>
              ))}
            </div>
            <button
              onClick={exportCsv}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-sm font-bold text-indigo-700 shadow-lg transition hover:shadow-xl"
            >
              <Download size={14} /> Export
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200/60 bg-white p-2 shadow-sm">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition ${
              tab === t.key
                ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-violet-500/30"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "OVERVIEW" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KPI label="Total Sales" value={formatCurrency(summary.totalSales)} sub={`${summary.invoiceCount} invoices`} tone="sky" />
            <KPI label="Collected" value={formatCurrency(summary.totalPaid)} tone="emerald" />
            <KPI label="Returns" value={formatCurrency(summary.totalReturns)} tone="rose" />
            <KPI label="Net Profit" value={formatCurrency(summary.profit)} tone="violet" />
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-base font-semibold text-slate-900">Sales vs Returns</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailySeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" fontSize={12} stroke="#94a3b8" />
                  <YAxis fontSize={12} stroke="#94a3b8" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={((v: unknown) => formatCurrency(Number(v))) as never}
                    contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                  />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="sales" fill="#f97316" name="Sales" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="returns" fill="#e11d48" name="Returns" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="profit" fill="#10b981" name="Profit" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {tab === "INVENTORY" && (
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="scroll-thin overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Category</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Stock</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Sold</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Cost</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Stock Value</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inventoryRows.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{p.name}</div>
                      <div className="font-mono text-xs text-slate-500">{p.sku}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.category || "—"}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${p.stock_quantity <= p.low_stock_threshold ? "text-amber-700" : "text-slate-900"}`}>
                      {p.stock_quantity}
                    </td>
                    <td className="px-4 py-3 text-right">{p.sold}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(p.cost_price)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(p.stockValue)}</td>
                    <td className="px-4 py-3 text-right">
                      {p.stock_quantity <= p.low_stock_threshold ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">LOW</span>
                      ) : p.is_active ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">OK</span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">INACTIVE</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "CUSTOMERS" && (
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="scroll-thin overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Mobile</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Purchases</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Invoices</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customerRows.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{c.name}</div>
                      <div className="text-xs text-slate-500">{c.address}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.mobile}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(c.totalPurchases)}</td>
                    <td className="px-4 py-3 text-right">{c.invoiceCount}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${c.credit_balance > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                      {formatCurrency(c.credit_balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "PROFIT" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KPI label="Revenue" value={formatCurrency(summary.totalSales)} tone="sky" />
            <KPI label="Cost of Goods" value={formatCurrency(summary.totalCost)} tone="amber" />
            <KPI label="Net Profit" value={formatCurrency(summary.profit)} tone="emerald" />
          </div>
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 p-4">
              <h2 className="text-sm font-semibold text-slate-900">Top Products by Profit</h2>
            </div>
            <div className="scroll-thin overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Product</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Qty Sold</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Revenue</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Cost</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {productProfit.slice(0, 20).map((p, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-900">{p.name}</td>
                      <td className="px-4 py-3 text-right">{p.qty}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(p.revenue)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(p.cost)}</td>
                      <td className={`px-4 py-3 text-right font-bold ${p.profit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                        {formatCurrency(p.profit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KPI({ label, value, sub, tone }: any) {
  const grads: Record<string, string> = {
    sky: "from-sky-500 to-blue-600",
    emerald: "from-emerald-500 to-teal-600",
    rose: "from-rose-500 to-pink-600",
    amber: "from-amber-500 to-orange-600",
    violet: "from-violet-500 to-fuchsia-600",
  };
  return (
    <div className="card-lift relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
      <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${grads[tone]} opacity-15 blur-2xl`} />
      <div className="relative">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</div>
        <div className={`mt-2 bg-gradient-to-br ${grads[tone]} bg-clip-text text-3xl font-extrabold text-transparent`}>{value}</div>
        {sub && <div className="mt-1 text-[11px] font-semibold text-slate-500">{sub}</div>}
      </div>
    </div>
  );
}
