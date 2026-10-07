import React from "react";
import { OrderTotalsResult } from "@/lib/advanceOrderCalculations";

interface InvoiceTotalsBlockProps {
  totals: OrderTotalsResult;
  variant?: "a4" | "thermal";
  advancePaid?: number;
  depositLabel?: string;
  cashReceived?: number;
  changeReturned?: number;
}

export function InvoiceTotalsBlock({
  totals,
  variant = "a4",
  advancePaid,
  depositLabel = "Cash",
  cashReceived,
  changeReturned,
}: InvoiceTotalsBlockProps) {
  const fmt = (n: number) =>
    Number(n || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  if (variant === "thermal") {
    return (
      <div className="text-[11px] py-3 border-b border-dashed border-black/40 mb-3 space-y-1.5">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>₹{fmt(totals.subtotal)}</span>
        </div>
        {totals.discount > 0 && (
          <div className="flex justify-between text-black">
            <span>{totals.discountLabel}:</span>
            <span>-₹{fmt(totals.discount)}</span>
          </div>
        )}
        {totals.gst > 0 && (
          <div className="flex justify-between text-black">
            <span>{totals.gstLabel}:</span>
            <span>+₹{fmt(totals.gst)}</span>
          </div>
        )}
        {totals.deliveryFee > 0 && (
          <div className="flex justify-between">
            <span>Delivery:</span>
            <span>₹{fmt(totals.deliveryFee)}</span>
          </div>
        )}
        <div className="border-t border-dashed border-black/40 my-1.5" />
        <div className="flex justify-between text-[14px] font-black">
          <span>TOTAL:</span>
          <span>₹{fmt(totals.total)}</span>
        </div>
        {advancePaid !== undefined && (
          <div className="flex justify-between font-semibold mt-1">
            <span>Advance Paid ({depositLabel}):</span>
            <span>₹{fmt(advancePaid)}</span>
          </div>
        )}
        {cashReceived !== undefined && cashReceived > 0 && (
          <div className="flex justify-between text-[11px] font-semibold mt-1">
            <span>Amount Received:</span>
            <span>₹{fmt(cashReceived)}</span>
          </div>
        )}
        {changeReturned !== undefined && changeReturned > 0 && (
          <div className="flex justify-between text-[11px] font-semibold">
            <span>Change Returned:</span>
            <span>₹{fmt(changeReturned)}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full sm:w-64 space-y-2 text-xs">
      <div className="flex justify-between text-slate-600">
        <span>Subtotal</span>
        <span className="font-mono text-slate-900 font-medium">
          ₹{fmt(totals.subtotal)}
        </span>
      </div>

      {totals.discount > 0 && (
        <div className="flex justify-between text-pink-600 font-medium">
          <span>{totals.discountLabel}</span>
          <span className="font-mono">
            -₹{fmt(totals.discount)}
          </span>
        </div>
      )}

      {totals.gst > 0 && (
        <div className="flex justify-between text-slate-500 text-[11px]">
          <span>{totals.gstLabel}</span>
          <span className="font-mono">
            +₹{fmt(totals.gst)}
          </span>
        </div>
      )}

      {totals.deliveryFee > 0 && (
        <div className="flex justify-between text-slate-600">
          <span>Delivery</span>
          <span className="font-mono text-slate-800">
            ₹{fmt(totals.deliveryFee)}
          </span>
        </div>
      )}

      <div className="border-t border-pink-300 my-2" />

      <div className="flex justify-between items-baseline">
        <span className="font-black text-sm tracking-wider uppercase text-pink-600">
          TOTAL
        </span>
        <span className="font-mono font-black text-base text-pink-600">
          ₹{fmt(totals.total)}
        </span>
      </div>
    </div>
  );
}
