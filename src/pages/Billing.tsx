import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useData } from "../store";
import {
  ScanLine,
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  User,
  Save,
  Printer,
  X,
  Check,
} from "lucide-react";
import QrScanner from "../components/QrScanner";
import { formatCurrency } from "../utils/id";
import type { CartItem } from "../types";

export default function Billing() {
  const products = useData((s) => s.products);
  const customers = useData((s) => s.customers);
  const createInvoice = useData((s) => s.createInvoice);
  const user = useAuth((s) => s.user);
  const navigate = useNavigate();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState<string>(customers[0]?.id || "");
  const [search, setSearch] = useState("");
  const [discount, setDiscount] = useState(0);
  const [amountPaid, setAmountPaid] = useState(0);
  const [scanOpen, setScanOpen] = useState(false);
  const [custModalOpen, setCustModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const filteredProducts = useMemo(() => {
    if (!search) return products.filter((p) => p.is_active).slice(0, 20);
    const s = search.toLowerCase();
    return products
      .filter((p) => p.is_active)
      .filter(
        (p) =>
          p.name.toLowerCase().includes(s) ||
          p.sku.toLowerCase().includes(s) ||
          p.qr_code.toLowerCase().includes(s)
      );
  }, [products, search]);

  const subtotal = cart.reduce((s, c) => s + c.quantity * c.unit_price, 0);
  const grandTotal = Math.max(0, subtotal - discount);
  const balance = Math.max(0, grandTotal - amountPaid);

  const addToCart = (productId: string) => {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    setCart((c) => {
      const existing = c.find((x) => x.product_id === productId);
      if (existing) {
        if (existing.quantity + 1 > p.stock_quantity) {
          alert(`Only ${p.stock_quantity} units available`);
          return c;
        }
        return c.map((x) =>
          x.product_id === productId ? { ...x, quantity: x.quantity + 1 } : x
        );
      }
      if (p.stock_quantity < 1) {
        alert("Out of stock");
        return c;
      }
      return [
        ...c,
        {
          product_id: p.id,
          product_name: p.name,
          sku: p.sku,
          quantity: 1,
          unit_price: p.selling_price,
          cost_price: p.cost_price,
          available_stock: p.stock_quantity,
        },
      ];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart((c) =>
      c
        .map((x) => {
          if (x.product_id !== productId) return x;
          const nq = x.quantity + delta;
          if (nq <= 0) return null;
          if (nq > x.available_stock) {
            alert(`Only ${x.available_stock} units available`);
            return x;
          }
          return { ...x, quantity: nq };
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeItem = (productId: string) =>
    setCart((c) => c.filter((x) => x.product_id !== productId));

  const updatePrice = (productId: string, price: number) =>
    setCart((c) => c.map((x) => (x.product_id === productId ? { ...x, unit_price: Math.max(0, price) } : x)));

  const onScan = (code: string) => {
    const found = products.find((p) => p.sku === code || p.qr_code === code);
    if (found) addToCart(found.id);
    else alert(`No product found for code: ${code}`);
  };

  const submit = (printAfter = false) => {
    if (!customerId) return alert("Please select a customer");
    if (cart.length === 0) return alert("Cart is empty");
    setBusy(true);
    const r = createInvoice({
      customer_id: customerId,
      items: cart.map((c) => ({ product_id: c.product_id, quantity: c.quantity, unit_price: c.unit_price })),
      discount,
      amount_paid: amountPaid,
      created_by: user?.id || "system",
    });
    setBusy(false);
    if (!r.ok) return alert(r.message);
    if (printAfter) navigate(`/invoices/${r.invoice!.id}?print=1`);
    else navigate(`/invoices/${r.invoice!.id}`);
  };

  return (
    <div className="grid h-full min-h-[calc(100vh-7rem)] grid-cols-1 gap-4 lg:grid-cols-[1fr_420px]">
      {/* Products */}
      <div className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products by name, SKU or scan QR..."
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
              />
            </div>
            <button
              onClick={() => setScanOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <ScanLine size={16} /> Scan
            </button>
          </div>
        </div>

        <div className="scroll-thin grid flex-1 grid-cols-2 gap-3 overflow-y-auto p-4 sm:grid-cols-3 xl:grid-cols-4">
          {filteredProducts.map((p, idx) => {
            const gradients = [
              "from-orange-400 to-rose-500",
              "from-sky-400 to-cyan-500",
              "from-emerald-400 to-teal-500",
              "from-violet-400 to-fuchsia-500",
              "from-amber-400 to-orange-500",
              "from-pink-400 to-rose-500",
              "from-indigo-400 to-violet-500",
              "from-teal-400 to-emerald-500",
            ];
            const g = gradients[idx % gradients.length];
            return (
            <button
              key={p.id}
              onClick={() => addToCart(p.id)}
              className="card-lift group relative flex flex-col items-start overflow-hidden rounded-2xl border border-slate-200/60 bg-white p-3 text-left shadow-sm"
            >
              <div className={`relative flex h-24 w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br ${g} text-white shadow-md`}>
                <div className="bg-dots absolute inset-0 opacity-30" />
                <span className="relative text-3xl font-extrabold drop-shadow">
                  {p.name.split(" ").slice(0, 2).map((w) => w[0]).join("")}
                </span>
                <div className="absolute right-2 top-2 rounded-full bg-white/20 px-1.5 py-0.5 text-[9px] font-bold uppercase backdrop-blur-md">
                  {p.category?.slice(0, 6) || "Item"}
                </div>
              </div>
              <div className="mt-2 line-clamp-2 text-sm font-bold text-slate-900 group-hover:text-orange-700">
                {p.name}
              </div>
              <div className="font-mono text-[10px] text-slate-500">{p.sku}</div>
              <div className="mt-1.5 flex w-full items-center justify-between">
                <span className="font-extrabold text-orange-700">{formatCurrency(p.selling_price)}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    p.stock_quantity <= p.low_stock_threshold
                      ? "bg-amber-100 text-amber-700"
                      : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {p.stock_quantity}
                </span>
              </div>
            </button>
            );
          })}
          {filteredProducts.length === 0 && (
            <div className="col-span-full py-16 text-center text-sm text-slate-400">
              No products match your search.
            </div>
          )}
        </div>
      </div>

      {/* Cart */}
      <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-lg">
        <div className="relative overflow-hidden border-b border-slate-100 bg-gradient-to-br from-orange-500 via-rose-500 to-fuchsia-600 p-4 text-white">
          <div className="bg-dots absolute inset-0 opacity-25" />
          <div className="relative mb-3 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md">
              <ShoppingCart size={16} />
            </div>
            <h2 className="text-base font-extrabold">Current Bill</h2>
            <span className="ml-auto rounded-full bg-white/25 px-2.5 py-0.5 text-xs font-bold backdrop-blur-md">
              {cart.length} item{cart.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="relative flex items-center gap-2">
            <div className="relative flex-1">
              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full appearance-none rounded-xl border-0 bg-white/95 py-2.5 pl-9 pr-3 text-sm font-semibold text-slate-900 shadow-md focus:outline-none focus:ring-2 focus:ring-white"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.mobile}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => setCustModalOpen(true)}
              className="rounded-xl bg-white/20 px-2.5 py-2.5 text-white backdrop-blur-md transition hover:bg-white/30"
              title="New customer"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-3">
          {cart.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center py-12 text-center text-sm text-slate-400">
              <ShoppingCart size={36} className="mb-2 text-slate-300" />
              <div>Cart is empty</div>
              <div className="text-xs">Search or scan a product to start</div>
            </div>
          ) : (
            <div className="space-y-2">
              {cart.map((it) => (
                <div key={it.product_id} className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-slate-900">{it.product_name}</div>
                      <div className="text-[11px] text-slate-500">{it.sku}</div>
                    </div>
                    <button
                      onClick={() => removeItem(it.product_id)}
                      className="rounded p-1 text-rose-500 hover:bg-rose-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white">
                      <button
                        onClick={() => updateQty(it.product_id, -1)}
                        className="px-2 py-1 text-slate-600 hover:bg-slate-100"
                      >
                        <Minus size={12} />
                      </button>
                      <input
                        type="number"
                        value={it.quantity}
                        onChange={(e) => {
                          const n = Math.max(1, +e.target.value);
                          setCart((c) =>
                            c.map((x) =>
                              x.product_id === it.product_id
                                ? { ...x, quantity: Math.min(n, x.available_stock) }
                                : x
                            )
                          );
                        }}
                        className="w-12 border-x border-slate-200 py-1 text-center text-sm font-semibold focus:outline-none"
                      />
                      <button
                        onClick={() => updateQty(it.product_id, 1)}
                        className="px-2 py-1 text-slate-600 hover:bg-slate-100"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    <input
                      type="number"
                      value={it.unit_price}
                      onChange={(e) => updatePrice(it.product_id, +e.target.value)}
                      className="w-24 rounded-md border border-slate-200 px-2 py-1 text-right text-sm focus:outline-none"
                    />
                    <div className="w-20 text-right font-semibold text-slate-900">
                      {formatCurrency(it.quantity * it.unit_price)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
          <div className="space-y-2 text-sm">
            <Row label="Subtotal" value={formatCurrency(subtotal)} />
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">Discount</span>
              <input
                type="number"
                min={0}
                value={discount}
                onChange={(e) => setDiscount(Math.max(0, +e.target.value))}
                className="w-28 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-right text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
              />
            </div>
            <div className="relative my-2 overflow-hidden rounded-xl bg-gradient-to-br from-orange-500 via-rose-500 to-fuchsia-600 p-3 text-white shadow-md">
              <div className="bg-dots absolute inset-0 opacity-25" />
              <div className="relative flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider opacity-90">Grand Total</span>
                <span className="text-2xl font-extrabold">{formatCurrency(grandTotal)}</span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">Amount Paid</span>
              <input
                type="number"
                min={0}
                value={amountPaid}
                onChange={(e) => setAmountPaid(Math.max(0, +e.target.value))}
                className="w-28 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-right text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
              />
            </div>
            <Row
              label="Balance"
              value={formatCurrency(balance)}
              valueClass={balance > 0 ? "text-rose-700 font-bold" : "text-emerald-700 font-semibold"}
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => submit(false)}
              disabled={busy || cart.length === 0}
              className="group relative inline-flex items-center justify-center gap-1.5 overflow-hidden rounded-xl bg-gradient-to-r from-orange-500 to-rose-600 px-3 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/30 transition hover:shadow-orange-500/50 disabled:opacity-50"
            >
              <Save size={16} /> Save Bill
            </button>
            <button
              onClick={() => submit(true)}
              disabled={busy || cart.length === 0}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 px-3 py-3 text-sm font-bold text-white shadow-lg transition hover:shadow-xl disabled:opacity-50"
            >
              <Printer size={16} /> Save & Print
            </button>
          </div>
        </div>
      </div>

      <QrScanner open={scanOpen} onClose={() => setScanOpen(false)} onScan={onScan} />

      {custModalOpen && (
        <NewCustomerModal
          onClose={() => setCustModalOpen(false)}
          onCreate={(data: any) => {
            const c = useData.getState().addCustomer(data);
            setCustomerId(c.id);
            setCustModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

function Row({ label, value, valueClass }: any) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={valueClass || "text-slate-900 font-semibold"}>{value}</span>
    </div>
  );
}

function NewCustomerModal({ onClose, onCreate }: any) {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">New Customer</h3>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3">
          <Input label="Name *" value={name} onChange={setName} placeholder="Customer name" />
          <Input label="Mobile *" value={mobile} onChange={setMobile} placeholder="10-digit mobile" />
          <Input label="Address" value={address} onChange={setAddress} placeholder="City / Address" />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={() => {
              if (!name || !mobile) return alert("Name and mobile required");
              if (!/^\d{10}$/.test(mobile)) return alert("Mobile must be 10 digits");
              onCreate({ name, mobile, address, credit_balance: 0 });
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-700"
          >
            <Check size={14} /> Create & Select
          </button>
        </div>
      </div>
    </div>
  );
}

export function Input({ label, value, onChange, placeholder, type = "text" }: any) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
      />
    </label>
  );
}
