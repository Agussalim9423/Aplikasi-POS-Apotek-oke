-- Revisi 16: zat aktif editable untuk Surat Pesanan Obat-Obat Tertentu (OOT)
ALTER TABLE public.purchase_order_items
ADD COLUMN IF NOT EXISTS active_ingredient TEXT;

UPDATE public.purchase_order_items AS poi
SET active_ingredient = COALESCE(NULLIF(TRIM(m.generic_name), ''), NULLIF(TRIM(m.description), ''))
FROM public.medicines AS m
WHERE m.id = poi.medicine_id
  AND (poi.active_ingredient IS NULL OR TRIM(poi.active_ingredient) = '');
