/**
 * Pure calculation logic for Advance Orders and final invoice settlement.
 * Single source of truth across:
 * - Deposit creation form
 * - Receive Remaining Payment popup
 * - Advance Orders list
 * - Invoice preview / print templates
 * - Analytics dashboard
 */

export interface AdvanceOrderItemInput {
  price: number;
  qty: number;
  name?: string;
}

export interface DiscountSpec {
  type: 'FIXED' | 'PERCENT' | 'fixed' | 'percent';
  value: number;
}

export interface AdvanceOrderCalculationParams {
  items?: AdvanceOrderItemInput[];
  subtotal?: number; // Precomputed subtotal if items not passed
  isGst?: boolean;
  gstPercentage?: number;
  taxMode?: 'exclusive' | 'inclusive';
  couponDiscount?: DiscountSpec | null;
  manualDiscount?: DiscountSpec | null;
  deliveryFee?: number;
  advanceAmount?: number;
  additionalPaid?: number;
  isCompleted?: boolean;
  grandTotal?: number;
}

export interface AdvanceOrderCalculationResult {
  subtotal: number;
  couponDiscountAmount: number;
  manualDiscountAmount: number;
  discountAmount: number;
  netSubtotal: number;
  taxableAmount: number;
  gstPercentage: number;
  gstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  deliveryFee: number;
  grandTotal: number;
  totalPaid: number;
  remainingBalance: number;
  advancePaid: number;
  settlementPaid: number;
  isValid: boolean;
  errorMessage?: string;
}

// Helpers for precise rounding in currency (2 decimals, round half-up)
export function roundToTwo(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function toPaise(num: number): number {
  return Math.round(Number(num || 0) * 100);
}

export function fromPaise(paise: number): number {
  return paise / 100;
}

/**
 * Single source of truth calculation for Advance Orders
 */
export function calculateAdvanceOrderTotals(
  params: AdvanceOrderCalculationParams
): AdvanceOrderCalculationResult {
  // 1. Calculate raw subtotal
  let subtotal = 0;
  if (params.items && params.items.length > 0) {
    subtotal = params.items.reduce((sum, item) => {
      const price = Number(item.price) || 0;
      const qty = Number(item.qty) || 0;
      return sum + price * qty;
    }, 0);
  } else {
    subtotal = Number(params.subtotal) || 0;
  }
  subtotal = roundToTwo(subtotal);

  // 2. Compute discounts (Coupon + Manual)
  // Discount applies before tax. Total discount cannot exceed subtotal.
  let couponDiscountAmount = 0;
  if (params.couponDiscount && params.couponDiscount.value > 0) {
    const isPercent = String(params.couponDiscount.type).toUpperCase() === 'PERCENT';
    if (isPercent) {
      couponDiscountAmount = roundToTwo(subtotal * (params.couponDiscount.value / 100));
    } else {
      couponDiscountAmount = roundToTwo(Number(params.couponDiscount.value) || 0);
    }
  }

  let manualDiscountAmount = 0;
  if (params.manualDiscount && params.manualDiscount.value > 0) {
    const isPercent = String(params.manualDiscount.type).toUpperCase() === 'PERCENT';
    if (isPercent) {
      manualDiscountAmount = roundToTwo(subtotal * (params.manualDiscount.value / 100));
    } else {
      manualDiscountAmount = roundToTwo(Number(params.manualDiscount.value) || 0);
    }
  }

  let totalDiscount = roundToTwo(couponDiscountAmount + manualDiscountAmount);
  if (totalDiscount > subtotal) {
    totalDiscount = subtotal;
    // Cap manual discount if needed
    manualDiscountAmount = Math.max(0, roundToTwo(subtotal - couponDiscountAmount));
  }

  const netSubtotal = Math.max(0, roundToTwo(subtotal - totalDiscount));
  const deliveryFee = roundToTwo(Math.max(0, Number(params.deliveryFee) || 0));

  // 3. GST Calculation & Legacy Inference
  let isGst = Boolean(params.isGst);
  let gstRate = isGst ? Math.max(0, Number(params.gstPercentage) || 0) : 0;
  const taxMode = params.taxMode || 'exclusive';

  const storedGrandTotal = roundToTwo(Math.max(0, Number(params.grandTotal) || 0));
  const hasSettlementDiscount = totalDiscount > 0;

  // Legacy fallback: if GST is not explicitly marked true, but storedGrandTotal exceeds netSubtotal + deliveryFee,
  // infer GST from storedGrandTotal so legacy pre-GST subtotals are never displayed.
  if (!isGst && storedGrandTotal > roundToTwo(netSubtotal + deliveryFee) && netSubtotal > 0 && !hasSettlementDiscount) {
    const diff = roundToTwo(storedGrandTotal - (netSubtotal + deliveryFee));
    isGst = true;
    gstRate = Math.round((diff / netSubtotal) * 100);
  }

  let taxableAmount = netSubtotal;
  let gstAmount = 0;
  let grandTotal = 0;

  if (isGst && gstRate > 0) {
    if (taxMode === 'exclusive') {
      // GST-exclusive:
      // taxable = subtotal - discount; gst = taxable x rate; grandTotal = taxable + gst + deliveryFee
      taxableAmount = netSubtotal;
      gstAmount = roundToTwo(taxableAmount * (gstRate / 100));
      grandTotal = roundToTwo(taxableAmount + gstAmount + deliveryFee);
    } else {
      // GST-inclusive:
      // grandTotalBeforeDiscount = subtotal
      // grandTotal = subtotal - discount + deliveryFee
      // taxable = (grandTotal - deliveryFee) / (1 + rate)
      // gst = (grandTotal - deliveryFee) - taxable
      grandTotal = roundToTwo(netSubtotal + deliveryFee);
      taxableAmount = roundToTwo(netSubtotal / (1 + gstRate / 100));
      gstAmount = roundToTwo(netSubtotal - taxableAmount);
    }
  } else {
    // Non-GST
    taxableAmount = netSubtotal;
    gstAmount = 0;
    grandTotal = roundToTwo(netSubtotal + deliveryFee);
  }

  // If no settlement discount was applied, but storedGrandTotal was higher, preserve storedGrandTotal
  if (!hasSettlementDiscount && storedGrandTotal > 0 && grandTotal < storedGrandTotal) {
    grandTotal = storedGrandTotal;
    if (taxMode === 'exclusive') {
      gstAmount = Math.max(0, roundToTwo(grandTotal - netSubtotal - deliveryFee));
    }
  }

  const halfGst = roundToTwo(gstAmount / 2);
  const cgstAmount = halfGst;
  const sgstAmount = roundToTwo(gstAmount - halfGst);

  // 4. Payments and Balance
  const advancePaid = roundToTwo(Math.max(0, Number(params.advanceAmount) || 0));
  const additionalPaid = roundToTwo(Math.max(0, Number(params.additionalPaid) || 0));
  let totalPaid = roundToTwo(advancePaid + additionalPaid);
  let remainingBalance = Math.max(0, roundToTwo(grandTotal - totalPaid));
  let settlementPaid = additionalPaid;

  if (params.isCompleted) {
    totalPaid = grandTotal;
    remainingBalance = 0;
    settlementPaid = Math.max(0, roundToTwo(grandTotal - advancePaid));
  }

  let isValid = true;
  let errorMessage: string | undefined = undefined;

  // Validation rules:
  // - Discount cannot make grandTotal < totalPaid (advance already collected).
  // If discount would make grandTotal < advancePaid, block it.
  if (!params.isCompleted && grandTotal < advancePaid) {
    isValid = false;
    errorMessage = `Discount is too high. Total bill (₹${grandTotal.toFixed(2)}) cannot be less than the advance already paid (₹${advancePaid.toFixed(2)}).`;
  }

  return {
    subtotal,
    couponDiscountAmount,
    manualDiscountAmount,
    discountAmount: totalDiscount,
    netSubtotal,
    taxableAmount,
    gstPercentage: gstRate,
    gstAmount,
    cgstAmount,
    sgstAmount,
    deliveryFee,
    grandTotal,
    totalPaid,
    remainingBalance,
    advancePaid,
    settlementPaid,
    isValid,
    errorMessage,
  };
}

export interface OrderTotalsResult {
  subtotal: number;
  discount: number;
  taxable: number;
  gstRate: number;
  gst: number;
  deliveryFee: number;
  total: number;
  paid: number;
  balance: number;
  advancePaid: number;
  discountLabel: string;
  gstLabel: string;
  cgst: number;
  sgst: number;
  isValid: boolean;
  errorMessage?: string;
}

/**
 * Universal calculation utility for orders, advance orders, modals, and invoices.
 */
export function calculateOrderTotals(orderOrParams: any): OrderTotalsResult {
  if (!orderOrParams) {
    return {
      subtotal: 0,
      discount: 0,
      taxable: 0,
      gstRate: 0,
      gst: 0,
      deliveryFee: 0,
      total: 0,
      paid: 0,
      balance: 0,
      advancePaid: 0,
      discountLabel: "Manual Discount",
      gstLabel: "GST",
      cgst: 0,
      sgst: 0,
      isValid: true,
    };
  }

  // 1. Raw Subtotal: calculate from items if available
  let rawSubtotal = 0;
  const items =
    orderOrParams.items ||
    orderOrParams.order_items ||
    orderOrParams.advance_order_items;

  if (Array.isArray(items) && items.length > 0) {
    rawSubtotal = items.reduce((sum: number, it: any) => {
      const price = Number(it.snapshot_price ?? it.price ?? 0) || 0;
      const qty = Number(it.quantity ?? it.qty ?? 1) || 1;
      return sum + price * qty;
    }, 0);
  } else if (orderOrParams.subtotal !== undefined && orderOrParams.subtotal !== null) {
    rawSubtotal = Number(orderOrParams.subtotal) || 0;
  } else if (orderOrParams.total_amount !== undefined && orderOrParams.total_amount !== null) {
    rawSubtotal = Number(orderOrParams.total_amount) || 0;
  } else if (orderOrParams.grand_total !== undefined && orderOrParams.grand_total !== null) {
    rawSubtotal = Number(orderOrParams.grand_total) || 0;
  }
  const subtotal = roundToTwo(rawSubtotal);

  // 2. Discount
  const discType = String(
    orderOrParams.discount_type ||
    orderOrParams.discountType ||
    orderOrParams.manualDiscount?.type ||
    orderOrParams.couponDiscount?.type ||
    "FIXED"
  ).toUpperCase();

  const discVal = Number(
    orderOrParams.discount_value ??
    orderOrParams.discountValue ??
    orderOrParams.manualDiscount?.value ??
    orderOrParams.couponDiscount?.value ??
    orderOrParams.discount_amount ??
    orderOrParams.discountAmount ??
    orderOrParams.discount ??
    0
  ) || 0;

  let discount = 0;
  let discountLabel = "Manual Discount";
  if (discVal > 0) {
    if (discType === "PERCENT") {
      discount = roundToTwo(subtotal * (discVal / 100));
      discountLabel = `Discount (${discVal}%)`;
    } else {
      discount = roundToTwo(discVal);
      discountLabel = "Manual Discount";
    }
  }
  if (discount > subtotal) {
    discount = subtotal;
  }
  const taxable = Math.max(0, roundToTwo(subtotal - discount));

  // 3. GST Calculation
  const isGst =
    orderOrParams.is_gst !== undefined
      ? Boolean(orderOrParams.is_gst)
      : orderOrParams.isGst !== undefined
      ? Boolean(orderOrParams.isGst)
      : Number(orderOrParams.gst_percentage ?? orderOrParams.gstPercentage ?? orderOrParams.gst_amount ?? orderOrParams.gstAmount ?? 0) > 0;

  const rawGstRate = Number(
    orderOrParams.gst_percentage ??
    orderOrParams.gstPercentage ??
    0
  );
  const gstRate = isGst ? Math.max(0, isNaN(rawGstRate) ? 0 : rawGstRate) : 0;
  const gstLabel = gstRate > 0 ? `GST (${gstRate}%)` : "GST";

  let gst = 0;
  const taxMode = orderOrParams.tax_mode || orderOrParams.taxMode || "exclusive";
  if (isGst && gstRate > 0) {
    if (taxMode === "inclusive") {
      const taxBase = roundToTwo(taxable / (1 + gstRate / 100));
      gst = roundToTwo(taxable - taxBase);
    } else {
      gst = roundToTwo(taxable * (gstRate / 100));
    }
  } else if (orderOrParams.gst_amount !== undefined && Number(orderOrParams.gst_amount) > 0) {
    gst = roundToTwo(Number(orderOrParams.gst_amount));
  } else if (orderOrParams.gstAmount !== undefined && Number(orderOrParams.gstAmount) > 0) {
    gst = roundToTwo(Number(orderOrParams.gstAmount));
  }

  const cgst = roundToTwo(gst / 2);
  const sgst = roundToTwo(gst - cgst);

  // 4. Delivery Fee
  const deliveryFee = roundToTwo(
    Math.max(
      0,
      Number(
        orderOrParams.delivery_fee ??
        orderOrParams.deliveryFee ??
        0
      )
    )
  );

  // 5. Total
  let total = 0;
  if (taxMode === "inclusive" && isGst && gstRate > 0) {
    total = roundToTwo(taxable + deliveryFee);
  } else {
    total = roundToTwo(taxable + gst + deliveryFee);
  }

  // 6. Paid and Balance
  const status = String(orderOrParams.status || "PENDING").trim().toUpperCase();
  const isCompleted = status === "COMPLETED" || Boolean(orderOrParams.isCompleted);
  const isCancelled = status === "CANCELLED";

  const advancePaid = roundToTwo(
    Math.max(
      0,
      Number(
        orderOrParams.deposit_amount ??
        orderOrParams.advanceAmount ??
        orderOrParams.cash_received ??
        orderOrParams.cashReceived ??
        0
      )
    )
  );

  let paid = advancePaid;
  let balance = Math.max(0, roundToTwo(total - paid));

  let isValid = true;
  let errorMessage: string | undefined;
  if (!isCompleted && total < advancePaid) {
    isValid = false;
    errorMessage = `Discount is too high. Total bill (₹${total.toFixed(2)}) cannot be less than the advance already paid (₹${advancePaid.toFixed(2)}).`;
  }

  return {
    subtotal,
    discount,
    taxable,
    gstRate,
    gst,
    deliveryFee,
    total,
    paid,
    balance,
    advancePaid,
    discountLabel,
    gstLabel,
    cgst,
    sgst,
    isValid,
    errorMessage,
  };
}
