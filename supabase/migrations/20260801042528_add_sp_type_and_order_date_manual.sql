-- Add SP type and manual order date to purchase_orders
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS sp_type text NOT NULL DEFAULT 'reguler';
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS order_date_manual date;

-- Backfill order_date_manual from order_date for existing rows
UPDATE purchase_orders SET order_date_manual = order_date::date WHERE order_date_manual IS NULL;

-- Add SIA number setting if not exists
INSERT INTO settings (key, value, updated_at)
SELECT 'sia_number', '', now()
WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'sia_number');
