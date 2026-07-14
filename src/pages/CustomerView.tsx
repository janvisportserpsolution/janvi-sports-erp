import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth, useData } from "../store";
import {
  ArrowLeft,
  Phone,
  MapPin,
  Calendar,
  Wallet,
  TrendingUp,
  TrendingDown,
  Receipt,
  Undo2,
  Plus,
  Mail,
  Download,
  MessageSquare,
} from "lucide-react";
import { formatCurrency, formatDate } from "../utils/id";

export default function CustomerView() {
  const { id } = useParams();
  const allCustomers = useData((s) => s.customers);
  const allInvoices = useData((s) => s.invoices);
  const allInvoiceItems = useData((s) => s.invoiceItems);
  const allReturns = useData((s) => s.salesReturns);
  const allLedger = useData((s) => s.ledger);
  
  const customer = useMemo(() => allCustomers.find((c) => c.id === id), [allCustomers, id]);
  const invoices = useMemo(() => allInvoices.filter((i) => i.customer_id === id), [allInvoices, id]);
  const invoiceItems = useMemo(() => allInvoiceItems, [allInvoiceItems]);
  const returns = useMemo(() => allReturns.filter((r) => r.customer_id === id), [allReturns, id]);
  const ledger = useMemo(() => allLedger.filter((l) => l.customer_id === id), [allLedger, id]);
  
  const recordPayment = useData((s) => s.recordPayment);
  const user = useAuth((s) => s.user);
  const navigate = useNavigate();

  const toE164WithoutPlus = (mobile: string) => {
    const digits = mobile.replace(/\D/g, "");
    if (digits.startsWith("91") && digits.length >= 12) return digits;
    if (digits.length === 10) return `91${digits}`;
    return digits;
  };

  const [payOpen, setPayOpen] = useState(false);
  const [payAmt, setPayAmt] = useState(0);
  const [payNote, setPayNote] = useState("");

  const stats = useMemo(() => {
    const totalPurchases = invoices.reduce((s, i) => s + i.grand_total, 0);
    const totalPaid = invoices.reduce((s, i) => s + i.amount_paid, 0) + ledger
      .filter((l) => l.entry_type === "PAYMENT")
      .reduce((s, l) => s + l.credit, 0);
    const totalReturns = returns.reduce((s, r) => s + r.total_amount, 0);
    return { totalPurchases, totalPaid, totalReturns };
  }, [invoices, returns, ledger]);

  const buildCustomerLedgerDoc = async () => {
    if (!customer) throw new Error("No customer selected");
    const entries = [...ledger].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const rows = entries.map((entry) => [
      formatDate(entry.created_at),
      entry.reference_number || "-",
      entry.entry_type,
      entry.debit > 0 ? formatCurrency(entry.debit) : "-",
      entry.credit > 0 ? formatCurrency(entry.credit) : "-",
      formatCurrency(entry.balance_after),
    ]);
    const totalDebit = entries.reduce((sum, entry) => sum + entry.debit, 0);
    const totalCredit = entries.reduce((sum, entry) => sum + entry.credit, 0);
    const fileName = `Ledger_${customer.name.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`;

    const docDefinition = {
      pageSize: "A4",
      pageMargins: [40, 40, 40, 60],
      content: [
        {
          columns: [
            [
              { text: "JANVI SPORTS", style: "title" },
              { text: customer.address || "", style: "subtle" },
              { text: `Phone: ${customer.mobile}`, style: "subtle" },
              { text: customer.email ? `Email: ${customer.email}` : "Email: -", style: "subtle" },
            ],
            [
              { text: "Ledger Statement", style: "docHeader", alignment: "right" },
              { text: formatDate(new Date().toISOString()), style: "docSubheader", alignment: "right" },
            ],
          ],
        },
        { text: "\n" },
        {
          table: {
            headerRows: 1,
            widths: [70, 90, 90, 60, 60, 80],
            body: [
              [
                { text: "Date", style: "tableHeader" },
                { text: "Voucher", style: "tableHeader" },
                { text: "Type", style: "tableHeader" },
                { text: "Debit", style: "tableHeader" },
                { text: "Credit", style: "tableHeader" },
                { text: "Balance", style: "tableHeader" },
              ],
              ...rows,
              [
                { text: "Totals", colSpan: 3, style: "tableTotal" },
                {},
                {},
                { text: formatCurrency(totalDebit), style: "tableTotal", alignment: "right" },
                { text: formatCurrency(totalCredit), style: "tableTotal", alignment: "right" },
                { text: "", style: "tableTotal" },
              ],
            ],
          },
          layout: {
            fillColor: (rowIndex: number) => (rowIndex === 0 ? "#f8fafc" : undefined),
          },
        },
      ],
      styles: {
        title: { fontSize: 18, bold: true },
        docHeader: { fontSize: 14, bold: true },
        docSubheader: { fontSize: 10, color: "#475569" },
        subtle: { fontSize: 10, color: "#64748b" },
        tableHeader: { bold: true, fontSize: 9, color: "#1f2937" },
        tableTotal: { bold: true, fontSize: 10 },
      },
    };

    const pdfMakeModule = await import("pdfmake/build/pdfmake");
    const pdfFontsModule = await import("pdfmake/build/vfs_fonts");
    const pdfMake = (pdfMakeModule.default ?? pdfMakeModule) as any;
    const pdfFonts = (pdfFontsModule.default ?? pdfFontsModule) as any;
    pdfMake.vfs = pdfFonts.pdfMake?.vfs ?? pdfFonts.vfs ?? pdfFonts;
    return { pdfMake, docDefinition, fileName };
  };

  const handleDownloadCustomerLedger = async () => {
    if (!customer) return;
    try {
      const { pdfMake, docDefinition, fileName } = await buildCustomerLedgerDoc();
      pdfMake.createPdf(docDefinition).download(fileName);
    } catch (error: any) {
      alert(`Download failed: ${error?.message || "Unknown error"}`);
    }
  };

  const handleEmailCustomerLedger = () => {
    if (!customer?.email) {
      alert("Customer email is required");
      return;
    }

    const subject = encodeURIComponent(`Ledger Statement – ${customer.name}`);
    const body = encodeURIComponent(
      `Dear ${customer.name},\n\nPlease find your ledger statement attached for your review.\n\nRegards,\nJANVI SPORTS`
    );

    window.open(`mailto:${encodeURIComponent(customer.email)}?subject=${subject}&body=${body}`, "_blank");
  };

  const handleWhatsappCustomerLedger = () => {
    if (!customer?.mobile) {
      alert("Customer mobile is required");
      return;
    }

    const phone = toE164WithoutPlus(customer.mobile);
    if (!phone) {
      alert("Valid customer mobile number is required");
      return;
    }

    const message = encodeURIComponent(
      `Dear ${customer.name},\n\nPlease find your ledger statement attached for your review.\n\nRegards,\nJANVI SPORTS`
    );

    window.open(`https://api.whatsapp.com/send/?phone=${phone}&text=${message}&type=phone_number&app_absent=0`, "_blank");
  };

  if (!customer) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
        <div className="text-slate-500">Customer not found.</div>
        <Link to="/customers" className="mt-3 inline-block text-sm font-semibold text-orange-700 hover:underline">
          ← Back to customers
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/customers" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-slate-900">
          <ArrowLeft size={16} /> Back
        </Link>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setPayOpen(true)}
            disabled={customer.credit_balance <= 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
          >
            <Plus size={14} /> Record Payment
          </button>
          <button
            onClick={handleDownloadCustomerLedger}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <Download size={14} /> Download PDF
          </button>
          <button
            type="button"
            onClick={handleEmailCustomerLedger}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <Mail size={14} /> Email
          </button>
          <button
            type="button"
            onClick={handleWhatsappCustomerLedger}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <MessageSquare size={14} /> WhatsApp
          </button>
        </div>
      </div>

      {/* Customer header card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-2xl">
        <div className="bg-mesh absolute inset-0 opacity-80" />
        <div className="bg-grid absolute inset-0 opacity-15" />
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-orange-400/30 blur-3xl" />
        <div className="absolute -bottom-16 -left-10 h-56 w-56 rounded-full bg-violet-500/30 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 animate-pulse-soft rounded-2xl bg-gradient-to-br from-orange-400 to-rose-500 blur-md" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-rose-600 text-3xl font-extrabold text-white shadow-2xl ring-2 ring-white/20">
                {customer.name[0]?.toUpperCase()}
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-extrabold">{customer.name}</h1>
              <div className="mt-2 flex flex-col gap-1 text-sm text-white/80 sm:flex-row sm:items-center sm:gap-4">
                <span className="flex items-center gap-1"><Phone size={12} /> {customer.mobile}</span>
                {customer.address && <span className="flex items-center gap-1"><MapPin size={12} /> {customer.address}</span>}
                <span className="flex items-center gap-1"><Calendar size={12} /> Joined {formatDate(customer.created_at)}</span>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 p-4 text-right backdrop-blur-md">
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/70">Outstanding Balance</div>
            <div className={`mt-1 text-3xl font-extrabold ${customer.credit_balance > 0 ? "text-rose-300" : "text-emerald-300"}`}>
              {formatCurrency(customer.credit_balance)}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat icon={TrendingUp} label="Total Purchases" value={formatCurrency(stats.totalPurchases)} gradient="from-sky-500 to-blue-600" />
        <Stat icon={Wallet} label="Total Paid" value={formatCurrency(stats.totalPaid)} gradient="from-emerald-500 to-teal-600" />
        <Stat icon={TrendingDown} label="Total Returns" value={formatCurrency(stats.totalReturns)} gradient="from-rose-500 to-pink-600" />
      </div>

      {/* Ledger */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-4">
            <h2 className="text-sm font-semibold text-slate-900">Account Ledger</h2>
            <p className="text-xs text-slate-500">All transactions affecting balance</p>
          </div>
          <div className="scroll-thin max-h-[480px] overflow-y-auto p-3">
            {ledger.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400">No transactions yet.</div>
            ) : (
              <div className="space-y-1">
                {ledger.map((l) => (
                  <div key={l.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3 hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                          l.entry_type === "SALE"
                            ? "bg-sky-50 text-sky-700"
                            : l.entry_type === "PAYMENT"
                              ? "bg-emerald-50 text-emerald-700"
                              : l.entry_type === "RETURN"
                                ? "bg-violet-50 text-violet-700"
                                : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {l.entry_type === "SALE" ? (
                          <Receipt size={14} />
                        ) : l.entry_type === "RETURN" ? (
                          <Undo2 size={14} />
                        ) : (
                          <Wallet size={14} />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-900">
                          {l.entry_type}
                          {l.reference_number && (
                            <span className="ml-1 font-mono text-xs text-slate-500">#{l.reference_number}</span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {formatDate(l.created_at)}
                          {l.note && ` · ${l.note}`}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-bold ${l.debit > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                        {l.debit > 0 ? `+${formatCurrency(l.debit)}` : `−${formatCurrency(l.credit)}`}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Bal: {formatCurrency(l.balance_after)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-4">
            <h2 className="text-sm font-semibold text-slate-900">Invoices</h2>
          </div>
          <div className="scroll-thin max-h-[480px] overflow-y-auto p-3">
            {invoices.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400">No invoices yet.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <Link
                    key={inv.id}
                    to={`/invoices/${inv.id}`}
                    className="flex items-center justify-between rounded-lg p-3 hover:bg-slate-50"
                  >
                    <div>
                      <div className="font-mono text-xs font-semibold text-orange-700">{inv.invoice_number}</div>
                      <div className="text-[11px] text-slate-400">{formatDate(inv.created_at)}</div>
                      <div className="text-xs text-slate-500">
                        {invoiceItems.filter((ii) => ii.invoice_id === inv.id).length} items
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-slate-900">{formatCurrency(inv.grand_total)}</div>
                      {inv.balance_amount > 0 && (
                        <div className="text-[11px] text-rose-600">
                          Due {formatCurrency(inv.balance_amount)}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {payOpen && (
        <PaymentModal
          balance={customer.credit_balance}
          onClose={() => setPayOpen(false)}
          onSubmit={() => {
            const r = recordPayment(customer.id, payAmt, user?.id || "system", payNote);
            if (r.ok) {
              alert("Payment recorded");
              setPayOpen(false);
              setPayAmt(0);
              setPayNote("");
            } else {
              alert(r.message);
            }
          }}
          amt={payAmt}
          setAmt={setPayAmt}
          note={payNote}
          setNote={setPayNote}
        />
      )}
    </div>
  );
}

function PaymentModal({ balance, onClose, onSubmit, amt, setAmt, note, setNote }: any) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
        <h3 className="mb-3 text-lg font-semibold">Record Payment</h3>
        <div className="mb-3 rounded-lg bg-slate-50 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Current Outstanding</span>
            <span className="font-bold text-rose-700">{formatCurrency(balance)}</span>
          </div>
        </div>
        <label className="mb-2 block">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Amount</span>
          <input
            type="number"
            min={0}
            max={balance}
            value={amt}
            onChange={(e) => setAmt(Math.max(0, Math.min(balance, +e.target.value)))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
          />
        </label>
        <label className="mb-4 block">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Note (optional)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Cash / UPI / Bank..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
          />
        </label>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={amt <= 0}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            Confirm Payment
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon, gradient }: any) {
  return (
    <div className="card-lift relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
      <div className={`absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br ${gradient} opacity-15 blur-2xl`} />
      <div className="relative flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</div>
          <div className={`mt-2 truncate bg-gradient-to-br ${gradient} bg-clip-text text-2xl font-extrabold text-transparent`}>{value}</div>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-lg`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}
