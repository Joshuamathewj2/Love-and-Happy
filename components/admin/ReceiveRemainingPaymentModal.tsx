"use client";

import React, { useState, useRef } from "react";
import { X, Check, Loader2 } from "lucide-react";
import { AdvanceOrderWithRelations } from "@/lib/types";
import { calculateAdvanceOrderTotals } from "@/lib/advanceOrderCalculations";
import { finalizeAdvanceOrder } from "@/app/pos/actions";
import { supabase } from "@/lib/supabaseClient";

export interface ReceiveRemainingPaymentModalProps {
  order: AdvanceOrderWithRelations;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
}

export function ReceiveRemainingPaymentModal({
  order,
  onClose,
  onSuccess,
}: ReceiveRemainingPaymentModalProps) {
  const [discountType, setDiscountType] = useState<"FIXED" | "PERCENT">("FIXED");
  const [discountValue, setDiscountValue] = useState<number | string>(0);
  const [invoiceType, setInvoiceType] = useState<"NON_GST" | "GST">(
    order.is_gst ? "GST" : "NON_GST"
  );
  const [gstRate, setGstRate] = useState<number | string>(
    order.gst_percentage !== undefined && order.gst_percentage !== null
      ? Number(order.gst_percentage)
      : 18
  );
  const initialTaxMode: "inclusive" | "exclusive" =
    (order as any).tax_mode === "exclusive" ||
    ((order as any).tax_mode !== "inclusive" &&
      Number(order.total_amount) > Number(order.subtotal) + (Number((order as any).delivery_fee) || 0))
      ? "exclusive"
      : "inclusive";
  const [taxMode, setTaxMode] = useState<"inclusive" | "exclusive">(initialTaxMode);
  const [paymentMode, setPaymentMode] = useState<"CASH" | "GPAY">("CASH");
  const [isFinalizing, setIsFinalizing] = useState<boolean>(false);
  const isFinalizingLock = useRef<boolean>(false);

  // Compute numeric safe discount input defaulting to 0
  const rawInput = Number(discountValue);
  const safeDiscount = isNaN(rawInput) || rawInput < 0 ? 0 : rawInput;

  // Compute safe numeric GST percentage (0 - 100)
  const parsedGstRate = typeof gstRate === "string" ? parseFloat(gstRate) : Number(gstRate);
  const numericGstRate = isNaN(parsedGstRate) || parsedGstRate < 0 ? 0 : Math.min(100, parsedGstRate);
  const halfRate = numericGstRate / 2;
  const halfRateStr = Number(halfRate.toFixed(4)).toString();

  // 1. Base order totals (without manual discount) for 3-column stats
  const baseTotals = calculateAdvanceOrderTotals({
    items: (order.items || []).map((it) => ({
      price: Number(it.snapshot_price) || 0,
      qty: Number(it.quantity) || 1,
      name: it.snapshot_name || "Service",
    })),
    subtotal: Number(order.subtotal) || Number(order.total_amount) || 0,
    isGst: invoiceType === "GST",
    gstPercentage: numericGstRate,
    taxMode: taxMode,
    manualDiscount: null,
    deliveryFee: Number((order as any).delivery_fee) || 0,
    advanceAmount: Number(order.deposit_amount) || 0,
  });

  // 2. Live order totals (with manual discount deducted from balance)
  const liveTotals = calculateAdvanceOrderTotals({
    items: (order.items || []).map((it) => ({
      price: Number(it.snapshot_price) || 0,
      qty: Number(it.quantity) || 1,
      name: it.snapshot_name || "Service",
    })),
    subtotal: Number(order.subtotal) || Number(order.total_amount) || 0,
    isGst: invoiceType === "GST",
    gstPercentage: numericGstRate,
    taxMode: taxMode,
    manualDiscount: {
      type: discountType,
      value: safeDiscount,
    },
    deliveryFee: Number((order as any).delivery_fee) || 0,
    advanceAmount: Number(order.deposit_amount) || 0,
  });

  const orderTotal = liveTotals.grandTotal;
  const advancePaid = liveTotals.advancePaid;
  const rawBalance = baseTotals.remainingBalance;
  const finalAmountToCollect = liveTotals.remainingBalance;
  const calculatedDiscount = liveTotals.discountAmount;

  const orderItems = (order.items || []).map((it) => {
    const price = Number(it.snapshot_price) || 0;
    const qty = Number(it.quantity) || 1;
    return {
      name: it.snapshot_name || "Service",
      price,
      qty,
      total: price * qty,
    };
  });

  const handleConfirmFinalPayment = async () => {
    if (!order || isFinalizingLock.current || isFinalizing) return;
    if (!liveTotals.isValid) {
      alert(liveTotals.errorMessage || "Invalid order calculation.");
      return;
    }

    isFinalizingLock.current = true;
    setIsFinalizing(true);

    try {
      const yr = new Date().getFullYear();
      const rand = Math.random().toString(36).substr(2, 5).toUpperCase();
      const invoiceId = `INV-${yr}-${rand}`;

      // Server action mutation: creates official invoice in orders table and marks advance completed
      const res = await finalizeAdvanceOrder({
        advanceOrderId: order.id,
        invoiceId,
        isGst: invoiceType === "GST",
        gstPercentage: invoiceType === "GST" ? numericGstRate : 0,
        discountType: discountType,
        discountValue: safeDiscount,
        discountAmount: calculatedDiscount,
        deliveryFee: liveTotals.deliveryFee,
        paymentMode: paymentMode,
        billDate: new Date().toISOString(),
        taxMode: taxMode,
      });

      if (!res?.success) {
        throw new Error(res?.error || "Failed to finalize advance order in database.");
      }

      // Direct DB update confirmation in advance_orders table
      const advUpdates: any = {
        status: "COMPLETED",
        finalized_order_id: invoiceId,
        finalized_at: new Date().toISOString(),
      };

      const { error: advErr } = await supabase
        .from("advance_orders")
        .update(advUpdates)
        .eq("id", order.id);

      if (advErr) {
        console.warn("Notice: advance_orders status direct sync returned:", advErr.message);
      }

      // STRICT LOGIC: Do NOT open WhatsApp or trigger window.open(wa.me/...)
      // Immediately notify parent to close modal, refetch orders, and refresh router
      await onSuccess();
    } catch (err: any) {
      console.error("Payment confirmation error:", err);
      alert(`Could not finalize the advance order: ${err?.message || "Please check your network and try again."}`);
    } finally {
      isFinalizingLock.current = false;
      setIsFinalizing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-[560px] max-h-[90vh] flex flex-col border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Modal Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {/* 1. Header */}
          <div className="flex items-start justify-between pb-3.5 border-b border-gray-100">
            <div>
              <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200">
                {order.id}
              </span>
              <h3 className="text-xl font-bold text-gray-900 mt-1 tracking-tight">
                Receive Remaining Payment
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 2. Customer Card */}
          <div className="bg-[#f4f4f5] border border-gray-200/80 rounded-[14px] p-3.5">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.05em] mb-1">
              CUSTOMER
            </p>
            <p className="text-sm font-bold text-gray-900">
              {order.customer_name || "Valued Customer"}
            </p>
            <p className="text-xs text-gray-500 mt-0.5 font-mono">
              {order.customer_phone || "No phone provided"}
            </p>
          </div>

          {/* 3. Line Item Summary Card */}
          <div className="bg-white border border-gray-200 rounded-[14px] p-3.5 divide-y divide-gray-100 shadow-xs">
            {orderItems.length > 0 ? (
              orderItems.map((item, idx) => (
                <div
                  key={idx}
                  className={`flex items-center justify-between ${idx > 0 ? "pt-2.5" : ""} ${
                    idx < orderItems.length - 1 ? "pb-2.5" : ""
                  }`}
                >
                  <div>
                    <p className="text-sm font-bold text-gray-900">
                      {item.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Qty: {item.qty} × ₹{item.price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-gray-900">
                    ₹{item.total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              ))
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-900">Advance Order Item</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Qty: 1 × ₹{baseTotals.subtotal.toFixed(2)}
                  </p>
                </div>
                <p className="text-sm font-bold text-gray-900">
                  ₹{baseTotals.subtotal.toFixed(2)}
                </p>
              </div>
            )}
          </div>

          {/* 4. 3-Column Financial Stat Row (Total / Paid / Balance) */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
            {/* Column 1: Total */}
            <div className="bg-[#f4f4f5] border border-gray-200/80 rounded-[14px] p-2.5 sm:p-3 text-center">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.05em]">
                TOTAL
              </p>
              <p className="text-sm sm:text-base md:text-lg font-black text-gray-900 mt-0.5 truncate">
                ₹{baseTotals.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>

            {/* Column 2: Paid */}
            <div className="bg-emerald-50 border border-emerald-300 rounded-[14px] p-2.5 sm:p-3 text-center">
              <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-[0.05em]">
                PAID
              </p>
              <p className="text-sm sm:text-base md:text-lg font-black text-emerald-700 mt-0.5 truncate">
                ₹{advancePaid.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>

            {/* Column 3: Balance */}
            <div className="bg-rose-50 border border-rose-300 rounded-[14px] p-2.5 sm:p-3 text-center">
              <p className="text-[10px] font-bold text-rose-800 uppercase tracking-[0.05em]">
                BALANCE
              </p>
              <p className="text-sm sm:text-base md:text-lg font-black text-rose-600 mt-0.5 truncate">
                ₹{rawBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* 5. Divider Line */}
          <div className="border-b border-gray-100" />

          {/* 6. Manual Discount */}
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-[0.05em] mb-1.5">
              MANUAL DISCOUNT
            </label>
            <div className="flex gap-2">
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as "FIXED" | "PERCENT")}
                className="bg-[#f4f4f5] border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-800 focus:outline-none focus:border-[#35607f] cursor-pointer"
              >
                <option value="FIXED">₹</option>
                <option value="PERCENT">%</option>
              </select>
              <input
                type="number"
                min="0"
                value={discountValue}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "") {
                    setDiscountValue("");
                  } else {
                    const parsed = parseFloat(val);
                    setDiscountValue(isNaN(parsed) || parsed < 0 ? 0 : parsed);
                  }
                }}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="0"
                className="flex-1 bg-white border border-gray-200 focus:border-[#35607f] rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none"
              />
            </div>
            {calculatedDiscount > 0 && (
              <p className="mt-1 text-[11px] font-medium text-gray-500">
                Discount applied: -₹{calculatedDiscount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            )}
            {liveTotals.errorMessage && (
              <p className="mt-1 text-[11px] font-medium text-rose-600">
                {liveTotals.errorMessage}
              </p>
            )}
          </div>

          {/* 7. Invoice Type Selector (NON-GST BILL vs GST INVOICE) */}
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-[0.05em] mb-1.5">
              INVOICE TYPE
            </label>
            <div className="bg-[#f3f4f6] p-1.5 rounded-full flex gap-1 border border-gray-200/80 items-center justify-between shadow-inner w-full mb-3">
              <button
                type="button"
                onClick={() => setInvoiceType("NON_GST")}
                className={`flex-1 py-1.5 rounded-full text-[10px] font-bold tracking-wider uppercase transition-all cursor-pointer ${
                  invoiceType === "NON_GST"
                    ? "bg-[#111827] text-white shadow-sm"
                    : "text-[#000000] hover:text-gray-700"
                }`}
              >
                NON-GST BILL
              </button>
              <button
                type="button"
                onClick={() => setInvoiceType("GST")}
                className={`flex-1 py-1.5 rounded-full text-[10px] font-bold tracking-wider uppercase transition-all cursor-pointer ${
                  invoiceType === "GST"
                    ? "bg-[#0097A7] text-white shadow-sm"
                    : "text-[#000000] hover:text-gray-700"
                }`}
              >
                GST INVOICE
              </button>
            </div>

            {invoiceType === "GST" && (
              <div className="bg-blue-50 border border-blue-100 rounded-[14px] p-3.5 space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">
                    GST RATE
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={gstRate}
                      onChange={(e) => setGstRate(e.target.value)}
                      onWheel={(e) => e.currentTarget.blur()}
                      placeholder="18"
                      className="w-24 bg-white border border-blue-200 text-blue-900 text-xs font-bold rounded-lg pl-3 pr-7 py-1.5 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 shadow-xs text-right font-mono"
                    />
                    <span className="absolute right-2.5 text-xs font-bold text-blue-500 pointer-events-none select-none">
                      %
                    </span>
                  </div>
                </div>

                {/* Tax Mode Segmented Selector */}
                <div className="flex items-center bg-blue-100/60 border border-blue-200/80 rounded-lg p-0.5 w-full">
                  <button
                    type="button"
                    onClick={() => setTaxMode("inclusive")}
                    className={`flex-1 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase transition-all cursor-pointer ${
                      taxMode === "inclusive"
                        ? "bg-white text-blue-900 shadow-xs"
                        : "text-blue-700/80 hover:text-blue-900"
                    }`}
                  >
                    Inclusive (Tax incl.)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaxMode("exclusive")}
                    className={`flex-1 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase transition-all cursor-pointer ${
                      taxMode === "exclusive"
                        ? "bg-white text-blue-900 shadow-xs"
                        : "text-blue-700/80 hover:text-blue-900"
                    }`}
                  >
                    Exclusive (+GST)
                  </button>
                </div>

                <div className="pt-2 border-t border-blue-200/60 space-y-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-blue-700 font-medium">Taxable Value</span>
                    <span className="font-bold text-blue-900 font-mono">
                      ₹{liveTotals.taxableAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-blue-700 font-medium">CGST ({halfRateStr}%)</span>
                    <span className="font-bold text-blue-900 font-mono">
                      ₹{liveTotals.cgstAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-blue-700 font-medium">SGST ({halfRateStr}%)</span>
                    <span className="font-bold text-blue-900 font-mono">
                      ₹{liveTotals.sgstAmount.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 8. Payment Method Selector (CASH / GPAY) */}
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-[0.05em] mb-1.5">
              PAYMENT METHOD
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setPaymentMode("CASH")}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold uppercase tracking-[0.05em] border transition-all cursor-pointer ${
                  paymentMode === "CASH"
                    ? "bg-[#35607f] text-white border-[#35607f] shadow-sm"
                    : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
                }`}
              >
                CASH
              </button>
              <button
                type="button"
                onClick={() => setPaymentMode("GPAY")}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold uppercase tracking-[0.05em] border transition-all cursor-pointer ${
                  paymentMode === "GPAY"
                    ? "bg-[#35607f] text-white border-[#35607f] shadow-sm"
                    : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
                }`}
              >
                GPAY
              </button>
            </div>
          </div>

          {/* 9. Final Amount to Collect Banner */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-[16px] py-3 px-4 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.05em] text-[#166534]">
              FINAL AMOUNT TO COLLECT
            </p>
            <p className="text-3xl sm:text-4xl font-extrabold text-[#166534] mt-1">
              ₹{finalAmountToCollect.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          {/* 10. Amber Confirmation Banner */}
          <div className="bg-[#fef3c7] border border-[#fcd34d] rounded-xl p-3 text-xs leading-relaxed text-[#92400e]">
            Confirmation marks the order Completed, creates one official invoice, and recognizes the full ₹{orderTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} as revenue.
          </div>
        </div>

        {/* 11. Primary Button (Sticky Footer) */}
        <div className="p-4 sm:p-5 border-t border-gray-100 bg-white rounded-b-[24px] shrink-0">
          <button
            type="button"
            onClick={handleConfirmFinalPayment}
            disabled={isFinalizing || !liveTotals.isValid}
            className={`w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-[0.05em] flex items-center justify-center gap-2 bg-[#10b981] hover:bg-[#059669] text-white shadow-md transition-all ${
              isFinalizing || !liveTotals.isValid ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
            }`}
          >
            {isFinalizing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>FINALIZING...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>CONFIRM FINAL PAYMENT</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ReceiveRemainingPaymentModal;
