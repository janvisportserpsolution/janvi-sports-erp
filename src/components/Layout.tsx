import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Boxes,
  Receipt,
  Undo2,
  Users,
  BarChart3,
  Settings,
  LogOut,
  ScanLine,
  Menu,
  Bell,
  Search,
  Sparkles,
  Wallet,
  MessageSquare,
} from "lucide-react";
import { useState } from "react";
import { useAuth, useData } from "../store";
import { canAccessRoute, getRoleLabel } from "../rbac";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true, color: "from-violet-500 to-fuchsia-500" },
  { to: "/inventory", label: "Inventory", icon: Boxes, color: "from-sky-500 to-cyan-500" },
  { to: "/billing", label: "New Bill", icon: ScanLine, color: "from-orange-500 to-rose-500" },
  { to: "/invoices", label: "Invoices", icon: Receipt, color: "from-emerald-500 to-teal-500" },
  { to: "/returns", label: "Sales Returns", icon: Undo2, color: "from-rose-500 to-pink-500" },
  { to: "/customers", label: "Customers", icon: Users, color: "from-amber-500 to-orange-500" },
  { to: "/collections", label: "Daily Collection", icon: Wallet, color: "from-yellow-500 to-amber-600", badge: "Pro" },
  { to: "/reports", label: "Reports", icon: BarChart3, color: "from-indigo-500 to-violet-500" },
  { to: "/statements", label: "Statements", icon: MessageSquare, color: "from-emerald-500 to-teal-500" },
  { to: "/settings", label: "Settings", icon: Settings, color: "from-orange-500 to-rose-500", important: true },
];

export default function Layout() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const products = useData((s) => s.products);
  const lowStock = products.filter((p) => p.is_active && p.stock_quantity <= p.low_stock_threshold).length;
  const visibleNav = nav.filter((item) => canAccessRoute(user, item.to));
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 transform border-r border-slate-200/60 bg-white/95 shadow-xl backdrop-blur-xl transition-transform lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand */}
        <div className="relative overflow-hidden border-b border-slate-200/60">
          <div className="bg-mesh absolute inset-0 opacity-90" />
          <div className="bg-dots absolute inset-0 opacity-30" />
          <div className="relative flex h-24 items-center gap-3 px-5">
            <div className="relative">
              <div className="absolute inset-0 animate-pulse-soft rounded-2xl bg-gradient-to-br from-orange-400 to-rose-500 blur-md" />
              <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 text-xl font-extrabold text-white shadow-xl ring-2 ring-white/20">
                J
              </div>
            </div>
            <div>
              <div className="text-base font-extrabold tracking-tight text-white">JANVI SPORTS</div>
              <div className="flex items-center gap-1 text-[11px] font-medium text-white/70">
                <Sparkles size={10} className="text-yellow-300" /> ERP System · v1
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 p-3">
          {visibleNav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  isActive
                    ? "bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-lg"
                    : "text-slate-700 hover:bg-slate-100"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <div
                      className={`absolute -left-1 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b ${n.color}`}
                    />
                  )}
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                      isActive
                        ? `bg-gradient-to-br ${n.color} text-white shadow-md`
                        : n.important
                          ? "bg-orange-100 text-orange-600 group-hover:bg-orange-200"
                          : "bg-slate-100 text-slate-600 group-hover:bg-white"
                    }`}
                  >
                    <n.icon size={16} />
                  </div>
                  <span className="flex-1">{n.label}</span>
                  {(n as any).badge && (
                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide ${isActive ? "bg-amber-300 text-slate-900" : "bg-amber-100 text-amber-800"}`}>
                      {(n as any).badge}
                    </span>
                  )}
                  {n.important && !isActive && (
                    <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide text-orange-700">Important</span>
                  )}
                  {n.to === "/inventory" && lowStock > 0 && (
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      isActive ? "bg-white/20 text-white" : "bg-amber-100 text-amber-700"
                    }`}>
                      {lowStock}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}

          <div className="my-3 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
        </nav>

        {/* Promo card */}
        <div className="px-3">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 via-rose-500 to-fuchsia-600 p-4 text-white shadow-lg">
            <div className="bg-dots absolute inset-0 opacity-30" />
            <div className="relative">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
                <Sparkles size={12} className="text-yellow-200" /> Quick Tip
              </div>
              <p className="text-xs leading-relaxed text-white/90">
                Press <kbd className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-bold">Scan</kbd> on any page to quickly look up products.
              </p>
            </div>
          </div>
        </div>

        {/* User */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200/60 bg-white/80 p-3 backdrop-blur-xl">
          <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100 p-3 ring-1 ring-slate-200/50">
            <div className="relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-sm font-bold text-white shadow-md">
                {user?.name?.[0] ?? "U"}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="truncate text-sm font-bold text-slate-900">{user?.name}</div>
              <div className="truncate text-[11px] text-slate-500">{user?.email || user?.mobile}</div>
              <div className="truncate text-[10px] font-semibold uppercase tracking-wide text-orange-600">
                {user?.role ? getRoleLabel(user.role) : "User"}
              </div>
            </div>
            <button
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="rounded-lg p-2 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200/60 bg-white/70 px-4 backdrop-blur-xl lg:px-6">
          <div className="flex flex-1 items-center gap-3">
            <button
              onClick={() => setOpen(true)}
              className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 lg:hidden"
            >
              <Menu size={20} />
            </button>
            <div className="relative hidden max-w-md flex-1 md:block">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                placeholder="Quick search (try product name or invoice #)..."
                className="w-full rounded-xl border border-slate-200 bg-white/80 py-2 pl-9 pr-3 text-sm placeholder-slate-400 focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-200"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const v = (e.target as HTMLInputElement).value.trim();
                    if (v.toUpperCase().startsWith("INV-")) navigate("/invoices");
                    else if (v) navigate(`/inventory`);
                  }
                }}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100" title="Notifications">
              <Bell size={18} />
              {lowStock > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                  {lowStock}
                </span>
              )}
            </button>
            {canAccessRoute(user, "/billing") && (
              <button
                onClick={() => navigate("/billing")}
                className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-orange-500 to-rose-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-orange-500/30 transition hover:shadow-xl hover:shadow-orange-500/40"
              >
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
                <ScanLine size={16} /> New Bill
              </button>
            )}
          </div>
        </header>

        <main className="scroll-thin min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="animate-slide-up">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
