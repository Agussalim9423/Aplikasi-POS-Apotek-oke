/*
# Seed sample products for Minuman and Alat Kesehatan categories

1. Purpose
   - Adds default sample products for the new "Minuman" and "Alat Kesehatan" categories.
   - These are non-obat categories, so requires_prescription is false.
   - Uses ON CONFLICT (barcode) DO NOTHING so re-running is safe.

2. Products added
   Minuman:
     - Air Mineral 600ml
     - Pocari Sweat 500ml
     - Bear Brand 189ml
   Alat Kesehatan:
     - Termometer Digital
     - Tensimeter Digital
     - Masker 3-ply (Box)
     - Alcohol Swab
     - Stetoskop

3. Security
   - No schema changes. All inserts go into existing `medicines` table.
   - RLS already enabled with anon+authenticated CRUD policies.
*/

INSERT INTO medicines (name, category, form, unit, barcode, sell_price, buy_price, stock, min_stock, requires_prescription, is_active, description)
VALUES
  -- Minuman
  ('Air Mineral 600ml', 'Minuman', 'Botol', 'btl', 'MIN-AM600', 4000, 2500, 100, 20, false, true, 'Air mineral 600ml'),
  ('Pocari Sweat 500ml', 'Minuman', 'Botol', 'btl', 'MIN-PS500', 8000, 5500, 60, 15, false, true, 'Pocari Sweat 500ml'),
  ('Bear Brand 189ml', 'Minuman', 'Kaleng', 'klg', 'MIN-BB189', 12000, 9000, 48, 12, false, true, 'Bear Brand 189ml'),
  -- Alat Kesehatan
  ('Termometer Digital', 'Alat Kesehatan', 'Unit', 'pcs', 'ALK-TD01', 85000, 60000, 20, 5, false, true, 'Termometer digital'),
  ('Tensimeter Digital', 'Alat Kesehatan', 'Unit', 'pcs', 'ALK-TD02', 350000, 280000, 10, 3, false, true, 'Tensimeter digital'),
  ('Masker 3-ply (Box)', 'Alat Kesehatan', 'Box', 'box', 'ALK-M3P', 45000, 30000, 50, 10, false, true, 'Masker 3-ply 1 box (50pcs)'),
  ('Alcohol Swab', 'Alat Kesehatan', 'Box', 'box', 'ALK-AS01', 18000, 12000, 40, 10, false, true, 'Alcohol swab'),
  ('Stetoskop', 'Alat Kesehatan', 'Unit', 'pcs', 'ALK-ST01', 120000, 90000, 8, 3, false, true, 'Stetoskop')
ON CONFLICT (barcode) DO NOTHING;
