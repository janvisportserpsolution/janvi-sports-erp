import { useEffect, useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useData } from "../store";
import { ArrowLeft, Printer, Mail } from "lucide-react";
import { formatCurrency, formatDate } from "../utils/id";
import { StatusBadge } from "./Dashboard";
import jsPDF from "jspdf";

export default function InvoiceView() {
  const { id } = useParams();
  const invoices = useData((s) => s.invoices);
  const invoiceItems = useData((s) => s.invoiceItems);
  const customers = useData((s) => s.customers);
  const [params] = useSearchParams();

  const invoice = useMemo(() => invoices.find((i) => i.id === id), [invoices, id]);
  const items = useMemo(
    () => invoiceItems.filter((ii) => ii.invoice_id === id),
    [invoiceItems, id]
  );
  const customer = useMemo(
    () => (invoice ? customers.find((c) => c.id === invoice.customer_id) : null),
    [invoice, customers]
  );

  useEffect(() => {
    if (params.get("print") === "1") {
      setTimeout(() => window.print(), 500);
    }
  }, [params]);

  if (!invoice) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
        <div className="text-slate-500">Invoice not found.</div>
        <Link to="/invoices" className="mt-3 inline-block text-sm font-semibold text-orange-700 hover:underline">
          ← Back to invoices
        </Link>
      </div>
    );
  }

  const exportPdf = () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const w = doc.internal.pageSize.getWidth();
    let y = 40;

    // Header
    doc.setFontSize(20).setFont("helvetica", "bold");
    doc.setTextColor(234, 88, 12);
    doc.text("JANVI SPORTS", 40, y);
    doc.setFontSize(10).setFont("helvetica", "normal").setTextColor(100);
    doc.text("Sports Equipment & Apparel", 40, y + 16);
    y += 40;

    doc.setFontSize(24).setFont("helvetica", "bold").setTextColor(15, 23, 42);
    doc.text("INVOICE", w - 40, y - 16, { align: "right" });
    doc.setFontSize(10).setFont("helvetica", "normal").setTextColor(100);
    doc.text(`#: ${invoice.invoice_number}`, w - 40, y, { align: "right" });
    doc.text(`Date: ${formatDate(invoice.created_at)}`, w - 40, y + 14, { align: "right" });

    // Customer
    y += 30;
    doc.setFontSize(11).setFont("helvetica", "bold").setTextColor(15, 23, 42);
    doc.text("Bill To:", 40, y);
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(60);
    doc.text(customer?.name || "Walk-in", 40, y + 14);
    doc.text(`Mobile: ${customer?.mobile || ""}`, 40, y + 28);
    doc.text(customer?.address || "", 40, y + 42);

    // Table header
    y += 70;
    doc.setFillColor(241, 245, 249);
    doc.rect(40, y, w - 80, 22, "F");
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(71, 85, 105);
    doc.text("ITEM", 50, y + 14);
    doc.text("SKU", 250, y + 14);
    doc.text("QTY", 360, y + 14);
    doc.text("PRICE", 420, y + 14);
    doc.text("TOTAL", w - 50, y + 14, { align: "right" });
    y += 22;

    doc.setFont("helvetica", "normal").setTextColor(15, 23, 42);
    items.forEach((it) => {
      doc.text(it.product_name.slice(0, 36), 50, y + 14);
      doc.text(it.sku, 250, y + 14);
      doc.text(String(it.quantity), 360, y + 14);
      doc.text(formatCurrency(it.unit_price), 420, y + 14);
      doc.text(formatCurrency(it.total), w - 50, y + 14, { align: "right" });
      y += 20;
    });

    // Totals
    y += 10;
    doc.setDrawColor(226, 232, 240);
    doc.line(40, y, w - 40, y);
    y += 18;
    const totals: [string, string, boolean][] = [
      ["Subtotal", formatCurrency(invoice.subtotal), false],
      ["Discount", formatCurrency(invoice.discount), false],
      ["Grand Total", formatCurrency(invoice.grand_total), true],
      ["Amount Paid", formatCurrency(invoice.amount_paid), false],
      ["Balance Due", formatCurrency(invoice.balance_amount), true],
    ];
    totals.forEach(([l, v, bold]) => {
      doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(bold ? 11 : 10);
      doc.setTextColor(bold ? 234 : 100, bold ? 88 : 116, bold ? 12 : 139);
      doc.text(l, w - 200, y);
      doc.text(v, w - 50, y, { align: "right" });
      y += 16;
    });

    // Footer
    doc.setFontSize(9).setFont("helvetica", "italic").setTextColor(148, 163, 184);
    doc.text("Thank you for your purchase!", w / 2, 780, { align: "center" });

    doc.save(`${invoice.invoice_number}.pdf`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link to="/invoices" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-slate-900">
          <ArrowLeft size={16} /> Back to invoices
        </Link>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Printer size={14} /> Print
          </button>
          <button
            onClick={exportPdf}
            className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-700"
          >
            <Mail size={14} /> Download PDF
          </button>
        </div>
      </div>

      <div className="print-area mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-start justify-between border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-red-600 text-xl font-bold text-white">
                J
              </div>
              <div>
                <div className="text-xl font-bold text-slate-900">JANVI SPORTS</div>
                <div className="text-xs text-slate-500">Sports Equipment & Apparel</div>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-slate-900">INVOICE</div>
            <div className="mt-1 font-mono text-sm text-slate-700">{invoice.invoice_number}</div>
            <div className="mt-1 text-xs text-slate-500">{formatDate(invoice.created_at)}</div>
            <div className="mt-2">
              <StatusBadge status={invoice.status} />
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-6">
          <div>
            <div className="text-xs font-semibold uppercase text-slate-500">Bill To</div>
            <div className="mt-1 text-base font-bold text-slate-900">{customer?.name}</div>
            <div className="text-sm text-slate-600">Mobile: {customer?.mobile}</div>
            {customer?.address && <div className="text-sm text-slate-600">{customer.address}</div>}
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold uppercase text-slate-500">Payment Summary</div>
            <div className="mt-1 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span>{formatCurrency(invoice.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Discount</span><span>−{formatCurrency(invoice.discount)}</span></div>
            </div>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-slate-500">#</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-slate-500">Item</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-slate-500">SKU</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-slate-500">Qty</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-slate-500">Price</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-slate-500">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((it, i) => (
                <tr key={it.id}>
                  <td className="px-4 py-2.5 text-slate-400">{i + 1}</td>
                  <td className="px-4 py-2.5 font-semibold text-slate-900">{it.product_name}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{it.sku}</td>
                  <td className="px-4 py-2.5 text-right">{it.quantity}</td>
                  <td className="px-4 py-2.5 text-right">{formatCurrency(it.unit_price)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold">{formatCurrency(it.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex justify-end">
          <div className="w-72 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Subtotal</span>
              <span>{formatCurrency(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Discount</span>
              <span>−{formatCurrency(invoice.discount)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold">
              <span>Grand Total</span>
              <span className="text-orange-700">{formatCurrency(invoice.grand_total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Amount Paid</span>
              <span className="text-emerald-700">{formatCurrency(invoice.amount_paid)}</span>
            </div>
            <div className={`flex justify-between border-t border-slate-200 pt-2 text-base font-bold ${invoice.balance_amount > 0 ? "text-rose-700" : "text-slate-700"}`}>
              <span>Balance Due</span>
              <span>{formatCurrency(invoice.balance_amount)}</span>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-slate-200 pt-4 text-center text-xs text-slate-400">
          Thank you for shopping at Janvi Sports! · {formatDate(invoice.created_at)}
        </div>
      </div>
    </div>
  );
}
