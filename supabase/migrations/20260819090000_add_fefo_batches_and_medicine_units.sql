-- FEFO batch stock and multi-unit pricing support.
-- Keep quantity for backward compatibility with existing receiving screens.
ALTER TABLE public.medicine_batches
  ADD COLUMN IF NOT EXISTS stock_quantity integer NOT NULL DEFAULT 0;

UPDATE public.medicine_batches
SET stock_quantity = quantity
WHERE stock_quantity = 0 AND quantity <> 0;

ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.medicine_batches(id),
  ADD COLUMN IF NOT EXISTS unit_id uuid,
  ADD COLUMN IF NOT EXISTS unit_name text,
  ADD COLUMN IF NOT EXISTS conversion_factor numeric NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS public.medicine_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_id uuid NOT NULL REFERENCES public.medicines(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  unit_name text NOT NULL,
  conversion_factor numeric NOT NULL DEFAULT 1 CHECK (conversion_factor > 0),
  price_regular numeric(15,2) NOT NULL DEFAULT 0,
  price_prescription numeric(15,2) NOT NULL DEFAULT 0,
  is_base_unit boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(medicine_id, unit_name)
);

ALTER TABLE public.sale_items
  DROP CONSTRAINT IF EXISTS sale_items_unit_id_fkey;
ALTER TABLE public.sale_items
  ADD CONSTRAINT sale_items_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.medicine_units(id);

ALTER TABLE public.medicine_units ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_medicine_units" ON public.medicine_units;
CREATE POLICY "anon_select_medicine_units" ON public.medicine_units FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_medicine_units" ON public.medicine_units;
CREATE POLICY "anon_insert_medicine_units" ON public.medicine_units FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_medicine_units" ON public.medicine_units;
CREATE POLICY "anon_update_medicine_units" ON public.medicine_units FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_medicine_units" ON public.medicine_units;
CREATE POLICY "anon_delete_medicine_units" ON public.medicine_units FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_medicine_units_medicine ON public.medicine_units(medicine_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_batch ON public.sale_items(batch_id);
