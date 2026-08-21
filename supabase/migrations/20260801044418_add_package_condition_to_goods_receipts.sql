ALTER TABLE goods_receipts
  ADD COLUMN IF NOT EXISTS package_condition text DEFAULT 'Baik';
