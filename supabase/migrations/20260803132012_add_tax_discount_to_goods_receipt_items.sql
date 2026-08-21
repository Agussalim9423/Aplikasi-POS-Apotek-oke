/*
# Add tax and discount columns to goods_receipt_items

1. Modified Tables
- `goods_receipt_items`
  - `discount` (numeric, default 0) — discount amount per item line from supplier/PBF
  - `tax` (numeric, default 0) — PPN (tax) amount per item line from supplier/PBF
  - `cost_price` (numeric, default 0) — the final modal/cost price per unit after adding tax and subtracting discount, used to update medicine buy_price on verification

2. Security
- No policy changes. Existing anon/authenticated CRUD policies on goods_receipt_items remain in effect.

3. Notes
- All three columns are additive with safe defaults so existing rows are unaffected.
- `cost_price` is computed by the frontend as: (unit_price * quantity + tax - discount) / quantity, i.e. the effective per-unit modal.
*/

ALTER TABLE goods_receipt_items
  ADD COLUMN IF NOT EXISTS discount numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_price numeric(15,2) NOT NULL DEFAULT 0;
