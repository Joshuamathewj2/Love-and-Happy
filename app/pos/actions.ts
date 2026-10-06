"use server";

import { revalidatePath } from "next/cache";
import { dbStore } from "@/lib/dbStore";
import { supabaseFetchCategories, supabaseFetchProducts, supabaseSeedCatalog } from "@/lib/supabaseActions";
import { Product, OrderWithRelations, CartItem, Expense, PaymentMode, Category, AdvanceOrderWithRelations, AdvanceOrderStatus } from "@/lib/types";

// Helper to serialize Date objects from Postgres to strings
function serialize<T>(data: T): T {
  if (data === null || data === undefined) return data;
  return JSON.parse(JSON.stringify(data));
}

export async function verifyPasscode(enteredPasscode: string): Promise<{ success: boolean; role?: 'staff' | 'admin' }> {
  const adminPasscode = process.env.ADMIN_PASSCODE || "admin123";
  const staffPasscode = process.env.STAFF_PASSCODE || process.env.NEXT_PUBLIC_STAFF_PASSCODE || "staff123";

  const normalizedEntered = enteredPasscode.replace(/\s/g, "");

  if (normalizedEntered === adminPasscode) {
    return { success: true, role: 'admin' };
  }
  if (normalizedEntered === staffPasscode) {
    return { success: true, role: 'staff' };
  }

  return { success: false };
}

// ── Catalog Seeding ─────────────────────────────────────────────────────────
/** Seed catalog into legacy Neon DB (kept for backward compat). */
export async function seedCatalog(): Promise<{ categoriesCount: number; productsCount: number }> {
  return await dbStore.seedDefaultCatalog();
}

/** Seed all 13 categories + 136 services into Supabase. */
export async function seedCatalogToSupabase(): Promise<{ categoriesCount: number; productsCount: number }> {
  return await supabaseSeedCatalog();
}

// ── Categories ──────────────────────────────────────────────────────────────
/**
 * Fetch categories: Supabase first, falls back to Neon → local data.
 */
export async function fetchCategories(): Promise<Category[]> {
  const supabaseResult = await supabaseFetchCategories();
  if (supabaseResult && supabaseResult.length > 0) return serialize(supabaseResult);
  return serialize(await dbStore.listCategories());
}

export async function createCategory(name: string): Promise<Category> {
  return serialize(await dbStore.addCategory(name.trim()));
}

export async function renameCategory(id: string, name: string): Promise<Category | null> {
  return serialize(await dbStore.updateCategory(id, name.trim()));
}

export async function removeCategory(id: string): Promise<void> {
  return await dbStore.deleteCategory(id);
}

// ── Products ─────────────────────────────────────────────────────────────────
/**
 * Fetch products: Supabase first, falls back to Neon → local data.
 * This drives the POS catalog modal and item auto-suggest.
 */
export async function fetchProducts(): Promise<Product[]> {
  const supabaseResult = await supabaseFetchProducts();
  if (supabaseResult && supabaseResult.length > 0) return serialize(supabaseResult);
  return serialize(await dbStore.listProducts());
}

export async function createProduct(data: { name: string; description: string | null; category: string; gst_rate: number; hsn_code: string | null; selling_price: number }): Promise<Product> {
  return serialize(await dbStore.addProduct(data));
}

export async function editProduct(id: string, data: Partial<Product>): Promise<Product | null> {
  return serialize(await dbStore.updateProduct(id, data));
}

export async function removeProduct(id: string): Promise<void> {
  return await dbStore.deleteProduct(id);
}

// Orders
export async function fetchOrders(): Promise<OrderWithRelations[]> {
  return serialize(await dbStore.listOrdersWithRelations());
}

export async function fetchOrderById(id: string): Promise<OrderWithRelations | null> {
  return serialize(await dbStore.getOrderWithRelations(id));
}

export async function orderIdExists(id: string): Promise<boolean> {
  return await dbStore.orderIdExists(id);
}

export async function submitOrder(payload: {
  orderId: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string | null;
  source: 'ONLINE' | 'OFFLINE';
  isGst: boolean;
  billDate: string;
  items: CartItem[];
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number;
  discountAmount: number;
  gstPercentage: number;
  gstAmount: number;
  deliveryFee: number;
  grandTotal: number;
  cashReceived: number;
  splitCash?: number;
  splitGpay?: number;
  paymentMode: PaymentMode;
}): Promise<{ orderId: string }> {
  return await dbStore.submitOrder(payload);
}

export async function removeOrder(id: string): Promise<void> {
  return await dbStore.deleteOrder(id);
}

// Expenses
export async function fetchExpenses(): Promise<Expense[]> {
  return serialize(await dbStore.listExpenses());
}

export async function createExpense(data: {
  title: string;
  category: string;
  amount: number;
  payment_mode: string;
  notes: string | null;
  expense_date: string;
}): Promise<Expense> {
  return serialize(await dbStore.addExpense(data));
}

export async function editExpense(id: string, data: Partial<Expense>): Promise<Expense | null> {
  return serialize(await dbStore.updateExpense(id, data));
}

export async function removeExpense(id: string): Promise<void> {
  return await dbStore.deleteExpense(id);
}

// Advance Orders (partial-payment holds — not revenue until finalized)
export async function fetchAdvanceOrders(): Promise<AdvanceOrderWithRelations[]> {
  return serialize(await dbStore.listAdvanceOrders());
}

export async function fetchAdvanceOrderById(id: string): Promise<AdvanceOrderWithRelations | null> {
  return serialize(await dbStore.getAdvanceOrder(id));
}

export async function advanceOrderIdExists(id: string): Promise<boolean> {
  return await dbStore.advanceOrderIdExists(id);
}

export async function createAdvanceOrder(payload: {
  advanceOrderId: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string | null;
  subtotal: number;
  totalAmount: number;
  depositAmount: number;
  depositPaymentMode: PaymentMode;
  deliveryDate: string | null;
  notes: string | null;
  items: {
    product_id: string | null;
    snapshot_name: string;
    snapshot_desc: string | null;
    snapshot_price: number;
    quantity: number;
  }[];
  isGst?: boolean;
  gstPercentage?: number;
  gstAmount?: number;
  taxMode?: 'exclusive' | 'inclusive';
  discountType?: 'PERCENT' | 'FIXED';
  discountValue?: number;
  discountAmount?: number;
  deliveryFee?: number;
}): Promise<{ advanceOrderId: string }> {
  const result = await dbStore.createAdvanceOrder(payload);
  try {
    revalidatePath('/admin/advance-orders');
  } catch (e) {}
  return result;
}

export async function setAdvanceOrderStatus(id: string, status: AdvanceOrderStatus): Promise<void> {
  const result = await dbStore.updateAdvanceOrderStatus(id, status);
  try {
    revalidatePath('/admin/orders');
    revalidatePath('/admin/analytics');
    revalidatePath('/admin/advance-orders');
  } catch (e) {}
  return result;
}

export async function cancelAdvanceOrder(id: string): Promise<void> {
  const result = await dbStore.cancelAdvanceOrder(id);
  try {
    revalidatePath('/admin/orders');
    revalidatePath('/admin/analytics');
    revalidatePath('/admin/advance-orders');
  } catch (e) {}
  return result;
}

export async function removeAdvanceOrder(id: string): Promise<void> {
  const result = await dbStore.deleteAdvanceOrder(id);
  try {
    revalidatePath('/admin/orders');
    revalidatePath('/admin/analytics');
    revalidatePath('/admin/advance-orders');
  } catch (e) {}
  return result;
}

export async function finalizeAdvanceOrder(payload: {
  advanceOrderId: string;
  invoiceId: string;
  isGst: boolean;
  gstPercentage: number;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number;
  discountAmount: number;
  deliveryFee: number;
  paymentMode: PaymentMode;
  billDate: string;
  taxMode?: 'exclusive' | 'inclusive';
}): Promise<{ success: boolean; orderId?: string; error?: string }> {
  try {
    const result = await dbStore.finalizeAdvanceOrder(payload);
    try {
      revalidatePath('/admin/orders');
      revalidatePath('/admin/analytics');
      revalidatePath('/admin/advance-orders');
      revalidatePath('/pos/admin/secure/control-panel/love-and-happy');
    } catch (e) {}
    return { success: true, orderId: result.orderId };
  } catch (err: any) {
    console.error('[finalizeAdvanceOrder Action Error]:', err);
    return { success: false, error: err?.message || 'Failed to finalize advance order' };
  }
}
