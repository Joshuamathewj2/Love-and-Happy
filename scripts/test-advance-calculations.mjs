import assert from "node:assert/strict";
import test from "node:test";
import { calculateAdvanceOrderTotals, calculateOrderTotals } from "../lib/advanceOrderCalculations.ts";

test("Non-GST, no discount, advance 500 of 2000 -> remaining 1500", () => {
  const res = calculateAdvanceOrderTotals({
    subtotal: 2000,
    isGst: false,
    advanceAmount: 500,
  });

  assert.equal(res.subtotal, 2000);
  assert.equal(res.discountAmount, 0);
  assert.equal(res.gstAmount, 0);
  assert.equal(res.grandTotal, 2000);
  assert.equal(res.advancePaid, 500);
  assert.equal(res.remainingBalance, 1500);
  assert.equal(res.isValid, true);
});

test("Non-GST, 10% discount at settlement: total 1800, paid 500, remaining 1300", () => {
  const res = calculateAdvanceOrderTotals({
    subtotal: 2000,
    isGst: false,
    manualDiscount: { type: "PERCENT", value: 10 },
    advanceAmount: 500,
  });

  assert.equal(res.subtotal, 2000);
  assert.equal(res.discountAmount, 200);
  assert.equal(res.grandTotal, 1800);
  assert.equal(res.totalPaid, 500);
  assert.equal(res.remainingBalance, 1300);
  assert.equal(res.isValid, true);
});

test("GST 18% exclusive, subtotal 2000, 10% discount, advance 500: taxable 1800, gst 324, total 2124, remaining 1624", () => {
  const res = calculateAdvanceOrderTotals({
    subtotal: 2000,
    isGst: true,
    gstPercentage: 18,
    taxMode: "exclusive",
    manualDiscount: { type: "PERCENT", value: 10 },
    advanceAmount: 500,
  });

  assert.equal(res.subtotal, 2000);
  assert.equal(res.discountAmount, 200);
  assert.equal(res.taxableAmount, 1800);
  assert.equal(res.gstAmount, 324);
  assert.equal(res.grandTotal, 2124);
  assert.equal(res.totalPaid, 500);
  assert.equal(res.remainingBalance, 1624);
  assert.equal(res.isValid, true);
});

test("GST 18% inclusive, subtotal 2000, 10% discount, advance 500: total 1800, taxable ~1525.42, gst ~274.58, remaining 1300", () => {
  const res = calculateAdvanceOrderTotals({
    subtotal: 2000,
    isGst: true,
    gstPercentage: 18,
    taxMode: "inclusive",
    manualDiscount: { type: "PERCENT", value: 10 },
    advanceAmount: 500,
  });

  assert.equal(res.subtotal, 2000);
  assert.equal(res.discountAmount, 200);
  assert.equal(res.grandTotal, 1800);
  assert.equal(res.taxableAmount, 1525.42);
  assert.equal(res.gstAmount, 274.58);
  assert.equal(res.totalPaid, 500);
  assert.equal(res.remainingBalance, 1300);
  assert.equal(res.isValid, true);
});

test("Flat discount larger than remaining (must be blocked/capped, never negative)", () => {
  // Advance paid is 1500 on a 2000 subtotal (remaining was 500).
  // User attempts a discount of 800 (which would make grand total 1200 < 1500 paid).
  const res = calculateAdvanceOrderTotals({
    subtotal: 2000,
    isGst: false,
    manualDiscount: { type: "FIXED", value: 800 },
    advanceAmount: 1500,
  });

  assert.equal(res.isValid, false);
  assert.ok(res.errorMessage && res.errorMessage.includes("cannot be less than the advance"));
  assert.ok(res.remainingBalance >= 0);
});

test("Coupon + manual discount together", () => {
  const res = calculateAdvanceOrderTotals({
    subtotal: 2000,
    isGst: false,
    couponDiscount: { type: "percent", value: 10 }, // 200
    manualDiscount: { type: "fixed", value: 100 },  // 100
    advanceAmount: 500,
  });

  assert.equal(res.subtotal, 2000);
  assert.equal(res.couponDiscountAmount, 200);
  assert.equal(res.manualDiscountAmount, 100);
  assert.equal(res.discountAmount, 300);
  assert.equal(res.grandTotal, 1700);
  assert.equal(res.remainingBalance, 1200);
  assert.equal(res.isValid, true);
});

test("Full payment as advance (remaining 0)", () => {
  const res = calculateAdvanceOrderTotals({
    subtotal: 1000,
    isGst: false,
    advanceAmount: 1000,
  });

  assert.equal(res.grandTotal, 1000);
  assert.equal(res.totalPaid, 1000);
  assert.equal(res.remainingBalance, 0);
  assert.equal(res.isValid, true);
});

test("Status calculation: isCompleted settles the balance (totalPaid = grandTotal, remainingBalance = 0)", () => {
  const pendingRes = calculateAdvanceOrderTotals({
    subtotal: 1500,
    isGst: true,
    gstPercentage: 20,
    taxMode: "exclusive",
    advanceAmount: 600,
  });

  assert.equal(pendingRes.grandTotal, 1800);
  assert.equal(pendingRes.totalPaid, 600);
  assert.equal(pendingRes.remainingBalance, 1200);

  const completedRes = calculateAdvanceOrderTotals({
    subtotal: 1500,
    isGst: true,
    gstPercentage: 20,
    taxMode: "exclusive",
    advanceAmount: 600,
    isCompleted: true,
  });

  // When marked COMPLETED, remaining balance is settled: balance = 0, paid = grandTotal
  assert.equal(completedRes.grandTotal, 1800);
  assert.equal(completedRes.totalPaid, 1800);
  assert.equal(completedRes.remainingBalance, 0);

  // When actual final settlement payment is confirmed:
  const settledRes = calculateAdvanceOrderTotals({
    subtotal: 1500,
    isGst: true,
    gstPercentage: 20,
    taxMode: "exclusive",
    advanceAmount: 600,
    additionalPaid: 1200,
  });
  assert.equal(settledRes.grandTotal, 1800);
  assert.equal(settledRes.totalPaid, 1800);
  assert.equal(settledRes.remainingBalance, 0);
});

test("User Case 1: Subtotal 1500, GST 20%, advance 500 -> Total 1800, Paid 500, Balance 1300", () => {
  const res = calculateAdvanceOrderTotals({
    subtotal: 1500,
    isGst: true,
    gstPercentage: 20,
    taxMode: "exclusive",
    advanceAmount: 500,
  });

  assert.equal(res.subtotal, 1500);
  assert.equal(res.gstAmount, 300);
  assert.equal(res.grandTotal, 1800);
  assert.equal(res.advancePaid, 500);
  assert.equal(res.totalPaid, 500);
  assert.equal(res.remainingBalance, 1300);
});

test("User Case 2: Subtotal 1500, GST 20%, advance 600 -> Total 1800, Paid 600, Balance 1200", () => {
  const res = calculateAdvanceOrderTotals({
    subtotal: 1500,
    isGst: true,
    gstPercentage: 20,
    taxMode: "exclusive",
    advanceAmount: 600,
  });

  assert.equal(res.subtotal, 1500);
  assert.equal(res.gstAmount, 300);
  assert.equal(res.grandTotal, 1800);
  assert.equal(res.totalPaid, 600);
  assert.equal(res.remainingBalance, 1200);
});

test("User Case 3: Same order without GST -> Total 1500, Balance = 1500 - advance", () => {
  const res = calculateAdvanceOrderTotals({
    subtotal: 1500,
    isGst: false,
    advanceAmount: 500,
  });

  assert.equal(res.subtotal, 1500);
  assert.equal(res.gstAmount, 0);
  assert.equal(res.grandTotal, 1500);
  assert.equal(res.totalPaid, 500);
  assert.equal(res.remainingBalance, 1000);
});

test("User Case 4: GST + 10% discount at settlement -> GST recalculated on the discounted amount, balance updated", () => {
  const res = calculateAdvanceOrderTotals({
    subtotal: 1500,
    isGst: true,
    gstPercentage: 20,
    taxMode: "exclusive",
    manualDiscount: { type: "PERCENT", value: 10 },
    advanceAmount: 500,
  });

  // 1500 - 10% (150) = 1350 net taxable. GST 20% on 1350 = 270. Grand total = 1620.
  assert.equal(res.subtotal, 1500);
  assert.equal(res.discountAmount, 150);
  assert.equal(res.taxableAmount, 1350);
  assert.equal(res.gstAmount, 270);
  assert.equal(res.grandTotal, 1620);
  assert.equal(res.totalPaid, 500);
  assert.equal(res.remainingBalance, 1120);
});

test("User Case 5: Legacy record without gst fields (stored grandTotal 1800, subtotal 1500, advance 600) -> Total 1800, Paid 600, Balance 1200", () => {
  const res = calculateAdvanceOrderTotals({
    subtotal: 1500,
    advanceAmount: 600,
    grandTotal: 1800,
  });

  assert.equal(res.subtotal, 1500);
  assert.equal(res.gstPercentage, 20);
  assert.equal(res.gstAmount, 300);
  assert.equal(res.grandTotal, 1800);
  assert.equal(res.totalPaid, 600);
  assert.equal(res.remainingBalance, 1200);
});

test("Output for order across statuses: COMPLETED settles balance to 0, PENDING/READY has balance", () => {
  const nonCompletedStatuses = ["PENDING", "READY", "pending", "ready", ""];
  for (const status of nonCompletedStatuses) {
    const res = calculateAdvanceOrderTotals({
      subtotal: 1500,
      isGst: true,
      gstPercentage: 18,
      taxMode: "exclusive",
      advanceAmount: 770,
      grandTotal: 1770,
      isCompleted: false,
    });

    assert.equal(res.grandTotal, 1770, `Grand total must be 1770 for status ${status}`);
    assert.equal(res.advancePaid, 770, `Advance paid must be 770 for status ${status}`);
    assert.equal(res.totalPaid, 770, `Total paid must be 770 for status ${status}`);
    assert.equal(res.remainingBalance, 1000, `Remaining balance must be 1000 for status ${status}`);
    assert.equal(res.isValid, true);
  }

  // Completed status
  const completedRes = calculateAdvanceOrderTotals({
    subtotal: 1500,
    isGst: true,
    gstPercentage: 18,
    taxMode: "exclusive",
    advanceAmount: 770,
    grandTotal: 1770,
    isCompleted: true,
  });
  assert.equal(completedRes.grandTotal, 1770);
  assert.equal(completedRes.totalPaid, 1770);
  assert.equal(completedRes.remainingBalance, 0);
});

test("GST Inclusive Mode reconciles: TaxableValue + CGST + SGST === GrossAmount (18% on 8000)", () => {
  const res = calculateAdvanceOrderTotals({
    subtotal: 8000,
    isGst: true,
    gstPercentage: 18,
    taxMode: "inclusive",
    advanceAmount: 2000,
  });

  assert.equal(res.subtotal, 8000);
  assert.equal(res.grandTotal, 8000);
  assert.equal(res.taxableAmount, 6779.66);
  assert.equal(res.gstAmount, 1220.34);
  assert.equal(res.cgstAmount, 610.17);
  assert.equal(res.sgstAmount, 610.17);
  assert.equal(Number((res.taxableAmount + res.cgstAmount + res.sgstAmount).toFixed(2)), 8000.00);
  assert.equal(res.advancePaid, 2000);
  assert.equal(res.remainingBalance, 6000);
});

test("GST Inclusive Mode reconciles: TaxableValue + CGST + SGST === GrossAmount (5% on 8000)", () => {
  const res = calculateAdvanceOrderTotals({
    subtotal: 8000,
    isGst: true,
    gstPercentage: 5,
    taxMode: "inclusive",
    advanceAmount: 2000,
  });

  assert.equal(res.subtotal, 8000);
  assert.equal(res.grandTotal, 8000);
  assert.equal(res.taxableAmount, 7619.05);
  assert.equal(res.gstAmount, 380.95);
  assert.equal(res.cgstAmount, 190.48);
  assert.equal(res.sgstAmount, 190.47);
  assert.equal(Number((res.taxableAmount + res.cgstAmount + res.sgstAmount).toFixed(2)), 8000.00);
  assert.equal(res.remainingBalance, 6000);
});

test("GST Exclusive Mode reconciles: TaxableValue + CGST + SGST === GrossAmount (18% on 8000)", () => {
  const res = calculateAdvanceOrderTotals({
    subtotal: 8000,
    isGst: true,
    gstPercentage: 18,
    taxMode: "exclusive",
    advanceAmount: 2000,
  });

  assert.equal(res.subtotal, 8000);
  assert.equal(res.taxableAmount, 8000.00);
  assert.equal(res.gstAmount, 1440.00);
  assert.equal(res.cgstAmount, 720.00);
  assert.equal(res.sgstAmount, 720.00);
  assert.equal(res.grandTotal, 9440.00);
  assert.equal(Number((res.taxableAmount + res.cgstAmount + res.sgstAmount).toFixed(2)), 9440.00);
  assert.equal(res.remainingBalance, 7440);
});

test("Verification Case 1: Advance order of 1500 with 500 paid and 18% GST -> Total 1770, Balance 1270, Final Amount 1270", () => {
  const res = calculateOrderTotals({
    subtotal: 1500,
    is_gst: true,
    gst_percentage: 18,
    deposit_amount: 500,
    status: "PENDING",
  });

  assert.equal(res.total, 1770);
  assert.equal(res.paid, 500);
  assert.equal(res.balance, 1270);
  assert.equal(res.gst, 270);
});

test("Verification Case 2: Outstanding Balance before vs after marking COMPLETED: balance drops to 0, paid equals total", () => {
  const pending = calculateOrderTotals({
    subtotal: 1000,
    deposit_amount: 800,
    status: "PENDING",
  });
  assert.equal(pending.total, 1000);
  assert.equal(pending.paid, 800);
  assert.equal(pending.balance, 200);

  const completed = calculateOrderTotals({
    subtotal: 1000,
    deposit_amount: 800,
    status: "COMPLETED",
  });
  assert.equal(completed.total, 1000);
  assert.equal(completed.paid, 1000);
  assert.equal(completed.balance, 0);
});

test("Verification Case 3: Invoice test: Subtotal 999, Discount 20, GST 18%, Delivery 20 -> GST +176.22, TOTAL 1175.22", () => {
  const res = calculateOrderTotals({
    subtotal: 999,
    discount_amount: 20,
    discount_value: 20,
    discount_type: "FIXED",
    is_gst: true,
    gst_percentage: 18,
    delivery_fee: 20,
    status: "COMPLETED",
  });

  assert.equal(res.subtotal, 999);
  assert.equal(res.discount, 20);
  assert.equal(res.taxable, 979);
  assert.equal(res.gst, 176.22);
  assert.equal(res.deliveryFee, 20);
  assert.equal(res.total, 1175.22);
  assert.equal(res.paid, 1175.22);
  assert.equal(res.balance, 0);
});

test("Verification Case 6: Older order with no GST/discount/delivery renders correctly", () => {
  const res = calculateOrderTotals({
    subtotal: 500,
    status: "COMPLETED",
  });

  assert.equal(res.subtotal, 500);
  assert.equal(res.discount, 0);
  assert.equal(res.gst, 0);
  assert.equal(res.deliveryFee, 0);
  assert.equal(res.total, 500);
  assert.equal(res.paid, 500);
  assert.equal(res.balance, 0);
});



