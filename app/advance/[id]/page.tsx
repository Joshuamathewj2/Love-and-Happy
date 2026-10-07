import { dbStore } from "@/lib/dbStore";
import { ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";
import { AdvanceReceiptActions } from "./AdvanceReceiptActions";
import { INVOICE_TERMS_AND_NOTES, SALON_DETAILS } from "@/lib/constants";
import { calculateAdvanceOrderTotals } from "@/lib/advanceOrderCalculations";

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

  const totals = calculateAdvanceOrderTotals({
    items: advance.items.map((it) => ({
      price: Number(it.snapshot_price) || 0,
      qty: Number(it.quantity) || 1,
    })),
    subtotal: Number(advance.subtotal) || Number(advance.total_amount) || 0,
    isGst: (advance as any).is_gst !== undefined ? Boolean((advance as any).is_gst) : undefined,
    gstPercentage: (advance as any).gst_percentage !== undefined ? Number((advance as any).gst_percentage) : undefined,
    taxMode: (advance as any).tax_mode || "exclusive",
    manualDiscount:
      Number((advance as any).discount_amount) > 0 || Number((advance as any).discount_value) > 0
        ? {
            type: (((advance as any).discount_type || "FIXED").toUpperCase() as any),
            value: Number((advance as any).discount_value) || Number((advance as any).discount_amount) || 0,
          }
        : null,
    deliveryFee: Number((advance as any).delivery_fee) || 0,
    advanceAmount: Number(advance.deposit_amount) || 0,
    grandTotal: Number(advance.total_amount) || undefined,
  });

  const totalNum = totals.grandTotal;
  const isCompleted = advance.status === "COMPLETED";
  const depositNum = totals.totalPaid;
  const balanceNum = totals.remainingBalance;
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
          <div className="text-[11px] py-3 border-b border-dashed border-black/40 mb-3 space-y-1.5">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>₹{fmt(totals.subtotal)}</span>
            </div>
            {totals.discountAmount > 0 && (
              <div className="flex justify-between text-black">
                <span>Discount:</span>
                <span>-₹{fmt(totals.discountAmount)}</span>
              </div>
            )}
            {totals.gstAmount > 0 && (
              <>
                <div className="flex justify-between text-black">
                  <span>CGST ({(totals.gstPercentage / 2).toFixed(1)}%):</span>
                  <span>₹{fmt(totals.cgstAmount)}</span>
                </div>
                <div className="flex justify-between text-black">
                  <span>SGST ({(totals.gstPercentage / 2).toFixed(1)}%):</span>
                  <span>₹{fmt(totals.sgstAmount)}</span>
                </div>
              </>
            )}
            {totals.deliveryFee > 0 && (
              <div className="flex justify-between text-black">
                <span>Delivery:</span>
                <span>₹{fmt(totals.deliveryFee)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold border-t border-dashed border-black/20 pt-1">
              <span>Order Total:</span>
              <span>₹{fmt(totalNum)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Deposit Paid ({depositLabel}):</span>
              <span>₹{fmt(depositNum)}</span>
            </div>
            <div className="flex justify-between text-[13px] font-black mt-2 pt-1 border-t border-dashed border-black/40">
              <span>BALANCE DUE:</span>
              <span>₹{fmt(balanceNum)}</span>
            </div>
          </div>

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
            <div className="space-y-4 max-w-sm">
              <div className="text-[11px] text-zinc-500 leading-relaxed space-y-1">
                <p className="font-semibold text-zinc-700">Terms &amp; Notes:</p>
                {INVOICE_TERMS_AND_NOTES.map((term, i) => (
                  <p key={i}>• {term}</p>
                ))}
              </div>
            </div>

            <div className="w-full sm:w-64 space-y-2 text-xs">
              <div className="flex justify-between text-zinc-600">
                <span>Subtotal</span>
                <span className="font-mono text-zinc-900">₹{fmt(totals.subtotal)}</span>
              </div>
              {totals.discountAmount > 0 && (
                <div className="flex justify-between text-zinc-600">
                  <span>Discount</span>
                  <span className="font-mono text-zinc-900">− ₹{fmt(totals.discountAmount)}</span>
                </div>
              )}
              {totals.gstAmount > 0 && (
                <>
                  <div className="flex justify-between text-zinc-600">
                    <span>CGST ({(totals.gstPercentage / 2).toFixed(1)}%)</span>
                    <span className="font-mono text-zinc-900">₹{fmt(totals.cgstAmount)}</span>
                  </div>
                  <div className="flex justify-between text-zinc-600">
                    <span>SGST ({(totals.gstPercentage / 2).toFixed(1)}%)</span>
                    <span className="font-mono text-zinc-900">₹{fmt(totals.sgstAmount)}</span>
                  </div>
                </>
              )}
              {totals.deliveryFee > 0 && (
                <div className="flex justify-between text-zinc-600">
                  <span>Delivery Fee</span>
                  <span className="font-mono text-zinc-900">₹{fmt(totals.deliveryFee)}</span>
                </div>
              )}
              <div className="flex justify-between text-zinc-900 font-bold border-t border-zinc-200 pt-1.5">
                <span>Order Total</span>
                <span className="font-mono text-zinc-900">₹{fmt(totalNum)}</span>
              </div>
              <div className="flex justify-between text-zinc-600">
                <span>Deposit Paid ({depositLabel})</span>
                <span className="font-mono text-zinc-900">− ₹{fmt(depositNum)}</span>
              </div>
              <div className="border-t border-zinc-900 pt-2.5 mt-2 flex justify-between items-baseline">
                <span className="text-sm font-bold text-zinc-900 uppercase">
                  Balance Due
                </span>
                <span className="font-mono text-lg font-bold text-zinc-900">
                  ₹{fmt(balanceNum)}
                </span>
              </div>
            </div>
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
