"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  History,
  Search,
  RefreshCw,
  FileText,
  Printer,
  ChevronDown,
  Calendar,
  CreditCard,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

type PeriodFilter = "ALL" | "TODAY" | "WEEK" | "MONTH" | "YEAR";

interface OrderCustomer {
  name?: string | null;
  phone?: string | null;
  address?: string | null;
}

interface OrderItem {
  id: string;
  snapshot_name: string;
  snapshot_price: number;
  quantity: number;
}

interface OrderRecord {
  id: string;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  customers?: OrderCustomer | null;
  source?: string;
  status: string;
  is_gst: boolean;
  subtotal: number;
  discount_amount?: number;
  gst_percentage?: number;
  gst_amount?: number;
  delivery_fee?: number;
  grand_total: number;
  cash_received?: number;
  payment_mode: string;
  bill_date?: string;
  created_at: string;
  is_advance?: boolean | null;
  order_items?: OrderItem[];
  items?: OrderItem[];
}

export const isAdvanceOrder = (order: any): boolean => {
  if (!order) return false;
  return (
    order.is_advance === true ||
    order.is_advance === "true" ||
    order.order_type === "ADVANCE" ||
    String(order.id || "").toUpperCase().startsWith("DEP-") ||
    String(order.invoice_id || "").toUpperCase().startsWith("DEP-")
  );
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("ALL");
  const [gstFilter, setGstFilter] = useState<"ALL" | "GST" | "NONGST">("ALL");

  const formatINR = (val: number) =>
    Number(val || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const fetchOrders = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // 1. Fetch orders reliably from orders table
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          customers (
            name,
            phone,
            address
          ),
          order_items (
            id,
            snapshot_name,
            snapshot_price,
            quantity
          )
        `)
        .order("created_at", { ascending: false });

      let rawOrders = data || [];
      if (error) {
        console.error(
          `[Orders] Supabase orders fetch error [code: ${error.code}, message: ${error.message}, details: ${error.details}, hint: ${error.hint}]`
        );
        if (error.code === "401" || error.code === "403" || error.code === "PGRST301") {
          console.error("[Orders] Unauthorized / RLS policy block on orders table. Check read permissions.");
        }

        const { data: flatData, error: flatError } = await supabase
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false });

        if (flatError) {
          console.error(
            `[Orders] Flat fallback error [code: ${flatError.code}, message: ${flatError.message}]`
          );
        } else if (flatData) {
          rawOrders = flatData;
        }
      }

      // 2. Also query completed advance orders from advance_orders table to ensure 100% presence
      let completedAdvOrders: any[] = [];
      try {
        const { data: advData, error: advErr } = await supabase
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
              snapshot_name,
              snapshot_price,
              quantity
            )
          `)
          .ilike("status", "COMPLETED");

        if (advErr) {
          console.error(`[Orders] Advance orders fetch error [code: ${advErr.code}]:`, advErr.message);
        } else if (advData && advData.length > 0) {
          completedAdvOrders = advData.map((a: any) => ({
            id: a.id,
            customer_id: a.customer_id,
            source: "OFFLINE",
            status: "COMPLETED",
            is_gst: false,
            subtotal: Number(a.subtotal) || 0,
            discount_type: "FIXED",
            discount_value: 0,
            discount_amount: 0,
            gst_percentage: 0,
            gst_amount: 0,
            delivery_fee: 0,
            grand_total: Number(a.total_amount ?? a.deposit_amount ?? 0),
            cash_received: Number(a.total_amount ?? a.deposit_amount ?? 0),
            payment_mode: a.deposit_payment_mode || "CASH",
            bill_date: a.finalized_at
              ? a.finalized_at.split("T")[0]
              : a.created_at
              ? a.created_at.split("T")[0]
              : new Date().toISOString().split("T")[0],
            created_at: a.created_at || new Date().toISOString(),
            is_advance: true,
            order_type: "ADVANCE",
            invoice_id: a.finalized_order_id || a.id,
            customers: a.customers,
            customer_name: a.customers?.name || "Walk-in Customer",
            customer_phone: a.customers?.phone || "",
            customer_address: a.customers?.address || null,
            order_items: (a.advance_order_items || []).map((it: any) => ({
              id: it.id,
              snapshot_name: it.snapshot_name,
              snapshot_price: Number(it.snapshot_price) || 0,
              quantity: Number(it.quantity) || 1,
            })),
          }));
        }
      } catch (advErr) {
        console.warn("[Orders] Secondary completed advance orders fetch notice:", advErr);
      }

      const allCombinedOrders = [...rawOrders, ...completedAdvOrders];

      // 3. Client-side filter:
      // - Exclude incomplete advance orders (status PENDING, READY, or CANCELLED)
      // - Display all regular completed sales PLUS any advance order whose status is explicitly 'COMPLETED'
      // - No strict ID prefix filtering (accepts both "INV-" and "DEP-")
      // - Case-insensitive status matching handles 'COMPLETED' and 'completed'
      const visibleOrders = allCombinedOrders.filter((order: any) => {
        const isAdvance = isAdvanceOrder(order);
        const status = String(order.status || "").trim().toUpperCase();

        if (isAdvance) {
          return status === "COMPLETED";
        }

        // Standard retail sales: strictly COMPLETED (or legacy retail sales without explicit status, but excluding non-completed statuses)
        return (
          status === "COMPLETED" ||
          (!order.status && status !== "CANCELLED" && status !== "PENDING" && status !== "READY")
        );
      });

      // 4. State Deduplication: Ensure only one unique row per order ID is stored and rendered
      const uniqueOrderMap = new Map<string, OrderRecord>();
      for (const ord of visibleOrders) {
        if (!ord.id || uniqueOrderMap.has(ord.id)) continue;
        uniqueOrderMap.set(ord.id, ord);
      }

      const dedupedList = Array.from(uniqueOrderMap.values());
      dedupedList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      // Completely overwrite state with fresh query result
      setOrders(dedupedList);
    } catch (err: any) {
      console.error("[Orders] Error fetching orders:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    // 1. Ensure auth session is restored before initial query execution
    const initAuthAndFetch = async () => {
      try {
        const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr) {
          console.warn("[Orders] Auth session check notice:", sessionErr);
        } else if (session) {
          console.log("[Orders] Active auth session verified:", session.user.email);
        }
      } catch (authErr) {
        console.warn("[Orders] Session restoration notice:", authErr);
      } finally {
        if (isMounted) {
          fetchOrders();
        }
      }
    };

    initAuthAndFetch();

    // 2. Listen to auth state transitions to refetch when session refreshes
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(() => {
      if (isMounted) {
        fetchOrders(true);
      }
    });

    // 3. Supabase Realtime channel: listen to changes and completely overwrite state
    const channel = supabase
      .channel("admin-orders-realtime-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          if (isMounted) fetchOrders(true);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "advance_orders" },
        () => {
          if (isMounted) fetchOrders(true);
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("[Orders] Realtime sync channel active");
        }
      });

    // 4. Refetch on window focus
    const handleFocus = () => {
      if (isMounted) fetchOrders(true);
    };
    window.addEventListener("focus", handleFocus);

    // Explicit cleanup function: unsubscribes channel and listeners on unmount
    return () => {
      isMounted = false;
      authSub.unsubscribe();
      supabase.removeChannel(channel);
      window.removeEventListener("focus", handleFocus);
    };
  }, [fetchOrders]);

  // Helper to parse order dates accurately in local timezone
  const parseOrderDate = (o: OrderRecord): Date => {
    if (o.created_at) {
      const dt = new Date(o.created_at);
      if (!isNaN(dt.getTime())) return dt;
    }
    if (o.bill_date) {
      const parts = String(o.bill_date).split("T")[0].split("-");
      if (parts.length === 3) {
        return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
      }
      const dt = new Date(o.bill_date);
      if (!isNaN(dt.getTime())) return dt;
    }
    return new Date();
  };

  const filteredOrders = orders.filter((o) => {
    // Search filter
    const query = searchQuery.toLowerCase().trim();
    if (query) {
      const idMatch = (o.id || "").toLowerCase().includes(query);
      const custName = (o.customers?.name || o.customer_name || "").toLowerCase();
      const custPhone = (o.customers?.phone || o.customer_phone || "").toLowerCase();
      if (!idMatch && !custName.includes(query) && !custPhone.includes(query)) {
        return false;
      }
    }

    // GST filter
    if (gstFilter === "GST" && !o.is_gst) return false;
    if (gstFilter === "NONGST" && o.is_gst) return false;

    // Period filter: When "ALL" is active, bypass all date constraints completely
    if (periodFilter !== "ALL") {
      const d = parseOrderDate(o);
      const now = new Date();

      if (periodFilter === "TODAY") {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        if (d < startOfDay || d > endOfDay) return false;
      } else if (periodFilter === "WEEK") {
        const startOfWeek = new Date(now);
        const day = startOfWeek.getDay();
        startOfWeek.setDate(startOfWeek.getDate() - (day === 0 ? 6 : day - 1));
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        if (d < startOfWeek || d > endOfWeek) return false;
      } else if (periodFilter === "MONTH") {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        if (d < startOfMonth || d > endOfMonth) return false;
      } else if (periodFilter === "YEAR") {
        const startOfYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        if (d < startOfYear || d > endOfYear) return false;
      }
    }

    return true;
  });

  const totalSales = filteredOrders.reduce((sum, o) => sum + (Number(o.grand_total) || 0), 0);
  const totalOrdersCount = filteredOrders.length;
  const avgOrderValue = totalOrdersCount > 0 ? totalSales / totalOrdersCount : 0;

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
              <History className="w-6 h-6 text-teal-600" />
              Order History &amp; Completed Sales
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Verified point-of-sale invoices and completed advance sales. Uncollected deposits remain in Advance Orders.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchOrders(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <Link
              href="/admin/advance-orders"
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
            >
              Advance Orders
            </Link>
            <Link
              href="/admin/analytics"
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
            >
              Analytics Dashboard
            </Link>
          </div>
        </div>

        {/* Quick Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Total Realized Sales
            </div>
            <div className="text-2xl font-black text-slate-950 mt-1">
              ₹{formatINR(totalSales)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              From {totalOrdersCount} completed orders
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Completed Orders
            </div>
            <div className="text-2xl font-black text-slate-950 mt-1">
              {totalOrdersCount}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Excludes active advance holds
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Average Bill Value
            </div>
            <div className="text-2xl font-black text-teal-700 mt-1">
              ₹{formatINR(avgOrderValue)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Per finalized customer sale
            </div>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[200px] w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 shrink-0 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by invoice ID, customer name, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Period Filter */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl font-semibold">
              {(["ALL", "TODAY", "WEEK", "MONTH", "YEAR"] as PeriodFilter[]).map((period) => (
                <button
                  key={period}
                  onClick={() => setPeriodFilter(period)}
                  className={`px-3 py-1 rounded-lg text-[11px] transition-all ${
                    periodFilter === period
                      ? "bg-white text-slate-900 shadow-xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {period === "ALL" ? "All Time" : period.charAt(0) + period.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            {/* GST Filter */}
            <select
              value={gstFilter}
              onChange={(e) => setGstFilter(e.target.value as any)}
              className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer focus:outline-none"
            >
              <option value="ALL">All Bills (GST + Non-GST)</option>
              <option value="GST">GST Invoices Only</option>
              <option value="NONGST">Non-GST Bills Only</option>
            </select>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50/80">
                  <th className="px-4 py-3">Invoice ID</th>
                  <th className="px-4 py-3">Date &amp; Time</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Mode</th>
                  <th className="px-4 py-3 text-right">Subtotal</th>
                  <th className="px-4 py-3 text-right">GST</th>
                  <th className="px-4 py-3 text-right">Grand Total</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="p-12 text-center text-xs font-semibold text-slate-400">
                      Loading orders history...
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-12 text-center text-xs font-bold text-slate-500">
                      No matching completed orders found.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((o) => {
                    const custName = o.customers?.name || o.customer_name || "Counter Customer";
                    const custPhone = o.customers?.phone || o.customer_phone || "";
                    const subtotal = Number(o.subtotal) || 0;
                    const gstAmount = Number(o.gst_amount) || 0;
                    const grandTotal = Number(o.grand_total) || 0;

                    const dateStr = o.created_at
                      ? new Date(o.created_at).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : o.bill_date || "—";

                    const timeStr = o.created_at
                      ? new Date(o.created_at).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })
                      : "";

                    return (
                      <tr key={o.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">
                          {o.id}
                          {isAdvanceOrder(o) && (
                            <span className="ml-1.5 px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[9px] font-bold rounded">
                              ADVANCE
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          <div>{dateStr}</div>
                          {timeStr && <div className="text-[10px] text-slate-400">{timeStr}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{custName}</div>
                          {custPhone && <div className="text-[11px] font-mono text-slate-400">{custPhone}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-800">
                            {o.payment_mode || "CASH"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-600">
                          ₹{formatINR(subtotal)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-600">
                          {gstAmount > 0 ? `₹${formatINR(gstAmount)}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-black text-slate-950">
                          ₹{formatINR(grandTotal)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                            COMPLETED
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              href={`/invoice/${o.id}`}
                              title="View Tax Invoice"
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 text-xs font-bold rounded-lg transition-colors"
                            >
                              <FileText className="w-3.5 h-3.5" /> Invoice
                            </Link>
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
      </div>
    </div>
  );
}
