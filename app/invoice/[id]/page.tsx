import { dbStore } from "@/lib/dbStore";
import { ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";
import { InvoiceActions } from "./InvoiceActions";
import { INVOICE_TERMS_AND_NOTES } from "@/lib/constants";
import { calculateAdvanceOrderTotals, calculateOrderTotals } from "@/lib/advanceOrderCalculations";
import { InvoiceTotalsBlock } from "@/components/InvoiceTotalsBlock";
import { supabase } from "@/lib/supabaseClient";

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

export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const isEmbed = resolvedSearchParams.embed === "true";
  const isPrint = resolvedSearchParams.print === "true";
  const paper = resolvedSearchParams.paper || "a4";
  const size = resolvedSearchParams.size || "a4";

  let order = await dbStore.getOrderWithRelations(id);

  if (!order) {
    const adv = await dbStore.getAdvanceOrder(id);
    if (adv) {
      if (adv.status === "COMPLETED" && adv.finalized_order_id) {
        order = await dbStore.getOrderWithRelations(adv.finalized_order_id);
      }
      if (!order) {
        const advTotals = calculateOrderTotals(adv);

        const isCompleted = adv.status === "COMPLETED";
        order = {
          id: adv.finalized_order_id || adv.id,
          customer_id: adv.customer_id,
          source: "OFFLINE",
          status: isCompleted ? "COMPLETED" : "PENDING",
          is_gst: advTotals.gstRate > 0,
          subtotal: advTotals.subtotal,
          discount_type: (adv as any).discount_type || "FIXED",
          discount_value: Number((adv as any).discount_value) || 0,
          discount_amount: advTotals.discount,
          gst_percentage: advTotals.gstRate,
          gst_amount: advTotals.gst,
          delivery_fee: advTotals.deliveryFee,
          grand_total: advTotals.total,
          cash_received: advTotals.paid,
          split_cash: 0,
          split_gpay: 0,
          payment_mode: (adv.deposit_payment_mode as any) || "CASH",
          bill_date: adv.finalized_at
            ? adv.finalized_at.split("T")[0]
            : adv.created_at
            ? adv.created_at.split("T")[0]
            : new Date().toISOString().split("T")[0],
          created_at: adv.created_at || new Date().toISOString(),
          is_advance: true,
          order_type: "ADVANCE",
          invoice_id: adv.finalized_order_id || adv.id,
          customer_name: adv.customer_name || "Counter Customer",
          customer_phone: adv.customer_phone || "",
          customer_address: adv.customer_address || null,
          tax_mode: (adv as any).tax_mode || "exclusive",
          items: (adv.items || []).map((it) => ({
            id: it.id,
            order_id: adv.id,
            product_id: it.product_id,
            snapshot_name: it.snapshot_name,
            snapshot_price: Number(it.snapshot_price) || 0,
            quantity: Number(it.quantity) || 1,
          })),
        };
      }
    }
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-6 text-center font-sans text-zinc-800">
        <div className="w-12 h-12 rounded-lg border border-zinc-200 bg-white flex items-center justify-center mb-3 text-zinc-500 shadow-xs">
          <FileText className="w-6 h-6" />
        </div>
        <h1 className="text-base font-semibold text-zinc-900 mb-1">
          Invoice Not Found
        </h1>
        <p className="text-xs text-zinc-500 max-w-sm mb-5">
          The requested invoice identifier #{id} could not be found.
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

  let advOrder: any = null;
  if (id.startsWith("DEP-")) {
    advOrder = await dbStore.getAdvanceOrder(id);
  } else if (order.is_advance || order.order_type === "ADVANCE") {
    try {
      const { data: matchedAdv } = await supabase
        .from("advance_orders")
        .select("*")
        .or(`finalized_order_id.eq.${order.id},id.eq.${order.id}`)
        .maybeSingle();
      if (matchedAdv) {
        advOrder = await dbStore.getAdvanceOrder(matchedAdv.id);
      }
    } catch (e) {}
  }

  const totals = calculateOrderTotals(order);
  const grandTotalNum = totals.total;
  const subtotalNum = totals.subtotal;
  const discountNum = totals.discount;
  const gstAmountNum = totals.gst;
  const deliveryFeeNum = totals.deliveryFee;
  const cashReceivedNum = Number(order.cash_received) || 0;
  const splitCashNum = Number(order.split_cash) || 0;
  const splitGpayNum = Number(order.split_gpay) || 0;

  const isAdvanceInvoice = Boolean(advOrder || id.startsWith("DEP-") || order.is_advance || order.order_type === "ADVANCE");
  const advanceTotals = advOrder ? calculateOrderTotals(advOrder) : totals;
  const advanceBalanceDue = isAdvanceInvoice ? advanceTotals.balance : 0;

  const changeReturned =
    cashReceivedNum > grandTotalNum ? cashReceivedNum - grandTotalNum : 0;

  const fmt = (n: number) =>
    Number(n || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const paymentLabel =
    order.payment_mode === "SPLIT"
      ? "Split · Cash + GPay"
      : order.payment_mode === "GPAY"
        ? "GPay"
        : "Cash";

  const halfGstRate = order.gst_percentage ? order.gst_percentage / 2 : 9;
  const halfGstAmount = gstAmountNum > 0 ? gstAmountNum / 2 : 0;

  const formattedDate = new Date(order.bill_date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });

  const formattedTime = new Date(order.created_at).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });

  const getInvoiceHeaderBadge = () => {
    // If viewed as an active/unsettled advance order
    const isAdvanceOrder =
      order.is_advance === true ||
      (order as any).order_type === "ADVANCE" ||
      order.id?.startsWith("DEP-");

    if (isAdvanceOrder && order.status?.toUpperCase() !== "COMPLETED") {
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
      {/* Print Stylesheet */}
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
          .print-hidden {
            display: none !important;
          }
          .invoice-sheet {
            border: none !important;
            box-shadow: none !important;
            max-width: 100% !important;
            width: 100% !important;
            padding: 0 !important;
          }
        }
      `}</style>

      {/* Top Action Toolbar (Hidden in print and embed) */}
      {!isEmbed && (
        <div className="w-full max-w-[760px] mb-4 print:hidden">
          <InvoiceActions
            orderId={order.id}
            customerName={order.customer_name}
            customerPhone={order.customer_phone}
            grandTotal={grandTotalNum}
            isGst={order.is_gst}
            autoPrint={isPrint}
          />
        </div>
      )}

      {paper === "thermal" ? (
        <div className={`invoice-sheet bg-white mx-auto text-black font-mono leading-tight p-3 ${size === "58" ? "w-[260px]" : "w-[320px]"}`}>
          {/* Thermal Receipt Layout */}
          <div className="text-center pb-3 border-b border-dashed border-black/40 mb-3">
            <h1 className="text-xl font-bold tracking-tight">LOVE &amp; HAPPY</h1>
            <p className="text-[11px] font-bold tracking-wider uppercase text-zinc-700">Unisex Salon</p>
            <p className="text-[11px] mt-1">No 65, 4 th cross west, Thillai Nagar</p>
            <p className="text-[11px]">Tiruchchirappalli, TN - 620018</p>
            <p className="text-[11px]">Ph: +91 98431 12203</p>
            {order.is_gst && <p className="text-[11px] font-bold mt-1">GSTIN: —</p>}
          </div>
          <div className="text-[11px] pb-3 border-b border-dashed border-black/40 mb-3 space-y-1">
            <div className="flex justify-between items-center">
              <span className="font-bold tracking-wider uppercase text-sm">
                {getInvoiceHeaderBadge()}
              </span>
              <span>#{order.id}</span>
            </div>
            <div className="flex justify-between">
              <span>Date:</span>
              <span>{formattedDate} {formattedTime}</span>
            </div>
            <div className="flex justify-between">
              <span>Customer:</span>
              <span className="font-semibold text-right">{order.customer_name || "Counter Sale"}</span>
            </div>
          </div>
          <div className="text-[11px] w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-dashed border-black/40">
                  <th className="py-1 font-bold">Item</th>
                  <th className="py-1 font-bold text-center">Qty</th>
                  <th className="py-1 font-bold text-right">Amt</th>
                </tr>
              </thead>
              <tbody className="align-top">
                {order.items.map((item, i) => (
                  <tr key={i} className="border-b border-dashed border-black/15">
                    <td className="py-1.5 pr-1">
                      <div className="font-semibold">{item.snapshot_name}</div>
                    </td>
                    <td className="py-1.5 text-center">{item.quantity}</td>
                    <td className="py-1.5 text-right font-medium">{(item.quantity * Number(item.snapshot_price)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <InvoiceTotalsBlock
            totals={totals}
            variant="thermal"
            cashReceived={cashReceivedNum}
            changeReturned={changeReturned}
          />
          <div className="text-[10px] space-y-1 mb-2">
            <p className="font-semibold text-center border-b border-dashed border-black/20 pb-2 mb-2">{paymentLabel}</p>
            <p className="text-[9px] uppercase tracking-wider text-center text-gray-700">{numberToWords(totals.total)}</p>
          </div>
          {/* Terms & Notes in Thermal */}
          <div className="text-[9px] text-zinc-600 space-y-0.5 pb-2 mb-2 border-b border-dashed border-black/20 leading-tight">
            <p className="font-bold text-black">Terms &amp; Notes:</p>
            {INVOICE_TERMS_AND_NOTES.map((term, i) => (
              <p key={i}>• {term}</p>
            ))}
          </div>
          <div className="text-[11px] text-center pt-1 font-semibold italic">
            Thank you for choosing Love &amp; Happy Unisex Salon!
          </div>
        </div>
      ) : (
        <div className="invoice-sheet w-full max-w-[760px] bg-white border border-zinc-200/80 shadow-xs rounded-sm p-6 sm:p-12 text-zinc-900 print:border-none print:shadow-none print:p-0 print:rounded-none">
        {/* Header: Company & Invoice Info */}
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
                Love &amp; Happy Unisex Salon
              </h1>
              <p className="text-xs text-zinc-500 leading-relaxed max-w-xs">
                No 65, 4 th cross west, Thillai Nagar, Tiruchchirappalli 620018
              </p>
              <div className="text-xs text-zinc-600 pt-1 space-y-0.5">
                <p>Phone: +91 98431 12203</p>
                {order.is_gst && (
                  <p className="text-zinc-800 font-medium pt-0.5">
                    GSTIN: <span className="font-mono">—</span> • State Code: 33
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="sm:text-right space-y-1.5 shrink-0">
            <div>
              <span className="font-bold tracking-wider uppercase text-sm text-zinc-900">
                {getInvoiceHeaderBadge()}
              </span>
              <p className="text-xs font-mono text-zinc-500">#{order.id}</p>
            </div>

            <div className="text-xs text-zinc-600 space-y-0.5 pt-1">
              <div>
                <span className="text-zinc-400">Date: </span>
                <span className="text-zinc-800 font-medium">{formattedDate}</span>
              </div>
              <div>
                <span className="text-zinc-400">Time: </span>
                <span className="text-zinc-700">{formattedTime}</span>
              </div>
              <div>
                <span className="text-zinc-400">Payment: </span>
                <span className="text-zinc-800 font-medium uppercase">
                  {paymentLabel} • {order.status}
                </span>
              </div>
              <div>
                <span className="text-zinc-400">Channel: </span>
                <span className="text-zinc-700 uppercase">{order.source}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Billed To Details */}
        <div className="py-5 border-b border-zinc-200 flex flex-col sm:flex-row justify-between items-start gap-4 text-xs">
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              BILLED TO
            </div>
            <div className="text-sm font-semibold text-zinc-900">
              {order.customer_name?.trim() ? order.customer_name : "Counter Customer"}
            </div>
            {order.customer_phone ? (
              <div className="text-xs text-zinc-600 font-mono mt-0.5">
                +91 {order.customer_phone}
              </div>
            ) : (
              <div className="text-xs text-zinc-400 italic mt-0.5">
                Walk-in Counter Sale
              </div>
            )}
            {order.customer_address && (
              <div className="text-xs text-zinc-600 mt-0.5 max-w-[200px]">
                {order.customer_address}
              </div>
            )}
          </div>

          <div className="sm:text-right text-xs">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              PLACE OF SUPPLY
            </div>
            <div className="font-medium text-slate-900">Tamil Nadu (33)</div>
          </div>
        </div>

        {/* Particulars Table */}
        <div className="py-4">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                <th className="pb-3 w-8 text-center">#</th>
                <th className="pb-3">Item Description</th>
                {order.is_gst && <th className="pb-3 text-center w-16">HSN</th>}
                <th className="pb-3 text-center w-12">Qty</th>
                <th className="pb-3 text-right w-24">
                  Rate (₹){order.is_gst && <span className="block text-[8px] font-normal normal-case tracking-normal text-zinc-400">incl. GST</span>}
                </th>
                <th className="pb-3 text-right w-28">
                  Amount (₹){order.is_gst && <span className="block text-[8px] font-normal normal-case tracking-normal text-zinc-400">incl. GST</span>}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {order.items.map((item, index: number) => {
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
                    </td>
                    {order.is_gst && (
                      <td className="py-3 text-center font-mono text-zinc-500">
                        8517
                      </td>
                    )}
                    <td className="py-3 text-center text-zinc-800 font-medium">
                      {item.quantity}
                    </td>
                    <td className="py-3 text-right font-mono text-zinc-600">
                      {unitPrice.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-3 text-right font-mono font-semibold text-zinc-900">
                      {itemTotal.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals & Breakdown */}
        <div className="border-t border-zinc-200 pt-4 flex flex-col sm:flex-row justify-between items-start gap-8 text-xs">
          {/* Left Side: Payment Audit & Words Breakdown */}
          <div className="space-y-3.5 max-w-sm flex-1">
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                AMOUNT IN WORDS
              </div>
              <div className="text-xs font-semibold italic text-slate-900">
                {numberToWords(grandTotalNum)}
              </div>
            </div>

            {/* Payment Audit */}
            <div className="text-xs space-y-1 pt-1">
              {cashReceivedNum > 0 && (
                <div>
                  <span className="text-slate-500 text-xs">Cash Received: </span>
                  <span className="font-bold text-slate-900">
                    ₹{fmt(cashReceivedNum)}
                  </span>
                </div>
              )}
              {changeReturned > 0 && (
                <div>
                  <span className="text-slate-500 text-xs">Change Returned: </span>
                  <span className="font-bold text-slate-900">
                    ₹{fmt(changeReturned)}
                  </span>
                </div>
              )}
              {isAdvanceInvoice && advanceBalanceDue > 0 && (
                <div>
                  <span className="text-slate-500 text-xs">Balance Due: </span>
                  <span className="font-bold text-rose-600">
                    ₹{fmt(advanceBalanceDue)}
                  </span>
                </div>
              )}
            </div>

            {/* Terms & Notes */}
            <div className="text-[11px] text-slate-500 leading-relaxed pt-1 space-y-0.5">
              <p className="font-semibold text-slate-700 mb-0.5">Terms &amp; Notes:</p>
              {INVOICE_TERMS_AND_NOTES.map((term, i) => (
                <p key={i}>• {term}</p>
              ))}
            </div>
          </div>

          {/* Right Side: Subtotal & Grand Total Block */}
          <InvoiceTotalsBlock totals={totals} variant="a4" />
        </div>

        {/* Signatory & Machine Note */}
        <div className="mt-12 pt-6 border-t border-zinc-200 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 text-xs">
          <div className="text-[11px] text-zinc-400">
            Thank you for your visit! • Love &amp; Happy Unisex Salon POS
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
