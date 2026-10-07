-- ============================================================
-- Supabase Database Schema & Migration Script
-- Run this in: Supabase Dashboard → SQL Editor
-- Project: https://txryikxpggbiijrmkwjp.supabase.co
-- ============================================================

-- Enable UUID extension if available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. CATEGORIES TABLE ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name        TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 2. CATALOG ITEMS TABLE ──────────────────────────────────
-- Specifically structured for catalog items with mixed data types & member pricing
CREATE TABLE IF NOT EXISTS catalog_items (
  id                      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  category_id             TEXT REFERENCES categories(id) ON DELETE SET NULL,
  category                TEXT NOT NULL,
  name                    TEXT NOT NULL,
  regular_price           NUMERIC(12,2) NOT NULL DEFAULT 0,
  member_price            NUMERIC(12,2),
  formatted_regular_price TEXT,
  formatted_member_price  TEXT,
  price_type              TEXT NOT NULL DEFAULT 'FIXED', -- 'FIXED' | 'RANGE' | 'CUSTOM' | 'CONSULTATION'
  details                 TEXT,
  duration                TEXT,
  unit                    TEXT DEFAULT 'Service',
  gst_rate                NUMERIC(5,2) NOT NULL DEFAULT 0,
  hsn_code                TEXT DEFAULT '9997',
  is_active               BOOLEAN NOT NULL DEFAULT true,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 3. PRODUCTS TABLE (Full POS Product / Service Model) ─────
CREATE TABLE IF NOT EXISTS products (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name           TEXT NOT NULL,
  description    TEXT,
  category       TEXT,
  gst_rate       NUMERIC(5,2) NOT NULL DEFAULT 0,
  hsn_code       TEXT,
  selling_price  NUMERIC(12,2) NOT NULL DEFAULT 0,
  price          NUMERIC(12,2) DEFAULT 0,
  offer_price    NUMERIC(12,2) DEFAULT 0,
  purchase_price NUMERIC(12,2) DEFAULT 0,
  sku            TEXT,
  stock_quantity INTEGER DEFAULT 999,
  low_stock_alert INTEGER DEFAULT 5,
  unit           TEXT,
  unit_label     TEXT,
  item_type      TEXT DEFAULT 'service',
  is_active      BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 4. CUSTOMERS TABLE ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL UNIQUE,
  address     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 5. ORDERS TABLE (Sales Invoices & Receipts) ─────────────
CREATE TABLE IF NOT EXISTS orders (
  id               TEXT PRIMARY KEY,
  customer_id      TEXT REFERENCES customers(id) ON DELETE SET NULL,
  source           TEXT NOT NULL DEFAULT 'OFFLINE',   -- 'OFFLINE' | 'ONLINE'
  status           TEXT NOT NULL DEFAULT 'COMPLETED', -- 'COMPLETED' | 'PENDING'
  is_gst           BOOLEAN NOT NULL DEFAULT FALSE,
  subtotal         NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_type    TEXT NOT NULL DEFAULT 'FIXED',      -- 'FIXED' | 'PERCENT'
  discount_value   NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
  gst_percentage   NUMERIC(5,2) NOT NULL DEFAULT 0,
  gst_amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  delivery_fee     NUMERIC(12,2) NOT NULL DEFAULT 0,
  grand_total      NUMERIC(12,2) NOT NULL DEFAULT 0,
  cash_received    NUMERIC(12,2) NOT NULL DEFAULT 0,
  split_cash       NUMERIC(12,2) NOT NULL DEFAULT 0,
  split_gpay       NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_mode     TEXT NOT NULL DEFAULT 'CASH',      -- 'CASH' | 'GPAY' | 'SPLIT'
  bill_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 6. ORDER ITEMS TABLE ────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id        TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id      TEXT,
  snapshot_name   TEXT NOT NULL,
  snapshot_price  NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantity        INTEGER NOT NULL DEFAULT 1
);

-- ── 7. EXPENSES TABLE ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title         TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'General',
  amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_mode  TEXT NOT NULL DEFAULT 'CASH',
  notes         TEXT,
  expense_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 8. ADVANCE ORDERS TABLE ─────────────────────────────────
CREATE TABLE IF NOT EXISTS advance_orders (
  id                    TEXT PRIMARY KEY,
  customer_id           TEXT REFERENCES customers(id) ON DELETE SET NULL,
  status                TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING'|'READY'|'COMPLETED'|'CANCELLED'
  subtotal              NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
  deposit_amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
  deposit_payment_mode  TEXT NOT NULL DEFAULT 'CASH',
  delivery_date         DATE,
  notes                 TEXT,
  finalized_order_id    TEXT,
  finalized_at          TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 9. ADVANCE ORDER ITEMS TABLE ────────────────────────────
CREATE TABLE IF NOT EXISTS advance_order_items (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  advance_order_id    TEXT NOT NULL REFERENCES advance_orders(id) ON DELETE CASCADE,
  product_id          TEXT,
  snapshot_name       TEXT NOT NULL,
  snapshot_desc       TEXT,
  snapshot_price      NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantity            INTEGER NOT NULL DEFAULT 1
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Public & Anon access enabled for seamless POS counter queries
-- ============================================================

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE advance_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE advance_order_items ENABLE ROW LEVEL SECURITY;

-- Categories RLS
DROP POLICY IF EXISTS "anon_read_categories" ON categories;
CREATE POLICY "anon_read_categories" ON categories FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon_all_categories" ON categories;
CREATE POLICY "anon_all_categories" ON categories FOR ALL TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_all_categories" ON categories;
CREATE POLICY "auth_all_categories" ON categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Catalog Items RLS
DROP POLICY IF EXISTS "anon_read_catalog_items" ON catalog_items;
CREATE POLICY "anon_read_catalog_items" ON catalog_items FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon_all_catalog_items" ON catalog_items;
CREATE POLICY "anon_all_catalog_items" ON catalog_items FOR ALL TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_all_catalog_items" ON catalog_items;
CREATE POLICY "auth_all_catalog_items" ON catalog_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Products RLS
DROP POLICY IF EXISTS "anon_read_products" ON products;
CREATE POLICY "anon_read_products" ON products FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon_all_products" ON products;
CREATE POLICY "anon_all_products" ON products FOR ALL TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_all_products" ON products;
CREATE POLICY "auth_all_products" ON products FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Customers RLS
DROP POLICY IF EXISTS "anon_all_customers" ON customers;
CREATE POLICY "anon_all_customers" ON customers FOR ALL TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_all_customers" ON customers;
CREATE POLICY "auth_all_customers" ON customers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Orders RLS
DROP POLICY IF EXISTS "anon_all_orders" ON orders;
CREATE POLICY "anon_all_orders" ON orders FOR ALL TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_all_orders" ON orders;
CREATE POLICY "auth_all_orders" ON orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Order Items RLS
DROP POLICY IF EXISTS "anon_all_order_items" ON order_items;
CREATE POLICY "anon_all_order_items" ON order_items FOR ALL TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_all_order_items" ON order_items;
CREATE POLICY "auth_all_order_items" ON order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Expenses RLS
DROP POLICY IF EXISTS "anon_all_expenses" ON expenses;
CREATE POLICY "anon_all_expenses" ON expenses FOR ALL TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_all_expenses" ON expenses;
CREATE POLICY "auth_all_expenses" ON expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Advance Orders RLS
DROP POLICY IF EXISTS "anon_all_advance_orders" ON advance_orders;
CREATE POLICY "anon_all_advance_orders" ON advance_orders FOR ALL TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_all_advance_orders" ON advance_orders;
CREATE POLICY "auth_all_advance_orders" ON advance_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Advance Order Items RLS
DROP POLICY IF EXISTS "anon_all_advance_order_items" ON advance_order_items;
CREATE POLICY "anon_all_advance_order_items" ON advance_order_items FOR ALL TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_all_advance_order_items" ON advance_order_items;
CREATE POLICY "auth_all_advance_order_items" ON advance_order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- PERFORMANCE INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_catalog_items_category ON catalog_items(category);
CREATE INDEX IF NOT EXISTS idx_catalog_items_name ON catalog_items(name);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_advance_order_items_ao_id ON advance_order_items(advance_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_bill_date ON orders(bill_date);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_mode ON orders(payment_mode);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_advance_orders_status ON advance_orders(status);
CREATE INDEX IF NOT EXISTS idx_advance_orders_created_at ON advance_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON expenses(expense_date);
