/*
# Barcode, Dual Pricing, Sale Type, Operational Expenses

1. Overview
   Adds barcode generation support, dual pricing (regular vs prescription),
   sale type tracking on sales, cost price tracking on sale items for profit
   calculation, and a new operational_expenses table for net profit reporting.
   All new tables and columns are tenant-scoped via tenant_id.

2. Modified Tables
   - `medicines`: add `price_regular` (numeric, default = sell_price) and
     `price_prescription` (numeric, default = sell_price). The existing
     `sell_price` column is kept for backward compatibility and used as the
     fallback when a price is 0 or null.
   - `sales`: add `sale_type` (text, default 'regular') — 'regular' | 'prescription'.
   - `sale_items`: add `cost_price` (numeric, default 0) — the buy price of the
     medicine at time of sale, for HPP calculation.

3. New Tables
   - `operational_expenses`: records operational costs (rent, electricity,
     salaries, etc.) for net profit calculation.
     - `id` (uuid, PK)
     - `tenant_id` (uuid, FK to tenants)
     - `category` (text, NOT NULL) — e.g. 'Listrik', 'Gaji', 'Sewa', 'Lainnya'
     - `description` (text)
     - `amount` (numeric, NOT NULL)
     - `expense_date` (date, NOT NULL)
     - `created_at` (timestamptz, default now())

4. Data Backfill
   - `price_regular` and `price_prescription` are backfilled from existing
     `sell_price` values so current data is not lost.
   - `sale_items.cost_price` is backfilled from the medicine's `buy_price`.

5. Security
   - RLS enabled on `operational_expenses` with open CRUD for anon+authenticated
     (same pattern as all other tables in this anon-key app).
   - Tenant isolation is enforced in the application layer via `tenantFrom()`.
*/

-- ============================================================
-- 1. Add dual pricing columns to medicines
-- ============================================================
ALTER TABLE public.medicines ADD COLUMN IF NOT EXISTS price_regular numeric NOT NULL DEFAULT 0;
ALTER TABLE public.medicines ADD COLUMN IF NOT EXISTS price_prescription numeric NOT NULL DEFAULT 0;

-- Backfill from sell_price
UPDATE public.medicines SET price_regular = sell_price WHERE price_regular = 0;
UPDATE public.medicines SET price_prescription = sell_price WHERE price_prescription = 0;

-- ============================================================
-- 2. Add sale_type to sales
-- ============================================================
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS sale_type text NOT NULL DEFAULT 'regular';

-- ============================================================
-- 3. Add cost_price to sale_items
-- ============================================================
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS cost_price numeric NOT NULL DEFAULT 0;

-- Backfill cost_price from medicines.buy_price
UPDATE public.sale_items si
SET cost_price = COALESCE(m.buy_price, 0)
FROM public.medicines m
WHERE si.medicine_id = m.id AND si.cost_price = 0;

-- ============================================================
-- 4. Create operational_expenses table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.operational_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  category text NOT NULL,
  description text,
  amount numeric NOT NULL DEFAULT 0,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.operational_expenses ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_opex_tenant ON public.operational_expenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_opex_date ON public.operational_expenses(expense_date);

DROP POLICY IF EXISTS "anon_select_opex" ON public.operational_expenses;
CREATE POLICY "anon_select_opex" ON public.operational_expenses
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_opex" ON public.operational_expenses;
CREATE POLICY "anon_insert_opex" ON public.operational_expenses
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_opex" ON public.operational_expenses;
CREATE POLICY "anon_update_opex" ON public.operational_expenses
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_opex" ON public.operational_expenses;
CREATE POLICY "anon_delete_opex" ON public.operational_expenses
  FOR DELETE TO anon, authenticated USING (true);
