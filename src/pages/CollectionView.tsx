import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useData } from "../store";
import {
  ArrowLeft,
  Search,
  Download,
  Lock,
  Unlock,
  Save,
  Plus,
  Trash2,
  Check,
  Clock,
  IndianRupee,
  Users,
  X,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { formatCurrency } from "../utils/id";
import jsPDF from "jspdf";

type ToastType = "success" | "error" | "warning";
type ToastItem = { id: string; type: ToastType; title: string; message?: string };

export default function CollectionView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const allSessions = useData((s) => s.collectionSessions);
  const allRows = useData((s) => s.collectionRows);
  const syncReady = useData((s) => s.syncReady);

  const session = useMemo(() => allSessions.find((cs) => cs.id === id), [allSessions, id]);
  const rowsAll = useMemo(() => allRows.filter((r) => r.session_id === id), [allRows, id]);

  const updateRow = useData((s) => s.updateCollectionRow);
  const setPayment = useData((s) => s.setCollectionRowPayment);
  const lockSession = useData((s) => s.lockCollectionSession);
  const unlockSession = useData((s) => s.unlockCollectionSession);
  const deleteRow = useData((s) => s.deleteCollectionRow);
  const addRow = useData((s) => s.addCollectionRow);
  const postToLedger = useData((s) => s.postCollectionToLedger);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PAID" | "PENDING" | "UNPAID">("ALL");
  const [addingName, setAddingName] = useState("");
  const tableRef = useRef<HTMLDivElement>(null);

  // End-collection flow: confirm -> lock -> post to ERP -> toast -> auto-close.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [postFailed, setPostFailed] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  const pushToast = (t: Omit<ToastItem, "id">) => {
    const tid = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { ...t, id: tid }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== tid));
    }, t.type === "success" ? 4200 : 6000);
  };
  const dismissToast = (tid: string) => setToasts((prev) => prev.filter((t) => t.id !== tid));

  const rows = useMemo(() => {
    let r = [...rowsAll].sort((a, b) => a.serial - b.serial);
    if (q) {
      const s = q.toLowerCase();
      r = r.filter(
        (x) =>
          x.customer_name.toLowerCase().includes(s) ||
          (x.customer_mobile || "").includes(s) ||
          (x.notes || "").toLowerCase().includes(s)
      );
    }
    if (statusFilter !== "ALL") r = r.filter((x) => x.status === statusFilter);
    return r;
  }, [rowsAll, q, statusFilter]);

  const totals = useMemo(() => {
    const total = rowsAll.reduce((sum, r) => sum + (r.amount_received || 0), 0);
    const paid = rowsAll.filter((r) => r.status === "PAID").length;
    const pending = rowsAll.filter((r) => r.status === "PENDING" || r.status === "UNPAID").length;
    return { total, paid, pending, clients: rowsAll.length };
  }, [rowsAll]);

  if (!session && !syncReady) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-600">
        Loading collection session...
      </div>
    );
  }

  if (!session) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
        Session not found. <Link to="/collections" className="text-orange-700 underline">Back</Link>
      </div>
    );
  }

  const quickAdd = (amt: number, rowId: string) => {
    if (session.status === "LOCKED") return;
    const row = rowsAll.find((r) => r.id === rowId);
    if (!row) return;
    const newAmount = (row.amount_received || 0) + amt;
    setPayment(rowId, newAmount, newAmount > 0 ? "PAID" : "UNPAID");
  };

  // Rows created from a bulk name-paste never had due_date/notes touched, so
  // they can still be sitting in the database as `undefined` — and Firestore's
  // setDoc() rejects undefined field values outright. Scrub every row clean
  // right before we lock/post so old data can't trip this error anymore,
  // no matter when or how the row was originally created.
  const sanitizeRowsBeforePosting = async () => {
    const dirty = rowsAll.filter(
      (r) => r.due_date === undefined || r.due_date === null || r.notes === undefined || r.notes === null
    );
    if (dirty.length === 0) return;
    await Promise.all(
      dirty.map((r) =>
        Promise.resolve(
          updateRow(r.id, {
            due_date: r.due_date ?? "",
            notes: r.notes ?? "",
          })
        )
      )
    );
  };

  // Lock the session, post the collected amounts to the ERP ledger, confirm with
  // a toast, then close the session by navigating back to the list.
  //
  // `lockSession`/`postToLedger` might return a plain result object, a Promise
  // of one, or throw synchronously (Firestore throws sync on invalid-field
  // writes). We normalize all three cases here and use try/catch/finally so
  // `processing` can never get stuck at `true` — that was causing the modal
  // to hang on "Posting…" forever whenever the store call errored out instead
  // of resolving cleanly.
  const handleConfirmEnd = async () => {
    setProcessing(true);
    try {
      await sanitizeRowsBeforePosting();
      const lockRes = await Promise.resolve(lockSession(session.id));
      if (!lockRes?.ok) {
        pushToast({ type: "error", title: "Couldn't lock session", message: lockRes?.message || "Please try again." });
        return;
      }
      const postRes = await Promise.resolve(postToLedger(session.id));
      setConfirmOpen(false);
      if (postRes?.ok) {
        setPostFailed(false);
        pushToast({
          type: "success",
          title: "Posted to ERP Ledger",
          message: `${formatCurrency(totals.total)} across ${totals.paid} client${totals.paid !== 1 ? "s" : ""} is posted. Session locked and closing…`,
        });
        closeTimerRef.current = window.setTimeout(() => navigate("/collections"), 1800);
      } else {
        setPostFailed(true);
        pushToast({
          type: "warning",
          title: "Locked, but ERP posting failed",
          message: postRes?.message || "You can retry posting from the toolbar above.",
        });
      }
    } catch (err: any) {
      setPostFailed(true);
      pushToast({
        type: "error",
        title: "Something went wrong",
        message: err?.message || "The ERP post didn't go through. You can retry from the toolbar above.",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleRetryPost = async () => {
    setProcessing(true);
    try {
      await sanitizeRowsBeforePosting();
      const postRes = await Promise.resolve(postToLedger(session.id));
      if (postRes?.ok) {
        setPostFailed(false);
        pushToast({
          type: "success",
          title: "Posted to ERP Ledger",
          message: `${formatCurrency(totals.total)} is posted. Session closing…`,
        });
        closeTimerRef.current = window.setTimeout(() => navigate("/collections"), 1800);
      } else {
        pushToast({ type: "error", title: "Posting failed again", message: postRes?.message || "Please check your ERP connection." });
      }
    } catch (err: any) {
      pushToast({ type: "error", title: "Posting failed again", message: err?.message || "Please check your ERP connection." });
    } finally {
      setProcessing(false);
    }
  };

  const exportPDF = () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const w = doc.internal.pageSize.getWidth();
    let y = 44;

    // header - dark luxury style in PDF uses gold accent
    doc.setFillColor(9, 10, 13);
    doc.rect(0, 0, w, 86, "F");
    doc.setTextColor(234, 211, 154);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Daily Collection Pro", 40, 40);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(session.title || session.session_number, 40, 60);
    doc.setTextColor(234, 211, 154);
    doc.text(`Date: ${session.collection_date}`, w - 40, 40, { align: "right" });
    doc.text(`Total: ₹ ${totals.total.toLocaleString("en-IN")}`, w - 40, 58, { align: "right" });

    y = 106;
    // table header
    doc.setFillColor(245, 242, 236);
    doc.rect(40, y, w - 80, 20, "F");
    doc.setTextColor(70, 70, 70);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    const cols = [
      { label: "#", x: 50, a: "left" as const },
      { label: "Client", x: 80, a: "left" as const },
      { label: "Amount", x: 360, a: "right" as const },
      { label: "Status", x: 430, a: "left" as const },
      { label: "Due Date", x: 500, a: "left" as const },
      { label: "Notes", x: w - 50, a: "right" as const },
    ];
    cols.forEach((c) => doc.text(c.label, c.x, y + 13, { align: c.a }));
    y += 22;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    rowsAll
      .sort((a, b) => a.serial - b.serial)
      .forEach((r, i) => {
        if (y > 760) {
          doc.addPage();
          y = 48;
        }
        doc.text(String(i + 1), 50, y + 12);
        doc.text((r.customer_name || "").slice(0, 34), 80, y + 12);
        doc.text(formatCurrency(r.amount_received || 0), 360, y + 12, { align: "right" });
        doc.text(r.status, 430, y + 12);
        doc.text(r.due_date ? r.due_date : "-", 500, y + 12);
        doc.text((r.notes || "").slice(0, 26), w - 50, y + 12, { align: "right" });
        y += 18;
      });

    y += 12;
    doc.setDrawColor(210, 200, 178);
    doc.line(40, y, w - 40, y);
    y += 18;
    doc.setFont("helvetica", "bold");
    doc.text("Total Collected:", w - 190, y);
    doc.text(formatCurrency(totals.total), w - 50, y, { align: "right" });

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(130, 130, 130);
    doc.text(`Generated by Daily Collection Pro · ${new Date().toLocaleString("en-IN")}`, w / 2, 810, {
      align: "center",
    });

    doc.save(`${session.session_number}.pdf`);
  };

  return (
    <div
      className="min-h-[calc(100vh-6rem)] rounded-3xl"
      style={{ background: "#090A0D", color: "#EDE6D8" }}
    >
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <div className="border-b border-[#1b1f27] px-5 py-4 lg:px-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/collections"
              className="rounded-xl border border-[#232735] bg-[#121419] px-3 py-2 text-sm font-semibold text-[#CBB893] hover:bg-[#181c26]"
            >
              <ArrowLeft size={15} className="inline -mt-0.5 mr-1" /> Back
            </Link>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider" style={{ color: "#C6A15B" }}>
                {session.session_number} · {session.collection_date}
              </div>
              <div className="text-lg font-extrabold text-[#F6F1E6]">
                {session.title || "Daily Collection"}
                <span
                  className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase"
                  style={{
                    background: session.status === "LOCKED" ? "rgba(198,161,91,.18)" : "rgba(134,168,216,.18)",
                    color: session.status === "LOCKED" ? "#EAD39A" : "#A9C5EA",
                  }}
                >
                  {session.status}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={exportPDF}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#2b2f3a] bg-[#121419] px-3 py-2 text-xs font-bold text-[#EAD39A] hover:bg-[#181c26]"
            >
              <Download size={13} /> Download PDF
            </button>
            {session.status === "OPEN" ? (
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-extrabold shadow-md"
                style={{ background: "linear-gradient(135deg,#EAD39A,#C6A15B)", color: "#15110a" }}
              >
                <Lock size={13} /> End Collection
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => unlockSession(session.id)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#2b2f3a] bg-[#121419] px-3 py-2 text-xs font-bold text-[#CBB893] hover:bg-[#181c26]"
                >
                  <Unlock size={13} /> Unlock
                </button>
                {postFailed && (
                  <button
                    type="button"
                    onClick={handleRetryPost}
                    disabled={processing}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-60"
                    title="Retry posting collected amounts to ERP"
                  >
                    {processing ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                    Retry Posting to ERP
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Summary cards */}
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <DCSum label="Total Clients" value={totals.clients.toString()} icon={Users} />
          <DCSum label="Paid" value={totals.paid.toString()} icon={Check} tone="green" />
          <DCSum label="Pending" value={totals.pending.toString()} icon={Clock} tone="amber" />
          <DCSum label="Collected" value={formatCurrency(totals.total)} icon={IndianRupee} tone="gold" />
        </div>
      </div>

      {/* Toolbar */}
      <div className="border-b border-[#1b1f27] bg-[#0d0f14] px-5 py-3 lg:px-7">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#90784f" }} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search client, notes…"
              className="w-full rounded-xl border border-[#2b2f3a] bg-[#121419] py-2.5 pl-9 pr-3 text-sm text-[#EDE6D8] placeholder:text-[#8b7a5c] outline-none focus:border-[#C6A15B] focus:ring-2 focus:ring-[#C6A15B]/20"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            {(["ALL", "PAID", "PENDING", "UNPAID"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setStatusFilter(f)}
                className={`rounded-full px-3 py-1.5 transition ${
                  statusFilter === f
                    ? "bg-[#EAD39A] text-[#15110a]"
                    : "border border-[#2b2f3a] bg-[#121419] text-[#CBB893] hover:bg-[#181c26]"
                }`}
              >
                {f[0] + f.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div ref={tableRef} className="scroll-thin overflow-x-auto px-4 py-4 lg:px-7">
        <div
          className="overflow-hidden rounded-2xl border"
          style={{ borderColor: "#1e222c", background: "#101317" }}
        >
          <table className="min-w-full text-sm" style={{ color: "#EDE6D8" }}>
            <thead style={{ background: "#0c0e12", color: "#CBB893" }}>
              <tr className="text-[11px] uppercase tracking-wider">
                <th className="px-3 py-3 text-left font-bold">#</th>
                <th className="px-3 py-3 text-left font-bold">Client</th>
                <th className="px-3 py-3 text-right font-bold">Amount (₹)</th>
                <th className="px-3 py-3 text-left font-bold">Status</th>
                <th className="px-3 py-3 text-left font-bold">Due date</th>
                <th className="px-3 py-3 text-left font-bold">Notes</th>
                <th className="px-3 py-3 text-right font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-t"
                  style={{ borderColor: "#1c202a" }}
                >
                  <td className="px-3 py-[10px] text-sm text-[#CBB893]">{r.serial}</td>
                  <td className="px-3 py-[10px]">
                    <div className="font-semibold text-[#F6F1E6]">{r.customer_name}</div>
                    <div className="text-[11px] text-[#a38b63]">
                      {r.customer_mobile || "—"} {r.amount_expected ? `· O/s ${formatCurrency(r.amount_expected)}` : ""}
                    </div>
                  </td>
                  <td className="px-3 py-[10px] text-right">
                    <input
                      type="number"
                      min={0}
                      step="1"
                      disabled={session.status === "LOCKED"}
                      value={r.amount_received || ""}
                      onChange={(e) => {
                        const amt = Math.max(0, Number(e.target.value) || 0);
                        const newStatus = amt > 0 ? "PAID" : "UNPAID";
                        setPayment(r.id, amt, newStatus);
                      }}
                      placeholder="0"
                      className="w-28 rounded-lg border border-[#2b2f3a] bg-[#0e1015] px-2 py-1.5 text-right text-sm font-bold text-[#F6F1E6] outline-none focus:border-[#C6A15B] focus:ring-2 focus:ring-[#C6A15B]/20 disabled:opacity-60"
                    />
                    <div className="mt-1 flex justify-end gap-1 text-[10px]">
                      {[500, 1000, 5000].map((n) => (
                        <button
                          key={n}
                          type="button"
                          disabled={session.status === "LOCKED"}
                          onClick={() => quickAdd(n, r.id)}
                          className="rounded-md border border-[#2b2f3a] bg-[#141820] px-1.5 py-0.5 font-bold text-[#CBB893] hover:bg-[#1b202c] disabled:opacity-40"
                        >
                          +{n}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-[10px]">
                    <select
                      value={r.status}
                      disabled={session.status === "LOCKED"}
                      onChange={(e) =>
                        setPayment(r.id, r.amount_received || 0, e.target.value as any, r.due_date, r.notes)
                      }
                      className="rounded-lg border border-[#2b2f3a] bg-[#0e1015] px-2 py-1.5 text-xs font-bold text-[#EDE6D8] outline-none focus:border-[#C6A15B]"
                    >
                      <option value="PAID">Paid</option>
                      <option value="PENDING">Pending</option>
                      <option value="UNPAID">Unpaid</option>
                    </select>
                  </td>
                  <td className="px-3 py-[10px]">
                    <input
                      type="date"
                      disabled={session.status === "LOCKED"}
                      value={r.due_date || ""}
                      onChange={(e) => {
                        // Firestore's setDoc rejects `undefined` field values outright —
                        // write an empty string instead so clearing the date never fails.
                        updateRow(r.id, { due_date: e.target.value || "" });
                      }}
                      className="rounded-lg border border-[#2b2f3a] bg-[#0e1015] px-2 py-1.5 text-xs text-[#EDE6D8] outline-none focus:border-[#C6A15B]"
                    />
                  </td>
                  <td className="px-3 py-[10px]">
                    <input
                      disabled={session.status === "LOCKED"}
                      value={r.notes || ""}
                      onChange={(e) => updateRow(r.id, { notes: e.target.value })}
                      placeholder="Note"
                      className="w-44 rounded-lg border border-[#2b2f3a] bg-[#0e1015] px-2 py-1.5 text-xs text-[#EDE6D8] outline-none focus:border-[#C6A15B]"
                    />
                  </td>
                  <td className="px-3 py-[10px] text-right">
                    <button
                      type="button"
                      disabled={session.status === "LOCKED"}
                      onClick={() => deleteRow(r.id)}
                      className="rounded-lg p-1.5 text-[#9a8870] hover:bg-[#1b1f27] hover:text-rose-400 disabled:opacity-40"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-sm" style={{ color: "#a38b63" }}>
                    No clients match your filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Add row inline */}
        {session.status === "OPEN" && (
          <div className="mt-3 flex items-center gap-2">
            <input
              value={addingName}
              onChange={(e) => setAddingName(e.target.value)}
              placeholder="Add client name and press Enter…"
              onKeyDown={(e) => {
                if (e.key === "Enter" && addingName.trim()) {
                  addRow(session.id, addingName.trim());
                  setAddingName("");
                }
              }}
              className="flex-1 rounded-xl border border-[#2b2f3a] bg-[#0f1116] px-3 py-2 text-sm text-[#EDE6D8] outline-none focus:border-[#C6A15B]"
            />
            <button
              type="button"
              onClick={() => {
                if (!addingName.trim()) return;
                addRow(session.id, addingName.trim());
                setAddingName("");
              }}
              className="rounded-xl px-3 py-2 text-sm font-bold"
              style={{ background: "#1b1f27", color: "#EAD39A" }}
            >
              <Plus size={14} className="inline mr-1" /> Add
            </button>
          </div>
        )}
      </div>

      {/* Sticky summary footer */}
      <div
        className="sticky bottom-0 border-t px-5 py-3 lg:px-7"
        style={{ background: "rgba(9,10,13,0.92)", borderColor: "#1b1f27", backdropFilter: "blur(8px)" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="flex flex-wrap items-center gap-4 text-[#CBB893]">
            <span><strong className="text-[#EDE6D8]">{totals.clients}</strong> clients</span>
            <span><strong className="text-[#92C99B]">{totals.paid}</strong> paid</span>
            <span><strong className="text-[#EAD39A]">{totals.pending}</strong> pending</span>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#C7B48A]">Total Collection</div>
            <div className="text-2xl font-extrabold" style={{ color: "#EAD39A" }}>{formatCurrency(totals.total)}</div>
          </div>
        </div>
      </div>

      <EndCollectionModal
        open={confirmOpen}
        totals={totals}
        processing={processing}
        onCancel={() => !processing && setConfirmOpen(false)}
        onConfirm={handleConfirmEnd}
      />

      <style>{`
        @keyframes toastIn { from { opacity: 0; transform: translateY(-8px) scale(.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes modalIn { from { opacity: 0; transform: translateY(10px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .animate-toast-in { animation: toastIn .22s ease-out; }
        .animate-modal-in { animation: modalIn .18s ease-out; }
      `}</style>
    </div>
  );
}

function DCSum({ label, value, icon: Icon, tone }: any) {
  const colors: Record<string, string> = {
    green: "#92C99B",
    amber: "#EAD39A",
    gold: "#C6A15B",
    default: "#86A8D8",
  };
  const c = colors[tone || "default"];
  return (
    <div className="rounded-2xl border bg-[#121419] px-4 py-3" style={{ borderColor: "rgba(198,161,91,.22)" }}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#CBB893" }}>{label}</div>
          <div className="mt-1 text-lg font-extrabold text-[#F6F1E6]">{value}</div>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: `${c}22`, color: c }}>
          <Icon size={16} />
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-lg border border-[#232735] bg-[#141820] px-2 py-2 text-center">
      <div className="text-sm font-extrabold" style={{ color: tone || "#EDE6D8" }}>{value}</div>
      <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-[#8b7a5c]">{label}</div>
    </div>
  );
}

/**
 * Single confirmation for the whole "end collection" action: locking the sheet
 * and posting to the ERP ledger now happen together, with one clear outcome
 * instead of two separate manual buttons.
 */
function EndCollectionModal({ open, totals, processing, onCancel, onConfirm }: any) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !processing) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, processing, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !processing) onCancel();
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-[20px] border border-[#C6A15B]/25 bg-[#101217] text-[#EDE6D8] shadow-2xl animate-modal-in">
        <div className="flex items-center justify-between border-b border-[#C6A15B]/15 px-5 py-4">
          <div className="flex items-center gap-2 text-sm font-bold text-[#EAD7B5]">
            <Lock size={15} /> End Collection Session
          </div>
          <button
            type="button"
            onClick={() => !processing && onCancel()}
            disabled={processing}
            aria-label="Close"
            className="rounded-lg p-1.5 text-[#CBB893] transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-5">
          <p className="text-sm leading-6 text-[#CBB893]">
            This locks every entry and automatically posts the collected amounts to your ERP customer ledger. You won't be able to edit until you unlock it again.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <MiniStat label="Clients" value={totals.clients} />
            <MiniStat label="Paid" value={totals.paid} tone="#92C99B" />
            <MiniStat label="To Post" value={formatCurrency(totals.total)} tone="#EAD39A" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[#C6A15B]/10 px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={processing}
            className="rounded-xl border border-[#2d313d] bg-[#181b24] px-4 py-2 text-sm font-bold text-[#d9cfb9] hover:bg-[#1d212c] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={processing}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #EAD39A, #C6A15B)", color: "#15110a" }}
          >
            {processing ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
            {processing ? "Posting…" : "Confirm & Post to ERP"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;
  const meta: Record<ToastType, { icon: any; color: string }> = {
    success: { icon: CheckCircle2, color: "#92C99B" },
    error: { icon: XCircle, color: "#DB7777" },
    warning: { icon: AlertTriangle, color: "#EAD39A" },
  };
  return (
    <div className="fixed right-4 top-4 z-[90] flex w-[min(92vw,380px)] flex-col gap-2">
      {toasts.map((t) => {
        const { icon: Icon, color } = meta[t.type];
        return (
          <div
            key={t.id}
            className="animate-toast-in flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-md"
            style={{ background: "rgba(16,18,23,0.97)", borderColor: `${color}55` }}
          >
            <div className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full" style={{ background: `${color}22`, color }}>
              <Icon size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-[#F6F1E6]">{t.title}</div>
              {t.message && <div className="mt-0.5 text-xs leading-5 text-[#CBB893]">{t.message}</div>}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              className="flex-none rounded-md p-1 text-[#8b7a5c] hover:bg-white/5 hover:text-[#EDE6D8]"
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}