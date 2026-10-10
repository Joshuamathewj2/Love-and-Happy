/**
 * lib/supabaseActions.ts
 * ──────────────────────
 * Comprehensive Supabase actions for Catalog, Customers, Orders,
 * Order Items, Expenses, and Advance Orders.
 *
 * Provides resilient fallbacks and explicit error reporting.
 */
import { supabase } from './supabaseClient';
import type {
  Category,
  Product,
  Customer,
  OrderRow,
  OrderItemRow,
  OrderWithRelations,
  CartItem,
  Expense,
  PaymentMode,
  AdvanceOrderRow,
  AdvanceOrderItemRow,
  AdvanceOrderStatus,
  AdvanceOrderWithRelations,
} from './types';
import { LOVE_AND_HAPPY_CATEGORIES, LOVE_AND_HAPPY_PRODUCTS } from './catalogData';
import { calculateAdvanceOrderTotals } from './advanceOrderCalculations';

export interface CatalogItemDB {
  id: string;
  category_id?: string | null;
  category: string;
  name: string;
  regular_price: number | string;
  member_price?: number | string | null;
  formatted_regular_price?: string | null;
  formatted_member_price?: string | null;
  price_type?: string;
  details?: string | null;
  duration?: string | null;
  unit?: string;
  gst_rate?: number;
  hsn_code?: string | null;
  is_active?: boolean;
  created_at?: string;
}

const uid = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

// ── CATEGORIES ─────────────────────────────────────────────────────────────

export async function supabaseFetchCategories(): Promise<Category[]> {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.warn('[Supabase] fetchCategories warning:', error.message);
      return LOVE_AND_HAPPY_CATEGORIES;
    }
    if (data && data.length > 0) return data as Category[];

    console.warn('[Supabase] categories table empty — using local fallback');
    return LOVE_AND_HAPPY_CATEGORIES;
  } catch (err) {
    console.warn('[Supabase] fetchCategories failed, using local fallback:', err);
    return LOVE_AND_HAPPY_CATEGORIES;
  }
}

export async function supabaseAddCategory(name: string): Promise<Category> {
  const categoryId = `cat-${Date.now()}`;
  const { data, error } = await supabase
    .from('categories')
    .upsert({ id: categoryId, name: name.trim(), created_at: new Date().toISOString() }, { onConflict: 'name' })
    .select()
    .single();

  if (error) {
    console.error('[Supabase] addCategory error:', error);
    throw new Error(error.message || 'Failed to add category');
  }
  return data as Category;
}

export async function supabaseUpdateCategory(id: string, name: string): Promise<Category | null> {
  const { data, error } = await supabase
    .from('categories')
    .update({ name: name.trim() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[Supabase] updateCategory error:', error);
    throw new Error(error.message || 'Failed to update category');
  }
  return data as Category;
}

export async function supabaseDeleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) {
    console.error('[Supabase] deleteCategory error:', error);
    throw new Error(error.message || 'Failed to delete category');
  }
}

// ── PRODUCTS & CATALOG ITEMS ───────────────────────────────────────────────

export async function supabaseFetchCatalogItems(): Promise<CatalogItemDB[]> {
  try {
    const { data, error } = await supabase
      .from('catalog_items')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.warn('[Supabase] fetchCatalogItems warning:', error.message);
      return [];
    }
    return (data || []) as CatalogItemDB[];
  } catch (err) {
    console.warn('[Supabase] fetchCatalogItems failed:', err);
    return [];
  }
}

export async function supabaseFetchProducts(): Promise<Product[]> {
  try {
    const { data: catalogData, error: catalogErr } = await supabase
      .from('catalog_items')
      .select('*')
      .order('name', { ascending: true });

    if (!catalogErr && catalogData && catalogData.length > 0) {
      return (catalogData as CatalogItemDB[]).map((item) => {
        const numPrice =
          typeof item.regular_price === 'number'
            ? item.regular_price
            : parseFloat(String(item.regular_price)) || 0;
        const numMemberPrice =
          item.member_price !== null && item.member_price !== undefined
            ? typeof item.member_price === 'number'
              ? item.member_price
              : parseFloat(String(item.member_price))
            : undefined;

        let desc = item.details || '';
        if (!desc && item.member_price) {
          desc = `Member Price: ₹${item.member_price}`;
        }

        return {
          id: item.id,
          name: item.name,
          description: desc || null,
          category: item.category || 'General',
          gst_rate: Number(item.gst_rate) || 0,
          hsn_code: item.hsn_code || '9997',
          selling_price: numPrice,
          price: numPrice,
          offer_price: numMemberPrice !== undefined ? numMemberPrice : numPrice,
          purchase_price: 0,
          stock_quantity: 999,
          low_stock_alert: 5,
          unit: item.unit || 'Service',
          unit_label: item.duration || undefined,
          item_type: 'service',
          is_active: item.is_active !== false,
          created_at: item.created_at || new Date().toISOString(),
        };
      });
    }

    const { data: prodData, error: prodErr } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true });

    if (!prodErr && prodData && prodData.length > 0) {
      return prodData as Product[];
    }

    console.warn('[Supabase] catalog_items and products empty — using local fallback');
    return LOVE_AND_HAPPY_PRODUCTS;
  } catch (err) {
    console.warn('[Supabase] fetchProducts failed, using local fallback:', err);
    return LOVE_AND_HAPPY_PRODUCTS;
  }
}

export async function supabaseAddProduct(product: Omit<Product, 'created_at'>): Promise<Product | null> {
  try {
    const timestamp = new Date().toISOString();

    const { data, error } = await supabase
      .from('products')
      .upsert({ ...product, created_at: timestamp }, { onConflict: 'id' })
      .select()
      .single();

    try {
      await supabase.from('catalog_items').upsert(
        {
          id: product.id,
          name: product.name,
          category: product.category,
          regular_price: product.selling_price || product.price || 0,
          member_price: product.offer_price || null,
          details: product.description || null,
          gst_rate: product.gst_rate || 0,
          hsn_code: product.hsn_code || '9997',
          unit: product.unit || 'Service',
          duration: product.unit_label || null,
          is_active: product.is_active !== false,
          created_at: timestamp,
        },
        { onConflict: 'id' }
      );
    } catch (_) {}

    if (error) throw error;
    return data as Product;
  } catch (err) {
    console.error('[Supabase] addProduct failed:', err);
    throw err;
  }
}

export async function supabaseUpdateProduct(id: string, patch: Partial<Product>): Promise<Product | null> {
  try {
    // Sanitize payload to only valid columns on products table
    const productPatch: Record<string, any> = {};
    if (patch.name !== undefined) productPatch.name = patch.name?.trim();
    if (patch.description !== undefined) productPatch.description = patch.description?.trim() || null;
    if (patch.category !== undefined) productPatch.category = patch.category?.trim() || 'General';
    if (patch.gst_rate !== undefined) productPatch.gst_rate = Number(patch.gst_rate) || 0;
    if (patch.hsn_code !== undefined) productPatch.hsn_code = patch.hsn_code?.trim() || null;
    if (patch.selling_price !== undefined) productPatch.selling_price = Number(patch.selling_price) || 0;
    if (patch.price !== undefined) productPatch.price = Number(patch.price) || 0;
    if (patch.offer_price !== undefined) productPatch.offer_price = patch.offer_price != null ? Number(patch.offer_price) : null;
    if (patch.purchase_price !== undefined) productPatch.purchase_price = patch.purchase_price != null ? Number(patch.purchase_price) : null;
    if (patch.sku !== undefined) productPatch.sku = patch.sku?.trim() || null;
    if (patch.stock_quantity !== undefined) productPatch.stock_quantity = Number(patch.stock_quantity) || 0;
    if (patch.low_stock_alert !== undefined) productPatch.low_stock_alert = Number(patch.low_stock_alert) || 0;
    if (patch.unit !== undefined) productPatch.unit = patch.unit || null;
    if (patch.unit_label !== undefined) productPatch.unit_label = patch.unit_label || null;
    if (patch.item_type !== undefined) productPatch.item_type = patch.item_type || 'service';
    if (patch.image_url !== undefined) productPatch.image_url = patch.image_url?.trim() || null;
    if (patch.is_active !== undefined) productPatch.is_active = Boolean(patch.is_active);

    const { data, error } = await supabase
      .from('products')
      .update(productPatch)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Supabase Update Error Details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      throw error;
    }

    try {
      const catalogPatch: Record<string, any> = {};
      if (patch.name !== undefined) catalogPatch.name = patch.name?.trim();
      if (patch.category !== undefined) catalogPatch.category = patch.category?.trim() || 'General';
      if (patch.selling_price !== undefined) catalogPatch.regular_price = Number(patch.selling_price) || 0;
      if (patch.offer_price !== undefined) catalogPatch.member_price = Number(patch.offer_price) || null;
      if (patch.description !== undefined) catalogPatch.details = patch.description?.trim() || null;
      if (patch.gst_rate !== undefined) catalogPatch.gst_rate = Number(patch.gst_rate) || 0;
      if (patch.hsn_code !== undefined) catalogPatch.hsn_code = patch.hsn_code?.trim() || null;

      if (Object.keys(catalogPatch).length > 0) {
        await supabase.from('catalog_items').update(catalogPatch).eq('id', id);
      }
    } catch (_) {}

    return data as Product;
  } catch (err: any) {
    console.error('Supabase Update Error Details:', {
      code: err?.code,
      message: err?.message,
      details: err?.details,
      hint: err?.hint,
    });
    throw err;
  }
}

export async function supabaseDeleteProduct(id: string): Promise<void> {
  try {
    await Promise.allSettled([
      supabase.from('products').delete().eq('id', id),
      supabase.from('catalog_items').delete().eq('id', id),
    ]);
  } catch (err) {
    console.error('[Supabase] deleteProduct failed:', err);
    throw err;
  }
}

export async function supabaseSeedCatalog(): Promise<{ categoriesCount: number; productsCount: number }> {
  let categoriesCount = 0;
  let productsCount = 0;

  const catRows = LOVE_AND_HAPPY_CATEGORIES.map((c: any) => ({
    id: c.id,
    name: c.name,
    created_at: c.created_at,
  }));

  const { error: catErr } = await supabase.from('categories').upsert(catRows, { onConflict: 'name' });
  if (catErr) {
    console.error('[Supabase] seed categories error:', catErr.message);
  } else {
    categoriesCount = catRows.length;
  }

  const CHUNK = 50;
  for (let i = 0; i < LOVE_AND_HAPPY_PRODUCTS.length; i += CHUNK) {
    const chunk = LOVE_AND_HAPPY_PRODUCTS.slice(i, i + CHUNK);
    const { error: prodErr } = await supabase.from('products').upsert(chunk, { onConflict: 'id' });

    if (prodErr) {
      console.error('[Supabase] seed products chunk error:', prodErr.message);
    } else {
      productsCount += chunk.length;
    }

    const catalogChunk = chunk.map((p: any) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      regular_price: p.selling_price || p.price || 0,
      member_price: p.offer_price || null,
      details: p.description || null,
      gst_rate: p.gst_rate || 0,
      hsn_code: p.hsn_code || '9997',
      unit: p.unit || 'Service',
      duration: p.unit_label || null,
      is_active: p.is_active !== false,
      created_at: p.created_at || new Date().toISOString(),
    }));

    await supabase.from('catalog_items').upsert(catalogChunk, { onConflict: 'id' });
  }

  return { categoriesCount, productsCount };
}

// ── CUSTOMERS ──────────────────────────────────────────────────────────────

export async function supabaseUpsertCustomer(
  name: string,
  phone: string,
  address?: string | null
): Promise<Customer> {
  const cleanPhone = phone.trim();
  const cleanName = name.trim() || 'Walk-in Customer';
  const cleanAddress = address?.trim() || null;

  // 1. Try to find existing customer by phone first
  const { data: existing, error: findErr } = await supabase
    .from('customers')
    .select('*')
    .eq('phone', cleanPhone)
    .maybeSingle();

  if (existing) {
    // Update name/address if changed
    const { data: updated, error: updateErr } = await supabase
      .from('customers')
      .update({ name: cleanName, address: cleanAddress })
      .eq('id', existing.id)
      .select()
      .single();

    if (!updateErr && updated) return updated as Customer;
    return existing as Customer;
  }

  // 2. Insert new customer
  const newId = uid();
  const { data: inserted, error: insertErr } = await supabase
    .from('customers')
    .upsert(
      {
        id: newId,
        name: cleanName,
        phone: cleanPhone,
        address: cleanAddress,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'phone' }
    )
    .select()
    .single();

  if (insertErr) {
    console.error('SUPABASE CUSTOMER UPSERT ERROR:', {
      message: insertErr.message,
      details: insertErr.details,
      hint: insertErr.hint,
      code: insertErr.code,
    });
    // Fallback object to not halt transaction if select fails
    return {
      id: newId,
      name: cleanName,
      phone: cleanPhone,
      address: cleanAddress,
      created_at: new Date().toISOString(),
    };
  }

  return inserted as Customer;
}

// ── ORDERS & SALES SUBMISSION ──────────────────────────────────────────────

export async function supabaseSubmitOrder(payload: {
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
  // 1. Upsert customer
  const customer = await supabaseUpsertCustomer(
    payload.customerName,
    payload.customerPhone,
    payload.customerAddress
  );

  const subtotalInclusive = Number(payload.grandTotal) + Number(payload.discountAmount) - Number(payload.deliveryFee);

  // Format bill_date as YYYY-MM-DD
  let formattedBillDate = new Date().toISOString().split('T')[0];
  if (payload.billDate) {
    formattedBillDate = payload.billDate.includes('T')
      ? payload.billDate.split('T')[0]
      : payload.billDate;
  }

  const orderPayload = {
    id: payload.orderId,
    customer_id: customer.id,
    source: payload.source || 'OFFLINE',
    status: 'COMPLETED',
    is_gst: Boolean(payload.isGst),
    subtotal: Number(subtotalInclusive) || 0,
    discount_type: payload.discountType || 'FIXED',
    discount_value: Number(payload.discountValue) || 0,
    discount_amount: Number(payload.discountAmount) || 0,
    gst_percentage: Number(payload.gstPercentage) || 0,
    gst_amount: Number(payload.gstAmount) || 0,
    delivery_fee: Number(payload.deliveryFee) || 0,
    grand_total: Number(payload.grandTotal) || 0,
    cash_received: Number(payload.cashReceived) || 0,
    split_cash: Number(payload.splitCash) || 0,
    split_gpay: Number(payload.splitGpay) || 0,
    payment_mode: payload.paymentMode || 'CASH',
    bill_date: formattedBillDate,
    created_at: new Date().toISOString(),
  };

  // 2. Insert into orders table
  const { error: orderError } = await supabase
    .from('orders')
    .upsert(orderPayload, { onConflict: 'id' });

  if (orderError) {
    console.error('SUPABASE SAVE SALE ERROR:', {
      message: orderError.message,
      details: orderError.details,
      hint: orderError.hint,
      code: orderError.code,
      payload: orderPayload,
    });
    throw new Error(`Failed to save sale: ${orderError.message || 'Database error inserting order'}`);
  }

  // 3. Insert order items
  const itemsToInsert = payload.items.map((item) => ({
    id: uid(),
    order_id: payload.orderId,
    product_id: item.product_id || null,
    snapshot_name: item.name || 'Custom Item',
    snapshot_price: Number(item.price) || 0,
    quantity: Number(item.qty) || 1,
  }));

  if (itemsToInsert.length > 0) {
    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(itemsToInsert);

    if (itemsError) {
      console.error('SUPABASE SAVE SALE ITEMS ERROR:', {
        message: itemsError.message,
        details: itemsError.details,
        hint: itemsError.hint,
        code: itemsError.code,
      });
      // We don't fail the whole invoice if only item insertion had non-fatal warning, but log it explicitly
    }
  }

  return { orderId: payload.orderId };
}

export async function supabaseOrderIdExists(id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('orders')
    .select('id')
    .eq('id', id)
    .maybeSingle();

  if (error) return false;
  return !!data;
}

export async function supabaseListOrdersWithRelations(): Promise<OrderWithRelations[]> {
  const { data: orders, error: ordersErr } = await supabase
    .from('orders')
    .select(`
      *,
      customers (
        name,
        phone,
        address
      ),
      order_items (
        id,
        order_id,
        product_id,
        snapshot_name,
        snapshot_price,
        quantity
      )
    `)
    .order('created_at', { ascending: false });

  if (ordersErr) {
    console.error('[Supabase] listOrders error:', ordersErr);
    // Fallback: fetch flat orders and order_items separately
    const { data: flatOrders } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (!flatOrders || flatOrders.length === 0) return [];

    const orderIds = flatOrders.map((o: any) => o.id);
    const { data: items } = await supabase
      .from('order_items')
      .select('*')
      .in('order_id', orderIds);

    const { data: customers } = await supabase.from('customers').select('*');
    const customerMap = new Map((customers || []).map((c: any) => [c.id, c]));

    const mapped = flatOrders.map((o: any) => {
      const cust = customerMap.get(o.customer_id) || {};
      return {
        ...o,
        customer_name: cust.name || 'Walk-in Customer',
        customer_phone: cust.phone || '',
        customer_address: cust.address || null,
        items: (items || []).filter((i: any) => i.order_id === o.id) as OrderItemRow[],
      };
    }) as OrderWithRelations[];

    const isAdvanceOrderRow = (order: any): boolean => {
      return (
        order.is_advance === true ||
        order.is_advance === 'true' ||
        order.order_type === 'ADVANCE' ||
        String(order.id || '').toUpperCase().startsWith('DEP-') ||
        String(order.invoice_id || '').toUpperCase().startsWith('DEP-')
      );
    };

    return mapped.filter((order: any) => {
      const isAdvance = isAdvanceOrderRow(order);
      const status = String(order.status || '').toUpperCase();
      if (isAdvance) {
        return status === 'COMPLETED';
      }
      return (
        status === 'COMPLETED' ||
        (!order.status && status !== 'CANCELLED' && status !== 'PENDING' && status !== 'READY')
      );
    });
  }

  const isAdvanceOrderRow = (order: any): boolean => {
    return (
      order.is_advance === true ||
      order.is_advance === 'true' ||
      order.order_type === 'ADVANCE' ||
      String(order.id || '').toUpperCase().startsWith('DEP-') ||
      String(order.invoice_id || '').toUpperCase().startsWith('DEP-')
    );
  };

  const mapped = (orders || []).map((o: any) => ({
    id: o.id,
    customer_id: o.customer_id,
    source: o.source,
    status: o.status,
    is_gst: Boolean(o.is_gst),
    subtotal: Number(o.subtotal) || 0,
    discount_type: o.discount_type,
    discount_value: Number(o.discount_value) || 0,
    discount_amount: Number(o.discount_amount) || 0,
    gst_percentage: Number(o.gst_percentage) || 0,
    gst_amount: Number(o.gst_amount) || 0,
    delivery_fee: Number(o.delivery_fee) || 0,
    grand_total: Number(o.grand_total) || 0,
    cash_received: Number(o.cash_received) || 0,
    split_cash: Number(o.split_cash) || 0,
    split_gpay: Number(o.split_gpay) || 0,
    payment_mode: o.payment_mode,
    bill_date: o.bill_date,
    created_at: o.created_at,
    is_advance: o.is_advance,
    order_type: o.order_type,
    customer_name: o.customers?.name || 'Walk-in Customer',
    customer_phone: o.customers?.phone || '',
    customer_address: o.customers?.address || null,
    items: (o.order_items || []) as OrderItemRow[],
  })) as OrderWithRelations[];

  const dedupedOrdersMap = new Map<string, OrderWithRelations>();

  // Process rows from orders table
  for (const o of mapped) {
    if (!o.id) continue;
    const isAdvance = isAdvanceOrderRow(o);
    const status = String(o.status || '').toUpperCase();

    // Pending/ready/cancelled advance orders must never appear in orders list / analytics
    if (isAdvance && status !== 'COMPLETED') {
      continue;
    }

    if (
      status === 'COMPLETED' ||
      (!o.status && status !== 'CANCELLED' && status !== 'PENDING' && status !== 'READY')
    ) {
      let officialId = o.id;
      // If legacy completed advance order still has DEP- id, normalize to official INV- id
      if (officialId.startsWith('DEP-')) {
        if (o.invoice_id && o.invoice_id.startsWith('INV-')) {
          officialId = o.invoice_id;
        } else {
          const cleanSuffix = o.id.replace(/[^A-Za-z0-9]/g, '').slice(-5).toUpperCase();
          const yr = o.created_at ? new Date(o.created_at).getFullYear() : new Date().getFullYear();
          officialId = `INV-${yr}-${cleanSuffix}`;
        }
        o.id = officialId;
        o.invoice_id = officialId;
      }
      dedupedOrdersMap.set(officialId, o);
    }
  }

  // Process completed advance orders to ensure every completed advance order has an official INV invoice in analytics
  try {
    const { data: compAdvances } = await supabase
      .from('advance_orders')
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
      .ilike('status', 'COMPLETED');

    if (compAdvances && compAdvances.length > 0) {
      for (const a of compAdvances) {
        if (!a.id) continue;

        // Determine official INV- id
        const officialInvId = a.finalized_order_id;
        if (!officialInvId || !officialInvId.startsWith('INV-')) {
          // Revenue recognition only happens through the official INV invoice created on final payment
          continue;
        }

        // Clean up legacy DEP key if present
        if (dedupedOrdersMap.has(a.id)) {
          const existing = dedupedOrdersMap.get(a.id)!;
          dedupedOrdersMap.delete(a.id);
          existing.id = officialInvId;
          existing.invoice_id = officialInvId;
          dedupedOrdersMap.set(officialInvId, existing);
          continue;
        }

        if (!dedupedOrdersMap.has(officialInvId)) {
          const grandTotal = Number(a.total_amount ?? a.deposit_amount ?? 0);
          dedupedOrdersMap.set(officialInvId, {
            id: officialInvId,
            customer_id: a.customer_id,
            source: 'OFFLINE',
            status: 'COMPLETED',
            is_gst: Boolean(a.is_gst),
            subtotal: Number(a.subtotal) || grandTotal,
            discount_type: 'FIXED',
            discount_value: 0,
            discount_amount: 0,
            gst_percentage: Number(a.gst_percentage) || 0,
            gst_amount: Number(a.gst_amount) || 0,
            delivery_fee: 0,
            grand_total: grandTotal,
            cash_received: Number(a.deposit_amount) || grandTotal,
            split_cash: 0,
            split_gpay: 0,
            payment_mode: a.deposit_payment_mode || 'CASH',
            bill_date: a.finalized_at
              ? a.finalized_at.split('T')[0]
              : a.created_at
              ? a.created_at.split('T')[0]
              : new Date().toISOString().split('T')[0],
            created_at: a.created_at || new Date().toISOString(),
            is_advance: true,
            order_type: 'ADVANCE',
            invoice_id: officialInvId,
            customer_name: a.customers?.name || 'Walk-in Customer',
            customer_phone: a.customers?.phone || '',
            customer_address: a.customers?.address || null,
            items: (a.advance_order_items || []).map((it: any) => ({
              id: it.id,
              order_id: officialInvId,
              product_id: it.product_id || null,
              snapshot_name: it.snapshot_name,
              snapshot_price: Number(it.snapshot_price) || 0,
              quantity: Number(it.quantity) || 1,
            })),
          });
        }
      }
    }
  } catch (advFetchErr) {
    // Ignore secondary fetch error
  }

  // Defensive: Analytics and Order history must only show official INV IDs
  const resultList = Array.from(dedupedOrdersMap.values()).filter(
    (o) => String(o.id || '').startsWith('INV-') && o.status === 'COMPLETED'
  );
  resultList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return resultList;
}

export async function supabaseGetOrderWithRelations(id: string): Promise<OrderWithRelations | null> {
  // 1. Try orders table by id
  let { data: order, error } = await supabase
    .from('orders')
    .select(`
      *,
      customers (
        name,
        phone,
        address
      ),
      order_items (
        id,
        order_id,
        product_id,
        snapshot_name,
        snapshot_price,
        quantity
      )
    `)
    .eq('id', id)
    .maybeSingle();

  // 2. If not found by primary key, try orders table by invoice_id
  if (!order) {
    const { data: byInv } = await supabase
      .from('orders')
      .select(`
        *,
        customers (
          name,
          phone,
          address
        ),
        order_items (
          id,
          order_id,
          product_id,
          snapshot_name,
          snapshot_price,
          quantity
        )
      `)
      .eq('invoice_id', id)
      .maybeSingle();
    if (byInv) order = byInv;
  }

  // 3. If still not found, check advance_orders table (for DEP- IDs or unfinalized / legacy records)
  if (!order) {
    const { data: adv } = await supabase
      .from('advance_orders')
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
      .or(`id.eq.${id},finalized_order_id.eq.${id}`)
      .maybeSingle();

    if (adv) {
      // If completed with a linked finalized_order_id, attempt to fetch that invoice
      if (adv.status === 'COMPLETED' && adv.finalized_order_id && adv.finalized_order_id !== id) {
        const finalized = await supabaseGetOrderWithRelations(adv.finalized_order_id);
        if (finalized) return finalized;
      }

      // Rebuild OrderWithRelations from advance_order on the fly
      const isCompleted = adv.status === 'COMPLETED';
      const grandTotal = Number(adv.total_amount) || 0;
      const deposit = Number(adv.deposit_amount) || 0;

      return {
        id: adv.finalized_order_id || adv.id,
        customer_id: adv.customer_id,
        source: 'OFFLINE',
        status: isCompleted ? 'COMPLETED' : 'PENDING',
        is_gst: Boolean(adv.is_gst),
        subtotal: Number(adv.subtotal) || grandTotal,
        discount_type: 'FIXED',
        discount_value: 0,
        discount_amount: 0,
        gst_percentage: Number(adv.gst_percentage) || 0,
        gst_amount: Number(adv.gst_amount) || 0,
        delivery_fee: 0,
        grand_total: grandTotal,
        cash_received: deposit,
        split_cash: 0,
        split_gpay: 0,
        payment_mode: adv.deposit_payment_mode || 'CASH',
        bill_date: adv.finalized_at
          ? adv.finalized_at.split('T')[0]
          : adv.created_at
          ? adv.created_at.split('T')[0]
          : new Date().toISOString().split('T')[0],
        created_at: adv.created_at || new Date().toISOString(),
        is_advance: true,
        order_type: 'ADVANCE',
        invoice_id: adv.finalized_order_id || adv.id,
        customer_name: adv.customers?.name || 'Walk-in Customer',
        customer_phone: adv.customers?.phone || '',
        customer_address: adv.customers?.address || null,
        items: (adv.advance_order_items || []).map((it: any) => ({
          id: it.id,
          order_id: adv.id,
          product_id: it.product_id || null,
          snapshot_name: it.snapshot_name,
          snapshot_price: Number(it.snapshot_price) || 0,
          quantity: Number(it.quantity) || 1,
        })),
      } as OrderWithRelations;
    }
  }

  if (!order) return null;

  return {
    id: order.id,
    customer_id: order.customer_id,
    source: order.source,
    status: order.status,
    is_gst: Boolean(order.is_gst),
    subtotal: Number(order.subtotal) || 0,
    discount_type: order.discount_type,
    discount_value: Number(order.discount_value) || 0,
    discount_amount: Number(order.discount_amount) || 0,
    gst_percentage: Number(order.gst_percentage) || 0,
    gst_amount: Number(order.gst_amount) || 0,
    delivery_fee: Number(order.delivery_fee) || 0,
    grand_total: Number(order.grand_total) || 0,
    cash_received: Number(order.cash_received) || 0,
    split_cash: Number(order.split_cash) || 0,
    split_gpay: Number(order.split_gpay) || 0,
    payment_mode: order.payment_mode,
    bill_date: order.bill_date,
    created_at: order.created_at,
    is_advance: order.is_advance,
    order_type: order.order_type,
    invoice_id: order.invoice_id || order.id,
    customer_name: order.customers?.name || 'Walk-in Customer',
    customer_phone: order.customers?.phone || '',
    customer_address: order.customers?.address || null,
    items: (order.order_items || []) as OrderItemRow[],
  } as OrderWithRelations;
}

export async function supabaseDeleteOrder(id: string): Promise<void> {
  await Promise.allSettled([
    supabase.from('order_items').delete().eq('order_id', id),
    supabase.from('orders').delete().eq('id', id),
  ]);
}

// ── EXPENSES ───────────────────────────────────────────────────────────────

export async function supabaseListExpenses(): Promise<Expense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .order('expense_date', { ascending: false });

  if (error) {
    console.error('[Supabase] listExpenses error:', error);
    return [];
  }
  return (data || []) as Expense[];
}

export async function supabaseAddExpense(input: {
  title: string;
  category: string;
  amount: number;
  payment_mode: string;
  notes: string | null;
  expense_date: string;
}): Promise<Expense> {
  const newId = uid();
  const { data, error } = await supabase
    .from('expenses')
    .insert({
      id: newId,
      title: input.title,
      category: input.category,
      amount: input.amount,
      payment_mode: input.payment_mode,
      notes: input.notes,
      expense_date: input.expense_date.split('T')[0],
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('[Supabase] addExpense error:', error);
    throw new Error(error.message || 'Failed to add expense');
  }
  return data as Expense;
}

export async function supabaseUpdateExpense(id: string, patch: Partial<Expense>): Promise<Expense | null> {
  const updatePayload: Record<string, any> = { ...patch };
  if (patch.expense_date) {
    updatePayload.expense_date = patch.expense_date.split('T')[0];
  }

  // Omit updated_at since it's not in the schema
  const { data, error } = await supabase
    .from('expenses')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error || !data) {
    console.error('[Supabase] updateExpense error:', error);
    throw new Error(error?.message ?? 'Update affected 0 rows (check RLS UPDATE policy)');
  }
  return data as Expense;
}

export async function supabaseDeleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) {
    console.error('[Supabase] deleteExpense error:', error);
    throw new Error(error.message || 'Failed to delete expense');
  }
}

// ── ADVANCE ORDERS ─────────────────────────────────────────────────────────

export async function supabaseListAdvanceOrders(): Promise<AdvanceOrderWithRelations[]> {
  try {
    const { data: rows, error: advErr } = await supabase
      .from('advance_orders')
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
          snapshot_desc,
          snapshot_price,
          quantity
        )
      `)
      .order('created_at', { ascending: false });

    if (advErr) {
      console.error('[Supabase] listAdvanceOrders error:', advErr);
    }

    const advList: AdvanceOrderWithRelations[] = (rows || []).map((r: any) => ({
      id: r.id,
      customer_id: r.customer_id,
      status: (r.status || 'PENDING').toUpperCase() as AdvanceOrderStatus,
      subtotal: Number(r.subtotal) || 0,
      total_amount: Number(r.total_amount) || 0,
      deposit_amount: Number(r.deposit_amount) || 0,
      deposit_payment_mode: (r.deposit_payment_mode || 'CASH') as PaymentMode,
      delivery_date: r.delivery_date,
      notes: r.notes,
      finalized_order_id: r.finalized_order_id,
      finalized_at: r.finalized_at,
      cancelled_at: r.cancelled_at,
      created_at: r.created_at || new Date().toISOString(),
      customer_name: r.customers?.name || 'Walk-in Customer',
      customer_phone: r.customers?.phone || '',
      customer_address: r.customers?.address || null,
      items: (r.advance_order_items || []) as AdvanceOrderItemRow[],
      is_gst: r.is_gst !== undefined ? Boolean(r.is_gst) : undefined,
      gst_percentage: r.gst_percentage !== undefined ? Number(r.gst_percentage) : undefined,
      gst_amount: r.gst_amount !== undefined ? Number(r.gst_amount) : undefined,
      tax_mode: r.tax_mode,
      discount_type: r.discount_type,
      discount_value: r.discount_value !== undefined ? Number(r.discount_value) : undefined,
      discount_amount: r.discount_amount !== undefined ? Number(r.discount_amount) : undefined,
      delivery_fee: r.delivery_fee !== undefined ? Number(r.delivery_fee) : undefined,
      finalPaymentAmount: r.finalized_order_id ? Math.max(0, (Number(r.total_amount) || 0) - (Number(r.deposit_amount) || 0)) : undefined,
      finalPaymentMethod: r.finalized_order_id ? (r.deposit_payment_mode || 'CASH') : undefined,
      completedAt: r.finalized_at || null,
    }));

    try {
      const advIds = advList.map((a) => a.id).filter(Boolean);
      if (advIds.length > 0) {
        const { data: matchedOrders } = await supabase
          .from('orders')
          .select('id, is_gst, gst_percentage, gst_amount, discount_type, discount_value, discount_amount, delivery_fee, grand_total')
          .in('id', advIds);

        if (matchedOrders && matchedOrders.length > 0) {
          const orderMap = new Map(matchedOrders.map((o) => [o.id, o]));
          for (const a of advList) {
            const ord = orderMap.get(a.id);
            if (ord) {
              if (a.is_gst === undefined && ord.is_gst !== undefined) a.is_gst = Boolean(ord.is_gst);
              if (a.gst_percentage === undefined && ord.gst_percentage !== undefined) a.gst_percentage = Number(ord.gst_percentage);
              if (a.gst_amount === undefined && ord.gst_amount !== undefined) a.gst_amount = Number(ord.gst_amount);
              if (a.discount_type === undefined && ord.discount_type) a.discount_type = ord.discount_type;
              if (a.discount_value === undefined && ord.discount_value !== undefined) a.discount_value = Number(ord.discount_value);
              if (a.discount_amount === undefined && ord.discount_amount !== undefined) a.discount_amount = Number(ord.discount_amount);
              if (a.delivery_fee === undefined && ord.delivery_fee !== undefined) a.delivery_fee = Number(ord.delivery_fee);
              if (!a.total_amount && ord.grand_total) a.total_amount = Number(ord.grand_total);
            }
          }
        }
      }
    } catch (e) {
      // Ignore
    }

    const existingIds = new Set<string>();
    for (const a of advList) {
      if (a.id) existingIds.add(a.id);
      if (a.finalized_order_id) existingIds.add(a.finalized_order_id);
    }

    try {
      const { data: orderRows } = await supabase
        .from('orders')
        .select(`
          *,
          customers (
            name,
            phone,
            address
          ),
          order_items (
            id,
            order_id,
            product_id,
            snapshot_name,
            snapshot_price,
            quantity
          )
        `)
        .or('is_advance.eq.true,order_type.eq.ADVANCE,id.ilike.DEP-%')
        .order('created_at', { ascending: false });

      if (orderRows && orderRows.length > 0) {
        for (const o of orderRows) {
          const isKnown = existingIds.has(o.id) || (o.invoice_id && existingIds.has(o.invoice_id));
          if (!isKnown) {
            advList.push({
              id: o.id,
              customer_id: o.customer_id,
              status: (o.status || 'PENDING').toUpperCase() as AdvanceOrderStatus,
              subtotal: Number(o.subtotal) || 0,
              total_amount: Number(o.grand_total) || 0,
              deposit_amount: Number(o.cash_received) || 0,
              deposit_payment_mode: (o.payment_mode || 'CASH') as PaymentMode,
              delivery_date: null,
              notes: null,
              finalized_order_id: null,
              finalized_at: null,
              cancelled_at: null,
              created_at: o.created_at || new Date().toISOString(),
              customer_name: o.customers?.name || 'Walk-in Customer',
              customer_phone: o.customers?.phone || '',
              customer_address: o.customers?.address || null,
              items: (o.order_items || []).map((i: any) => ({
                id: i.id,
                advance_order_id: o.id,
                product_id: i.product_id || null,
                snapshot_name: i.snapshot_name,
                snapshot_desc: null,
                snapshot_price: Number(i.snapshot_price) || 0,
                quantity: Number(i.quantity) || 1,
              })),
              is_gst: o.is_gst !== undefined ? Boolean(o.is_gst) : undefined,
              gst_percentage: o.gst_percentage !== undefined ? Number(o.gst_percentage) : undefined,
              gst_amount: o.gst_amount !== undefined ? Number(o.gst_amount) : undefined,
              tax_mode: o.tax_mode,
              discount_type: o.discount_type,
              discount_value: o.discount_value !== undefined ? Number(o.discount_value) : undefined,
              discount_amount: o.discount_amount !== undefined ? Number(o.discount_amount) : undefined,
              delivery_fee: o.delivery_fee !== undefined ? Number(o.delivery_fee) : undefined,
            });
            existingIds.add(o.id);
            if (o.invoice_id) existingIds.add(o.invoice_id);
          }
        }
      }
    } catch (err) {
      // Ignore secondary check errors
    }

    // Deduplicate by ID to guarantee one row per parent advance order
    const uniqueAdvMap = new Map<string, AdvanceOrderWithRelations>();
    for (const a of advList) {
      if (!a.id || uniqueAdvMap.has(a.id)) continue;
      uniqueAdvMap.set(a.id, a);
    }
    const dedupedAdvList = Array.from(uniqueAdvMap.values());

    dedupedAdvList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return dedupedAdvList;
  } catch (err) {
    console.error('[Supabase] listAdvanceOrders exception:', err);
    return [];
  }
}

export async function supabaseGetAdvanceOrder(id: string): Promise<AdvanceOrderWithRelations | null> {
  const { data: r, error } = await supabase
    .from('advance_orders')
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
        snapshot_desc,
        snapshot_price,
        quantity
      )
    `)
    .eq('id', id)
    .maybeSingle();

  if (error || !r) return null;

  const res: AdvanceOrderWithRelations = {
    id: r.id,
    customer_id: r.customer_id,
    status: r.status as AdvanceOrderStatus,
    subtotal: Number(r.subtotal) || 0,
    total_amount: Number(r.total_amount) || 0,
    deposit_amount: Number(r.deposit_amount) || 0,
    deposit_payment_mode: r.deposit_payment_mode as PaymentMode,
    delivery_date: r.delivery_date,
    notes: r.notes,
    finalized_order_id: r.finalized_order_id,
    finalized_at: r.finalized_at,
    cancelled_at: r.cancelled_at,
    created_at: r.created_at,
    customer_name: r.customers?.name || 'Walk-in Customer',
    customer_phone: r.customers?.phone || '',
    customer_address: r.customers?.address || null,
    items: (r.advance_order_items || []) as AdvanceOrderItemRow[],
    is_gst: r.is_gst !== undefined ? Boolean(r.is_gst) : undefined,
    gst_percentage: r.gst_percentage !== undefined ? Number(r.gst_percentage) : undefined,
    gst_amount: r.gst_amount !== undefined ? Number(r.gst_amount) : undefined,
    tax_mode: r.tax_mode,
    discount_type: r.discount_type,
    discount_value: r.discount_value !== undefined ? Number(r.discount_value) : undefined,
    discount_amount: r.discount_amount !== undefined ? Number(r.discount_amount) : undefined,
    delivery_fee: r.delivery_fee !== undefined ? Number(r.delivery_fee) : undefined,
  };

  if (res.is_gst === undefined || res.gst_percentage === undefined) {
    try {
      const { data: ord } = await supabase
        .from('orders')
        .select('is_gst, gst_percentage, gst_amount, discount_type, discount_value, discount_amount, delivery_fee, grand_total')
        .eq('id', id)
        .maybeSingle();
      if (ord) {
        if (res.is_gst === undefined && ord.is_gst !== undefined) res.is_gst = Boolean(ord.is_gst);
        if (res.gst_percentage === undefined && ord.gst_percentage !== undefined) res.gst_percentage = Number(ord.gst_percentage);
        if (res.gst_amount === undefined && ord.gst_amount !== undefined) res.gst_amount = Number(ord.gst_amount);
        if (res.discount_type === undefined && ord.discount_type) res.discount_type = ord.discount_type;
        if (res.discount_value === undefined && ord.discount_value !== undefined) res.discount_value = Number(ord.discount_value);
        if (res.discount_amount === undefined && ord.discount_amount !== undefined) res.discount_amount = Number(ord.discount_amount);
        if (res.delivery_fee === undefined && ord.delivery_fee !== undefined) res.delivery_fee = Number(ord.delivery_fee);
        if (!res.total_amount && ord.grand_total) res.total_amount = Number(ord.grand_total);
      }
    } catch (e) {}
  }

  return res;
}

export async function supabaseAdvanceOrderIdExists(id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('advance_orders')
    .select('id')
    .eq('id', id)
    .maybeSingle();

  if (error) return false;
  return !!data;
}

export async function supabaseCreateAdvanceOrder(payload: {
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
  let advId = payload.advanceOrderId;
  if (!advId || !advId.startsWith('DEP-')) {
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const rand = String(Math.floor(1000 + Math.random() * 9000));
    advId = `DEP-${ymd}-${rand}`;
  }

  const customer = await supabaseUpsertCustomer(
    payload.customerName,
    payload.customerPhone,
    payload.customerAddress
  );

  const calc = calculateAdvanceOrderTotals({
    items: payload.items.map((it) => ({
      price: Number(it.snapshot_price) || 0,
      qty: Number(it.quantity) || 1,
    })),
    subtotal: Number(payload.subtotal) || 0,
    isGst: Boolean(payload.isGst),
    gstPercentage: Number(payload.gstPercentage) || 0,
    taxMode: payload.taxMode || 'exclusive',
    manualDiscount:
      Number(payload.discountAmount) > 0 || Number(payload.discountValue) > 0
        ? {
            type: payload.discountType || 'FIXED',
            value: Number(payload.discountValue) || Number(payload.discountAmount) || 0,
          }
        : null,
    deliveryFee: Number(payload.deliveryFee) || 0,
    advanceAmount: Number(payload.depositAmount) || 0,
    grandTotal: Number(payload.totalAmount) || undefined,
  });

  const insertPayload: any = {
    id: advId,
    customer_id: customer.id,
    status: 'PENDING',
    subtotal: calc.subtotal,
    total_amount: calc.grandTotal,
    deposit_amount: Number(payload.depositAmount) || 0,
    deposit_payment_mode: payload.depositPaymentMode || 'CASH',
    delivery_date: payload.deliveryDate ? payload.deliveryDate.split('T')[0] : null,
    notes: payload.notes || null,
    is_advance: true,
    order_type: 'ADVANCE',
    invoice_id: advId,
    created_at: new Date().toISOString(),
    is_gst: calc.gstPercentage > 0,
    gst_percentage: calc.gstPercentage,
    gst_amount: calc.gstAmount,
    tax_mode: payload.taxMode || 'exclusive',
    discount_type: payload.discountType || 'FIXED',
    discount_value: Number(payload.discountValue) || 0,
    discount_amount: calc.discountAmount,
    delivery_fee: calc.deliveryFee,
  };

  const { error: advErr } = await supabase.from('advance_orders').insert(insertPayload);

  if (advErr) {
    console.error('[Supabase] createAdvanceOrder error:', advErr);
    delete insertPayload.is_advance;
    delete insertPayload.order_type;
    delete insertPayload.invoice_id;
    delete insertPayload.is_gst;
    delete insertPayload.gst_percentage;
    delete insertPayload.gst_amount;
    delete insertPayload.tax_mode;
    delete insertPayload.discount_type;
    delete insertPayload.discount_value;
    delete insertPayload.discount_amount;
    delete insertPayload.delivery_fee;

    const { error: retryErr } = await supabase.from('advance_orders').insert(insertPayload);
    if (retryErr) {
      console.error('[Supabase] createAdvanceOrder retry error:', retryErr);
      throw new Error(`Failed to create advance order: ${retryErr.message}`);
    }
  }

  const itemsToInsert = payload.items.map((it) => ({
    id: uid(),
    advance_order_id: advId,
    product_id: it.product_id || null,
    snapshot_name: it.snapshot_name,
    snapshot_desc: it.snapshot_desc || null,
    snapshot_price: Number(it.snapshot_price) || 0,
    quantity: Number(it.quantity) || 1,
  }));

  if (itemsToInsert.length > 0) {
    const { error: itemsErr } = await supabase
      .from('advance_order_items')
      .insert(itemsToInsert);

    if (itemsErr) {
      console.error('[Supabase] createAdvanceOrder items error:', itemsErr);
    }
  }

  try {
    const orderPayload: any = {
      id: advId,
      customer_id: customer.id,
      source: 'OFFLINE',
      status: 'PENDING',
      is_gst: calc.gstPercentage > 0,
      subtotal: calc.subtotal,
      discount_type: payload.discountType || 'FIXED',
      discount_value: Number(payload.discountValue) || 0,
      discount_amount: calc.discountAmount,
      gst_percentage: calc.gstPercentage,
      gst_amount: calc.gstAmount,
      delivery_fee: calc.deliveryFee,
      grand_total: calc.grandTotal,
      cash_received: Number(payload.depositAmount) || 0,
      payment_mode: payload.depositPaymentMode || 'CASH',
      bill_date: new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString(),
    };
    const { error: ordErr } = await supabase.from('orders').insert({
      ...orderPayload,
      is_advance: true,
      order_type: 'ADVANCE',
      invoice_id: advId,
    });
    if (ordErr) {
      await supabase.from('orders').insert(orderPayload);
    }
  } catch (e) {
    // Ignore secondary insert errors
  }

  return { advanceOrderId: advId };
}

// Status change must never modify total/paid/balance. Only a saved payment record can.
export async function supabaseUpdateAdvanceOrderStatus(id: string, status: AdvanceOrderStatus): Promise<void> {
  const statusUpper = String(status || '').trim().toUpperCase() as AdvanceOrderStatus;
  const { data: advData } = await supabase
    .from('advance_orders')
    .select('total_amount, subtotal, status')
    .eq('id', id)
    .maybeSingle();

  // Lock: an already COMPLETED order can never move to another status.
  if (String((advData as any)?.status || '').toUpperCase() === 'COMPLETED' && statusUpper !== 'COMPLETED') {
    throw new Error('Completed advance orders cannot change status');
  }

  const advUpdates: any = {
    status: statusUpper,
  };
  if (statusUpper === 'COMPLETED') {
    advUpdates.finalized_at = new Date().toISOString();
  } else if (statusUpper === 'CANCELLED') {
    advUpdates.cancelled_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('advance_orders')
    .update(advUpdates)
    .eq('id', id);

  if (error) {
    console.error('[Supabase] Failed to update advance_orders status:', error);
    throw new Error(`Failed to update advance order status: ${error.message}`);
  }

  try {
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (existingOrder) {
      await supabase
        .from('orders')
        .update({ status: statusUpper })
        .eq('id', id);
    }
  } catch (err) {
    console.error('Failed to sync advance order status to orders table:', err);
  }
}

export async function supabaseCancelAdvanceOrder(id: string): Promise<void> {
  const { error } = await supabase
    .from('advance_orders')
    .update({ status: 'CANCELLED', cancelled_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function supabaseDeleteAdvanceOrder(id: string): Promise<void> {
  await Promise.allSettled([
    supabase.from('advance_order_items').delete().eq('advance_order_id', id),
    supabase.from('advance_orders').delete().eq('id', id),
  ]);
}

export async function supabaseFinalizeAdvanceOrder(payload: {
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
}): Promise<{ orderId: string }> {
  const advance = await supabaseGetAdvanceOrder(payload.advanceOrderId);
  if (!advance) throw new Error('Advance order not found');
  if (advance.status === 'COMPLETED' && advance.finalized_order_id) {
    return { orderId: advance.finalized_order_id };
  }
  if (advance.status === 'CANCELLED') throw new Error('Advance order was cancelled');

  const cart: CartItem[] = (advance.items || []).map((it) => ({
    id: it.id,
    product_id: it.product_id,
    name: it.snapshot_name,
    desc: it.snapshot_desc || '',
    price: Number(it.snapshot_price) || 0,
    qty: Number(it.quantity) || 1,
  }));

  const orderTaxMode =
    payload.taxMode ||
    (advance as any).tax_mode ||
    (Number(advance.total_amount) > Number(advance.subtotal) + (Number((advance as any).delivery_fee) || 0)
      ? 'exclusive'
      : 'inclusive');

  // Pure single-source calculation logic
  const calc = calculateAdvanceOrderTotals({
    items: cart.map((i) => ({ price: i.price, qty: i.qty })),
    isGst: Boolean(payload.isGst),
    gstPercentage: Number(payload.gstPercentage) || 0,
    taxMode: orderTaxMode,
    manualDiscount:
      Number(payload.discountAmount) > 0 || Number(payload.discountValue) > 0
        ? {
            type: payload.discountType || 'FIXED',
            value: Number(payload.discountValue) || Number(payload.discountAmount) || 0,
          }
        : null,
    deliveryFee: Number(payload.deliveryFee) || 0,
    advanceAmount: Number(advance.deposit_amount) || 0,
  });

  // Official invoice number must start with INV-
  let finalizedInvoiceId = String(payload.invoiceId || '').trim();
  if (!finalizedInvoiceId || !finalizedInvoiceId.startsWith('INV-')) {
    const yr = new Date().getFullYear();
    const rand = Math.random().toString(36).substr(2, 5).toUpperCase();
    finalizedInvoiceId = `INV-${yr}-${rand}`;
  }

  let customerId = advance.customer_id || null;
  if (!customerId && (advance.customer_name || advance.customer_phone)) {
    try {
      const cust = await supabaseUpsertCustomer(
        advance.customer_name || 'Counter Customer',
        advance.customer_phone || '',
        advance.customer_address || null
      );
      if (cust?.id) customerId = cust.id;
    } catch (e) {
      // Continue with null if customer upsert fails
    }
  }

  // 1. Prepare official invoice row with ONLY existing columns in Postgres orders schema
  const orderPayload: any = {
    id: finalizedInvoiceId,
    customer_id: customerId,
    source: 'OFFLINE',
    status: 'COMPLETED',
    is_gst: Boolean(calc.gstPercentage > 0),
    subtotal: calc.subtotal,
    discount_type: payload.discountType || 'FIXED',
    discount_value: Number(payload.discountValue) || 0,
    discount_amount: calc.discountAmount,
    gst_percentage: calc.gstPercentage,
    gst_amount: calc.gstAmount,
    delivery_fee: calc.deliveryFee,
    grand_total: calc.grandTotal,
    cash_received: calc.grandTotal,
    payment_mode: payload.paymentMode || 'CASH',
    bill_date: payload.billDate
      ? payload.billDate.split('T')[0]
      : new Date().toISOString().split('T')[0],
  };

  // 2. Insert into orders table first
  const { error: orderErr } = await supabase
    .from('orders')
    .upsert(orderPayload, { onConflict: 'id' });

  if (orderErr) {
    console.error('[Supabase] Failed to create official invoice in orders table:', orderErr);
    throw new Error(`Failed to create official invoice: ${orderErr.message}`);
  }

  // 3. Insert order_items for finalizedInvoiceId
  const itemsToInsert = cart.map((item) => ({
    id: uid(),
    order_id: finalizedInvoiceId,
    product_id: item.product_id || null,
    snapshot_name: item.name || 'Advance Item',
    snapshot_price: Number(item.price) || 0,
    quantity: Number(item.qty) || 1,
  }));

  if (itemsToInsert.length > 0) {
    const { error: itemsErr } = await supabase
      .from('order_items')
      .insert(itemsToInsert);

    if (itemsErr) {
      console.error('[Supabase] Failed to create order items for invoice:', itemsErr);
      // Atomic rollback: delete created invoice from orders
      await supabase.from('orders').delete().eq('id', finalizedInvoiceId);
      throw new Error(`Failed to create invoice items: ${itemsErr.message}`);
    }
  }

  // 4. Update advance_orders row: mark COMPLETED, record final recognized revenue, and store link to official invoice
  // ONLY use existing columns in advance_orders table (status, subtotal, total_amount, deposit_amount, finalized_order_id, finalized_at)
  const advUpdatePayload: any = {
    status: 'COMPLETED',
    finalized_order_id: finalizedInvoiceId,
    finalized_at: new Date().toISOString(),
  };

  const { error: advErr } = await supabase
    .from('advance_orders')
    .update(advUpdatePayload)
    .eq('id', payload.advanceOrderId);

  if (advErr) {
    console.error('[Supabase] Failed to update advance_orders on finalize:', advErr);
    // Atomic rollback: delete created order_items and orders invoice
    await supabase.from('order_items').delete().eq('order_id', finalizedInvoiceId);
    await supabase.from('orders').delete().eq('id', finalizedInvoiceId);
    throw new Error(`Failed to update advance order: ${advErr.message}`);
  }

  // 5. Clean up any placeholder order previously created under DEP- ID if any
  try {
    await supabase.from('order_items').delete().eq('order_id', payload.advanceOrderId);
    await supabase.from('orders').delete().eq('id', payload.advanceOrderId);
  } catch (cleanErr) {
    // Ignore cleanup error
  }

  return { orderId: finalizedInvoiceId };
}
