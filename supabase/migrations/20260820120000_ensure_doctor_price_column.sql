-- Ensure the doctor selling price is present in the live Supabase schema.
-- This is intentionally a new migration so Supabase applies it even if the
-- original doctor-pricing migration was already marked as applied.
ALTER TABLE public.medicines
  ADD COLUMN IF NOT EXISTS price_doctor numeric(15,2) NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS public.medicine_units
  ADD COLUMN IF NOT EXISTS price_doctor numeric(15,2) NOT NULL DEFAULT 0;

ALTER TABLE public.sales
  DROP CONSTRAINT IF EXISTS sales_sale_type_check;

ALTER TABLE public.sales
  ADD CONSTRAINT sales_sale_type_check
  CHECK (sale_type IN ('regular', 'prescription', 'doctor'));

NOTIFY pgrst, 'reload schema';
