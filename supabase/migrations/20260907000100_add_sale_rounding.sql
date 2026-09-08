-- Manual rounding adjustment for sales.
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS rounding_amount numeric(15,2) NOT NULL DEFAULT 0;
