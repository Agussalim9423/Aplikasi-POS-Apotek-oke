/* Add sell_price column to goods_receipt_items so the received sell price
   is recorded per line item and applied to the medicine on verification. */
ALTER TABLE goods_receipt_items
  ADD COLUMN IF NOT EXISTS sell_price numeric(15,2) NOT NULL DEFAULT 0;
