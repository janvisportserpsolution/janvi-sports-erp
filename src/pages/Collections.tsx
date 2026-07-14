import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  X,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { formatCurrency } from "../utils/id";

type ToastType = "success" | "error" | "warning";
type ToastItem = { id: string; type: ToastType; title: string; message?: string };

export default function Collections() {
  const navigate = useNavigate();
  const sessions = useData((s) => s.collectionSessions);
  const rows = useData((s) => s.collectionRows);
  const cashReady = useData((s) => s.cashCollectionsReady);
  const cashSyncedAt = useData((s) => s.cash_last_synced_at);
  const syncReady = useData((s) => s.syncReady);
  const createCollectionSession = useData((s) => s.createCollectionSession);
  const deleteCollectionSession = useData((s) => s.deleteCollectionSession);
  const unlockCollectionSession = useData((s) => s.unlockCollectionSession);
  const user = useAuth((s) => s.user);

  const [q, setQ] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const pushToast = (t: Omit<ToastItem, "id">) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { ...t, id }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, t.type === "success" ? 4200 : 5500);
  };
  const dismissToast = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

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

  // Creates the session and returns a result the modal can render a success state from.
  // Reads straight from the store's live state so we don't rely on a stale closure.
  const handleCreate = (payload: any) => {
    const r = createCollectionSession({
      ...payload,
      created_by: user?.id || "system",
    });
    if (r.ok && r.session_id) {
      const created = useData.getState().collectionSessions.find((s) => s.id === r.session_id);
      return { ok: true as const, session: created };
    }
    pushToast({ type: "error", title: "Couldn't create collection", message: r.message || "Please try again." });
    return { ok: false as const, message: r.message };
  };

  const handleDelete = (id: string, label: string) => {
    if (!confirm("Delete this collection session? This cannot be undone.")) return;
    deleteCollectionSession(id);
    pushToast({ type: "success", title: "Session deleted", message: label });
  };

  const handleReopen = (id: string, label: string) => {
    if (!confirm(`Reopen "${label}" for editing? It will move back to OPEN.`)) return;
    unlockCollectionSession(id);
    pushToast({ type: "success", title: "Session reopened", message: `${label} is editable again.` });
  };

  if (!syncReady || !cashReady) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-600">
        Loading daily collections...
        {cashSyncedAt && <div className="mt-2 text-xs text-slate-400">Last cloud sync: {cashSyncedAt}</div>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

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
                type="button"
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
              {cashSyncedAt && (
                <div className="ml-3 self-center text-xs text-slate-400">Last sync: {cashSyncedAt}</div>
              )}
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
                  {s.pdf_url && (
                    <div className="mt-2 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                      PDF stored
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <Link
                    to={`/collections/${s.id}`}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800"
                  >
                    <Eye size={14} /> Open Session <ChevronRight size={14} />
                  </Link>
                  {s.status === "LOCKED" && (
                    <button
                      type="button"
                      onClick={() => handleReopen(s.id, s.title || s.session_number)}
                      className="rounded-xl border border-slate-200 px-3 py-2.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600"
                      title="Reopen for editing"
                    >
                      <RotateCcw size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(s.id, s.title || s.session_number)}
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
              type="button"
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
          onCreate={handleCreate}
          onOpenNow={(sessionId: string) => {
            setNewOpen(false);
            navigate(`/collections/${sessionId}`);
          }}
        />
      )}

      <style>{`
        @keyframes toastIn { from { opacity: 0; transform: translateY(-8px) scale(.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes modalIn { from { opacity: 0; transform: translateY(10px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .animate-toast-in { animation: toastIn .22s ease-out; }
        .animate-modal-in { animation: modalIn .18s ease-out; }
      `}</style>
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

/**
 * Two-step flow:
 *  1. "form"    – paste names, pick date/title
 *  2. "success" – confirms creation, lets the user close and pick the session up
 *                 from its card ("Open Session"), or jump straight in.
 * The X button, Escape key, and backdrop click all reliably close the modal
 * (disabled only for the brief moment we're actually submitting).
 */
function NewCollectionModal({ onClose, onCreate, onOpenNow }: any) {
  const [step, setStep] = useState<"form" | "success">("form");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [names, setNames] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [createdSession, setCreatedSession] = useState<any>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  const parsed = names
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const dedup = Array.from(new Set(parsed.map((n) => n.toLowerCase()))).length;

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    firstInputRef.current?.focus();
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitting]);

  const handleSubmit = async () => {
    if (dedup === 0) {
      setErrorMsg("Please enter at least one client name.");
      return;
    }

    setErrorMsg("");
    setSubmitting(true);

    try {
      // Tiny, deliberate pause so the loading state reads as real work, not a flicker.
      await new Promise((resolve) => window.setTimeout(resolve, 320));
      const result = await Promise.resolve(
        onCreate({
          title: title || undefined,
          collection_date: date,
          names_raw: names,
        })
      );

      if (result.ok) {
        setCreatedSession(result.session);
        setStep("success");
      } else {
        setErrorMsg(result.message || "Something went wrong. Please try again.");
      }
    } catch (error) {
      console.error("Collection creation failed", error);
      setErrorMsg("Unable to create collection. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-[20px] border border-[#C6A15B]/25 bg-[#101217] text-[#EDE6D8] shadow-2xl animate-modal-in">
        <div className="border-b border-[#C6A15B]/15 px-5 py-4" style={{ background: "#0d0f13" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold">
              <span className="rounded-lg px-2 py-1 text-[10px] uppercase tracking-wider" style={{ background: "#C6A15B", color: "#15110a" }}>Pro</span>
              <span className="text-[#EAD7B5]">{step === "form" ? "New Daily Collection" : "Collection Created"}</span>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              aria-label="Close"
              className="rounded-lg p-1.5 text-[#CBB893] transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {step === "form" ? (
          <div className="p-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#C7B48A]">Collection Date</span>
                <input
                  ref={firstInputRef}
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
                placeholder="Enter client names, one per line"
                className="w-full resize-y rounded-2xl border border-[#2b2f3a] bg-[#0f1116] px-4 py-3 text-sm leading-6 text-[#EDE6D8] outline-none focus:border-[#C6A15B] focus:ring-2 focus:ring-[#C6A15B]/20"
                style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
              />
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-[#bda886]">Duplicates will be removed automatically. You can edit names later.</span>
                {errorMsg && (
                  <span className="flex items-center gap-1 font-bold text-rose-400">
                    <AlertTriangle size={12} /> {errorMsg}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="rounded-xl border border-[#2d313d] bg-[#181b24] px-4 py-2 text-sm font-bold text-[#d9cfb9] hover:bg-[#1d212c] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={dedup === 0 || submitting}
                className="inline-flex min-w-[210px] items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  background: dedup > 0 ? "linear-gradient(135deg, #EAD39A, #C6A15B)" : "linear-gradient(135deg, #9b8866, #8b7856)",
                  color: dedup > 0 ? "#14100b" : "#6b5f4a",
                }}
              >
                {submitting ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> Creating…
                  </>
                ) : (
                  <>Generate Collection Sheet →</>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center">
            <div
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: "rgba(146,201,155,0.14)", color: "#92C99B" }}
            >
              <CheckCircle2 size={28} />
            </div>
            <div className="mt-4 text-lg font-extrabold text-[#F6F1E6]">Collection sheet is ready</div>
            <p className="mx-auto mt-1 max-w-sm text-sm text-[#CBB893]">
              {createdSession?.session_number ? (
                <>
                  <span className="font-mono font-bold text-[#EAD39A]">{createdSession.session_number}</span> has been created with{" "}
                  <span className="font-bold text-[#EDE6D8]">{dedup}</span> client{dedup !== 1 ? "s" : ""}.
                </>
              ) : (
                "Your collection sheet has been created."
              )}
            </p>

            <div className="mx-auto mt-4 grid max-w-sm grid-cols-2 gap-3 text-left">
              <div className="rounded-xl border border-[#232735] bg-[#121419] px-3 py-2.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#C7B48A]">Date</div>
                <div className="mt-0.5 text-sm font-bold text-[#EDE6D8]">{createdSession?.collection_date || date}</div>
              </div>
              <div className="rounded-xl border border-[#232735] bg-[#121419] px-3 py-2.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#C7B48A]">Clients</div>
                <div className="mt-0.5 text-sm font-bold text-[#EDE6D8]">{createdSession?.total_clients ?? dedup}</div>
              </div>
            </div>

            <div className="mt-6 flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="w-full max-w-sm rounded-xl px-4 py-2.5 text-sm font-extrabold shadow-lg"
                style={{ background: "linear-gradient(135deg, #EAD39A, #C6A15B)", color: "#14100b" }}
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => createdSession?.id && onOpenNow(createdSession.id)}
                className="text-xs font-bold text-[#CBB893] underline decoration-dotted underline-offset-4 hover:text-[#EAD39A]"
              >
                or open it right now →
              </button>
              <p className="text-[11px] text-[#8b7a5c]">
                It's also waiting for you on the collections list — just tap "Open Session" on its card.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;
  const meta: Record<ToastType, { icon: any; color: string }> = {
    success: { icon: CheckCircle2, color: "#2f9e5c" },
    error: { icon: XCircle, color: "#dc4444" },
    warning: { icon: AlertTriangle, color: "#b8860b" },
  };
  return (
    <div className="fixed right-4 top-4 z-[80] flex w-[min(92vw,360px)] flex-col gap-2">
      {toasts.map((t) => {
        const { icon: Icon, color } = meta[t.type];
        return (
          <div
            key={t.id}
            className="animate-toast-in flex items-start gap-3 rounded-2xl border bg-white px-4 py-3 shadow-2xl"
            style={{ borderColor: `${color}40` }}
          >
            <div className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full" style={{ background: `${color}18`, color }}>
              <Icon size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-slate-900">{t.title}</div>
              {t.message && <div className="mt-0.5 text-xs leading-5 text-slate-500">{t.message}</div>}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              className="flex-none rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}