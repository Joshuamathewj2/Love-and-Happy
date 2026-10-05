import React from "react";
import { INVOICE_TERMS_AND_NOTES } from "@/lib/constants";

// Clean Indian Number-to-Words Converter
export function numberToWords(num: number): string {
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

export interface PrintableReceiptProps {
  order: {
    id: string;
    customer_name?: string | null;
    customer_phone?: string | null;
    customer_address?: string | null;
    created_at?: string;
    payment_mode?: string;
    status?: string;
    source?: string;
    items: Array<{
      snapshot_name: string;
      snapshot_price: number | string;
      quantity: number;
      snapshot_desc?: string | null;
    }>;
    subtotal?: number;
    discount_value?: number;
    discount_type?: "PERCENT" | "FIXED" | "percent" | "fixed";
    discount_amount?: number;
    is_gst?: boolean;
    gst_rate?: number;
    gst_percentage?: number;
    gst_amount?: number;
    delivery_fee?: number;
    total_amount?: number;
    cash_received?: number;
    change_returned?: number;
    balance_due?: number;
    amount_received?: number;
  };
}

export default function PrintableReceipt({ order }: PrintableReceiptProps) {
  const formatINR = (val: number) =>
    Number(val || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const itemsSubtotal =
    Number(order.subtotal) ||
    order.items.reduce(
      (sum, i) => sum + Number(i.snapshot_price) * (i.quantity || 1),
      0
    );
  const discountAmount = Number(order.discount_amount) || 0;
  const deliveryFee = Number(order.delivery_fee) || 0;
  const isGst = Boolean(order.is_gst);
  const gstRate = Number(order.gst_percentage ?? order.gst_rate ?? (isGst ? 18 : 0));
  const gstAmount = Number(order.gst_amount) || 0;
  const halfGstRate = gstRate > 0 ? gstRate / 2 : 0;
  const halfGstAmount = gstAmount > 0 ? gstAmount / 2 : 0;

  const total = Number(order.total_amount ?? (order as any).grand_total ?? itemsSubtotal);
  const taxableValue = isGst && gstAmount > 0 && Math.abs(total - (itemsSubtotal - discountAmount + deliveryFee)) < 0.05
    ? itemsSubtotal - discountAmount - gstAmount
    : itemsSubtotal - discountAmount;
  const amountReceived = Number(
    order.cash_received ?? order.amount_received ?? total
  );
  const changeReturned =
    order.change_returned !== undefined
      ? Number(order.change_returned)
      : Math.max(0, amountReceived - total);
  const balanceDue =
    order.balance_due !== undefined
      ? Number(order.balance_due)
      : Math.max(0, total - amountReceived);

  const formattedDate = order.created_at
    ? new Date(order.created_at).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : new Date().toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

  return (
    <div className="w-full max-w-[760px] mx-auto bg-white p-6 sm:p-8 font-sans text-zinc-900 border border-zinc-200 rounded-sm print:border-none print:p-0">
      {/* Top Customer Row / Place of Supply Header */}
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

      {/* Items Table */}
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
            {order.items.map((item, index) => {
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
                  <td className="py-3 text-center text-zinc-800 font-medium">
                    {item.quantity}
                  </td>
                  <td className="py-3 text-right font-mono text-zinc-600">
                    ₹{formatINR(unitPrice)}
                  </td>
                  <td className="py-3 text-right font-mono font-semibold text-zinc-900">
                    ₹{formatINR(itemTotal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Totals & Breakdown: Formal 2-Column Accounting Layout */}
      <div className="border-t border-zinc-200 pt-4 flex flex-col sm:flex-row justify-between items-start gap-8 text-xs">
        {/* Left Side: Payment Audit & Words Breakdown */}
        <div className="space-y-3.5 max-w-sm flex-1">
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
              AMOUNT IN WORDS
            </div>
            <div className="text-xs font-semibold italic text-slate-900">
              {numberToWords(total)}
            </div>
          </div>

          {/* Cash Payment Audit */}
          <div className="text-xs space-y-1 pt-1">
            <div>
              <span className="text-slate-500 text-xs">Cash Received: </span>
              <span className="font-bold text-slate-900">
                ₹{formatINR(amountReceived)}
              </span>
            </div>
            {amountReceived >= total ? (
              <div>
                <span className="text-slate-500 text-xs">Change Returned: </span>
                <span className="font-bold text-slate-900">
                  ₹{formatINR(changeReturned)}
                </span>
              </div>
            ) : (
              <div>
                <span className="text-slate-500 text-xs">Balance Due: </span>
                <span className="font-bold text-rose-600">
                  ₹{formatINR(balanceDue)}
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

        {/* Right Side: Financial Lines & Grand Total Block */}
        <div className="w-full sm:w-64 space-y-2 text-xs">
          <div className="flex justify-between text-slate-600">
            <span>Items Subtotal / Taxable Value</span>
            <span className="font-mono text-slate-900 font-medium">
              ₹{formatINR(taxableValue)}
            </span>
          </div>

          {discountAmount > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Discount</span>
              <span className="font-mono text-rose-600 font-medium">
                -₹{formatINR(discountAmount)}
              </span>
            </div>
          )}

          {isGst && gstAmount > 0 && (
            <>
              <div className="flex justify-between text-slate-600">
                <span>CGST ({halfGstRate.toFixed(1)}%)</span>
                <span className="font-mono text-slate-900 font-medium">
                  ₹{formatINR(halfGstAmount)}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>SGST ({halfGstRate.toFixed(1)}%)</span>
                <span className="font-mono text-slate-900 font-medium">
                  ₹{formatINR(halfGstAmount)}
                </span>
              </div>
            </>
          )}

          {deliveryFee > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Delivery / Freight</span>
              <span className="font-mono text-slate-900 font-medium">
                ₹{formatINR(deliveryFee)}
              </span>
            </div>
          )}

          <div className="border-t-2 border-b-4 border-double border-slate-900 py-2 mt-2 flex justify-between items-baseline">
            <span className="font-black text-sm tracking-wider uppercase text-black">
              GRAND TOTAL
            </span>
            <span className="font-mono font-black text-base text-black">
              ₹{formatINR(total)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
