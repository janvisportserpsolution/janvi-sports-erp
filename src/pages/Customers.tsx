import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useData } from "../store";
import {
  Search,
  UserPlus,
  Phone,
  MapPin,
  Wallet,
  Edit2,
  Trash2,
  X,
} from "lucide-react";
import { formatCurrency, formatShortDate } from "../utils/id";

export default function Customers() {
  const customers = useData((s) => s.customers);
  const addCustomer = useData((s) => s.addCustomer);
  const updateCustomer = useData((s) => s.updateCustomer);
  const deleteCustomer = useData((s) => s.deleteCustomer);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<any | null>(null);

  const filtered = useMemo(() => {
    if (!q) return customers;
    const s = q.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        c.mobile.includes(s) ||
        c.address.toLowerCase().includes(s)
    );
  }, [customers, q]);

  const stats = useMemo(() => {
    return {
      total: customers.length,
      outstanding: customers.reduce((s, c) => s + c.credit_balance, 0),
      owing: customers.filter((c) => c.credit_balance > 0).length,
    };
  }, [customers]);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 via-orange-600 to-rose-600 p-6 text-white shadow-xl sm:p-8">
        <div className="bg-dots absolute inset-0 opacity-20" />
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-yellow-300/30 blur-3xl" />
        <div className="absolute -bottom-16 -left-10 h-56 w-56 rounded-full bg-pink-400/30 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-md">
              <UserPlus size={12} /> Customer Management
            </div>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Customers</h1>
            <p className="mt-1 text-sm text-white/80">Manage customer accounts and ledgers</p>
          </div>
          <button
            onClick={() => setEditing({})}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-orange-700 shadow-lg transition hover:shadow-xl"
          >
            <UserPlus size={16} /> New Customer
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Total Customers" value={stats.total.toString()} gradient="from-sky-500 to-blue-600" icon={UserPlus} />
        <Stat label="With Outstanding" value={stats.owing.toString()} gradient="from-amber-500 to-orange-600" icon={Wallet} />
        <Stat label="Total Outstanding" value={formatCurrency(stats.outstanding)} gradient="from-rose-500 to-pink-600" icon={Wallet} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, mobile, or address..."
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((c, idx) => {
          const gradients = [
            "from-orange-400 to-rose-500",
            "from-sky-400 to-blue-500",
            "from-emerald-400 to-teal-500",
            "from-violet-400 to-fuchsia-500",
            "from-amber-400 to-orange-500",
            "from-pink-400 to-rose-500",
          ];
          const g = gradients[idx % gradients.length];
          return (
          <div
            key={c.id}
            className="card-lift relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm"
          >
            <div className={`absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${g} opacity-10 blur-2xl`} />
            <div className="relative flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${g} text-lg font-extrabold text-white shadow-lg`}>
                  {c.name[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-bold text-slate-900">{c.name}</div>
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Phone size={11} /> {c.mobile}
                  </div>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setEditing(c)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100">
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={() => {
                    if (c.id === customers[0]?.id) return alert("Cannot delete default customer");
                    if (c.credit_balance > 0) return alert("Cannot delete customer with outstanding balance");
                    if (confirm(`Delete ${c.name}?`)) deleteCustomer(c.id);
                  }}
                  className="rounded p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
                  disabled={c.id === customers[0]?.id}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {c.address && (
              <div className="mt-3 flex items-start gap-2 text-xs text-slate-600">
                <MapPin size={12} className="mt-0.5 flex-shrink-0 text-slate-400" />
                <span className="line-clamp-2">{c.address}</span>
              </div>
            )}

            <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Outstanding</div>
              <div className={`text-base font-bold ${c.credit_balance > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                {formatCurrency(c.credit_balance)}
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <div className="text-[11px] text-slate-400">Joined {formatShortDate(c.created_at)}</div>
              <Link
                to={`/customers/${c.id}`}
                className="rounded-lg bg-gradient-to-r from-slate-900 to-slate-800 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:from-orange-600 hover:to-rose-600"
              >
                View Ledger →
              </Link>
            </div>
          </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full py-10 text-center text-sm text-slate-400">No customers found.</div>
        )}
      </div>

      {editing && (
        <CustomerModal
          customer={editing}
          onClose={() => setEditing(null)}
          onSave={(data: any) => {
            if (editing.id) updateCustomer(editing.id, data);
            else addCustomer(data);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, gradient, icon: Icon }: any) {
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

function CustomerModal({ customer, onClose, onSave }: any) {
  const isNew = !customer.id;
  const [form, setForm] = useState({
    name: customer.name || "",
    mobile: customer.mobile || "",
    email: customer.email || "",
    address: customer.address || "",
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{isNew ? "New Customer" : "Edit Customer"}</h3>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Name *</span>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Mobile *</span>
            <input
              value={form.mobile}
              onChange={(e) => setForm({ ...form, mobile: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Email</span>
            <input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Address</span>
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={() => {
              if (!form.name || !form.mobile) return alert("Name and mobile required");
              if (!/^\d{10}$/.test(form.mobile)) return alert("Mobile must be 10 digits");
              onSave(form);
            }}
            className="rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-700"
          >
            {isNew ? "Create" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
