-- Revisi 14: zat aktif prekursor farmasi per item Surat Pesanan.
-- Nilai disimpan pada item SP agar dapat dikoreksi tanpa mengubah master obat.
ALTER TABLE public.purchase_order_items
  ADD COLUMN IF NOT EXISTS precursor_active_ingredient text;

-- Isi otomatis SP prekursor lama yang belum memiliki nilai,
-- menggunakan nama generik/deskripsi obat sebagai nilai awal.
UPDATE public.purchase_order_items poi
SET precursor_active_ingredient = COALESCE(NULLIF(m.generic_name, ''), NULLIF(m.description, ''))
FROM public.purchase_orders po
JOIN public.medicines m ON m.id = poi.medicine_id
WHERE poi.purchase_order_id = po.id
  AND po.sp_type = 'prekursor'
  AND poi.precursor_active_ingredient IS NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_order_items_precursor_active_ingredient
  ON public.purchase_order_items(purchase_order_id)
  WHERE precursor_active_ingredient IS NOT NULL;
