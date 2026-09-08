-- Add the third sales price channel and allow doctor sales.
ALTER TABLE public.medicines ADD COLUMN IF NOT EXISTS price_doctor numeric(15,2) NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS public.medicine_units ADD COLUMN IF NOT EXISTS price_doctor numeric(15,2) NOT NULL DEFAULT 0;

ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_sale_type_check;
ALTER TABLE public.sales ADD CONSTRAINT sales_sale_type_check CHECK (sale_type IN ('regular', 'prescription', 'doctor'));

-- Refresh PostgREST's schema cache so the frontend can use the new columns immediately.
NOTIFY pgrst, 'reload schema';
