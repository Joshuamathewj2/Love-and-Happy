/**
 * lib/supabaseActions.ts
 * ──────────────────────
 * Server-side and Client-side Supabase helpers for catalog operations.
 * Used by app/pos/actions.ts to read categories, catalog items, and products from Supabase.
 * Falls back gracefully to local catalogData if Supabase is unreachable or unseeded.
 */
import { supabase } from './supabaseClient';
import type { Category, Product } from './types';
import { LOVE_AND_HAPPY_CATEGORIES, LOVE_AND_HAPPY_PRODUCTS } from './catalogData';

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

/** Fetch all categories from Supabase, fallback to local data. */
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

/** Fetch catalog items directly from Supabase `catalog_items` table. */
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

/** Fetch all products from Supabase (checking catalog_items first, then products), fallback to local data. */
export async function supabaseFetchProducts(): Promise<Product[]> {
  try {
    // 1. First attempt to fetch from catalog_items table
    const { data: catalogData, error: catalogErr } = await supabase
      .from('catalog_items')
      .select('*')
      .order('name', { ascending: true });

    if (!catalogErr && catalogData && catalogData.length > 0) {
      return (catalogData as CatalogItemDB[]).map((item) => {
        const numPrice = typeof item.regular_price === 'number'
          ? item.regular_price
          : parseFloat(String(item.regular_price)) || 0;
        const numMemberPrice = item.member_price !== null && item.member_price !== undefined
          ? (typeof item.member_price === 'number' ? item.member_price : parseFloat(String(item.member_price)))
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

    // 2. Fallback to products table in Supabase
    const { data: prodData, error: prodErr } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true });

    if (!prodErr && prodData && prodData.length > 0) {
      return prodData as Product[];
    }

    console.warn('[Supabase] catalog_items and products tables empty or unreachable — using local fallback');
    return LOVE_AND_HAPPY_PRODUCTS;
  } catch (err) {
    console.warn('[Supabase] fetchProducts failed, using local fallback:', err);
    return LOVE_AND_HAPPY_PRODUCTS;
  }
}

/** Upsert a product / catalog item into Supabase. */
export async function supabaseAddProduct(product: Omit<Product, 'created_at'>): Promise<Product | null> {
  try {
    const timestamp = new Date().toISOString();

    // Upsert into products table
    const { data, error } = await supabase
      .from('products')
      .upsert({ ...product, created_at: timestamp }, { onConflict: 'id' })
      .select()
      .single();

    // Also sync into catalog_items table
    try {
      await supabase
        .from('catalog_items')
        .upsert({
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
        }, { onConflict: 'id' });
    } catch (_) {
      // Non-critical if catalog_items isn't initialized yet
    }

    if (error) throw error;
    return data as Product;
  } catch (err) {
    console.warn('[Supabase] addProduct failed:', err);
    return null;
  }
}

/** Update a product in Supabase. */
export async function supabaseUpdateProduct(id: string, patch: Partial<Product>): Promise<Product | null> {
  try {
    const { data, error } = await supabase
      .from('products')
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    try {
      const catalogPatch: Record<string, any> = {};
      if (patch.name !== undefined) catalogPatch.name = patch.name;
      if (patch.category !== undefined) catalogPatch.category = patch.category;
      if (patch.selling_price !== undefined) catalogPatch.regular_price = patch.selling_price;
      if (patch.offer_price !== undefined) catalogPatch.member_price = patch.offer_price;
      if (patch.description !== undefined) catalogPatch.details = patch.description;
      if (patch.gst_rate !== undefined) catalogPatch.gst_rate = patch.gst_rate;
      if (patch.hsn_code !== undefined) catalogPatch.hsn_code = patch.hsn_code;

      if (Object.keys(catalogPatch).length > 0) {
        await supabase.from('catalog_items').update(catalogPatch).eq('id', id);
      }
    } catch (_) {
      // Non-critical
    }

    if (error) throw error;
    return data as Product;
  } catch (err) {
    console.warn('[Supabase] updateProduct failed:', err);
    return null;
  }
}

/** Delete a product from Supabase. */
export async function supabaseDeleteProduct(id: string): Promise<void> {
  try {
    await Promise.allSettled([
      supabase.from('products').delete().eq('id', id),
      supabase.from('catalog_items').delete().eq('id', id),
    ]);
  } catch (err) {
    console.warn('[Supabase] deleteProduct failed:', err);
  }
}

/** Seed categories, catalog_items, and products from local data into Supabase. */
export async function supabaseSeedCatalog(): Promise<{ categoriesCount: number; productsCount: number }> {
  let categoriesCount = 0;
  let productsCount = 0;

  // Upsert categories
  const catRows = LOVE_AND_HAPPY_CATEGORIES.map((c) => ({
    id: c.id,
    name: c.name,
    created_at: c.created_at,
  }));

  const { error: catErr } = await supabase
    .from('categories')
    .upsert(catRows, { onConflict: 'name' });

  if (catErr) {
    console.error('[Supabase] seed categories error:', catErr.message);
  } else {
    categoriesCount = catRows.length;
  }

  // Upsert products in chunks of 50
  const CHUNK = 50;
  for (let i = 0; i < LOVE_AND_HAPPY_PRODUCTS.length; i += CHUNK) {
    const chunk = LOVE_AND_HAPPY_PRODUCTS.slice(i, i + CHUNK);
    const { error: prodErr } = await supabase
      .from('products')
      .upsert(chunk, { onConflict: 'id' });

    if (prodErr) {
      console.error('[Supabase] seed products chunk error:', prodErr.message);
    } else {
      productsCount += chunk.length;
    }

    // Also seed catalog_items
    const catalogChunk = chunk.map((p) => ({
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

  console.log(`[Supabase] Seeded ${categoriesCount} categories + ${productsCount} products/catalog_items`);
  return { categoriesCount, productsCount };
}
