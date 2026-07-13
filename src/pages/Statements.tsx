import { useMemo, useState, useEffect } from "react";
import { useData } from "../store";
import { useSearchParams } from "react-router-dom";
import { formatCurrency, formatShortDate } from "../utils/id";
import { CustomerLedgerEntry } from "../types";
import { Mail, MessageSquare, Printer, Send, Search, Edit3, Download } from "lucide-react";


type StatementLedgerEntry = CustomerLedgerEntry & { running_balance: number };

const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "2-digit",
};

const ENTRY_LABELS: Record<CustomerLedgerEntry["entry_type"], string> = {
  SALE: "Sale",
  PAYMENT: "Payment",
  RETURN: "Return",
  ADJUSTMENT: "Adjustment",
};

function formatPlainDate(date: string) {
  return new Date(date).toLocaleDateString("en-IN", DATE_FORMAT_OPTIONS);
}

function formatPeriodLabel(mode: "single" | "range", from: string, to: string) {
  if (mode === "single") return formatPlainDate(from);
  return `${formatPlainDate(from)} – ${formatPlainDate(to)}`;
}

export default function Statements() {
  const customers = useData((s) => s.customers);
  const ledger = useData((s) => s.ledger);
  const updateCustomer = useData((s) => s.updateCustomer);

  const [customerQuery, setCustomerQuery] = useState("");
  const [searchParams] = useSearchParams();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customers[0]?.id || "");
  const [mode, setMode] = useState<"single" | "range">("single");
  const [singleDate, setSingleDate] = useState(new Date().toISOString().slice(0, 10));
  const [fromDate, setFromDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [emailChecked, setEmailChecked] = useState(true);
  const [whatsappChecked, setWhatsappChecked] = useState(true);
  const [printChecked, setPrintChecked] = useState(true);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<{ email?: string; whatsapp?: string; print?: string }>({});
  const [sending, setSending] = useState(false);
  const [mobileDraft, setMobileDraft] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [updateMaster, setUpdateMaster] = useState(true);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId]
  );

  useEffect(() => {
    const customerParam = searchParams.get("customer");
    if (customerParam && customers.some((c) => c.id === customerParam)) {
      setSelectedCustomerId(customerParam);
    }
  }, [customers, searchParams]);

  const filteredCustomers = useMemo(() => {
    const query = customerQuery.trim().toLowerCase();
    if (!query) return customers;
    return customers.filter((c) =>
      c.name.toLowerCase().includes(query) ||
      c.mobile.includes(query) ||
      (c.email ?? "").toLowerCase().includes(query)
    );
  }, [customers, customerQuery]);

  const { filteredLedger, openingBalance, closingBalance, totalDebit, totalCredit, periodLabel } = useMemo(() => {
    if (!selectedCustomer) return { filteredLedger: [] as StatementLedgerEntry[], openingBalance: 0, closingBalance: 0, totalDebit: 0, totalCredit: 0, periodLabel: "" };

    const customerLedger = ledger
      .filter((entry) => entry.customer_id === selectedCustomer.id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));

    const from = mode === "single" ? new Date(singleDate) : new Date(fromDate);
    const to = mode === "single" ? new Date(singleDate) : new Date(toDate);
    const endOfDay = new Date(to);
    endOfDay.setHours(23, 59, 59, 999);

    const earlierEntries = customerLedger.filter((entry) => new Date(entry.created_at) < from);
    const selectedEntries = customerLedger.filter((entry) => {
      const created = new Date(entry.created_at);
      return created >= from && created <= endOfDay;
    });

    let running = earlierEntries.length ? earlierEntries[earlierEntries.length - 1].balance_after : 0;
    const transformed = selectedEntries.map((entry) => {
      running += entry.debit - entry.credit;
      return { ...entry, running_balance: running };
    });

    return {
      filteredLedger: transformed,
      openingBalance: earlierEntries.length ? earlierEntries[earlierEntries.length - 1].balance_after : 0,
      closingBalance: running,
      totalDebit: transformed.reduce((sum, entry) => sum + entry.debit, 0),
      totalCredit: transformed.reduce((sum, entry) => sum + entry.credit, 0),
      periodLabel: formatPeriodLabel(mode, mode === "single" ? singleDate : fromDate, mode === "single" ? singleDate : toDate),
    };
  }, [selectedCustomer, ledger, mode, singleDate, fromDate, toDate]);

  const previewRows = filteredLedger.map((entry) => (
    <tr key={entry.id} className="border-b border-slate-200 last:border-0">
      <td className="px-3 py-3 text-xs text-slate-700">{formatShortDate(entry.created_at)}</td>
      <td className="px-3 py-3 text-xs text-slate-700">{entry.reference_number || "-"}</td>
      <td className="px-3 py-3 text-xs text-slate-700">{ENTRY_LABELS[entry.entry_type]}</td>
      <td className="px-3 py-3 text-right text-xs text-slate-700">{entry.debit > 0 ? formatCurrency(entry.debit) : "-"}</td>
      <td className="px-3 py-3 text-right text-xs text-slate-700">{entry.credit > 0 ? formatCurrency(entry.credit) : "-"}</td>
      <td className="px-3 py-3 text-right text-xs font-semibold text-slate-900">{formatCurrency(entry.running_balance ?? entry.balance_after)}</td>
    </tr>
  ));

  const handleCustomerSelection = (id: string) => {
    setSelectedCustomerId(id);
    const customer = customers.find((c) => c.id === id);
    setMobileDraft(customer?.mobile ?? "");
    setEmailDraft(customer?.email ?? "");
    setSubject(`Ledger Statement – ${customer?.name ?? "Customer"} – ${periodLabel}`);
    setBody(
      `Dear ${customer?.name ?? "Customer"},\n\nPlease find attached your ledger statement for ${periodLabel}.\n\nRegards,\nJANVI SPORTS`
    );
  };

  const buildDocDefinition = async () => {
    const customer = selectedCustomer;
    if (!customer) throw new Error("No customer selected");
    const period = periodLabel || "Ledger Statement";

    const rows = filteredLedger.map((entry) => [
      formatShortDate(entry.created_at),
      entry.reference_number || "-",
      ENTRY_LABELS[entry.entry_type],
      entry.debit > 0 ? formatCurrency(entry.debit) : "-",
      entry.credit > 0 ? formatCurrency(entry.credit) : "-",
      formatCurrency(entry.running_balance ?? entry.balance_after),
    ]);

    const docDefinition = {
      pageSize: "A4",
      pageMargins: [40, 40, 40, 60],
      footer: (currentPage: number, pageCount: number) => ({
        columns: [
          { text: "Computer-generated statement, no signature required.", style: "footerText" },
          { text: `Page ${currentPage} of ${pageCount}`, alignment: "right", style: "footerText" },
        ],
        margin: [40, 0, 40, 0],
      }),
      content: [
        {
          columns: [
            [
              { text: "JANVI SPORTS", style: "title" },
              { text: "123 MG Road, Mumbai, 400001", style: "subtle" },
              { text: "GSTIN: 27ABCDE1234F2Z5", style: "subtle" },
              { text: "Phone: +91 99999 99999", style: "subtle" },
              { text: "Email: support@janvisports.com", style: "subtle" },
            ],
            [
              { text: "Ledger Statement", style: "docHeader", alignment: "right" },
              { text: period, style: "docSubheader", alignment: "right" },
            ],
          ],
        },
        { text: "\n" },
        {
          columns: [
            {
              width: "*",
              stack: [
                { text: "Customer", style: "sectionTitle" },
                { text: customer.name, style: "sectionText" },
                { text: customer.address || "", style: "sectionText" },
                { text: `Phone: ${mobileDraft}`, style: "sectionText" },
                { text: customer.email ? `Email: ${emailDraft}` : "Email: -", style: "sectionText" },
              ],
            },
            {
              width: "auto",
              stack: [
                { text: "Statement Period", style: "sectionTitleRight" },
                { text: period, style: "sectionTextRight" },
                { text: `Opening Balance: ${formatCurrency(openingBalance)}`, style: "sectionTextRight" },
                { text: `Closing Balance: ${formatCurrency(closingBalance)}`, style: "sectionTextRight" },
              ],
              alignment: "right",
            },
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
                { text: formatCurrency(closingBalance), style: "tableTotal", alignment: "right" },
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
        sectionTitle: { fontSize: 11, bold: true, margin: [0, 0, 0, 4] },
        sectionText: { fontSize: 10, margin: [0, 0, 0, 2] },
        sectionTitleRight: { fontSize: 11, bold: true, margin: [0, 0, 0, 4] },
        sectionTextRight: { fontSize: 10, margin: [0, 0, 0, 2] },
        tableHeader: { bold: true, fontSize: 9, color: "#1f2937" },
        tableTotal: { bold: true, fontSize: 10 },
        footerText: { fontSize: 8, color: "#6b7280" },
      },
    };

    const pdfMake = (await import("pdfmake/build/pdfmake")).default as any;
    const pdfFonts = (await import("pdfmake/build/vfs_fonts")).default as any;
    pdfMake.vfs = pdfFonts.pdfMake.vfs;
    return { pdfMake, docDefinition, fileName: `Ledger_${customer.name.replace(/\s+/g, "_")}_${mode === "single" ? singleDate : fromDate}_${mode === "single" ? singleDate : toDate}.pdf` };
  };

  const toE164WithoutPlus = (mobile: string) => {
    const digits = mobile.replace(/\D/g, "");
    // If user already entered country code (e.g., 91xxxxxxxxxx), keep as-is
    if (digits.startsWith("91") && digits.length >= 12) return digits;
    // Default India
    if (digits.length === 10) return `91${digits}`;
    return digits;
  };

  const handleDownloadPdf = async () => {
    if (!selectedCustomer) {
      setStatus((prev) => ({ ...prev, print: "No customer selected" }));
      return;
    }

    try {
      const { pdfMake, docDefinition, fileName } = await buildDocDefinition();
      pdfMake.createPdf(docDefinition).download(fileName);
      setStatus((prev) => ({ ...prev, print: "PDF downloaded" }));
    } catch (error: any) {
      setStatus((prev) => ({ ...prev, print: `Failed ❌ ${error?.message || "PDF download failed"}` }));
    }
  };

  const handleSend = async () => {
    setSending(true);
    setStatus({});

    if (!selectedCustomer) {
      setStatus({ email: "No customer selected", whatsapp: "No customer selected", print: "No customer selected" });
      setSending(false);
      return;
    }

    const contact = {
      mobile: mobileDraft.trim(),
      email: emailDraft.trim(),
    };

    if (updateMaster) {
      updateCustomer(selectedCustomer.id, { mobile: contact.mobile, email: contact.email });
    }

    const { pdfMake, docDefinition, fileName } = await buildDocDefinition();

    // Create PDF blob for download; we also try to attach via mailto/whatsapp links (browser limitations)
    const pdfBlob: Blob = await new Promise((res) => {
      pdfMake.createPdf(docDefinition).getBlob((b: Blob) => res(b));
    });
    const pdfUrl = URL.createObjectURL(pdfBlob);

    const tasks: Promise<void>[] = [];

    if (emailChecked) {
      tasks.push(
        (async () => {
          try {
            if (!contact.email) throw new Error("Customer email is required for Email");

            const fromEmail = "Janvisports.customer.care@gmail.com";

            const subjectLine = encodeURIComponent(subject || `Ledger Statement – ${selectedCustomer.name} – ${periodLabel}`);
            const bodyText = encodeURIComponent(
              `${body || `Dear ${selectedCustomer.name},\n\nPlease find attached your ledger statement for ${periodLabel}.\n\nRegards,\nJANVI SPORTS`}\n\nPDF link: ${pdfUrl}\n\nFrom: ${fromEmail}`
            );

            window.open(`mailto:${encodeURIComponent(contact.email)}?cc=${encodeURIComponent(fromEmail)}&subject=${subjectLine}&body=${bodyText}`, "_blank");

            setStatus((prev) => ({ ...prev, email: "Email draft opened" }));
          } catch (error: any) {
            setStatus((prev) => ({ ...prev, email: `Failed ❌ ${error?.message || "Email send failed"}` }));
            throw error;
          }
        })()
      );
    }

    if (whatsappChecked) {
      tasks.push(
        (async () => {
          try {
            if (!contact.mobile) throw new Error("Customer mobile is required for WhatsApp");

            const phone = toE164WithoutPlus(contact.mobile);
            if (!phone) throw new Error("Invalid customer mobile");

            const msg = encodeURIComponent(
              `${body || `Dear ${selectedCustomer.name},\n\nPlease find your ledger statement for ${periodLabel}.\n\nRegards,\nJANVI SPORTS`}\n\nPDF link: ${pdfUrl}`
            );

            window.open(`https://api.whatsapp.com/send/?phone=${phone}&text=${msg}&type=phone_number&app_absent=0`, "_blank");
            setStatus((prev) => ({ ...prev, whatsapp: "WhatsApp chat opened" }));
          } catch (error: any) {
            setStatus((prev) => ({ ...prev, whatsapp: `Failed ❌ ${error?.message || "WhatsApp send failed"}` }));
            throw error;
          }
        })()
      );
    }

    if (printChecked) {
      tasks.push(
        (async () => {
          try {
            pdfMake.createPdf(docDefinition).print();
            setStatus((prev) => ({ ...prev, print: "Print dialog opened" }));
          } catch (error: any) {
            setStatus((prev) => ({ ...prev, print: `Failed ❌ ${error?.message || "Print failed"}` }));
            throw error;
          }
        })()
      );
    }

    await Promise.allSettled(tasks);
    setSending(false);
  };


  const handlePreviewDefaults = () => {
    if (!selectedCustomer) return;
    setMobileDraft(selectedCustomer.mobile);
    setEmailDraft(selectedCustomer.email ?? "");
    setSubject(`Ledger Statement – ${selectedCustomer.name} – ${periodLabel}`);
    setBody(`Dear ${selectedCustomer.name},\n\nPlease find attached your ledger statement for ${periodLabel}.\n\nRegards,\nJANVI SPORTS`);
  };

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-800 via-slate-900 to-black p-6 text-white shadow-xl sm:p-8">
        <div className="bg-mesh absolute inset-0 opacity-60" />
        <div className="bg-grid absolute inset-0 opacity-20" />
        <div className="relative">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-md">
            <MessageSquare size={12} /> Customer Ledger Statement
          </div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Generate & Send Ledger</h1>
          <p className="mt-1 text-sm text-white/80">Create a PDF-ready customer ledger and deliver it via Email, WhatsApp, or Print.</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_0.6fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 grid gap-4 lg:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Select Customer</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                <input
                  value={customerQuery}
                  onChange={(e) => setCustomerQuery(e.target.value)}
                  placeholder="Search by name, mobile, or email..."
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-800 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
                />
              </div>
              <div className="mt-2 max-h-60 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-2">
                {filteredCustomers.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => handleCustomerSelection(customer.id)}
                    className={`w-full rounded-2xl border px-3 py-2 text-left text-sm transition ${
                      customer.id === selectedCustomerId ? "border-orange-400 bg-orange-50 text-slate-900" : "border-transparent bg-white text-slate-700 hover:border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <div className="font-semibold">{customer.name}</div>
                    <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-500">
                      <span>{customer.mobile}</span>
                      {customer.email && <span>{customer.email}</span>}
                    </div>
                  </button>
                ))}
                {filteredCustomers.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-3 py-4 text-sm text-slate-500">No customers match your search.</div>
                )}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Statement Type</label>
              <div className="grid gap-2">
                {[
                  { id: "single", label: "Single Date", desc: "Ledger as of one date" },
                  { id: "range", label: "Date Range", desc: "Period-based statement" },
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setMode(option.id as "single" | "range")}
                    className={`rounded-2xl border px-4 py-4 text-left transition ${
                      mode === option.id ? "border-orange-400 bg-orange-50" : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="font-semibold text-slate-900">{option.label}</div>
                    <div className="mt-1 text-xs text-slate-500">{option.desc}</div>
                  </button>
                ))}
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">From</span>
                  <input
                    type="date"
                    value={mode === "single" ? singleDate : fromDate}
                    onChange={(e) => {
                      if (mode === "single") setSingleDate(e.target.value);
                      else setFromDate(e.target.value);
                    }}
                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-800 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
                  />
                </label>
                {mode === "range" && (
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">To</span>
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-800 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
                    />
                  </label>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-slate-50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-900">Preview</div>
                <div className="text-xs text-slate-500">Live statement preview for the selected customer and period.</div>
              </div>
              <button
                onClick={handlePreviewDefaults}
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                <Edit3 size={14} /> Clear preview text
              </button>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <InfoCard label="Customer" value={selectedCustomer?.name ?? "Not selected"} />
                  <InfoCard label="Period" value={periodLabel || "-"} />
                  <InfoCard label="Opening balance" value={formatCurrency(openingBalance)} />
                  <InfoCard label="Closing balance" value={formatCurrency(closingBalance)} />
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contact</div>
                  <div className="mt-2 grid gap-3">
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold uppercase text-slate-500">Mobile</span>
                      <input
                        value={mobileDraft}
                        onChange={(e) => setMobileDraft(e.target.value)}
                        className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold uppercase text-slate-500">Email</span>
                      <input
                        value={emailDraft}
                        onChange={(e) => setEmailDraft(e.target.value)}
                        className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                      />
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={updateMaster}
                        onChange={(e) => setUpdateMaster(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                      />
                      Update customer master if contact changed
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-3 text-sm font-semibold text-slate-900">
                    <Mail size={16} /> Email and WhatsApp message preview
                  </div>
                  <div className="mt-3 space-y-3">
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Subject</label>
                    <input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                    />
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Message body</label>
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={6}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                    />
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-3 text-sm font-semibold text-slate-900">
                    <Printer size={16} /> Delivery options
                  </div>
                  <div className="mt-3 grid gap-3">
                    <label className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
                      <input type="checkbox" checked={emailChecked} onChange={(e) => setEmailChecked(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500" />
                      Email
                    </label>
                    <label className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
                      <input type="checkbox" checked={whatsappChecked} onChange={(e) => setWhatsappChecked(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500" />
                      WhatsApp
                    </label>
                    <label className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
                      <input type="checkbox" checked={printChecked} onChange={(e) => setPrintChecked(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500" />
                      Print
                    </label>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Channel status</div>
                      <div className="text-xs text-slate-500">Email and WhatsApp are sent in parallel.</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleDownloadPdf}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        <Download size={16} /> Download PDF
                      </button>
                      <button
                        onClick={handleSend}
                        disabled={!selectedCustomer || (!emailChecked && !whatsappChecked && !printChecked) || sending}
                        className="inline-flex items-center gap-2 rounded-2xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        <Send size={16} /> {sending ? "Sending..." : "Send Statement"}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    {emailChecked && <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">Email: {status.email || "Ready to send"}</div>}
                    {whatsappChecked && <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">WhatsApp: {status.whatsapp || "Ready to send"}</div>}
                    {printChecked && <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">Print: {status.print || "Ready to print"}</div>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-slate-900">Statement Preview</div>
              <div className="text-xs text-slate-500">Snapshot of the ledger table that will appear in the PDF.</div>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{filteredLedger.length} entries</span>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <PreviewCard label="Opening Balance" value={formatCurrency(openingBalance)} />
              <PreviewCard label="Closing Balance" value={formatCurrency(closingBalance)} />
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-3xl border border-slate-200">
            <div className="bg-slate-900 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white">Ledger transactions</div>
            <div className="scroll-thin max-h-[480px] overflow-x-auto overflow-y-auto bg-white">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-3 py-3 font-semibold">Date</th>
                    <th className="px-3 py-3 font-semibold">Voucher</th>
                    <th className="px-3 py-3 font-semibold">Type</th>
                    <th className="px-3 py-3 text-right font-semibold">Debit</th>
                    <th className="px-3 py-3 text-right font-semibold">Credit</th>
                    <th className="px-3 py-3 text-right font-semibold">Balance</th>
                  </tr>
                </thead>
                <tbody>{previewRows.length ? previewRows : <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-400">No transactions found for this period.</td></tr>}</tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-slate-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function PreviewCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-lg font-bold text-slate-900">{value}</div>
    </div>
  );
}
