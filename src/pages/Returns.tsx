import { useMemo, useState } from "react";
import { useAuth, useData } from "../store";
import {
  Search,
  Undo2,
  ScanLine,
  X,
  FileText,
  Calendar,
  User,
} from "lucide-react";
import QrScanner from "../components/QrScanner";
import { formatCurrency, formatDate } from "../utils/id";

export default function Returns() {
  const invoices = useData((s) => s.invoices);
  const invoiceItems = useData((s) => s.invoiceItems);
  const customers = useData((s) => s.customers);
  const returns = useData((s) => s.salesReturns);
  const salesReturnItems = useData((s) => s.salesReturnItems);
  const createReturn = useData((s) => s.createReturn);
  const user = useAuth((s) => s.user);

  const [search, setSearch] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [viewing, setViewing] = useState<any | null>(null);

  const filteredInvoices = useMemo(() => {
    if (!search) return invoices.slice(0, 20);
    const s = search.toLowerCase();
    return invoices.filter((i) => {
      const c = customers.find((x) => x.id === i.customer_id);
      return (
        i.invoice_number.toLowerCase().includes(s) ||
        (c?.name || "").toLowerCase().includes(s) ||
        (c?.mobile || "").includes(s)
      );
    });
  }, [invoices, customers, search]);

  const onScan = (code: string) => {
    // Try to find product then an invoice containing it
    const items = invoiceItems.filter((ii) => ii.sku === code);
    if (items.length > 0) {
      const inv = invoices.find((i) => i.id === items[0].invoice_id);
      if (inv) {
        setSelectedInvoice(inv);
        return;
      }
    }
    alert("No matching invoice for that code.");
  };

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-600 via-pink-600 to-fuchsia-700 p-6 text-white shadow-xl sm:p-8">
        <div className="bg-dots absolute inset-0 opacity-20" />
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-pink-300/30 blur-3xl" />
        <div className="absolute -bottom-16 -left-10 h-56 w-56 rounded-full bg-fuchsia-400/30 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-md">
              <Undo2 size={12} /> Refunds & Returns
            </div>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Sales Returns</h1>
            <p className="mt-1 text-sm text-white/80">Process product returns with automatic stock & ledger adjustment</p>
          </div>
          <div className="flex gap-3">
            <div className="rounded-2xl border border-white/20 bg-white/15 p-3 backdrop-blur-md">
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/80">Total Returns</div>
              <div className="text-xl font-extrabold">{returns.length}</div>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/15 p-3 backdrop-blur-md">
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/80">Refunded</div>
              <div className="text-xl font-extrabold">{formatCurrency(returns.reduce((s, r) => s + r.total_amount, 0))}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: search invoice */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Find Invoice to Return</h2>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Invoice #, customer or scan QR..."
                  className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                />
              </div>
              <button
                onClick={() => setScanOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                <ScanLine size={16} /> Scan
              </button>
            </div>
          </div>
          <div className="scroll-thin max-h-[420px] overflow-y-auto p-3">
            {filteredInvoices.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400">No invoices found.</div>
            ) : (
              <div className="space-y-2">
                {filteredInvoices.map((inv) => {
                  const c = customers.find((x) => x.id === inv.customer_id);
                  const itemCount = invoiceItems.filter((ii) => ii.invoice_id === inv.id).length;
                  return (
                    <button
                      key={inv.id}
                      onClick={() => setSelectedInvoice(inv)}
                      className="w-full rounded-lg border border-slate-200 p-3 text-left transition hover:border-orange-300 hover:bg-orange-50/40"
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-mono text-sm font-semibold text-orange-700">
                          {inv.invoice_number}
                        </div>
                        <div className="text-sm font-bold text-slate-900">
                          {formatCurrency(inv.grand_total)}
                        </div>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                        <div className="flex items-center gap-2">
                          <User size={12} /> {c?.name}
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar size={12} /> {formatDate(inv.created_at)}
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-slate-400">{itemCount} item(s)</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: recent returns */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-4">
            <h2 className="text-sm font-semibold text-slate-900">Recent Returns</h2>
          </div>
          <div className="scroll-thin max-h-[420px] overflow-y-auto p-3">
            {returns.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400">No returns yet.</div>
            ) : (
              <div className="space-y-2">
                {returns.map((r) => {
                  const c = customers.find((x) => x.id === r.customer_id);
                  return (
                    <button
                      key={r.id}
                      onClick={() => setViewing(r)}
                      className="w-full rounded-lg border border-slate-200 p-3 text-left transition hover:border-violet-300 hover:bg-violet-50/40"
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-mono text-sm font-semibold text-violet-700">{r.return_number}</div>
                        <div className="text-sm font-bold text-slate-900">{formatCurrency(r.total_amount)}</div>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                        <span>
                          <FileText size={12} className="mr-1 inline" />
                          {r.invoice_number}
                        </span>
                        <span>{c?.name}</span>
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        {r.items_count} item(s) · {formatDate(r.created_at)}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedInvoice && (
        <ReturnModal
          invoice={selectedInvoice}
          invoiceItems={invoiceItems.filter((ii) => ii.invoice_id === selectedInvoice.id)}
          salesReturnItems={salesReturnItems}
          customer={customers.find((c) => c.id === selectedInvoice.customer_id)}
          onClose={() => setSelectedInvoice(null)}
          onSubmit={(items: any, reason: any) => {
            const r = createReturn({
              invoice_id: selectedInvoice.id,
              items,
              reason,
              created_by: user?.id || "system",
            });
            if (r.ok) {
              alert(r.message);
              setSelectedInvoice(null);
            } else {
              alert(r.message);
            }
          }}
        />
      )}

      {viewing && (
        <ReturnDetailModal
          returnRec={viewing}
          items={salesReturnItems.filter((i) => i.sales_return_id === viewing.id)}
          customer={customers.find((c) => c.id === viewing.customer_id)}
          onClose={() => setViewing(null)}
        />
      )}

      <QrScanner open={scanOpen} onClose={() => setScanOpen(false)} onScan={onScan} />
    </div>
  );
}

function ReturnModal({
  invoice,
  invoiceItems,
  salesReturnItems,
  customer,
  onClose,
  onSubmit,
}: any) {
  const [selections, setSelections] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");

  const setQty = (id: string, q: number, available: number) => {
    setSelections((s) => {
      const next = { ...s };
      if (q <= 0) delete next[id];
      else next[id] = Math.min(q, available);
      return next;
    });
  };

  const total = Object.entries(selections).reduce((sum, [id, qty]) => {
    const it = invoiceItems.find((x: any) => x.id === id);
    return sum + (it ? it.unit_price * qty : 0);
  }, 0);

  const submit = () => {
    const items = Object.entries(selections).map(([invoice_item_id, quantity]) => ({ invoice_item_id, quantity }));
    if (items.length === 0) return alert("Select at least one item");
    onSubmit(items, reason);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white p-5">
          <div>
            <h3 className="text-lg font-semibold">Process Return</h3>
            <p className="text-xs text-slate-500">
              {invoice.invoice_number} · {customer?.name}
            </p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          <div className="space-y-2">
            {invoiceItems.map((it: any) => {
              const alreadyReturned = salesReturnItems
                .filter((r: any) => r.invoice_item_id === it.id)
                .reduce((s: number, r: any) => s + r.quantity, 0);
              const available = it.quantity - alreadyReturned;
              const qty = selections[it.id] || 0;
              return (
                <div
                  key={it.id}
                  className={`flex items-center justify-between rounded-lg border p-3 ${
                    qty > 0 ? "border-violet-300 bg-violet-50/40" : "border-slate-200"
                  } ${available === 0 ? "opacity-50" : ""}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-slate-900">{it.product_name}</div>
                    <div className="text-xs text-slate-500">
                      {it.sku} · Sold: {it.quantity} · Returned: {alreadyReturned} ·{" "}
                      <span className={available === 0 ? "text-rose-600" : "text-emerald-600"}>
                        Returnable: {available}
                      </span>
                    </div>
                  </div>
                  <div className="ml-4 flex items-center gap-3">
                    <div className="text-sm font-bold text-slate-900">
                      {formatCurrency(it.unit_price)}
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={available}
                      value={qty}
                      disabled={available === 0}
                      onChange={(e) => setQty(it.id, +e.target.value, available)}
                      className="w-16 rounded-md border border-slate-200 px-2 py-1 text-center text-sm focus:outline-none disabled:bg-slate-100"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
              Reason (optional)
            </label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Wrong size, defective, etc."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
          </div>

          <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 p-3">
            <span className="text-sm text-slate-600">Return Total</span>
            <span className="text-xl font-bold text-violet-700">{formatCurrency(total)}</span>
          </div>
        </div>

        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white p-4">
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={total === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            <Undo2 size={14} /> Process Return
          </button>
        </div>
      </div>
    </div>
  );
}

function ReturnDetailModal({ returnRec, items, customer, onClose }: any) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Return Details</h3>
            <p className="font-mono text-xs text-slate-500">{returnRec.return_number}</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="mb-4 rounded-lg bg-violet-50 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Invoice</span>
            <span className="font-semibold">{returnRec.invoice_number}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Customer</span>
            <span className="font-semibold">{customer?.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Date</span>
            <span>{formatDate(returnRec.created_at)}</span>
          </div>
          {returnRec.reason && (
            <div className="mt-1 flex justify-between">
              <span className="text-slate-500">Reason</span>
              <span>{returnRec.reason}</span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          {items.map((it: any) => (
            <div key={it.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
              <div>
                <div className="font-semibold text-slate-900">{it.product_name}</div>
                <div className="text-xs text-slate-500">{it.quantity} × {formatCurrency(it.unit_price)}</div>
              </div>
              <div className="font-semibold text-violet-700">{formatCurrency(it.amount)}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-900 p-3 text-white">
          <span>Total Refunded</span>
          <span className="text-lg font-bold">{formatCurrency(returnRec.total_amount)}</span>
        </div>
      </div>
    </div>
  );
}
