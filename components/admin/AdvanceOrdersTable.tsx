import React from "react";
import Link from "next/link";
import { MessageSquare, FileText, Eye, IndianRupee, Trash2 } from "lucide-react";
import { AdvanceOrderWithRelations } from "@/lib/types";
import { calculateAdvanceOrderTotals } from "@/lib/advanceOrderCalculations";

export interface AdvanceOrdersTableProps {
  advanceOrders: AdvanceOrderWithRelations[];
  onMarkReady?: (orderId: string) => void;
  onWhatsApp?: (order: AdvanceOrderWithRelations) => void;
  onViewInvoice?: (order: AdvanceOrderWithRelations) => void;
  onViewDetails?: (order: AdvanceOrderWithRelations) => void;
  onReceiveBalance?: (order: AdvanceOrderWithRelations) => void;
  onDelete?: (order: AdvanceOrderWithRelations) => void;
}

export function AdvanceOrdersTable({
  advanceOrders,
  onMarkReady,
  onWhatsApp,
  onViewInvoice,
  onViewDetails,
  onReceiveBalance,
  onDelete,
}: AdvanceOrdersTableProps) {
  return (
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
          {advanceOrders.length === 0 ? (
            <tr>
              <td colSpan={7} className="p-12 text-center text-xs font-bold text-slate-500">
                No advance orders found.
              </td>
            </tr>
          ) : (
            advanceOrders.map((order: AdvanceOrderWithRelations) => {
              const totals = calculateAdvanceOrderTotals({
                items: (order.items || []).map((it) => ({
                  price: Number(it.snapshot_price) || 0,
                  qty: Number(it.quantity) || 1,
                })),
                subtotal: Number(order.subtotal) || Number(order.total_amount) || 0,
                isGst: order.is_gst !== undefined ? Boolean(order.is_gst) : undefined,
                gstPercentage: order.gst_percentage !== undefined ? Number(order.gst_percentage) : undefined,
                taxMode: order.tax_mode || "exclusive",
                manualDiscount:
                  Number(order.discount_amount) > 0 || Number(order.discount_value) > 0
                    ? {
                        type: (((order.discount_type || "FIXED").toUpperCase() as any)),
                        value: Number(order.discount_value) || Number(order.discount_amount) || 0,
                      }
                    : null,
                deliveryFee: Number(order.delivery_fee) || 0,
                advanceAmount: Number(order.deposit_amount) || 0,
                grandTotal: Number(order.total_amount) || undefined,
              });
              const total = totals.grandTotal;
              const paid = totals.totalPaid;
              const balanceDue = totals.remainingBalance;

              return (
                <tr key={order.id} className="hover:bg-slate-50/60 transition-colors">
                  {/* Deposit ID */}
                  <td className="w-[14%] text-left px-4 py-3 align-middle">
                    <p className="text-xs font-bold text-slate-950 font-mono">
                      {order.id}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {new Date(order.created_at).toLocaleDateString()}
                    </p>
                  </td>

                  {/* Customer */}
                  <td className="w-[14%] text-left px-4 py-3 align-middle">
                    <p className="font-bold text-slate-900">{order.customer_name}</p>
                    <p className="text-[11px] text-slate-500 font-mono">{order.customer_phone}</p>
                  </td>

                  {/* Product */}
                  <td className="w-[18%] text-left px-4 py-3 align-middle">
                    <div className="text-[11px] space-y-0.5">
                      {order.items.slice(0, 2).map((i) => (
                        <p key={i.id} className="font-medium text-slate-800 truncate">
                          {i.quantity}× {i.snapshot_name}
                        </p>
                      ))}
                      {order.items.length > 2 && (
                        <p className="text-[10px] text-slate-400 font-medium">
                          +{order.items.length - 2} more items
                        </p>
                      )}
                    </div>
                  </td>

                  {/* Total / Paid / Balance */}
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
                    {order.delivery_date
                      ? new Date(order.delivery_date).toLocaleDateString("en-IN")
                      : "—"}
                  </td>

                  {/* Status */}
                  <td className="w-[12%] text-center px-4 py-3 align-middle">
                    <div className="flex flex-col items-center justify-center gap-1">
                      <span
                        className={`inline-block px-3 py-0.5 rounded-full text-xs font-semibold border ${
                          order.status === "COMPLETED"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                            : order.status === "READY"
                            ? "bg-blue-50 text-blue-700 border-blue-300"
                            : order.status === "CANCELLED"
                            ? "bg-rose-50 text-rose-700 border-rose-300"
                            : "bg-amber-50 text-amber-700 border-amber-300"
                        }`}
                      >
                        {order.status || "PENDING"}
                      </span>
                      {order.status === "PENDING" && onMarkReady && (
                        <button
                          onClick={() => onMarkReady(order.id)}
                          className="text-[11px] font-bold text-blue-600 hover:underline tracking-tight uppercase cursor-pointer"
                        >
                          MARK AS READY
                        </button>
                      )}
                    </div>
                  </td>

                  {/* Actions (WhatsApp, Invoice, View Details, Collect Payment, Delete) */}
                  <td className="w-[13%] text-right pr-4 py-3 align-middle">
                    <div className="flex items-center justify-end gap-1.5 flex-nowrap">
                      {/* WhatsApp */}
                      {onWhatsApp && (
                        <button
                          onClick={() => onWhatsApp(order)}
                          title="Send on WhatsApp"
                          className="flex items-center justify-center w-7 h-7 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-md transition-colors cursor-pointer shrink-0"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Invoice */}
                      <Link
                        href={`/advance/${order.id}`}
                        title="Print / View Invoice"
                        className="flex items-center justify-center w-7 h-7 bg-cyan-50 hover:bg-cyan-100 text-cyan-600 rounded-md transition-colors cursor-pointer shrink-0"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </Link>

                      {/* View Details */}
                      {onViewDetails && (
                        <button
                          onClick={() => onViewDetails(order)}
                          title="View Details"
                          className="flex items-center justify-center w-7 h-7 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md transition-colors cursor-pointer shrink-0"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Collect Payment */}
                      {order.status !== "COMPLETED" && order.status !== "CANCELLED" && onReceiveBalance && (
                        <button
                          onClick={() => onReceiveBalance(order)}
                          title="Collect Payment"
                          className="flex items-center justify-center w-7 h-7 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-md transition-colors cursor-pointer shrink-0"
                        >
                          <IndianRupee className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Delete */}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(order)}
                          title="Delete Order"
                          className="flex items-center justify-center w-7 h-7 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-md transition-colors cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export default AdvanceOrdersTable;
