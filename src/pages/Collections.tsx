import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth, useData } from "../store";
import {
  Wallet,
  Plus,
  Search,
  Clock,
  Eye,
  Trash2,
  Layers,
  TrendingUp,
  AlertCircle,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { formatCurrency } from "../utils/id";

export default function Collections() {
  const sessions = useData((s) => s.collectionSessions);
  const rows = useData((s) => s.collectionRows);
  const createCollectionSession = useData((s) => s.createCollectionSession);
  const deleteCollectionSession = useData((s) => s.deleteCollectionSession);
  const user = useAuth((s) => s.user);

  const [q, setQ] = useState("");
  const [newOpen, setNewOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!q) return sessions;
    const t = q.toLowerCase();
    return sessions.filter(
      (s) =>
        s.session_number.toLowerCase().includes(t) ||
        (s.title || "").toLowerCase().includes(t) ||
        s.collection_date.includes(t)
    );
  }, [sessions, q]);

  const summary = useMemo(() => {
    const open = sessions.filter((s) => s.status === "OPEN").length;
    const locked = sessions.filter((s) => s.status === "LOCKED").length;
    const totalCollected = sessions.reduce((sum, s) => sum + s.total_collected, 0);
    const pending = sessions.reduce(
      (sum, s) =>
        sum +
        rows
          .filter((r) => r.session_id === s.id && (r.status === "PENDING" || r.status === "UNPAID"))
          .reduce((a, r) => a + (r.amount_received || 0), 0),
      0
    );
    return { open, locked, totalCollected, pending };
  }, [sessions, rows]);

  return (
    <div className="space-y-6">
      {/* Hero - Dark luxury theme */}
      <div
        className="relative overflow-hidden rounded-3xl shadow-2xl"
        style={{ background: "#090A0D" }}
      >
        <div
          className="absolute inset-0 opacity-[0.045]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(198,161,91,.35) 1px, transparent 1px), linear-gradient(90deg, rgba(198,161,91,.35) 1px, transparent 1px)",
            backgroundSize: "30px 30px",
          }}
        />
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full blur-[120px]"
          style={{ background: "radial-gradient(circle, rgba(198,161,91,0.18), transparent 70%)" }} />
        <div className="absolute -bottom-28 -left-20 h-72 w-72 rounded-full blur-[110px]"
          style={{ background: "radial-gradient(circle, rgba(134,168,216,0.13), transparent 70%)" }} />

        <div className="relative p-7 lg:p-9">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#C6A15B]/30 bg-[#C6A15B]/10 px-3 py-1 text-xs font-bold tracking-wider text-[#EAD39A]">
                <Sparkles size={12} style={{ color: "#EAD39A" }} /> DAILY COLLECTION PRO
              </div>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[#F6F1E6] lg:text-[2.35rem]">
                Cash Collection Control Room
              </h1>
              <p className="mt-2 max-w-xl text-sm text-[#CBB893]">
                Premium daily collection operating system for wholesalers. Paste client names, collect in minutes, generate professional PDF reports.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setNewOpen(true)}
                className="group relative inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-extrabold text-[#15110a] shadow-xl transition hover:translate-y-[-1px]"
                style={{
                  background: "linear-gradient(135deg, #EAD39A 0%, #C6A15B 55%, #a67c3a 100%)",
                  boxShadow: "0 12px 34px -10px rgba(198,161,91,0.55)",
                }}
              >
                <Plus size={17} /> Start New Collection
                <div className="absolute inset-0 rounded-2xl bg-white/15 opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            </div>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <DCStat label="Open Sessions" value={summary.open.toString()} icon={Layers} accent="#86A8D8" />
            <DCStat label="Locked" value={summary.locked.toString()} icon={Clock} accent="#C6A15B" />
            <DCStat label="Total Collected" value={formatCurrency(summary.totalCollected)} icon={TrendingUp} accent="#92C99B" />
            <DCStat label="Pending Tracked" value={formatCurrency(summary.pending)} icon={AlertCircle} accent="#DB7777" />
          </div>
        </div>
      </div>

      {/* Search + list */}
      <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by session #, title, or date…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-9 pr-3 text-sm focus:border-amber-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
          </div>
          <div className="text-xs text-slate-500">
            {filtered.length} session{filtered.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* Sessions grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {filtered.map((s) => {
          const paidPct = s.total_clients > 0 ? Math.round((s.paid_clients / s.total_clients) * 100) : 0;
          return (
            <div
              key={s.id}
              className="group relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm transition hover:shadow-lg card-lift"
            >
              <div className="h-1.5 w-full" style={{
                background: s.status === "LOCKED"
                  ? "linear-gradient(90deg, #C6A15B, #EAD39A)"
                  : "linear-gradient(90deg, #86A8D8, #b4caec)"
              }} />
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {s.collection_date}
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${
                      s.status === "LOCKED"
                        ? "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
                        : "bg-sky-50 text-sky-800 ring-1 ring-sky-200"
                    }`}
                  >
                    {s.status}
                  </span>
                </div>

                <div className="mt-2 font-mono text-sm font-bold text-slate-900">{s.session_number}</div>
                <div className="truncate text-sm font-semibold text-slate-800">{s.title}</div>

                <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                  <Mini label="Clients" value={s.total_clients.toString()} />
                  <Mini label="Paid" value={s.paid_clients.toString()} tone="green" />
                  <Mini label="Pending" value={s.pending_clients.toString()} tone="amber" />
                </div>

                <div className="mt-4 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 p-3 ring-1 ring-slate-200/60">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Collected</div>
                  <div className="text-2xl font-extrabold text-slate-900">{formatCurrency(s.total_collected)}</div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${paidPct}%`,
                        background: "linear-gradient(90deg, #C6A15B, #EAD39A)",
                      }}
                    />
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">{paidPct}% collected</div>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <Link
                    to={`/collections/${s.id}`}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800"
                  >
                    <Eye size={14} /> Open Session <ChevronRight size={14} />
                  </Link>
                  <button
                    onClick={() => {
                      if (confirm("Delete this collection session? This cannot be undone.")) {
                        deleteCollectionSession(s.id);
                      }
                    }}
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-700">
              <Wallet size={22} />
            </div>
            <div className="font-bold text-slate-800">No collection sessions yet</div>
            <div className="mt-1 text-sm text-slate-500">Start your first daily collection to begin tracking payments.</div>
            <button
              onClick={() => setNewOpen(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white"
            >
              <Plus size={14} /> New Collection
            </button>
          </div>
        )}
      </div>

      {newOpen && (
        <NewCollectionModal
          onClose={() => setNewOpen(false)}
          onCreate={async (payload: any) => {
            const r = createCollectionSession({
              ...payload,
              created_by: user?.id || "system",
            });
            setNewOpen(false);
            if (r.ok && r.session_id) {
              window.location.href = `/collections/${r.session_id}`;
            } else {
              alert(r.message);
            }
          }}
        />
      )}
    </div>
  );
}

function DCStat({ label, value, icon: Icon, accent }: any) {
  return (
    <div
      className="rounded-2xl border bg-[#121419]/95 px-4 py-3"
      style={{ borderColor: "rgba(198,161,91,.22)" }}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#CBB893" }}>{label}</div>
          <div className="mt-1 text-lg font-extrabold text-[#F6F1E6]">{value}</div>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: `${accent}22`, color: accent }}>
          <Icon size={16} />
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value, tone }: any) {
  const tones: any = {
    green: "text-emerald-700 bg-emerald-50 ring-emerald-200",
    amber: "text-amber-700 bg-amber-50 ring-amber-200",
    default: "text-slate-700 bg-slate-50 ring-slate-200",
  };
  return (
    <div className={`rounded-lg px-2 py-2 ring-1 ${tones[tone || "default"]}`}>
      <div className="text-base font-extrabold">{value}</div>
      <div className="text-[9px] font-bold uppercase tracking-wider opacity-80">{label}</div>
    </div>
  );
}

function NewCollectionModal({ onClose, onCreate }: any) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [names, setNames] = useState(
    `Aarav Textiles
Mehta Fabrics
Royal Suiting
Khan Cloth Depot
Shree Ganesh Traders
Patel Brothers
`
  );

  const parsed = names
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const dedup = Array.from(new Set(parsed.map((n) => n.toLowerCase()))).length;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-[20px] border border-[#C6A15B]/25 bg-[#101217] text-[#EDE6D8] shadow-2xl">
        <div className="border-b border-[#C6A15B]/15 px-5 py-4" style={{ background: "#0d0f13" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold">
              <span className="rounded-lg px-2 py-1 text-[10px] uppercase tracking-wider" style={{ background: "#C6A15B", color: "#15110a" }}>Pro</span>
              <span className="text-[#EAD7B5]">New Daily Collection</span>
            </div>
            <button onClick={onClose} className="rounded-lg px-2 py-1 text-sm text-[#CBB893] hover:bg-white/5">✕</button>
          </div>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#C7B48A]">Collection Date</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-[#2b2f3a] bg-[#121419] px-3 py-2 text-sm text-[#EDE6D8] outline-none focus:border-[#C6A15B] focus:ring-2 focus:ring-[#C6A15B]/20"
              />
            </label>
            <label className="md:col-span-2 block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#C7B48A]">Title (optional)</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`Daily Collection – ${date}`}
                className="w-full rounded-xl border border-[#2b2f3a] bg-[#121419] px-3 py-2 text-sm text-[#EDE6D8] outline-none focus:border-[#C6A15B] focus:ring-2 focus:ring-[#C6A15B]/20"
              />
            </label>
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#C7B48A]">Paste client names (one per line)</span>
              <span className="rounded-full bg-[#1d212c] px-2.5 py-1 text-[11px] font-bold text-[#EAD39A] ring-1 ring-[#C6A15B]/25">
                {dedup} unique clients
              </span>
            </div>
            <textarea
              value={names}
              onChange={(e) => setNames(e.target.value)}
              rows={9}
              placeholder="Aarav Textiles
Mehta Fabrics
Royal Suiting
..."
              className="w-full resize-y rounded-2xl border border-[#2b2f3a] bg-[#0f1116] px-4 py-3 text-sm leading-6 text-[#EDE6D8] outline-none focus:border-[#C6A15B] focus:ring-2 focus:ring-[#C6A15B]/20"
              style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
            />
            <div className="mt-2 text-xs text-[#bda886]">
              Duplicates will be removed automatically. You can edit names later.
            </div>
          </div>

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-xl border border-[#2d313d] bg-[#181b24] px-4 py-2 text-sm font-bold text-[#d9cfb9] hover:bg-[#1d212c]"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (dedup === 0) {
                  alert("Please enter at least one client name");
                  return;
                }
                onCreate({
                  title: title || undefined,
                  collection_date: date,
                  names_raw: names,
                })
              }}
              disabled={dedup === 0}
              className="rounded-xl px-4 py-2 text-sm font-extrabold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: dedup > 0 ? "linear-gradient(135deg, #EAD39A, #C6A15B)" : "linear-gradient(135deg, #9b8866, #8b7856)",
                color: dedup > 0 ? "#14100b" : "#6b5f4a",
              }}
            >
              Generate Collection Sheet →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
