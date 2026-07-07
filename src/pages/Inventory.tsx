import { useMemo, useState } from "react";
import { useData } from "../store";
import {
  Search,
  Plus,
  Minus,
  ScanLine,
  History,
  Package,
  AlertTriangle,
  X,
  Pencil,
  Power,
} from "lucide-react";
import QrScanner from "../components/QrScanner";
import { formatCurrency, formatDate } from "../utils/id";

export default function Inventory() {
  const products = useData((s) => s.products);
  const addStock = useData((s) => s.addStock);
  const removeStock = useData((s) => s.removeStock);
  const addProduct = useData((s) => s.addProduct);
  const updateProduct = useData((s) => s.updateProduct);
  const deleteProduct = useData((s) => s.deleteProduct);
  const inventoryTransactions = useData((s) => s.inventoryTransactions);

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"ALL" | "LOW" | "ACTIVE" | "INACTIVE">("ALL");
  const [scanOpen, setScanOpen] = useState(false);
  const [stockModal, setStockModal] = useState<{
    product: any;
    mode: "ADD" | "REMOVE";
  } | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [historyProduct, setHistoryProduct] = useState<any | null>(null);

  const filtered = useMemo(() => {
    let list = [...products];
    if (q) {
      const s = q.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(s) ||
          p.sku.toLowerCase().includes(s) ||
          p.qr_code.toLowerCase().includes(s) ||
          (p.category || "").toLowerCase().includes(s)
      );
    }
    if (filter === "LOW") list = list.filter((p) => p.stock_quantity <= p.low_stock_threshold);
    if (filter === "ACTIVE") list = list.filter((p) => p.is_active);
    if (filter === "INACTIVE") list = list.filter((p) => !p.is_active);
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [products, q, filter]);

  const stats = useMemo(() => {
    return {
      total: products.length,
      active: products.filter((p) => p.is_active).length,
      low: products.filter((p) => p.is_active && p.stock_quantity <= p.low_stock_threshold).length,
      stockValue: products.reduce((s, p) => s + p.stock_quantity * p.cost_price, 0),
    };
  }, [products]);

  const onScan = (code: string) => {
    const found = products.find((p) => p.sku === code || p.qr_code === code);
    if (found) {
      setQ(found.sku);
    } else {
      alert(`No product found for code: ${code}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky-600 via-cyan-600 to-blue-700 p-6 text-white shadow-xl sm:p-8">
        <div className="bg-dots absolute inset-0 opacity-20" />
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-cyan-300/30 blur-3xl" />
        <div className="absolute -bottom-16 -left-10 h-56 w-56 rounded-full bg-blue-400/30 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-md">
              <Package size={12} /> Stock Management
            </div>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Inventory</h1>
            <p className="mt-1 text-sm text-white/80">Manage products, stock levels and movements</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setScanOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/15 px-4 py-2.5 text-sm font-bold backdrop-blur-md transition hover:bg-white/25"
            >
              <ScanLine size={16} /> Scan QR
            </button>
            <button
              onClick={() => setEditing({})}
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-sky-700 shadow-lg transition hover:shadow-xl"
            >
              <Plus size={16} /> New Product
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatBox label="Total Products" value={stats.total.toString()} icon={Package} gradient="from-sky-500 to-blue-600" />
        <StatBox label="Active" value={stats.active.toString()} icon={Power} gradient="from-emerald-500 to-teal-600" />
        <StatBox label="Low Stock" value={stats.low.toString()} icon={AlertTriangle} gradient="from-amber-500 to-orange-600" />
        <StatBox label="Stock Value" value={formatCurrency(stats.stockValue)} icon={Package} gradient="from-violet-500 to-fuchsia-600" />
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, SKU or QR code..."
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { v: "ALL", l: "All" },
              { v: "LOW", l: "Low Stock" },
              { v: "ACTIVE", l: "Active" },
              { v: "INACTIVE", l: "Inactive" },
            ].map((b) => (
              <button
                key={b.v}
                onClick={() => setFilter(b.v as any)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  filter === b.v
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {b.l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Product list */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="scroll-thin overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-slate-500">Product</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-slate-500">SKU / QR</th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase text-slate-500">Price</th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase text-slate-500">Cost</th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase text-slate-500">Stock</th>
                <th className="px-3 py-3 text-center text-xs font-semibold uppercase text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((p, idx) => {
                const isLow = p.is_active && p.stock_quantity <= p.low_stock_threshold;
                const gradients = [
                  "from-orange-400 to-rose-500",
                  "from-sky-400 to-cyan-500",
                  "from-emerald-400 to-teal-500",
                  "from-violet-400 to-fuchsia-500",
                  "from-amber-400 to-orange-500",
                  "from-pink-400 to-rose-500",
                  "from-indigo-400 to-violet-500",
                ];
                const g = gradients[idx % gradients.length];
                return (
                  <tr key={p.id} className="transition hover:bg-slate-50">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${g} text-sm font-extrabold text-white shadow-md`}>
                          {p.name.split(" ").slice(0, 2).map((w) => w[0]).join("")}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-bold text-slate-900">{p.name}</div>
                          <div className="text-xs text-slate-500">{p.category || "—"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-mono text-xs text-slate-700">{p.sku}</div>
                      <div className="font-mono text-[11px] text-slate-400">{p.qr_code}</div>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-slate-900">{formatCurrency(p.selling_price)}</td>
                    <td className="px-3 py-3 text-right text-slate-600">{formatCurrency(p.cost_price)}</td>
                    <td className="px-3 py-3 text-right">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                          isLow ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {p.stock_quantity}
                      </span>
                      <div className="text-[11px] text-slate-400">Min {p.low_stock_threshold}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setStockModal({ product: p, mode: "ADD" })}
                          className="rounded-md p-1.5 text-emerald-700 hover:bg-emerald-50"
                          title="Add stock"
                        >
                          <Plus size={16} />
                        </button>
                        <button
                          onClick={() => setStockModal({ product: p, mode: "REMOVE" })}
                          className="rounded-md p-1.5 text-rose-700 hover:bg-rose-50"
                          title="Remove stock"
                        >
                          <Minus size={16} />
                        </button>
                        <button
                          onClick={() => setHistoryProduct(p)}
                          className="rounded-md p-1.5 text-slate-700 hover:bg-slate-100"
                          title="Stock history"
                        >
                          <History size={16} />
                        </button>
                        <button
                          onClick={() => setEditing(p)}
                          className="rounded-md p-1.5 text-slate-700 hover:bg-slate-100"
                          title="Edit"
                        >
                          <Pencil size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-12 text-center text-sm text-slate-400">
                    No products found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <QrScanner open={scanOpen} onClose={() => setScanOpen(false)} onScan={onScan} />

      {stockModal && (
        <StockModal
          product={stockModal.product}
          mode={stockModal.mode}
          onClose={() => setStockModal(null)}
          onSubmit={(qty, note) => {
            const r =
              stockModal.mode === "ADD"
                ? addStock(stockModal.product.id, qty, note)
                : removeStock(stockModal.product.id, qty, note);
            if (r.ok) setStockModal(null);
            alert(r.message);
          }}
        />
      )}

      {editing && (
        <ProductModal
          product={editing}
          onClose={() => setEditing(null)}
          onSave={(data: any) => {
            if (editing.id) {
              updateProduct(editing.id, data);
            } else {
              addProduct({ ...data, stock_quantity: data.stock_quantity || 0, is_active: true } as any);
            }
            setEditing(null);
          }}
          onDelete={
            editing.id
              ? () => {
                  if (confirm("Deactivate this product?")) {
                    deleteProduct(editing.id);
                    setEditing(null);
                  }
                }
              : undefined
          }
        />
      )}

      {historyProduct && (
        <HistoryModal
          product={historyProduct}
          transactions={inventoryTransactions.filter((t) => t.product_id === historyProduct.id)}
          onClose={() => setHistoryProduct(null)}
        />
      )}
    </div>
  );
}

function StatBox({ label, value, icon: Icon, gradient }: any) {
  return (
    <div className="card-lift relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
      <div className={`absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br ${gradient} opacity-10 blur-2xl`} />
      <div className="relative flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</div>
          <div className="mt-2 truncate text-2xl font-extrabold text-slate-900">{value}</div>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-lg`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

function StockModal({
  product,
  mode,
  onClose,
  onSubmit,
}: {
  product: any;
  mode: "ADD" | "REMOVE";
  onClose: () => void;
  onSubmit: (qty: number, note: string) => void;
}) {
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  return (
    <Modal onClose={onClose} title={`${mode === "ADD" ? "Add Stock" : "Remove Stock"} — ${product.name}`}>
      <div className="space-y-3">
        <div className="rounded-lg bg-slate-50 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Current Stock</span>
            <span className="font-semibold">{product.stock_quantity}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">SKU</span>
            <span className="font-mono text-xs">{product.sku}</span>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Quantity</label>
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(Math.max(1, +e.target.value))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Note (optional)</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. New shipment, damaged, etc."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={() => onSubmit(qty, note)}
            className={`rounded-lg px-3 py-2 text-sm font-semibold text-white ${
              mode === "ADD" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
            }`}
          >
            {mode === "ADD" ? "Add Stock" : "Remove Stock"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ProductModal({ product, onClose, onSave, onDelete }: any) {
  const isNew = !product.id;
  const [form, setForm] = useState<any>({
    name: product.name || "",
    sku: product.sku || `SKU-${Date.now().toString().slice(-6)}`,
    qr_code: product.qr_code || "",
    category: product.category || "",
    selling_price: product.selling_price ?? 0,
    cost_price: product.cost_price ?? 0,
    stock_quantity: product.stock_quantity ?? 0,
    low_stock_threshold: product.low_stock_threshold ?? 5,
  });

  return (
    <Modal onClose={onClose} title={isNew ? "New Product" : `Edit — ${product.name}`}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Product Name" required>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="Category">
          <input
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="input"
            placeholder="e.g. Cricket, Footwear"
          />
        </Field>
        <Field label="SKU" required>
          <input
            value={form.sku}
            onChange={(e) => setForm({ ...form, sku: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="QR Code">
          <input
            value={form.qr_code}
            onChange={(e) => setForm({ ...form, qr_code: e.target.value })}
            placeholder="Auto-generated if blank"
            className="input"
          />
        </Field>
        <Field label="Selling Price (₹)" required>
          <input
            type="number"
            min={0}
            value={form.selling_price}
            onChange={(e) => setForm({ ...form, selling_price: +e.target.value })}
            className="input"
          />
        </Field>
        <Field label="Cost Price (₹)">
          <input
            type="number"
            min={0}
            value={form.cost_price}
            onChange={(e) => setForm({ ...form, cost_price: +e.target.value })}
            className="input"
          />
        </Field>
        {isNew && (
          <Field label="Initial Stock">
            <input
              type="number"
              min={0}
              value={form.stock_quantity}
              onChange={(e) => setForm({ ...form, stock_quantity: +e.target.value })}
              className="input"
            />
          </Field>
        )}
        <Field label="Low Stock Alert">
          <input
            type="number"
            min={0}
            value={form.low_stock_threshold}
            onChange={(e) => setForm({ ...form, low_stock_threshold: +e.target.value })}
            className="input"
          />
        </Field>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <div>
          {onDelete && (
            <button
              onClick={onDelete}
              className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
            >
              Deactivate
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={() => {
              if (!form.name || !form.sku) return alert("Name and SKU are required");
              onSave(form);
            }}
            className="rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-700"
          >
            {isNew ? "Create Product" : "Save Changes"}
          </button>
        </div>
      </div>
      <style>{`.input { width:100%; border-radius:0.5rem; border:1px solid #cbd5e1; padding:0.5rem 0.75rem; font-size:0.875rem; outline:none;} .input:focus { border-color:#f97316; box-shadow:0 0 0 2px #fed7aa; }`}</style>
    </Modal>
  );
}

function HistoryModal({ product, transactions, onClose }: any) {
  return (
    <Modal onClose={onClose} title={`Stock History — ${product.name}`}>
      {transactions.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-400">No transactions yet.</div>
      ) : (
        <div className="scroll-thin max-h-96 space-y-2 overflow-y-auto">
          {transactions.map((t: any) => (
            <div key={t.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                      t.type === "ADD"
                        ? "bg-emerald-100 text-emerald-700"
                        : t.type === "REMOVE"
                          ? "bg-rose-100 text-rose-700"
                          : t.type === "SALE"
                            ? "bg-sky-100 text-sky-700"
                            : t.type === "RETURN"
                              ? "bg-violet-100 text-violet-700"
                              : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {t.type}
                  </span>
                  <span className="text-sm font-semibold text-slate-900">
                    {t.type === "ADD" || t.type === "RETURN" ? "+" : "−"}
                    {t.quantity}
                  </span>
                  {t.note && <span className="text-xs text-slate-500">· {t.note}</span>}
                </div>
                <div className="text-xs text-slate-400">{formatDate(t.created_at)}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">
                  {t.previous_stock} → {t.new_stock}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function Field({ label, children, required }: any) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
        {label} {required && <span className="text-rose-500">*</span>}
      </span>
      {children}
    </label>
  );
}

export function Modal({ children, onClose, title, wide }: any) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className={`w-full ${wide ? "max-w-3xl" : "max-w-md"} rounded-2xl bg-white p-5 shadow-2xl`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
