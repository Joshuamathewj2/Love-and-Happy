"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CreditCard, Save, Loader2 } from "lucide-react";
import { createAdvanceOrder } from "@/app/pos/actions";
import { PaymentMode } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function handleSaveAdvanceOrder(
  payload: {
    customerName: string;
    customerPhone: string;
    customerAddress?: string | null;
    subtotal: number;
    totalAmount: number;
    depositAmount: number;
    depositPaymentMode?: PaymentMode;
    deliveryDate?: string | null;
    notes?: string | null;
    items: {
      product_id: string | null;
      snapshot_name: string;
      snapshot_desc?: string | null;
      snapshot_price: number;
      quantity: number;
    }[];
  },
  router?: any
) {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = String(Math.floor(1000 + Math.random() * 9000));
  const advanceOrderId = `DEP-${ymd}-${rand}`;

  const res = await createAdvanceOrder({
    advanceOrderId,
    customerName: payload.customerName.trim() || "Guest",
    customerPhone: payload.customerPhone,
    customerAddress: payload.customerAddress || null,
    subtotal: payload.subtotal,
    totalAmount: payload.totalAmount,
    depositAmount: payload.depositAmount,
    depositPaymentMode: payload.depositPaymentMode || "CASH",
    deliveryDate: payload.deliveryDate || null,
    notes: payload.notes || null,
    items: payload.items.map((i) => ({
      product_id: i.product_id || null,
      snapshot_name: i.snapshot_name,
      snapshot_desc: i.snapshot_desc || null,
      snapshot_price: Number(i.snapshot_price) || 0,
      quantity: Number(i.quantity) || 1,
    })),
  });

  if (router && typeof router.refresh === "function") {
    router.refresh();
  }

  return res;
}

export default function AdminBillingPage() {
  const router = useRouter();
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositPaymentMode, setDepositPaymentMode] = useState<PaymentMode>("CASH");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemQty, setItemQty] = useState("1");
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);

  const onSaveAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingRef.current || isSaving) return;
    isSavingRef.current = true;
    setIsSaving(true);

    if (!customerName.trim()) {
      isSavingRef.current = false;
      setIsSaving(false);
      alert("Customer name is required.");
      return;
    }
    if (customerPhone.length !== 10) {
      isSavingRef.current = false;
      setIsSaving(false);
      alert("Valid 10-digit phone number is required.");
      return;
    }
    const deposit = Number(depositAmount) || 0;
    if (deposit <= 0) {
      isSavingRef.current = false;
      setIsSaving(false);
      alert("Deposit amount must be greater than 0.");
      return;
    }
    const price = Number(itemPrice) || 0;
    const qty = Number(itemQty) || 1;
    const sub = price * qty;

    if (!itemName.trim() || sub <= 0) {
      isSavingRef.current = false;
      setIsSaving(false);
      alert("Valid item name and price are required.");
      return;
    }
    if (deposit >= sub) {
      isSavingRef.current = false;
      setIsSaving(false);
      alert("Deposit cannot equal or exceed the total amount. For full payment, complete standard retail checkout.");
      return;
    }

    try {
      const res = await handleSaveAdvanceOrder(
        {
          customerName,
          customerPhone,
          customerAddress,
          subtotal: sub,
          totalAmount: sub,
          depositAmount: deposit,
          depositPaymentMode,
          deliveryDate,
          notes,
          items: [
            {
              product_id: null,
              snapshot_name: itemName,
              snapshot_price: price,
              quantity: qty,
            },
          ],
        },
        router
      );

      // Clear the current cart and form fields immediately upon a successful save to ensure the same transaction cannot be resubmitted
      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
      setDepositAmount("");
      setItemName("");
      setItemPrice("");
      setItemQty("1");
      setNotes("");
      setDeliveryDate("");

      alert(`Advance Order ${res.advanceOrderId} saved successfully with status PENDING!`);
      router.push("/admin/advance-orders");
    } catch (err: any) {
      alert(`Error: ${err?.message || "Failed to save advance order."}`);
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 sm:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div>
            <Link
              href="/pos/admin/secure/control-panel/ss-creatives"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors mb-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to POS Control Panel
            </Link>
            <h1 className="text-xl font-black text-slate-950 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-teal-600" /> Quick Billing &amp; Advance Orders
            </h1>
          </div>
        </div>

        <form onSubmit={onSaveAdvance} className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Save Advance Deposit Order</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold mb-1 text-slate-700">Customer Name *</label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer Name"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1 text-slate-700">Customer Phone *</label>
              <input
                type="tel"
                required
                maxLength={10}
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="10-digit Mobile"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold mb-1 text-slate-700">Item Name *</label>
              <input
                type="text"
                required
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="Service / Product Name"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1 text-slate-700">Total Price (₹) *</label>
              <input
                type="number"
                required
                min={1}
                value={itemPrice}
                onChange={(e) => setItemPrice(e.target.value)}
                placeholder="Total Amount"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1 text-slate-700">Advance Deposit (₹) *</label>
              <input
                type="number"
                required
                min={1}
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="Advance Deposit"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors disabled:opacity-50 uppercase tracking-wider cursor-pointer disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>SAVING ADVANCE ORDER...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>SAVE AS ADVANCE ORDER</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
