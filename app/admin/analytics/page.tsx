"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart2,
  TrendingUp,
  ShoppingBag,
  IndianRupee,
  Trophy,
  Calendar,
  Globe,
  RefreshCw,
  Percent,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

type PeriodKey = "all" | "today" | "week" | "month" | "year";

interface SaleRecord {
  id: string;
  total?: number;
  grand_total?: number;
  subtotal?: number;
  gst_amount?: number;
  is_gst?: boolean;
  delivery_fee?: number;
  created_at: string;
  status: string;
  is_advance?: boolean | null;
  payment_mode?: string;
  source?: string;
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

export const isCompletedSale = (sale: any): boolean => {
  if (!sale) return false;
  const status = String(sale.status || "").toUpperCase();
  const isAdv = isAdvanceOrder(sale);

  // Incomplete advance orders (status PENDING, READY, or CANCELLED) MUST NOT inflate revenue metrics, charts, or order counts
  if (isAdv) {
    return status === "COMPLETED";
  }

  // Standard retail sales must be COMPLETED
  return (
    status === "COMPLETED" ||
    (!sale.status && status !== "CANCELLED" && status !== "PENDING" && status !== "READY")
  );
};

export default function AdminAnalyticsPage() {
  const [salesData, setSalesData] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [period, setPeriod] = useState<PeriodKey>("all");

  const formatINR = (val: number) =>
    Number(val || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const loadSalesData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // 1. Query orders table
      const { data: sales, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[Analytics] Error loading sales data:", error);
      }

      // 2. Query completed advance orders from advance_orders table
      let compAdvRecords: SaleRecord[] = [];
      try {
        const { data: advData } = await supabase
          .from("advance_orders")
          .select("*")
          .ilike("status", "COMPLETED");

        if (advData && advData.length > 0) {
          compAdvRecords = advData.map((a: any) => {
            const tot = Number(a.total_amount ?? a.deposit_amount ?? 0);
            return {
              id: a.id,
              grand_total: tot,
              total: tot,
              subtotal: Number(a.subtotal) || tot,
              gst_amount: 0,
              is_gst: false,
              delivery_fee: 0,
              created_at: a.finalized_at || a.created_at || new Date().toISOString(),
              status: "COMPLETED",
              is_advance: true,
              payment_mode: a.deposit_payment_mode || "CASH",
              source: "OFFLINE",
            };
          });
        }
      } catch (advErr) {
        console.warn("Analytics advance orders fetch notice:", advErr);
      }

      // 3. Deduplicate by order primary key, merging advance records
      const combinedMap = new Map<string, SaleRecord>();
      for (const s of (sales || [])) {
        if (!s.id) continue;
        combinedMap.set(s.id, s);
      }
      for (const adv of compAdvRecords) {
        if (!adv.id) continue;
        if (!combinedMap.has(adv.id)) {
          combinedMap.set(adv.id, adv);
        } else {
          const existing = combinedMap.get(adv.id)!;
          const exTotal = Number(existing.grand_total ?? existing.total ?? 0);
          if (exTotal <= 0 && adv.grand_total && adv.grand_total > 0) {
            combinedMap.set(adv.id, {
              ...existing,
              grand_total: adv.grand_total,
              total: adv.grand_total,
              status: "COMPLETED",
            });
          }
        }
      }

      // 4. Strictly isolate: exclude all unfulfilled deposits and incomplete advance orders
      const validCompletedSales = Array.from(combinedMap.values()).filter(isCompletedSale);
      setSalesData(validCompletedSales);
    } catch (err) {
      console.error("[Analytics] Error loading sales data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSalesData();

    const handleFocus = () => loadSalesData(true);
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [loadSalesData]);

  // Filter completed sales by selected period
  const filteredSales = salesData.filter((sale) => {
    // Strictly exclude any non-completed sales or incomplete advance orders
    if (!isCompletedSale(sale)) return false;

    if (period === "all") return true;

    const d = new Date(sale.created_at);
    if (isNaN(d.getTime())) return false;
    const now = new Date();

    if (period === "today") {
      return (
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      );
    }
    if (period === "week") {
      const startOfWeek = new Date(now);
      const day = startOfWeek.getDay();
      startOfWeek.setDate(startOfWeek.getDate() - (day === 0 ? 6 : day - 1));
      startOfWeek.setHours(0, 0, 0, 0);
      return d >= startOfWeek;
    }
    if (period === "month") {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    if (period === "year") {
      return d.getFullYear() === now.getFullYear();
    }
    return true;
  });

  // Helper to extract realized revenue from completed sales & advance orders
  const getSaleAmount = (s: SaleRecord) =>
    Number(s.grand_total ?? s.total ?? (s as any).total_amount ?? (s as any).amount_paid ?? 0);

  // Calculate clean core metrics (strictly completed sales)
  const totalRevenue = filteredSales.reduce(
    (sum, s) => sum + getSaleAmount(s),
    0
  );
  const totalOrders = filteredSales.length;
  const avgBillValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Breakdown metrics
  const offlineSales = filteredSales.filter((s) => s.source !== "ONLINE");
  const onlineSales = filteredSales.filter((s) => s.source === "ONLINE");
  const offlineRevenue = offlineSales.reduce(
    (sum, s) => sum + getSaleAmount(s),
    0
  );
  const onlineRevenue = onlineSales.reduce(
    (sum, s) => sum + getSaleAmount(s),
    0
  );

  const gstSales = filteredSales.filter((s) => Boolean(s.is_gst));
  const nonGstSales = filteredSales.filter((s) => !Boolean(s.is_gst));
  const gstRevenue = gstSales.reduce(
    (sum, s) => sum + getSaleAmount(s),
    0
  );
  const nonGstRevenue = nonGstSales.reduce(
    (sum, s) => sum + getSaleAmount(s),
    0
  );

  // Monthly revenue trend (last 12 months)
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const currentYear = new Date().getFullYear();
  const monthlyRevenue = Array(12).fill(0);
  salesData.forEach((s) => {
    if (isCompletedSale(s)) {
      const d = new Date(s.created_at);
      if (d.getFullYear() === currentYear) {
        monthlyRevenue[d.getMonth()] += getSaleAmount(s);
      }
    }
  });
  const maxMonthlyRevenue = Math.max(...monthlyRevenue, 1);

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
              <BarChart2 className="w-6 h-6 text-teal-600" />
              Realized Sales &amp; Revenue Analytics
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Strictly finalized completed sales revenue. Uncollected advance deposits and pending orders are excluded.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadSalesData(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <Link
              href="/admin/orders"
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
            >
              Order History
            </Link>
            <Link
              href="/admin/advance-orders"
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
            >
              Advance Orders
            </Link>
          </div>
        </div>

        {/* Period Selector Tabs */}
        <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl max-w-fit text-xs font-semibold">
          {[
            { key: "all", label: "All Time" },
            { key: "today", label: "Today" },
            { key: "week", label: "This Week" },
            { key: "month", label: "This Month" },
            { key: "year", label: "This Year" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setPeriod(tab.key as PeriodKey)}
              className={`px-4 py-1.5 rounded-lg transition-all ${
                period === tab.key
                  ? "bg-white text-slate-900 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Core Metric Cards Grid — Rebalanced across 3 columns without gaps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Total Realized Revenue */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all">
            <div className="flex justify-between items-start mb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Total Sales / Revenue
              </span>
              <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <IndianRupee className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-950 font-mono mb-1">
              ₹{formatINR(totalRevenue)}
            </div>
            <div className="text-[11px] text-slate-500 font-medium">
              Strictly completed and finalized sales
            </div>
          </div>

          {/* Card 2: Total Orders */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all">
            <div className="flex justify-between items-start mb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Total Completed Orders
              </span>
              <div className="w-8 h-8 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-950 font-mono mb-1">
              {totalOrders}
            </div>
            <div className="text-[11px] text-slate-500 font-medium">
              Finalized checkout transactions
            </div>
          </div>

          {/* Card 3: Average Bill Value */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all">
            <div className="flex justify-between items-start mb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Average Bill Value
              </span>
              <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                <Trophy className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-950 font-mono mb-1">
              ₹{formatINR(avgBillValue)}
            </div>
            <div className="text-[11px] text-slate-500 font-medium">
              Average ticket size per completed invoice
            </div>
          </div>
        </div>

        {/* Secondary Operational Metrics Grid (4 columns) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Offline Sales (Walk-in)
            </span>
            <div className="text-xl font-black text-slate-900 mt-1 font-mono">
              ₹{formatINR(offlineRevenue)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
              {offlineSales.length} walk-in orders
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Online Channel Sales
            </span>
            <div className="text-xl font-black text-slate-900 mt-1 font-mono">
              ₹{formatINR(onlineRevenue)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
              {onlineSales.length} online orders
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              GST Invoiced Revenue
            </span>
            <div className="text-xl font-black text-teal-700 mt-1 font-mono">
              ₹{formatINR(gstRevenue)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
              {gstSales.length} GST invoices
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Non-GST Sales Revenue
            </span>
            <div className="text-xl font-black text-slate-700 mt-1 font-mono">
              ₹{formatINR(nonGstRevenue)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
              {nonGstSales.length} Non-GST bills
            </div>
          </div>
        </div>

        {/* Revenue Trend Visualization */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-teal-600" />
                Completed Sales Revenue Trend ({currentYear})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Monthly realized sales performance based strictly on completed invoices.
              </p>
            </div>
          </div>

          <div className="h-48 flex items-end justify-between gap-2 pt-8 pb-2">
            {months.map((m, idx) => {
              const val = monthlyRevenue[idx];
              const heightPercent = Math.max(8, Math.round((val / maxMonthlyRevenue) * 100));

              return (
                <div key={m} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                  <div className="text-[9px] font-mono font-bold text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    ₹{val > 1000 ? `${(val / 1000).toFixed(1)}k` : val}
                  </div>
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className={`w-full max-w-[36px] rounded-t-lg transition-all ${
                      val > 0
                        ? "bg-teal-600 hover:bg-teal-500"
                        : "bg-slate-100"
                    }`}
                  />
                  <div className="text-[10px] font-bold text-slate-600">{m}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
