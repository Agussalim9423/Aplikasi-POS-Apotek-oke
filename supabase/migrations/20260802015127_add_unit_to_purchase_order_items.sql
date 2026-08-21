ALTER TABLE purchase_order_items
  ADD COLUMN IF NOT EXISTS unit text;

UPDATE purchase_order_items
  SET unit = m.unit
  FROM medicines m
  WHERE purchase_order_items.medicine_id = m.id
    AND purchase_order_items.unit IS NULL;
