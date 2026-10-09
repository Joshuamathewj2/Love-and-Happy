"use client";

import React, { useState, useRef } from "react";
import { X, Check, Loader2 } from "lucide-react";
import { AdvanceOrderWithRelations } from "@/lib/types";
import { calculateOrderTotals } from "@/lib/advanceOrderCalculations";
import { finalizeAdvanceOrder } from "@/app/pos/actions";
import { supabase } from "@/lib/supabaseClient";

export interface ReceiveRemainingPaymentModalProps {
  order: AdvanceOrderWithRelations;
  onClose: () => void;
  onSuccess: (finalizedOrder?: any) => Promise<void> | void;
}

export function ReceiveRemainingPaymentModal({
  order,
  onClose,
  onSuccess,
}: ReceiveRemainingPaymentModalProps) {
  const [paymentMode, setPaymentMode] = useState<"CASH" | "GPAY">("CASH");
  const [isFinalizing, setIsFinalizing] = useState<boolean>(false);
  const isFinalizingLock = useRef<boolean>(false);

  // Single shared calculation utility
  const totals = calculateOrderTotals(order);

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
    if (!totals.isValid) {
      alert(totals.errorMessage || "Invalid order calculation.");
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
        isGst: totals.gstRate > 0,
        gstPercentage: totals.gstRate,
        discountType: ((order as any).discount_type || "FIXED") as "PERCENT" | "FIXED",
        discountValue: Number((order as any).discount_value) || 0,
        discountAmount: totals.discount,
        deliveryFee: totals.deliveryFee,
        paymentMode: paymentMode,
        billDate: new Date().toISOString(),
        taxMode: (order as any).tax_mode || "exclusive",
      });

      if (!res?.success) {
        throw new Error(res?.error || "Failed to finalize advance order in database.");
      }

      // Direct DB update confirmation in advance_orders table:
      // mark COMPLETED without touching the original deposit_amount snapshot
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

      const officialOrderId = res.orderId || invoiceId;
      const finalizedOrder = {
        id: officialOrderId,
        customerName: order.customer_name || "Valued Customer",
        customerPhone: order.customer_phone || "",
        customerAddress: order.customer_address || null,
        source: "OFFLINE",
        isGst: totals.gstRate > 0,
        items: (order.items && order.items.length > 0)
          ? order.items.map((it, idx) => ({
              id: it.id || `oi-${officialOrderId}-${idx}`,
              name: it.snapshot_name || "Advance Item",
              desc: it.snapshot_desc || "",
              price: Number(it.snapshot_price) || 0,
              qty: Number(it.quantity) || 1,
            }))
          : [
              {
                id: `oi-${officialOrderId}-0`,
                name: "Advance Order Item",
                desc: "",
                price: Number(totals.subtotal) || 0,
                qty: 1,
              },
            ],
        subtotal: totals.subtotal,
        discount: totals.discount,
        discountType: (order as any).discount_type || "FIXED",
        discountValue: Number((order as any).discount_value) || 0,
        gstPercentage: totals.gstRate,
        gstAmount: totals.gst,
        deliveryFee: totals.deliveryFee,
        grandTotal: totals.total,
        cashReceived: totals.total,
        finalPaymentAmount: totals.balance,
        finalPaymentMethod: paymentMode,
        completedAt: new Date().toISOString(),
        splitCash: 0,
        splitGpay: 0,
        paymentMode: paymentMode,
        date: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        status: "Completed",
        isAdvance: true,
        depositId: order.id,
        advancePaidEarlier: totals.advancePaid,
      };

      // Notify parent to close modal, show Bill Generated popup, and refresh orders
      await onSuccess(finalizedOrder);
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
                    Qty: 1 × ₹{totals.subtotal.toFixed(2)}
                  </p>
                </div>
                <p className="text-sm font-bold text-gray-900">
                  ₹{totals.subtotal.toFixed(2)}
                </p>
              </div>
            )}

            {/* Read-only breakdown if Discount, GST, or Delivery applies */}
            {(totals.discount > 0 || totals.gst > 0 || totals.deliveryFee > 0) && (
              <div className="pt-2.5 mt-2.5 border-t border-gray-100 space-y-1 text-xs">
                {totals.discount > 0 && (
                  <div className="flex items-center justify-between text-pink-600 font-medium">
                    <span>{totals.discountLabel}</span>
                    <span>-₹{totals.discount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
                {totals.gst > 0 && (
                  <div className="flex items-center justify-between text-slate-500 text-[11px]">
                    <span>{totals.gstLabel}</span>
                    <span>+₹{totals.gst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
                {totals.deliveryFee > 0 && (
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Delivery</span>
                    <span>₹{totals.deliveryFee.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
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
                ₹{totals.total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>

            {/* Column 2: Paid */}
            <div className="bg-emerald-50 border border-emerald-300 rounded-[14px] p-2.5 sm:p-3 text-center">
              <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-[0.05em]">
                PAID
              </p>
              <p className="text-sm sm:text-base md:text-lg font-black text-emerald-700 mt-0.5 truncate">
                ₹{totals.advancePaid.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>

            {/* Column 3: Balance */}
            <div className="bg-rose-50 border border-rose-300 rounded-[14px] p-2.5 sm:p-3 text-center">
              <p className="text-[10px] font-bold text-rose-800 uppercase tracking-[0.05em]">
                BALANCE
              </p>
              <p className="text-sm sm:text-base md:text-lg font-black text-rose-600 mt-0.5 truncate">
                ₹{totals.balance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* 5. Payment Method Selector (CASH / GPAY) */}
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

          {/* 6. Final Amount to Collect Banner */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-[16px] py-3 px-4 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.05em] text-[#166534]">
              FINAL AMOUNT TO COLLECT
            </p>
            <p className="text-3xl sm:text-4xl font-extrabold text-[#166534] mt-1">
              ₹{totals.balance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          {/* 7. Amber Confirmation Banner */}
          <div className="bg-[#fef3c7] border border-[#fcd34d] rounded-xl p-3 text-xs leading-relaxed text-[#92400e]">
            Confirmation marks the order Completed, creates one official invoice, and recognizes the full ₹{totals.total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} as revenue.
          </div>
        </div>

        {/* 8. Primary Button (Sticky Footer) */}
        <div className="p-4 sm:p-5 border-t border-gray-100 bg-white rounded-b-[24px] shrink-0">
          <button
            type="button"
            onClick={handleConfirmFinalPayment}
            disabled={isFinalizing || !totals.isValid}
            className={`w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-[0.05em] flex items-center justify-center gap-2 bg-[#10b981] hover:bg-[#059669] text-white shadow-md transition-all ${
              isFinalizing || !totals.isValid ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
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
