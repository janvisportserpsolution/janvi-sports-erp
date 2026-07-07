import { useMemo } from "react";
import { useData } from "../store";
import {
  Boxes,
  Receipt,
  Users,
  TrendingUp,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Package,
  IndianRupee,
  Wallet,
  Calendar,
} from "lucide-react";
import { Link } from "react-router-dom";
import { formatCurrency, formatShortDate } from "../utils/id";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  RadialBarChart,
  RadialBar,
} from "recharts";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default function Dashboard() {
  const invoices = useData((s) => s.invoices);
  const invoiceItems = useData((s) => s.invoiceItems);
  const products = useData((s) => s.products);
  const customers = useData((s) => s.customers);
  const returns = useData((s) => s.salesReturns);

  const today = startOfDay(new Date()).getTime();
  const yesterday = today - 86400000;

  const stats = useMemo(() => {
    const todayInvoices = invoices.filter((i) => new Date(i.created_at).getTime() >= today);
    const yesterdayInvoices = invoices.filter((i) => {
      const t = new Date(i.created_at).getTime();
      return t >= yesterday && t < today;
    });
    const todaySales = todayInvoices.reduce((s, i) => s + i.grand_total, 0);
    const yesterdaySales = yesterdayInvoices.reduce((s, i) => s + i.grand_total, 0);
    const salesDelta = yesterdaySales === 0 ? 100 : ((todaySales - yesterdaySales) / yesterdaySales) * 100;

    const todayReturns = returns.filter((r) => new Date(r.created_at).getTime() >= today);
    const todayReturnAmount = todayReturns.reduce((s, r) => s + r.total_amount, 0);
    const outstanding = customers.reduce((s, c) => s + c.credit_balance, 0);
    const lowStock = products.filter((p) => p.is_active && p.stock_quantity <= p.low_stock_threshold);
    const stockValue = products.reduce((s, p) => s + p.stock_quantity * p.cost_price, 0);

    const todayCost = todayInvoices.reduce((sum, inv) => {
      const items = invoiceItems.filter((ii) => ii.invoice_id === inv.id);
      return sum + items.reduce((a, ii) => a + ii.quantity * ii.cost_price, 0);
    }, 0);
    const todayProfit = todaySales - todayCost;
    const margin = todaySales > 0 ? (todayProfit / todaySales) * 100 : 0;

    return {
      todaySales,
      salesDelta,
      todayInvoices: todayInvoices.length,
      todayReturnAmount,
      todayReturns: todayReturns.length,
      outstanding,
      lowStock,
      stockValue,
      todayProfit,
      margin,
    };
  }, [invoices, invoiceItems, products, customers, returns, today, yesterday]);

  const chartData = useMemo(() => {
    const days: { date: string; sales: number; returns: number; profit: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      const dayInvoices = invoices.filter((inv) => {
        const t = new Date(inv.created_at).getTime();
        return t >= d.getTime() && t < next.getTime();
      });
      const dayReturns = returns.filter((r) => {
        const t = new Date(r.created_at).getTime();
        return t >= d.getTime() && t < next.getTime();
      });
      const sales = dayInvoices.reduce((s, i) => s + i.grand_total, 0);
      const cost = dayInvoices.reduce((sum, inv) => {
        const items = invoiceItems.filter((ii) => ii.invoice_id === inv.id);
        return sum + items.reduce((a, ii) => a + ii.quantity * ii.cost_price, 0);
      }, 0);
      days.push({
        date: d.toLocaleDateString("en-IN", { weekday: "short" }),
        sales,
        returns: dayReturns.reduce((s, r) => s + r.total_amount, 0),
        profit: sales - cost,
      });
    }
    return days;
  }, [invoices, invoiceItems, returns]);

  const categoryData = useMemo(() => {
    const map = new Map<string, number>();
    invoiceItems.forEach((ii) => {
      const p = products.find((p) => p.id === ii.product_id);
      const cat = p?.category || "Other";
      map.set(cat, (map.get(cat) || 0) + ii.total);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [invoiceItems, products]);

  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    invoiceItems.forEach((ii) => {
      const ex = map.get(ii.product_id) || { name: ii.product_name, qty: 0, revenue: 0 };
      ex.qty += ii.quantity;
      ex.revenue += ii.total;
      map.set(ii.product_id, ex);
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [invoiceItems]);

  const COLORS = ["#f97316", "#0ea5e9", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#ec4899"];
  const recentInvoices = invoices.slice(0, 5);

  // Top customers
  const topCustomers = useMemo(() => {
    const map = new Map<string, number>();
    invoices.forEach((inv) => {
      map.set(inv.customer_id, (map.get(inv.customer_id) || 0) + inv.grand_total);
    });
    return Array.from(map.entries())
      .map(([id, total]) => ({ customer: customers.find((c) => c.id === id), total }))
      .filter((x) => x.customer)
      .sort((a, b) => b.total - a.total)
      .slice(0, 4);
  }, [invoices, customers]);

  return (
    <div className="space-y-6">
      {/* Hero greeting */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-2xl sm:p-8">
        <div className="bg-mesh absolute inset-0 opacity-80" />
        <div className="bg-grid absolute inset-0 opacity-20" />
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-gradient-to-br from-orange-400/40 to-rose-500/40 blur-3xl" />
        <div className="absolute -bottom-20 right-40 h-60 w-60 rounded-full bg-gradient-to-br from-violet-500/40 to-fuchsia-500/40 blur-3xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-md">
              <Sparkles size={12} className="text-yellow-300" />
              {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
            </div>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Good {new Date().getHours() < 12 ? "Morning" : new Date().getHours() < 17 ? "Afternoon" : "Evening"} 👋
            </h1>
            <p className="mt-1 text-sm text-white/80">
              Here's what's happening at <span className="font-bold text-orange-300">Janvi Sports</span> today.
            </p>
          </div>

          <div className="flex flex-wrap items-stretch gap-3">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-white/70">Today's Sales</div>
              <div className="mt-1 text-2xl font-extrabold text-white">{formatCurrency(stats.todaySales)}</div>
              <div className={`mt-1 flex items-center gap-1 text-xs font-bold ${stats.salesDelta >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                {stats.salesDelta >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {Math.abs(stats.salesDelta).toFixed(0)}% vs yesterday
              </div>
            </div>
            <Link
              to="/billing"
              className="group relative flex items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-orange-500 to-rose-600 px-6 py-4 font-bold shadow-xl shadow-orange-500/30 transition hover:shadow-orange-500/50"
            >
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              <Receipt size={18} /> Create Bill
            </Link>
          </div>
        </div>
      </div>

      {/* Vibrant KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard
          label="Today's Profit"
          value={formatCurrency(stats.todayProfit)}
          sub={`${stats.margin.toFixed(1)}% margin`}
          icon={TrendingUp}
          gradient="from-emerald-500 to-teal-600"
          shadowColor="emerald"
        />
        <KPICard
          label="Outstanding"
          value={formatCurrency(stats.outstanding)}
          sub="Customer credit"
          icon={Wallet}
          gradient="from-rose-500 to-pink-600"
          shadowColor="rose"
        />
        <KPICard
          label="Stock Value"
          value={formatCurrency(stats.stockValue)}
          sub={`${products.length} products`}
          icon={Boxes}
          gradient="from-sky-500 to-blue-600"
          shadowColor="sky"
        />
        <KPICard
          label="Bills Today"
          value={stats.todayInvoices.toString()}
          sub={`${stats.todayReturns} returns`}
          icon={Receipt}
          gradient="from-violet-500 to-fuchsia-600"
          shadowColor="violet"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Sales chart */}
        <div className="card-lift overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm lg:col-span-2">
          <div className="border-b border-slate-100 bg-gradient-to-r from-orange-50/50 to-rose-50/50 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-rose-600 text-white shadow-md">
                    <TrendingUp size={14} />
                  </span>
                  Last 7 Days Performance
                </h2>
                <p className="text-xs text-slate-500">Track sales, returns and profit trends</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <Legendish color="bg-orange-500" label="Sales" />
                <Legendish color="bg-emerald-500" label="Profit" />
                <Legendish color="bg-rose-500" label="Returns" />
              </div>
            </div>
          </div>
          <div className="h-80 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="profitG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="retG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e11d48" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#e11d48" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false}
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={((v: unknown) => formatCurrency(Number(v))) as never}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    fontSize: 12,
                    boxShadow: "0 8px 24px -8px rgba(15,23,42,0.15)",
                  }}
                />
                <Area type="monotone" dataKey="sales" stroke="#f97316" strokeWidth={2.5} fill="url(#salesG)" />
                <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2.5} fill="url(#profitG)" />
                <Area type="monotone" dataKey="returns" stroke="#e11d48" strokeWidth={2} fill="url(#retG)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Margin gauge */}
        <div className="card-lift relative overflow-hidden rounded-2xl border border-slate-200/60 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-5 shadow-sm">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br from-emerald-200 to-teal-200 opacity-40 blur-2xl" />
          <div className="relative">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md">
                <IndianRupee size={14} />
              </span>
              Today's Margin
            </h2>
            <p className="text-xs text-slate-500">Profit vs revenue</p>

            <div className="relative mt-3 h-52">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  innerRadius="65%"
                  outerRadius="95%"
                  data={[{ name: "margin", value: Math.max(0, Math.min(100, stats.margin)), fill: "#10b981" }]}
                  startAngle={90}
                  endAngle={-270}
                >
                  <RadialBar background={{ fill: "#e2e8f0" } as never} dataKey="value" cornerRadius={20} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-4xl font-extrabold text-gradient-orange">{stats.margin.toFixed(1)}%</div>
                <div className="mt-1 text-xs font-semibold text-slate-500">Profit Margin</div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-xl bg-white/70 p-2 ring-1 ring-emerald-100">
                <div className="text-[10px] font-semibold uppercase text-slate-500">Revenue</div>
                <div className="text-sm font-bold text-emerald-700">{formatCurrency(stats.todaySales)}</div>
              </div>
              <div className="rounded-xl bg-white/70 p-2 ring-1 ring-emerald-100">
                <div className="text-[10px] font-semibold uppercase text-slate-500">Profit</div>
                <div className="text-sm font-bold text-emerald-700">{formatCurrency(stats.todayProfit)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Categories */}
        <div className="card-lift overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-gradient-to-r from-violet-50/60 to-fuchsia-50/60 p-5">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-md">
                <Package size={14} />
              </span>
              Sales by Category
            </h2>
          </div>
          {categoryData.length === 0 ? (
            <EmptyState message="No sales yet" />
          ) : (
            <div className="h-64 p-3">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={40}
                    outerRadius={75}
                    paddingAngle={3}
                  >
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="#fff" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip formatter={((v: unknown) => formatCurrency(Number(v))) as never} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Top products */}
        <div className="card-lift overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm lg:col-span-2">
          <div className="border-b border-slate-100 bg-gradient-to-r from-sky-50/60 to-blue-50/60 p-5">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-md">
                <Sparkles size={14} />
              </span>
              Top Selling Products
            </h2>
          </div>
          <div className="space-y-2 p-4">
            {topProducts.length === 0 ? (
              <EmptyState message="No products sold yet" />
            ) : (
              topProducts.map((p, i) => {
                const max = topProducts[0].revenue;
                const pct = (p.revenue / max) * 100;
                return (
                  <div key={i} className="group">
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold text-white shadow-sm ${
                          i === 0 ? "bg-gradient-to-br from-yellow-400 to-orange-500" :
                          i === 1 ? "bg-gradient-to-br from-slate-400 to-slate-500" :
                          i === 2 ? "bg-gradient-to-br from-amber-600 to-orange-700" :
                          "bg-slate-200 text-slate-600"
                        }`}>{i + 1}</span>
                        <span className="font-semibold text-slate-900">{p.name}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                          {p.qty} sold
                        </span>
                      </div>
                      <span className="font-bold text-orange-700">{formatCurrency(p.revenue)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-orange-400 to-rose-500 transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Low stock alerts */}
        <div className="card-lift overflow-hidden rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50/50 via-white to-orange-50/40 shadow-sm">
          <div className="flex items-center justify-between border-b border-amber-100/60 p-4">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md">
                <AlertTriangle size={14} />
              </span>
              Low Stock Alerts
            </h2>
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700 ring-1 ring-amber-200">
              {stats.lowStock.length}
            </span>
          </div>
          {stats.lowStock.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <Package size={20} />
              </div>
              <div className="text-sm font-semibold text-slate-700">All stocked up!</div>
              <div className="text-xs text-slate-500">No products below threshold</div>
            </div>
          ) : (
            <div className="scroll-thin max-h-64 space-y-2 overflow-y-auto p-3">
              {stats.lowStock.slice(0, 6).map((p) => {
                const pct = Math.min(100, (p.stock_quantity / p.low_stock_threshold) * 100);
                return (
                  <div key={p.id} className="rounded-xl border border-amber-200/60 bg-white/80 p-3">
                    <div className="mb-1.5 flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-slate-900">{p.name}</div>
                        <div className="font-mono text-[10px] text-slate-500">{p.sku}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-extrabold text-amber-700">{p.stock_quantity}</div>
                        <div className="text-[10px] text-slate-500">/ {p.low_stock_threshold}</div>
                      </div>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-amber-100">
                      <div
                        className={`h-full rounded-full ${pct < 50 ? "bg-gradient-to-r from-rose-400 to-rose-500" : "bg-gradient-to-r from-amber-400 to-amber-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top customers */}
        <div className="card-lift overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-gradient-to-r from-rose-50/60 to-pink-50/60 p-4">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-md">
                <Users size={14} />
              </span>
              Top Customers
            </h2>
          </div>
          <div className="space-y-2 p-3">
            {topCustomers.length === 0 ? (
              <EmptyState message="No customers yet" />
            ) : (
              topCustomers.map((tc, i) => (
                <Link
                  key={i}
                  to={`/customers/${tc.customer!.id}`}
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-3 transition hover:border-rose-200 hover:bg-rose-50/40"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm ${
                        ["bg-gradient-to-br from-orange-400 to-rose-500",
                         "bg-gradient-to-br from-sky-400 to-blue-500",
                         "bg-gradient-to-br from-emerald-400 to-teal-500",
                         "bg-gradient-to-br from-violet-400 to-fuchsia-500"][i]
                      }`}
                    >
                      {tc.customer!.name[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{tc.customer!.name}</div>
                      <div className="text-[11px] text-slate-500">{tc.customer!.mobile}</div>
                    </div>
                  </div>
                  <div className="text-sm font-bold text-slate-900">{formatCurrency(tc.total)}</div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Recent invoices */}
        <div className="card-lift overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-emerald-50/60 to-teal-50/60 p-4">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md">
                <Receipt size={14} />
              </span>
              Recent Bills
            </h2>
            <Link to="/invoices" className="text-xs font-semibold text-emerald-700 hover:underline">View all →</Link>
          </div>
          <div className="space-y-1 p-2">
            {recentInvoices.length === 0 ? (
              <EmptyState message="No invoices yet" />
            ) : (
              recentInvoices.map((inv) => {
                const cust = customers.find((c) => c.id === inv.customer_id);
                return (
                  <Link
                    key={inv.id}
                    to={`/invoices/${inv.id}`}
                    className="flex items-center justify-between rounded-xl p-2.5 transition hover:bg-emerald-50/50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-emerald-700">{inv.invoice_number}</span>
                        <StatusBadge status={inv.status} />
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                        <span className="truncate">{cust?.name}</span>
                        <Calendar size={10} />
                        <span>{formatShortDate(inv.created_at)}</span>
                      </div>
                    </div>
                    <div className="font-bold text-slate-900">{formatCurrency(inv.grand_total)}</div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KPICard({
  label,
  value,
  sub,
  icon: Icon,
  gradient,
  shadowColor,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ size?: number }>;
  gradient: string;
  shadowColor: string;
}) {
  const shadows: Record<string, string> = {
    emerald: "shadow-emerald-500/20",
    rose: "shadow-rose-500/20",
    sky: "shadow-sky-500/20",
    violet: "shadow-violet-500/20",
  };
  return (
    <div className={`card-lift group relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white p-5 shadow-lg ${shadows[shadowColor]}`}>
      <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${gradient} opacity-10 blur-2xl transition-opacity group-hover:opacity-20`} />
      <div className="relative flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</div>
          <div className="mt-2 truncate text-2xl font-extrabold text-slate-900">{value}</div>
          {sub && <div className="mt-1 text-xs font-semibold text-slate-500">{sub}</div>}
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-lg`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

function Legendish({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-slate-600">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <span className="font-semibold">{label}</span>
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Sparkles size={20} />
      </div>
      <div className="text-sm text-slate-500">{message}</div>
    </div>
  );
}

export function StatusBadge({ status }: { status: "PAID" | "UNPAID" | "PARTIAL" }) {
  const map: Record<string, string> = {
    PAID: "bg-gradient-to-r from-emerald-500 to-teal-500 text-white",
    UNPAID: "bg-gradient-to-r from-rose-500 to-pink-500 text-white",
    PARTIAL: "bg-gradient-to-r from-amber-500 to-orange-500 text-white",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold shadow-sm ${map[status]}`}>
      {status}
    </span>
  );
}
