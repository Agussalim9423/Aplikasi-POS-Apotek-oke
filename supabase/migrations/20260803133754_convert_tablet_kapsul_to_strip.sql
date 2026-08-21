/*
# Convert tablet/kapsul medicines to strip unit

1. Modified Tables
- `medicines`
  - `pieces_per_strip` (integer, default 10) — number of pieces (tablets/kapsul) per strip. Used to convert between strip and piece quantities.
  - `unit` — changed from 'tablet'/'kapsul' to 'strip' for all existing medicines whose form is Tablet or Kapsul.

2. Data Migration
- For all medicines with unit IN ('tablet', 'kapsul'):
  - Set `pieces_per_strip` = 10 (default assumption)
  - Convert `stock` from pieces to strips: stock = CEIL(stock / 10)
  - Convert `min_stock` from pieces to strips: min_stock = CEIL(min_stock / 10)
  - Convert `sell_price` from per-piece to per-strip: sell_price = sell_price * 10
  - Convert `buy_price` from per-piece to per-strip: buy_price = buy_price * 10
  - Set `unit` = 'strip'

3. Notes
- Existing tablet/kapsul medicines now use 'strip' as their unit with 10 pieces per strip.
- Prices are multiplied by 10 to reflect per-strip pricing.
- Stock is divided by 10 (rounded up) to reflect strip quantities.
- Medicines with other units (pcs, botol, etc.) are unaffected.
*/

ALTER TABLE medicines
  ADD COLUMN IF NOT EXISTS pieces_per_strip integer NOT NULL DEFAULT 10;

-- Convert existing tablet/kapsul medicines to strip
UPDATE medicines
SET
  pieces_per_strip = 10,
  stock = CEIL(stock::numeric / 10),
  min_stock = CEIL(min_stock::numeric / 10),
  sell_price = sell_price * 10,
  buy_price = buy_price * 10,
  unit = 'strip'
WHERE unit IN ('tablet', 'kapsul');
