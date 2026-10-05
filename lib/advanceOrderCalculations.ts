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

  let isValid = true;
  let errorMessage: string | undefined = undefined;

  // Validation rules:
  // - Discount cannot make grandTotal < totalPaid (advance already collected).
  // If discount would make grandTotal < advancePaid, block it.
  if (grandTotal < advancePaid) {
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
