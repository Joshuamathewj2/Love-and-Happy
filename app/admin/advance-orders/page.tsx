"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock, MessageSquare, FileText, Eye, IndianRupee, Trash2, RefreshCw } from "lucide-react";
import { fetchAdvanceOrders, removeAdvanceOrder } from "@/app/pos/actions";
import { AdvanceOrderWithRelations, AdvanceOrderStatus } from "@/lib/types";
import { supabase } from "@/lib/supabaseClient";

type FilterTab = "ALL" | AdvanceOrderStatus;

export default function AdminAdvanceOrdersPage() {
  const router = useRouter();
  const [advanceOrders, setAdvanceOrders] = useState<AdvanceOrderWithRelations[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("ALL");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const loadData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    try {
      const data = await fetchAdvanceOrders();
      setAdvanceOrders(data || []);
    } catch (err) {
      console.error("Failed to load advance orders:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Auto-refetch on window focus to prevent stale Next.js cache
    const handleFocus = () => {
      loadData();
    };
    window.addEventListener("focus", handleFocus);
    return () => {
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

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    setAdvanceOrders((prev) =>
      prev.map((ord) => (ord.id === orderId ? { ...ord, status: newStatus as AdvanceOrderStatus } : ord))
    );

    const { error } = await supabase
      .from("advance_orders")
      .update({
        status: newStatus,
      })
      .eq("id", orderId);

    if (error) {
      console.error("Failed to update status:", error);
      alert(`Error updating status: ${error.message}`);
      loadData();
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link
                href="/pos/admin/secure/control-panel/ss-creatives"
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
              href="/pos/admin/secure/control-panel/ss-creatives"
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
            >
              Open POS Register
            </Link>
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
                  const total = Number(a.total_amount) || 0;
                  const paid = Number(a.deposit_amount) || 0;
                  const balanceDue = Math.max(0, total - paid);
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
                            value={statusUpper}
                            onChange={(e) => handleStatusChange(a.id, e.target.value)}
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
                              href="/pos/admin/secure/control-panel/ss-creatives"
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
    </div>
  );
}
