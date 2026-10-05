"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock, MessageSquare, FileText, Eye, IndianRupee, Trash2, RefreshCw, Check, Loader2, X } from "lucide-react";
import { fetchAdvanceOrders, removeAdvanceOrder, setAdvanceOrderStatus, finalizeAdvanceOrder } from "@/app/pos/actions";
import { AdvanceOrderWithRelations, AdvanceOrderStatus } from "@/lib/types";
import { calculateAdvanceOrderTotals } from "@/lib/advanceOrderCalculations";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

type FilterTab = "ALL" | AdvanceOrderStatus;

export default function AdminAdvanceOrdersPage() {
  const router = useRouter();
  const [advanceOrders, setAdvanceOrders] = useState<AdvanceOrderWithRelations[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("ALL");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // ── Receive Remaining Payment modal state ──
  const [receiveModalOrder, setReceiveModalOrder] = useState<AdvanceOrderWithRelations | null>(null);
  const [receiveDiscountType, setReceiveDiscountType] = useState<"FIXED" | "PERCENT">("FIXED");
  const [receiveDiscountValue, setReceiveDiscountValue] = useState<number | "">("");
  const [receivePaymentMode, setReceivePaymentMode] = useState<"CASH" | "GPAY" | "SPLIT">("CASH");
  const [receivePaymentNotes, setReceivePaymentNotes] = useState<string>("");
  const [receiveCouponCode, setReceiveCouponCode] = useState<string>("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; type: "fixed" | "percent"; value: number } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const isFinalizingLock = useRef(false);

  const loadData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    try {
      let data = await fetchAdvanceOrders();
      if (!data || data.length === 0) {
        // Direct query fallback in case server action caching intervened
        const { data: directData, error: directErr } = await supabase
          .from("advance_orders")
          .select(`
            *,
            customers (
              name,
              phone,
              address
            ),
            advance_order_items (
              id,
              advance_order_id,
              product_id,
              snapshot_name,
              snapshot_price,
              quantity
            )
          `)
          .order("created_at", { ascending: false });

        if (directErr) {
          console.error(
            `[Advance Orders] Direct fetch error [code: ${directErr.code}, message: ${directErr.message}, details: ${directErr.details}, hint: ${directErr.hint}]`
          );
          if (directErr.code === "401" || directErr.code === "403" || directErr.code === "PGRST301") {
            console.error("[Advance Orders] Unauthorized / RLS policy block on advance_orders table.");
          }
        } else if (directData && directData.length > 0) {
          data = directData.map((r: any) => ({
            id: r.id,
            customer_id: r.customer_id,
            status: r.status as AdvanceOrderStatus,
            subtotal: Number(r.subtotal) || 0,
            total_amount: Number(r.total_amount) || 0,
            deposit_amount: Number(r.deposit_amount) || 0,
            deposit_payment_mode: r.deposit_payment_mode,
            delivery_date: r.delivery_date,
            notes: r.notes,
            finalized_order_id: r.finalized_order_id,
            finalized_at: r.finalized_at,
            cancelled_at: r.cancelled_at,
            created_at: r.created_at,
            customer_name: r.customers?.name || "Walk-in Customer",
            customer_phone: r.customers?.phone || "",
            customer_address: r.customers?.address || null,
            items: (r.advance_order_items || []).map((it: any) => ({
              id: it.id,
              advance_order_id: r.id,
              product_id: it.product_id || null,
              snapshot_name: it.snapshot_name,
              snapshot_desc: null,
              snapshot_price: Number(it.snapshot_price) || 0,
              quantity: Number(it.quantity) || 1,
            })),
          }));
        }
      }

      // State Deduplication: completely overwrite state with unique rows by primary key id
      const uniqueMap = new Map<string, AdvanceOrderWithRelations>();
      for (const adv of data || []) {
        if (!adv.id || uniqueMap.has(adv.id)) continue;
        uniqueMap.set(adv.id, adv);
      }
      setAdvanceOrders(Array.from(uniqueMap.values()));
    } catch (err) {
      console.error("Failed to load advance orders:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    // 1. Ensure auth session is restored before query execution
    const initAuthAndFetch = async () => {
      try {
        const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr) {
          console.warn("[Advance Orders] Auth session notice:", sessionErr);
        } else if (session) {
          console.log("[Advance Orders] Active auth session verified:", session.user.email);
        }
      } catch (authErr) {
        console.warn("[Advance Orders] Session restore notice:", authErr);
      } finally {
        if (isMounted) {
          loadData();
        }
      }
    };

    initAuthAndFetch();

    // 2. Auth state change listener
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(() => {
      if (isMounted) {
        loadData(true);
      }
    });

    // 3. Supabase Realtime channel listener: listen to changes and completely overwrite state
    const channel = supabase
      .channel("admin-advance-orders-realtime-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "advance_orders" },
        () => {
          if (isMounted) loadData(true);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          if (isMounted) loadData(true);
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("[Advance Orders] Realtime sync channel active");
        }
      });

    // 4. Window focus listener
    const handleFocus = () => {
      if (isMounted) loadData(true);
    };
    window.addEventListener("focus", handleFocus);

    // Explicit cleanup function: unsubscribes channel and listeners on unmount
    return () => {
      isMounted = false;
      authSub.unsubscribe();
      supabase.removeChannel(channel);
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadData]);

  const handleDelete = async (id: string) => {
    if (!confirm(`Are you sure you want to delete advance order ${id}? This cannot be undone.`)) {
      return;
    }
    try {
      await removeAdvanceOrder(id);
      setAdvanceOrders((prev) => prev.filter((a) => a.id !== id));
      router.refresh();
    } catch (err: any) {
      alert(`Could not delete advance order: ${err?.message || "Please try again."}`);
    }
  };

  // ── Helper: compute totals from saved DB values ──
  const getAdvanceTotals = (adv: AdvanceOrderWithRelations) =>
    calculateAdvanceOrderTotals({
      items: (adv.items || []).map((it) => ({
        price: Number(it.snapshot_price) || 0,
        qty: Number(it.quantity) || 1,
      })),
      subtotal: Number(adv.subtotal) || Number(adv.total_amount) || 0,
      isGst: adv.is_gst !== undefined ? Boolean(adv.is_gst) : undefined,
      gstPercentage: adv.gst_percentage !== undefined ? Number(adv.gst_percentage) : undefined,
      taxMode: (adv as any).tax_mode || "exclusive",
      manualDiscount:
        Number((adv as any).discount_amount) > 0 || Number((adv as any).discount_value) > 0
          ? {
              type: (((adv as any).discount_type || "FIXED").toUpperCase() as any),
              value: Number((adv as any).discount_value) || Number((adv as any).discount_amount) || 0,
            }
          : null,
      deliveryFee: Number((adv as any).delivery_fee) || 0,
      advanceAmount: Number(adv.deposit_amount) || 0,
      grandTotal: Number(adv.total_amount) || undefined,
    });

  const openReceiveModal = (adv: AdvanceOrderWithRelations) => {
    setReceiveModalOrder(adv);
    setReceiveDiscountType("FIXED");
    setReceiveDiscountValue("");
    setReceivePaymentMode("CASH");
    setReceivePaymentNotes("");
    setReceiveCouponCode("");
    setAppliedCoupon(null);
    setCouponError(null);
    // Reset state so select stays on previous status
    setAdvanceOrders((prev) => [...prev]);
  };

  const closeReceiveModal = () => {
    setReceiveModalOrder(null);
    setReceiveCouponCode("");
    setAppliedCoupon(null);
    setCouponError(null);
    // Force re-render so status selects snap back to saved status
    setAdvanceOrders((prev) => [...prev]);
  };

  const handleStatusChange = async (orderId: string, newStatus: string, order: any) => {
    const statusUpper = String(newStatus || "").trim().toUpperCase() as AdvanceOrderStatus;

    // If Completed selected and there is a remaining balance, open payment popup instead
    if (statusUpper === "COMPLETED") {
      const adv = advanceOrders.find((a) => a.id === orderId);
      if (adv) {
        const totals = getAdvanceTotals(adv);
        if (totals.remainingBalance > 0) {
          openReceiveModal(adv);
          return;
        }
      }
    }

    // For all other statuses (and Completed with zero balance): update ONLY status field
    setAdvanceOrders((prev) => {
      const updated = prev.map((ord) =>
        ord.id === orderId ? { ...ord, status: statusUpper } : ord
      );
      const uniqueMap = new Map<string, AdvanceOrderWithRelations>();
      for (const o of updated) {
        if (!o.id || uniqueMap.has(o.id)) continue;
        uniqueMap.set(o.id, o);
      }
      return Array.from(uniqueMap.values());
    });

    try {
      const advUpdates: any = { status: statusUpper };
      if (statusUpper === "COMPLETED") advUpdates.finalized_at = new Date().toISOString();
      else if (statusUpper === "CANCELLED") advUpdates.cancelled_at = new Date().toISOString();

      const { error: advErr } = await supabase
        .from("advance_orders")
        .update(advUpdates)
        .eq("id", orderId);
      if (advErr) throw new Error(`Failed to update advance order: ${advErr.message}`);

      const { data: existingOrd } = await supabase
        .from("orders")
        .select("id")
        .eq("id", orderId)
        .maybeSingle();
      if (existingOrd) {
        await supabase.from("orders").update({ status: statusUpper }).eq("id", orderId);
      }

      try {
        await setAdvanceOrderStatus(orderId, statusUpper);
      } catch (actErr) {
        console.warn("Server action status revalidation notice:", actErr);
      }

      await loadData(true);
      router.refresh();
    } catch (err: any) {
      console.error("Status update error:", err);
      alert(`Database update failed: ${err?.message || "Please check your network or database permissions."}`);
      await loadData(true);
    }
  };

  // Filter advance orders based on active status filter
  const filteredOrders = advanceOrders.filter((a) => {
    if (activeFilter === "ALL") return true;
    const status = (a.status || "PENDING").toUpperCase();
    return status === activeFilter;
  });

  const countAll = advanceOrders.length;
  const countPending = advanceOrders.filter((a) => (a.status || "PENDING").toUpperCase() === "PENDING").length;
  const countReady = advanceOrders.filter((a) => (a.status || "").toUpperCase() === "READY").length;
  const countCompleted = advanceOrders.filter((a) => (a.status || "").toUpperCase() === "COMPLETED").length;
  const countCancelled = advanceOrders.filter((a) => (a.status || "").toUpperCase() === "CANCELLED").length;

  // Real-time Outstanding Balance from all non-cancelled orders
  const activeOrders = advanceOrders.filter((a) => {
    const st = (a.status || "PENDING").toUpperCase();
    return st !== "CANCELLED";
  });
  const outstandingBalance = activeOrders.reduce((sum, a) => {
    const totals = calculateAdvanceOrderTotals({
      items: (a.items || []).map((it) => ({
        price: Number(it.snapshot_price) || 0,
        qty: Number(it.quantity) || 1,
      })),
      subtotal: Number(a.subtotal) || Number(a.total_amount) || 0,
      isGst: a.is_gst !== undefined ? Boolean(a.is_gst) : undefined,
      gstPercentage: a.gst_percentage !== undefined ? Number(a.gst_percentage) : undefined,
      taxMode: a.tax_mode || "exclusive",
      manualDiscount:
        Number(a.discount_amount) > 0 || Number(a.discount_value) > 0
          ? {
              type: ((a.discount_type || "FIXED").toUpperCase() as any),
              value: Number(a.discount_value) || Number(a.discount_amount) || 0,
            }
          : null,
      deliveryFee: Number(a.delivery_fee) || 0,
      advanceAmount: Number(a.deposit_amount) || 0,
      grandTotal: Number(a.total_amount) || undefined,
    });
    return sum + totals.remainingBalance;
  }, 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link
                href="/pos/admin/secure/control-panel/love-and-happy"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to POS Control Panel
              </Link>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight flex items-center gap-2">
              <Clock className="w-6 h-6 text-amber-500" />
              Advance Orders Management
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Track customer deposits, partial advances, pending deliveries, and outstanding balances.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadData(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <Link
              href="/admin/orders"
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl shadow-xs transition-colors"
            >
              Order History
            </Link>
            <Link
              href="/admin/analytics"
              className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
            >
              Analytics
            </Link>
          </div>
        </div>

        {/* Top Summary Metric Cards (with real-time decrementing Outstanding Balance) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Outstanding Balance
              </p>
              <p className="text-2xl font-black text-rose-600 mt-1 font-mono">
                ₹{outstandingBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {activeOrders.length} active orders awaiting balance
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
              <IndianRupee className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Ready For Collection
              </p>
              <p className="text-2xl font-black text-blue-600 mt-1">
                {countReady}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Orders prepared &amp; awaiting pickup
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Completed &amp; Settled
              </p>
              <p className="text-2xl font-black text-emerald-600 mt-1">
                {countCompleted}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Flows into Order History &amp; Analytics
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <FileText className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-200/60 rounded-xl max-w-fit overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setActiveFilter("ALL")}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              activeFilter === "ALL"
                ? "bg-white text-slate-900 shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            ALL ({countAll})
          </button>
          <button
            onClick={() => setActiveFilter("PENDING")}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              activeFilter === "PENDING"
                ? "bg-amber-500 text-white shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            PENDING ({countPending})
          </button>
          <button
            onClick={() => setActiveFilter("READY")}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              activeFilter === "READY"
                ? "bg-blue-600 text-white shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            READY ({countReady})
          </button>
          <button
            onClick={() => setActiveFilter("COMPLETED")}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              activeFilter === "COMPLETED"
                ? "bg-emerald-600 text-white shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            COMPLETED ({countCompleted})
          </button>
          <button
            onClick={() => setActiveFilter("CANCELLED")}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              activeFilter === "CANCELLED"
                ? "bg-rose-600 text-white shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            CANCELLED ({countCancelled})
          </button>
        </div>

        {/* Advance Orders Table */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <table className="w-full table-fixed border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50/80">
                <th className="w-[14%] text-left px-4 py-3">Deposit ID</th>
                <th className="w-[14%] text-left px-4 py-3">Customer</th>
                <th className="w-[18%] text-left px-4 py-3">Product</th>
                <th className="w-[18%] text-left px-4 py-3">Total / Paid / Balance</th>
                <th className="w-[11%] text-center px-4 py-3">Delivery</th>
                <th className="w-[12%] text-center px-4 py-3">Status</th>
                <th className="w-[13%] text-right pr-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-xs font-semibold text-slate-400">
                    Loading advance orders...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-xs font-bold text-slate-500">
                    No advance orders found.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((a: AdvanceOrderWithRelations) => {
                  const totals = calculateAdvanceOrderTotals({
                    items: (a.items || []).map((it) => ({
                      price: Number(it.snapshot_price) || 0,
                      qty: Number(it.quantity) || 1,
                    })),
                    subtotal: Number(a.subtotal) || Number(a.total_amount) || 0,
                    isGst: a.is_gst !== undefined ? Boolean(a.is_gst) : undefined,
                    gstPercentage: a.gst_percentage !== undefined ? Number(a.gst_percentage) : undefined,
                    taxMode: a.tax_mode || "exclusive",
                    manualDiscount:
                      Number(a.discount_amount) > 0 || Number(a.discount_value) > 0
                        ? {
                            type: (((a.discount_type || "FIXED").toUpperCase() as any)),
                            value: Number(a.discount_value) || Number(a.discount_amount) || 0,
                          }
                        : null,
                    deliveryFee: Number(a.delivery_fee) || 0,
                    advanceAmount: Number(a.deposit_amount) || 0,
                    grandTotal: Number(a.total_amount) || undefined,
                  });
                  const total = totals.grandTotal;
                  const paid = totals.totalPaid;
                  const balanceDue = totals.remainingBalance;
                  const statusUpper = (a.status || "PENDING").toUpperCase();

                  return (
                    <tr key={a.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Deposit ID (2-line layout) */}
                      <td className="w-[14%] text-left px-4 py-3 align-middle">
                        <p className="text-xs font-bold text-slate-950 font-mono">
                          {a.id}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {new Date(a.created_at).toLocaleDateString("en-IN")}
                        </p>
                      </td>

                      {/* Customer */}
                      <td className="w-[14%] text-left px-4 py-3 align-middle">
                        <p className="font-bold text-slate-900">{a.customer_name}</p>
                        <p className="text-[11px] text-slate-500 font-mono">{a.customer_phone}</p>
                      </td>

                      {/* Product */}
                      <td className="w-[18%] text-left px-4 py-3 align-middle">
                        <div className="text-[11px] space-y-0.5">
                          {a.items.slice(0, 2).map((i) => (
                            <p key={i.id} className="font-medium text-slate-800 truncate">
                              {i.quantity}× {i.snapshot_name}
                            </p>
                          ))}
                          {a.items.length > 2 && (
                            <p className="text-[10px] text-slate-400 font-medium">
                              +{a.items.length - 2} more items
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Total / Paid / Balance (3-line stacked block) */}
                      <td className="w-[18%] text-left px-4 py-3 align-middle">
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-slate-900">
                            Total: ₹{total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-xs font-semibold text-emerald-600">
                            Paid: ₹{paid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-xs font-semibold text-rose-600">
                            Balance: ₹{balanceDue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </td>

                      {/* Delivery */}
                      <td className="w-[11%] text-center px-4 py-3 align-middle font-medium text-slate-700 text-xs">
                        {a.delivery_date
                          ? new Date(a.delivery_date).toLocaleDateString("en-IN")
                          : "—"}
                      </td>

                      {/* Status */}
                      <td className="w-[12%] text-center px-4 py-3 align-middle">
                        <div className="relative inline-block w-full max-w-[150px] mx-auto">
                          <select
                            key={`adv-status-admin-${a.id}-${statusUpper}`}
                            value={statusUpper}
                            onChange={(e) => handleStatusChange(a.id, e.target.value, a)}
                            className={`w-full appearance-none px-2 py-1 pr-6 rounded-xl text-[10px] font-bold tracking-normal border cursor-pointer focus:outline-none transition-colors ${
                              statusUpper === "COMPLETED"
                                ? "bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-pink-300"
                                : statusUpper === "READY"
                                ? "bg-blue-50 text-blue-800 border-blue-300 ring-1 ring-pink-300"
                                : statusUpper === "CANCELLED"
                                ? "bg-rose-50 text-rose-800 border-rose-300"
                                : "bg-amber-50 text-amber-800 border-amber-300 ring-1 ring-pink-300"
                            }`}
                          >
                            <option value="PENDING" className="bg-white text-gray-900 font-semibold">PENDING</option>
                            <option value="READY" className="bg-white text-gray-900 font-semibold">READY</option>
                            <option value="COMPLETED" className="bg-white text-gray-900 font-semibold">COMPLETED</option>
                            <option value="CANCELLED" className="bg-white text-gray-900 font-semibold">CANCELLED</option>
                          </select>
                          
                          {/* Chevron Down Icon */}
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-inherit opacity-70">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      </td>

                      {/* Actions (WhatsApp, Invoice, View Details, Collect Payment, Delete) */}
                      <td className="w-[13%] text-right pr-4 py-3 align-middle">
                        <div className="flex items-center justify-end gap-1.5 flex-nowrap">
                          {/* WhatsApp */}
                          <a
                            href={`https://api.whatsapp.com/send?phone=91${(a.customer_phone || "").replace(/\D/g, "").slice(-10)}`}
                            target="_blank"
                            rel="noreferrer"
                            title="Send on WhatsApp"
                            className="flex items-center justify-center w-7 h-7 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-md transition-colors shrink-0"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </a>

                          {/* Invoice */}
                          <Link
                            href={`/advance/${a.id}`}
                            title="Print / View Invoice"
                            className="flex items-center justify-center w-7 h-7 bg-cyan-50 hover:bg-cyan-100 text-cyan-600 rounded-md transition-colors shrink-0"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </Link>

                          {/* View Details */}
                          <Link
                            href={`/advance/${a.id}`}
                            title="View Details"
                            className="flex items-center justify-center w-7 h-7 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md transition-colors shrink-0"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Link>

                          {/* Collect Payment */}
                          {statusUpper !== "COMPLETED" && statusUpper !== "CANCELLED" && (
                            <Link
                              href="/pos/admin/secure/control-panel/love-and-happy"
                              title="Collect Payment"
                              className="flex items-center justify-center w-7 h-7 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-md transition-colors shrink-0"
                            >
                              <IndianRupee className="w-3.5 h-3.5" />
                            </Link>
                          )}

                          {/* Delete */}
                          <button
                            onClick={() => handleDelete(a.id)}
                            title="Delete Order"
                            className="flex items-center justify-center w-7 h-7 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-md transition-colors shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Receive Remaining Payment Modal ───────────────────────────── */}
      {receiveModalOrder && (() => {
        const baseTotals = getAdvanceTotals(receiveModalOrder);
        const settlementCalc = calculateAdvanceOrderTotals({
          items: (receiveModalOrder.items || []).map((it) => ({
            price: Number(it.snapshot_price) || 0,
            qty: Number(it.quantity) || 1,
          })),
          subtotal: baseTotals.subtotal,
          isGst: (receiveModalOrder as any).is_gst !== undefined ? Boolean((receiveModalOrder as any).is_gst) : undefined,
          gstPercentage: (receiveModalOrder as any).gst_percentage !== undefined ? Number((receiveModalOrder as any).gst_percentage) : undefined,
          taxMode: (receiveModalOrder as any).tax_mode || "exclusive",
          deliveryFee: Number((receiveModalOrder as any).delivery_fee) || 0,
          couponDiscount: appliedCoupon ? { type: appliedCoupon.type, value: appliedCoupon.value } : null,
          manualDiscount:
            receiveDiscountValue !== "" && Number(receiveDiscountValue) > 0
              ? { type: receiveDiscountType, value: Number(receiveDiscountValue) }
              : null,
          advanceAmount: Number(receiveModalOrder.deposit_amount) || 0,
        });

        const confirmReceiveBalance = async () => {
          if (!receiveModalOrder || isFinalizingLock.current || isFinalizing) return;
          if (!settlementCalc.isValid) {
            alert(settlementCalc.errorMessage || "Discount is too high.");
            return;
          }
          isFinalizingLock.current = true;
          setIsFinalizing(true);
          try {
            const yr = new Date().getFullYear();
            const rand = Math.random().toString(36).substr(2, 5).toUpperCase();
            const invoiceId = `INV-${yr}-${rand}`;

            // Open WhatsApp directly in click handler to avoid popup blockers
            const cleanPhone = (receiveModalOrder.customer_phone || "").replace(/\D/g, "").slice(-10);
            let waUrl = "";
            if (cleanPhone && cleanPhone.length === 10) {
              const shopEmoji = String.fromCodePoint(0x2728);
              const checkEmoji = String.fromCodePoint(0x2705);
              let msg = `${shopEmoji} *Love & Happy Unisex Salon* ${shopEmoji}\n\n`;
              msg += `${checkEmoji} *Payment Received & Order Completed!*\n\n`;
              msg += `Customer: ${receiveModalOrder.customer_name || "Valued Customer"}\n`;
              msg += `Deposit ID: ${receiveModalOrder.id}\n`;
              msg += `Official Invoice: ${invoiceId}\n`;
              msg += `Amount Paid Now: ₹${settlementCalc.remainingBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}\n`;
              msg += `Payment Method: ${receivePaymentMode === "GPAY" ? "UPI / GPay" : receivePaymentMode}\n`;
              msg += `Total Bill: ₹${settlementCalc.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}\n`;
              msg += `Balance Due: ₹0.00\n\n`;
              msg += `Thank you for choosing Love & Happy Unisex Salon. We look forward to serving you again!`;
              waUrl = `https://api.whatsapp.com/send?phone=91${cleanPhone}&text=${encodeURIComponent(msg)}`;
            }
            if (waUrl) window.open(waUrl, "_blank");

            await finalizeAdvanceOrder({
              advanceOrderId: receiveModalOrder.id,
              invoiceId,
              isGst: settlementCalc.gstPercentage > 0,
              gstPercentage: settlementCalc.gstPercentage,
              discountType: receiveDiscountType,
              discountValue: Number(receiveDiscountValue) || 0,
              discountAmount: settlementCalc.discountAmount,
              deliveryFee: 0,
              paymentMode: receivePaymentMode,
              billDate: new Date().toISOString(),
            });

            closeReceiveModal();
            await loadData(true);
            router.refresh();

            if (!waUrl) {
              alert(`Payment confirmed! Official Invoice: ${invoiceId}. (No customer phone for WhatsApp).`);
            }
          } catch (err: any) {
            console.error("Finalize advance order error:", err);
            alert(`Could not finalize the advance order: ${err?.message || "Please try again."}`);
          } finally {
            isFinalizingLock.current = false;
            setIsFinalizing(false);
          }
        };

        return (
          <div
            className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) closeReceiveModal(); }}
          >
            <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md p-5 sm:p-6 max-h-[90vh] overflow-y-auto border-t-4 border-emerald-500">
              <div className="space-y-4">
                {/* Header */}
                <div className="flex justify-between items-start">
                  <div>
                    <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200">
                      {receiveModalOrder.id}
                    </span>
                    <h3 className="text-lg font-black text-gray-900 tracking-tight mt-1">Receive Remaining Payment</h3>
                    <p className="text-xs text-gray-500">
                      {receiveModalOrder.customer_name || "Customer"} • {receiveModalOrder.customer_phone || "No phone"}
                    </p>
                  </div>
                  <button
                    onClick={closeReceiveModal}
                    className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Remaining Amount card */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">REMAINING AMOUNT</p>
                  <p className="text-3xl font-black text-emerald-700 mt-0.5">
                    ₹{settlementCalc.remainingBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <div className="flex justify-center gap-4 mt-2 text-[11px] text-emerald-900/80 font-medium border-t border-emerald-200/60 pt-2">
                    <span>Order Total: ₹{settlementCalc.grandTotal.toFixed(2)}</span>
                    <span>•</span>
                    <span>Already Paid: ₹{settlementCalc.advancePaid.toFixed(2)}</span>
                  </div>
                </div>

                {/* Coupon Code */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">Coupon Code (Optional)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={receiveCouponCode}
                      onChange={(e) => { setReceiveCouponCode(e.target.value.toUpperCase()); setCouponError(null); }}
                      placeholder="e.g. WELCOME10"
                      className="flex-1 bg-white border border-gray-300 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 uppercase focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const code = receiveCouponCode.trim().toUpperCase();
                        if (!code) { setAppliedCoupon(null); setCouponError(null); return; }
                        // Simple validation: if code is non-empty treat as free-text coupon
                        // (no coupon DB in admin page; reject unknown codes)
                        setCouponError("Coupon validation is available on the POS page.");
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                    >
                      Apply
                    </button>
                  </div>
                  {appliedCoupon && (
                    <div className="mt-1.5 flex items-center justify-between text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                      <span className="font-bold">✓ {appliedCoupon.code} (-₹{settlementCalc.couponDiscountAmount.toFixed(2)})</span>
                      <button type="button" onClick={() => { setAppliedCoupon(null); setReceiveCouponCode(""); }} className="text-xs text-rose-600 hover:underline font-bold cursor-pointer">Remove</button>
                    </div>
                  )}
                  {couponError && <p className="mt-1 text-[11px] font-semibold text-rose-600">{couponError}</p>}
                </div>

                {/* Manual Discount */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">Manual Discount</label>
                  <div className="flex gap-2">
                    <select
                      value={receiveDiscountType}
                      onChange={(e) => setReceiveDiscountType(e.target.value as "FIXED" | "PERCENT")}
                      className="bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="FIXED">₹</option>
                      <option value="PERCENT">%</option>
                    </select>
                    <input
                      type="number"
                      min="0"
                      value={receiveDiscountValue}
                      onChange={(e) => setReceiveDiscountValue(e.target.value === "" ? "" : parseFloat(e.target.value))}
                      onWheel={(e) => e.currentTarget.blur()}
                      placeholder="Discount amount"
                      className="flex-1 bg-white border border-gray-300 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none"
                    />
                  </div>
                  {settlementCalc.manualDiscountAmount > 0 && (
                    <p className="mt-1 text-[11px] text-gray-500 font-medium">Manual discount: -₹{settlementCalc.manualDiscountAmount.toFixed(2)}</p>
                  )}
                </div>

                {/* Payment Method */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">Payment Method</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["CASH", "GPAY", "SPLIT"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setReceivePaymentMode(mode)}
                        className={`py-2 px-1 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                          receivePaymentMode === mode
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                            : "bg-white text-gray-700 border-gray-200 hover:border-emerald-500"
                        }`}
                      >
                        {mode === "GPAY" ? "UPI / GPay" : mode === "CASH" ? "Cash" : "Card / Split"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Payment Notes */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">Payment Notes (Optional)</label>
                  <textarea
                    value={receivePaymentNotes}
                    onChange={(e) => setReceivePaymentNotes(e.target.value)}
                    placeholder="e.g. Settle remaining via UPI..."
                    className="w-full bg-white border border-gray-300 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none min-h-[60px] resize-none"
                  />
                </div>

                {/* Info box */}
                <div className="bg-amber-50 border border-amber-300/80 rounded-xl p-3 text-[11px] text-amber-900 font-medium">
                  Confirmation marks the order Completed, creates one official invoice, and recognizes the full ₹{settlementCalc.grandTotal.toFixed(2)} as revenue.
                </div>

                {/* Validation error */}
                {!settlementCalc.isValid && (
                  <div className="bg-rose-50 border border-rose-300 rounded-xl p-2.5 text-xs text-rose-700 font-bold">
                    {settlementCalc.errorMessage || "Discount cannot reduce the total below the amount already paid."}
                  </div>
                )}

                {/* Confirm button */}
                <button
                  onClick={confirmReceiveBalance}
                  disabled={isFinalizing || !settlementCalc.isValid}
                  className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all ${
                    isFinalizing || !settlementCalc.isValid ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                  }`}
                >
                  {isFinalizing ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /><span>Finalizing...</span></>
                  ) : (
                    <><Check className="w-4 h-4" /><span>Confirm Final Payment</span></>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
