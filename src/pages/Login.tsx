import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../store";
import {
  LogIn,
  ShieldCheck,
  Sparkles,
  Boxes,
  Receipt,
  Users,
  BarChart3,
  TrendingUp,
} from "lucide-react";

export default function Login() {
  const login = useAuth((s) => s.login);
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const r = await login(email.trim(), password);
      if (r.ok) navigate("/");
      else setError(r.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      {/* Left visual side */}
      <div className="bg-mesh relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex">
        <div className="bg-dots absolute inset-0 opacity-30" />
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-gradient-to-br from-orange-400/60 to-rose-500/60 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-gradient-to-br from-violet-500/50 to-fuchsia-500/50 blur-3xl" />

        {/* Floating decorative cards */}
        <div className="animate-float pointer-events-none absolute right-12 top-32 w-48 rotate-6 rounded-2xl bg-white/15 p-3 backdrop-blur-md ring-1 ring-white/20">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-400/30 text-emerald-200">
              <TrendingUp size={14} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-white/70">Sales Today</div>
              <div className="text-sm font-bold">₹24,500</div>
            </div>
          </div>
        </div>

        <div className="animate-float pointer-events-none absolute bottom-44 right-20 w-52 -rotate-3 rounded-2xl bg-white/15 p-3 backdrop-blur-md ring-1 ring-white/20" style={{ animationDelay: "1s" }}>
          <div className="flex items-center justify-between">
            <div className="text-xs">
              <div className="font-bold">INV-2026-00128</div>
              <div className="text-white/70">Rahul Sharma</div>
            </div>
            <div className="rounded-full bg-emerald-400/40 px-2 py-0.5 text-[10px] font-bold">PAID</div>
          </div>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 animate-pulse-soft rounded-2xl bg-orange-400 blur-md" />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 text-2xl font-extrabold shadow-2xl ring-2 ring-white/30">
                J
              </div>
            </div>
            <div>
              <div className="text-xl font-extrabold tracking-tight">JANVI SPORTS</div>
              <div className="flex items-center gap-1 text-xs text-white/80">
                <Sparkles size={10} className="text-yellow-300" /> ERP System · V1
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-md">
            <Sparkles size={12} className="text-yellow-300" /> Powered by modern tech
          </div>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight lg:text-5xl">
            Run your store with{" "}
            <span className="bg-gradient-to-r from-yellow-300 via-orange-300 to-rose-300 bg-clip-text text-transparent">
              clarity
            </span>
            <br />& confidence.
          </h1>
          <p className="max-w-md text-white/85">
            Centralized inventory, lightning-fast billing, customer ledgers, and powerful reports — all in one place.
          </p>

          <div className="grid grid-cols-2 gap-3 pt-2">
            {[
              { t: "Inventory", d: "QR-based stock", icon: Boxes, c: "from-sky-400 to-cyan-400" },
              { t: "Billing", d: "Atomic invoices", icon: Receipt, c: "from-emerald-400 to-teal-400" },
              { t: "Customers", d: "Live ledger", icon: Users, c: "from-amber-400 to-orange-400" },
              { t: "Reports", d: "Profit insights", icon: BarChart3, c: "from-violet-400 to-fuchsia-400" },
            ].map((f) => (
              <div
                key={f.t}
                className="card-lift group relative overflow-hidden rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md"
              >
                <div className={`mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${f.c} text-white shadow-lg`}>
                  <f.icon size={16} />
                </div>
                <div className="font-bold">{f.t}</div>
                <div className="text-xs text-white/70">{f.d}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-2 text-xs text-white/70">
          <ShieldCheck size={14} /> Secure · JWT Auth · Transaction Safe · 100% Reliable
        </div>
      </div>

      {/* Right form side */}
      <div className="relative flex items-center justify-center p-8">
        <div className="bg-grid absolute inset-0 opacity-50" />
        <div className="absolute right-10 top-10 h-40 w-40 rounded-full bg-gradient-to-br from-orange-200/60 to-rose-200/60 blur-3xl" />
        <div className="absolute bottom-10 left-10 h-48 w-48 rounded-full bg-gradient-to-br from-violet-200/60 to-fuchsia-200/60 blur-3xl" />

        <div className="relative w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 text-xl font-extrabold text-white shadow-lg">
                J
              </div>
              <div>
                <div className="text-lg font-extrabold tracking-tight text-slate-900">JANVI SPORTS</div>
                <div className="text-xs text-slate-500">ERP System · V1</div>
              </div>
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700 ring-1 ring-orange-200">
            <Sparkles size={11} /> Welcome back
          </div>
          <h2 className="mt-3 text-3xl font-extrabold text-slate-900">Sign in to your store</h2>
          <p className="mt-1 text-sm text-slate-500">Use your email address and password to continue.</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-100"
                placeholder="name@company.com"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-100"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-4 py-3 text-sm font-bold text-white shadow-xl transition hover:shadow-2xl"
            >
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              <LogIn size={16} /> {isSubmitting ? "Signing in..." : "Sign In"}
            </button>

          </form>
        </div>
      </div>
    </div>
  );
}
