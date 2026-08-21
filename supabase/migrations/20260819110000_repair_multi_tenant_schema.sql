-- Repair migration for an existing database where the multi-tenant migration
-- was partially applied or failed during index/constraint creation.
-- Run this after the original multi-tenant migration, not instead of the base schema.

CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  phone text,
  footer_copyright text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now()
);

-- The table may already exist with an older, smaller definition.
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS footer_copyright text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

INSERT INTO public.tenants (name, address, phone, footer_copyright, status)
SELECT 'Apotek Avicenna', 'Jl. Kesehatan No. 1, Jakarta', '021-1234567', '© 2024 Apotek Avicenna · Sistem POS Apotek', 'approved'
WHERE NOT EXISTS (SELECT 1 FROM public.tenants WHERE name = 'Apotek Avicenna');

DO $$
DECLARE
  default_tenant_id uuid;
BEGIN
  SELECT id INTO default_tenant_id
  FROM public.tenants
  WHERE name = 'Apotek Avicenna'
  ORDER BY created_at
  LIMIT 1;

  IF default_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant default tidak ditemukan';
  END IF;

  ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS tenant_id uuid;
  ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS tenant_id uuid;
  ALTER TABLE public.medicines ADD COLUMN IF NOT EXISTS tenant_id uuid;
  ALTER TABLE public.medicine_batches ADD COLUMN IF NOT EXISTS tenant_id uuid;
  ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS tenant_id uuid;
  ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS tenant_id uuid;
  ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS tenant_id uuid;
  ALTER TABLE public.purchase_order_items ADD COLUMN IF NOT EXISTS tenant_id uuid;
  ALTER TABLE public.goods_receipts ADD COLUMN IF NOT EXISTS tenant_id uuid;
  ALTER TABLE public.goods_receipt_items ADD COLUMN IF NOT EXISTS tenant_id uuid;
  ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS tenant_id uuid;
  ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS tenant_id uuid;
  ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS tenant_id uuid;

  UPDATE public.settings SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.suppliers SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.medicines SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.medicine_batches SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.patients SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.doctors SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.purchase_orders SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.purchase_order_items SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.goods_receipts SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.goods_receipt_items SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.sales SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.sale_items SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;

  -- Keep superadmin tenantless; assign only ordinary users to the default tenant.
  UPDATE public.app_users
  SET tenant_id = default_tenant_id
  WHERE tenant_id IS NULL AND role <> 'superadmin';
END $$;

-- Remove old global unique constraints before creating per-tenant indexes.
ALTER TABLE public.app_users DROP CONSTRAINT IF EXISTS app_users_email_key;
ALTER TABLE public.settings DROP CONSTRAINT IF EXISTS settings_key_key;
ALTER TABLE public.suppliers DROP CONSTRAINT IF EXISTS suppliers_code_key;
ALTER TABLE public.medicines DROP CONSTRAINT IF EXISTS medicines_barcode_key;
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_invoice_number_key;
ALTER TABLE public.purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_po_number_key;
ALTER TABLE public.goods_receipts DROP CONSTRAINT IF EXISTS goods_receipts_receipt_number_key;
ALTER TABLE public.medicine_batches DROP CONSTRAINT IF EXISTS medicine_batches_medicine_id_batch_number_key;

-- Parentheses around expressions make this valid on PostgreSQL versions used by Supabase.
CREATE UNIQUE INDEX IF NOT EXISTS app_users_email_tenant_key
  ON public.app_users (email, (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)));
CREATE UNIQUE INDEX IF NOT EXISTS settings_key_tenant_key
  ON public.settings (key, (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)));
CREATE UNIQUE INDEX IF NOT EXISTS suppliers_code_tenant_key
  ON public.suppliers (code, (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)))
  WHERE code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS medicines_barcode_tenant_key
  ON public.medicines (barcode, (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)))
  WHERE barcode IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS sales_invoice_tenant_key
  ON public.sales (invoice_number, (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)));
CREATE UNIQUE INDEX IF NOT EXISTS po_number_tenant_key
  ON public.purchase_orders (po_number, (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)));
CREATE UNIQUE INDEX IF NOT EXISTS gr_number_tenant_key
  ON public.goods_receipts (receipt_number, (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)));
CREATE UNIQUE INDEX IF NOT EXISTS batch_tenant_key
  ON public.medicine_batches (medicine_id, batch_number, (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)));

-- Add missing foreign keys only when they are not already present.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'settings_tenant_id_fkey') THEN
    ALTER TABLE public.settings ADD CONSTRAINT settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'medicines_tenant_id_fkey') THEN
    ALTER TABLE public.medicines ADD CONSTRAINT medicines_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
