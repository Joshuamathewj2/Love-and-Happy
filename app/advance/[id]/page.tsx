import { dbStore } from "@/lib/dbStore";
import { ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";
import { AdvanceReceiptActions } from "./AdvanceReceiptActions";
import { INVOICE_TERMS_AND_NOTES, SALON_DETAILS } from "@/lib/constants";
import { calculateAdvanceOrderTotals, calculateOrderTotals } from "@/lib/advanceOrderCalculations";
import { InvoiceTotalsBlock } from "@/components/InvoiceTotalsBlock";

// Clean Indian Number-to-Words Converter
function numberToWords(num: number): string {
  if (!num || num === 0) return "Zero Rupees Only";
  const a = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const b = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  const formatChunk = (n: number): string => {
    let str = "";
    if (n >= 100) {
      str += a[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }
    if (n >= 20) {
      str +=
        b[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + a[n % 10] : "") + " ";
    } else if (n > 0) {
      str += a[n] + " ";
    }
    return str.trim();
  };

  const integerPart = Math.floor(Math.abs(num));
  const decimalPart = Math.round((Math.abs(num) - integerPart) * 100);

  let result = "";
  let n = integerPart;

  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const hundred = n;

  if (crore > 0) result += formatChunk(crore) + " Crore ";
  if (lakh > 0) result += formatChunk(lakh) + " Lakh ";
  if (thousand > 0) result += formatChunk(thousand) + " Thousand ";
  if (hundred > 0) result += formatChunk(hundred) + " ";

  result = result.trim();
  if (!result) result = "Zero";

  let out = result + " Rupees";
  if (decimalPart > 0) {
    out += " and " + formatChunk(decimalPart) + " Paise";
  }
  return out + " Only";
}

export default async function AdvanceReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const isEmbed = resolvedSearchParams.embed === "true";
  const autoPrint = resolvedSearchParams.print === "true";
  const paper = (resolvedSearchParams.paper as string) || "a4";
  const size = (resolvedSearchParams.size as string) || "a4";

  let advance = await dbStore.getAdvanceOrder(id);

  // Fallback: check if the id passed is in orders or is finalized_order_id
  if (!advance) {
    const order = await dbStore.getOrderWithRelations(id);
    if (order && order.is_advance) {
      advance = {
        id: order.id,
        customer_id: order.customer_id,
        status: (order.status as any) || "COMPLETED",
        subtotal: order.subtotal,
        total_amount: order.grand_total,
        deposit_amount: order.cash_received || order.grand_total,
        deposit_payment_mode: order.payment_mode || "CASH",
        delivery_date: null,
        notes: null,
        finalized_order_id: order.id,
        finalized_at: order.bill_date,
        cancelled_at: null,
        created_at: order.created_at,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        customer_address: order.customer_address,
        items: (order.items || []).map((it) => ({
          id: it.id,
          advance_order_id: order.id,
          product_id: it.product_id,
          snapshot_name: it.snapshot_name,
          snapshot_desc: null,
          snapshot_price: it.snapshot_price,
          quantity: it.quantity,
        })),
      };
    }
  }

  if (!advance) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-6 text-center font-sans text-zinc-800">
        <div className="w-12 h-12 rounded-lg border border-zinc-200 bg-white flex items-center justify-center mb-3 text-zinc-500 shadow-xs">
          <FileText className="w-6 h-6" />
        </div>
        <h1 className="text-base font-semibold text-zinc-900 mb-1">
          Advance Order Not Found
        </h1>
        <p className="text-xs text-zinc-500 max-w-sm mb-5">
          The requested advance order #{id} could not be found.
        </p>
        <Link
          href="/pos/admin/secure/control-panel/love-and-happy"
          className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 rounded-md text-white font-medium text-xs transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
        </Link>
      </div>
    );
  }

  const totals = calculateOrderTotals(advance);
  const totalNum = totals.total;
  const isCompleted = advance.status === "COMPLETED";
  const depositNum = totals.paid;
  const balanceNum = totals.balance;
  const modeStr = String(advance.deposit_payment_mode || "CASH").toUpperCase();
  const depositLabel =
    modeStr === "GPAY"
      ? "GPay"
      : modeStr === "CARD"
      ? "Card"
      : modeStr === "UPI"
      ? "UPI"
      : "Cash";

  const fmt = (n: number) =>
    n.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const formattedDate = new Date(advance.created_at).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });

  const deliveryDate = advance.delivery_date
    ? new Date(advance.delivery_date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      })
    : null;

  const getInvoiceHeaderBadge = () => {
    // If viewed as an active/unsettled advance order
    const isAdvanceOrder =
      (advance as any).is_advance === true ||
      (advance as any).order_type === "ADVANCE" ||
      advance.id?.startsWith("DEP-") ||
      Boolean(advance);

    if (isAdvanceOrder && advance.status?.toUpperCase() !== "COMPLETED") {
      return "ADVANCE RECEIPT";
    }

    // For settled orders, completed sales, and records viewed in Order History
    return "INVOICE";
  };

  return (
    <div
      className={`min-h-screen bg-zinc-100/70 text-zinc-900 font-sans ${
        isEmbed ? "p-2 sm:p-4" : "py-8 px-3 sm:px-6"
      } flex flex-col items-center print:bg-white print:p-0 print:m-0`}
    >
      <style>{`
        @media print {
          @page {
            size: ${
              paper === "thermal"
                ? size === "58"
                  ? "58mm auto"
                  : "80mm auto"
                : size === "a5"
                  ? "A5 portrait"
                  : "A4 portrait"
            };
            margin: ${paper === "thermal" ? "3mm" : size === "a5" ? "10mm" : "12mm"};
          }
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            padding: 0 !important;
            margin: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-hidden { display: none !important; }
          .invoice-sheet {
            border: none !important;
            box-shadow: none !important;
            max-width: 100% !important;
            width: 100% !important;
            padding: 0 !important;
          }
        }
      `}</style>

      {!isEmbed && (
        <div className="w-full max-w-[760px] mb-4 print:hidden">
          <AdvanceReceiptActions
            advanceId={advance.id}
            customerName={advance.customer_name}
            customerPhone={advance.customer_phone}
            total={totalNum}
            deposit={depositNum}
            balance={balanceNum}
            autoPrint={autoPrint}
          />
        </div>
      )}

      {paper === "thermal" ? (
        /* Thermal Receipt Layout */
        <div
          className={`invoice-sheet bg-white mx-auto text-black font-mono leading-tight p-3 ${
            size === "58" ? "w-[260px]" : "w-[320px]"
          }`}
        >
          <div className="text-center pb-3 border-b border-dashed border-black/40 mb-3">
            <h1 className="text-xl font-bold tracking-tight">{SALON_DETAILS.name}</h1>
            <p className="text-[11px] font-bold tracking-wider uppercase text-zinc-700">
              Unisex Salon
            </p>
            <p className="text-[11px] mt-1">{SALON_DETAILS.addressLine1}</p>
            <p className="text-[11px]">{SALON_DETAILS.cityStateZip}</p>
            <p className="text-[11px]">Ph: {SALON_DETAILS.phone}</p>
          </div>

          <div className="text-[11px] pb-3 border-b border-dashed border-black/40 mb-3 space-y-1">
            <div className="flex justify-between items-center">
              <span className="font-bold tracking-wider uppercase text-sm">
                {getInvoiceHeaderBadge()}
              </span>
              <span>#{advance.id}</span>
            </div>
            <div className="flex justify-between">
              <span>Date:</span>
              <span>{formattedDate}</span>
            </div>
            {deliveryDate && (
              <div className="flex justify-between">
                <span>Delivery:</span>
                <span>{deliveryDate}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Status:</span>
              <span className="font-bold uppercase">{advance.status}</span>
            </div>
            <div className="flex justify-between">
              <span>Customer:</span>
              <span className="font-bold truncate max-w-[150px]">
                {advance.customer_name || "Counter Customer"}
              </span>
            </div>
            {advance.customer_phone && (
              <div className="flex justify-between">
                <span>Phone:</span>
                <span>+91 {advance.customer_phone}</span>
              </div>
            )}
          </div>

          {/* Items */}
          <div className="border-b border-dashed border-black/40 pb-3 mb-3">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-black/20 text-left">
                  <th className="pb-1">Item</th>
                  <th className="pb-1 text-center">Qty</th>
                  <th className="pb-1 text-right">Amt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dashed divide-black/10">
                {advance.items.map((item, idx) => {
                  const price = Number(item.snapshot_price) || 0;
                  return (
                    <tr key={idx}>
                      <td className="py-1 pr-1">
                        <p className="font-bold truncate">{item.snapshot_name}</p>
                      </td>
                      <td className="py-1 text-center font-bold">{item.quantity}</td>
                      <td className="py-1 text-right font-medium">
                        {(item.quantity * price).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <InvoiceTotalsBlock
            totals={totals}
            variant="thermal"
            advancePaid={depositNum}
            depositLabel={depositLabel}
          />

          {advance.notes && (
            <div className="text-[10px] text-zinc-700 pb-2 mb-2 border-b border-dashed border-black/20">
              <span className="font-bold">Notes: </span>
              {advance.notes}
            </div>
          )}

          {/* Terms & Notes */}
          <div className="text-[9px] text-zinc-600 space-y-0.5 pb-2 mb-2 border-b border-dashed border-black/20 leading-tight">
            <p className="font-bold text-black">Terms &amp; Conditions:</p>
            {INVOICE_TERMS_AND_NOTES.map((term, i) => (
              <p key={i}>• {term}</p>
            ))}
          </div>

          <div className="text-[11px] text-center pt-1 font-semibold italic">
            Thank you for choosing Love &amp; Happy!
          </div>
        </div>
      ) : (
        /* Sheet (A4 / A5) Layout */
        <div className="invoice-sheet w-full max-w-[760px] bg-white border border-zinc-200/80 shadow-xs rounded-sm p-6 sm:p-12 text-zinc-900 print:border-none print:shadow-none print:p-0 print:rounded-none">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pb-6 border-b border-zinc-200">
            <div className="flex items-start gap-3.5 sm:gap-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-sm border border-zinc-300 overflow-hidden bg-black p-1">
                <img
                  src="/logo.jpeg"
                  alt="Love & Happy Unisex Salon"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="space-y-1">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900">
                  {SALON_DETAILS.name}
                </h1>
                <p className="text-xs text-zinc-500 leading-relaxed max-w-xs">
                  {SALON_DETAILS.addressLine1}, {SALON_DETAILS.cityStateZip}
                </p>
                <div className="text-xs text-zinc-600 pt-1">
                  <p>Phone: {SALON_DETAILS.phone}</p>
                </div>
              </div>
            </div>

            <div className="sm:text-right space-y-1.5 shrink-0">
              <div>
                <span className="font-bold tracking-wider uppercase text-sm text-zinc-900">
                  {getInvoiceHeaderBadge()}
                </span>
                <p className="text-xs font-mono text-zinc-500">#{advance.id}</p>
              </div>
              <div className="text-xs text-zinc-600 space-y-0.5 pt-1">
                <div>
                  <span className="text-zinc-400">Date: </span>
                  <span className="text-zinc-800 font-medium">{formattedDate}</span>
                </div>
                <div>
                  <span className="text-zinc-400">Status: </span>
                  <span className="text-zinc-800 font-medium uppercase">
                    {advance.status}
                  </span>
                </div>
                {deliveryDate && (
                  <div>
                    <span className="text-zinc-400">Delivery: </span>
                    <span className="text-zinc-700">{deliveryDate}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Billed To */}
          <div className="py-5 border-b border-zinc-200 text-xs">
            <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
              Customer
            </div>
            <div className="text-sm font-semibold text-zinc-900">
              {advance.customer_name?.trim() ? advance.customer_name : "Counter Customer"}
            </div>
            {advance.customer_phone && (
              <div className="text-xs text-zinc-600 font-mono mt-0.5">
                +91 {advance.customer_phone}
              </div>
            )}
            {advance.customer_address && (
              <div className="text-xs text-zinc-600 mt-0.5 max-w-[260px]">
                {advance.customer_address}
              </div>
            )}
          </div>

          {/* Items */}
          <div className="py-4">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  <th className="pb-3 w-8 text-center">#</th>
                  <th className="pb-3">Item Description</th>
                  <th className="pb-3 text-center w-12">Qty</th>
                  <th className="pb-3 text-right w-24">Rate (₹)</th>
                  <th className="pb-3 text-right w-28">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {advance.items.map((item, index) => {
                  const unitPrice = Number(item.snapshot_price) || 0;
                  const itemTotal = unitPrice * item.quantity;
                  return (
                    <tr key={index}>
                      <td className="py-3 text-center text-zinc-400 font-mono">
                        {index + 1}
                      </td>
                      <td className="py-3">
                        <div className="font-medium text-zinc-900">
                          {item.snapshot_name}
                        </div>
                        {item.snapshot_desc && (
                          <div className="text-[10px] text-zinc-500">
                            {item.snapshot_desc}
                          </div>
                        )}
                      </td>
                      <td className="py-3 text-center text-zinc-800 font-medium">
                        {item.quantity}
                      </td>
                      <td className="py-3 text-right font-mono text-zinc-600">
                        {fmt(unitPrice)}
                      </td>
                      <td className="py-3 text-right font-mono font-semibold text-zinc-900">
                        {fmt(itemTotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals & Terms */}
          <div className="border-t border-zinc-200 pt-4 flex flex-col sm:flex-row justify-between items-start gap-8 text-xs">
            <div className="space-y-3.5 max-w-sm flex-1">
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                  AMOUNT IN WORDS
                </div>
                <div className="text-xs font-semibold italic text-slate-900">
                  {numberToWords(totals.total)}
                </div>
              </div>

              {/* Advance Paid & Balance Due */}
              <div className="text-xs space-y-1 pt-1">
                <div>
                  <span className="text-slate-500 text-xs">Advance Paid: </span>
                  <span className="font-bold text-slate-900">
                    ₹{fmt(totals.advancePaid)}
                  </span>
                </div>
                {totals.balance > 0 && (
                  <div>
                    <span className="text-slate-500 text-xs">Balance Due: </span>
                    <span className="font-bold text-rose-600">
                      ₹{fmt(totals.balance)}
                    </span>
                  </div>
                )}
              </div>

              {/* Terms & Notes */}
              <div className="text-[11px] text-zinc-500 leading-relaxed space-y-1">
                <p className="font-semibold text-zinc-700">Terms &amp; Notes:</p>
                {INVOICE_TERMS_AND_NOTES.map((term, i) => (
                  <p key={i}>• {term}</p>
                ))}
              </div>
            </div>

            {/* Right Side: Subtotal & Grand Total Block */}
            <InvoiceTotalsBlock totals={totals} variant="a4" />
          </div>

          {advance.notes && (
            <div className="mt-6 text-xs text-zinc-600">
              <span className="font-semibold text-zinc-700">Notes: </span>
              {advance.notes}
            </div>
          )}

          <div className="mt-12 pt-6 border-t border-zinc-200 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 text-xs">
            <div className="text-[11px] text-zinc-400">
              Thank you for choosing Love &amp; Happy Unisex Salon!
            </div>
            <div className="sm:text-right space-y-1 self-end">
              <div className="border-b border-zinc-300 w-36 mb-1 ml-auto"></div>
              <div className="font-semibold text-zinc-800 text-xs">
                Authorised Signatory
              </div>
              <div className="text-[10px] text-zinc-400">For Love &amp; Happy Unisex Salon</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
