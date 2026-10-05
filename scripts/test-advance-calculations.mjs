import assert from "node:assert/strict";
import test from "node:test";
import { calculateAdvanceOrderTotals } from "../lib/advanceOrderCalculations.ts";

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

test("Status is not an input to calculation: isCompleted does not alter Total, Paid, or Balance", () => {
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

  // Must be identical to pendingRes
  assert.equal(completedRes.grandTotal, 1800);
  assert.equal(completedRes.totalPaid, 600);
  assert.equal(completedRes.remainingBalance, 1200);

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

test("Same output for the same order across all statuses (Order Total 1770, Paid 770, Balance 1000)", () => {
  const statuses = ["PENDING", "READY", "COMPLETED", "CANCELLED", "pending", "ready", "completed", "cancelled", ""];

  for (const status of statuses) {
    const res = calculateAdvanceOrderTotals({
      subtotal: 1500,
      isGst: true,
      gstPercentage: 18,
      taxMode: "exclusive",
      advanceAmount: 770,
      grandTotal: 1770,
      // Pass isCompleted flag or status simulation if relevant
      isCompleted: status.toUpperCase() === "COMPLETED",
    });

    assert.equal(res.grandTotal, 1770, `Grand total must be 1770 for status ${status}`);
    assert.equal(res.advancePaid, 770, `Advance paid must be 770 for status ${status}`);
    assert.equal(res.totalPaid, 770, `Total paid must be 770 for status ${status}`);
    assert.equal(res.remainingBalance, 1000, `Remaining balance must be 1000 for status ${status}`);
    assert.equal(res.isValid, true);
  }
});


