/*
# Add discount_percent and tax_percent to goods_receipt_items

1. Modified Tables
- `goods_receipt_items`
  - `discount_percent` (numeric, default 0) — discount percentage from supplier (e.g. 5 = 5%)
  - `tax_percent` (numeric, default 0) — PPN percentage from supplier (e.g. 11 = 11%)

2. Notes
- The existing `discount` and `tax` columns remain and now store the computed nominal (Rp) amounts.
- `discount_percent` / `tax_percent` store the user-entered percentage.
- `cost_price` = (subtotal - discount_nominal + tax_nominal) / quantity, computed by the frontend.
*/

ALTER TABLE goods_receipt_items
  ADD COLUMN IF NOT EXISTS discount_percent numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_percent numeric(5,2) NOT NULL DEFAULT 0;
