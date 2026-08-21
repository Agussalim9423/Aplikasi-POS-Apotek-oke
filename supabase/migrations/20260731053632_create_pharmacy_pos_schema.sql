
/*
# Pharmacy POS Schema

Single-tenant pharmacy point-of-sale application (no auth required).
All tables are open to anon + authenticated roles via RLS.

1. Tables Created:
   - `settings` — store settings (name, address, phone, etc.)
   - `suppliers` — PBF/supplier data
   - `medicines` — medicine/drug catalog with stock tracking
   - `medicine_batches` — batch tracking per medicine (expiry, quantity)
   - `patients` — patient records
   - `doctors` — doctor records
   - `purchase_orders` — PO header to suppliers
   - `purchase_order_items` — PO line items
   - `goods_receipts` — goods receipt header
   - `goods_receipt_items` — goods receipt line items
   - `sales` — sales transaction header
   - `sale_items` — sale transaction line items

2. Security:
   - RLS enabled on all tables
   - anon + authenticated CRUD allowed (single-tenant, no login)
*/

-- Settings
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_settings" ON settings;
CREATE POLICY "anon_select_settings" ON settings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_settings" ON settings;
CREATE POLICY "anon_insert_settings" ON settings FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_settings" ON settings;
CREATE POLICY "anon_update_settings" ON settings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_settings" ON settings;
CREATE POLICY "anon_delete_settings" ON settings FOR DELETE TO anon, authenticated USING (true);

-- Seed default settings
INSERT INTO settings (key, value) VALUES
  ('pharmacy_name', 'Apotek Shanum Sehat'),
  ('pharmacy_address', 'Jl. Kesehatan No. 1, Jakarta'),
  ('pharmacy_phone', '021-1234567'),
  ('pharmacy_email', 'apotek@shanumsehat.com'),
  ('pharmacist_name', 'Apt. Ahmad Sehat, S.Farm'),
  ('sipa_number', 'SIPA-123/2024'),
  ('low_stock_threshold', '10'),
  ('expiry_warning_days', '90')
ON CONFLICT (key) DO NOTHING;

-- Suppliers / PBF
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE,
  address text,
  phone text,
  email text,
  contact_person text,
  npwp text,
  pbf_license text,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_suppliers" ON suppliers;
CREATE POLICY "anon_select_suppliers" ON suppliers FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_suppliers" ON suppliers;
CREATE POLICY "anon_insert_suppliers" ON suppliers FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_suppliers" ON suppliers;
CREATE POLICY "anon_update_suppliers" ON suppliers FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_suppliers" ON suppliers;
CREATE POLICY "anon_delete_suppliers" ON suppliers FOR DELETE TO anon, authenticated USING (true);

-- Seed suppliers
INSERT INTO suppliers (name, code, address, phone, email, contact_person) VALUES
  ('PT. Kimia Farma Trading & Distribution', 'KFTD', 'Jl. Raya Bogor Km 26, Jakarta Timur', '021-8710808', 'info@kftd.co.id', 'Budi Santoso'),
  ('PT. Enseval Putera Megatrading', 'EPM', 'Jl. Pulo Lentut No. 10, Jakarta Timur', '021-4602424', 'info@enseval.com', 'Sari Wulandari'),
  ('PT. Merapi Utama Pharma', 'MUP', 'Jl. Pemuda No. 5, Yogyakarta', '0274-512345', 'sales@merapi-pharma.com', 'Joko Susilo')
ON CONFLICT (code) DO NOTHING;

-- Doctors
CREATE TABLE IF NOT EXISTS doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  specialization text,
  sip_number text,
  phone text,
  email text,
  clinic text,
  address text,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_doctors" ON doctors;
CREATE POLICY "anon_select_doctors" ON doctors FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_doctors" ON doctors;
CREATE POLICY "anon_insert_doctors" ON doctors FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_doctors" ON doctors;
CREATE POLICY "anon_update_doctors" ON doctors FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_doctors" ON doctors;
CREATE POLICY "anon_delete_doctors" ON doctors FOR DELETE TO anon, authenticated USING (true);

INSERT INTO doctors (name, specialization, sip_number, phone, clinic) VALUES
  ('dr. Ahmad Hidayat', 'Umum', 'SIP-001/2024', '081234567890', 'Klinik Sehat Bersama'),
  ('dr. Siti Rahayu', 'Anak', 'SIP-002/2024', '081234567891', 'RS. Bunda'),
  ('dr. Budi Prasetyo', 'Penyakit Dalam', 'SIP-003/2024', '081234567892', 'Klinik Pratama')
ON CONFLICT DO NOTHING;

-- Patients
CREATE TABLE IF NOT EXISTS patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  date_of_birth date,
  gender text CHECK (gender IN ('L', 'P')),
  phone text,
  email text,
  address text,
  allergy text,
  bpjs_number text,
  nik text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_patients" ON patients;
CREATE POLICY "anon_select_patients" ON patients FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_patients" ON patients;
CREATE POLICY "anon_insert_patients" ON patients FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_patients" ON patients;
CREATE POLICY "anon_update_patients" ON patients FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_patients" ON patients;
CREATE POLICY "anon_delete_patients" ON patients FOR DELETE TO anon, authenticated USING (true);

INSERT INTO patients (name, date_of_birth, gender, phone, address) VALUES
  ('Budi Hartono', '1985-03-15', 'L', '081111111111', 'Jl. Melati No. 5, Jakarta'),
  ('Sari Indah', '1992-07-20', 'P', '082222222222', 'Jl. Mawar No. 10, Jakarta'),
  ('Ahmad Fauzi', '1978-11-05', 'L', '083333333333', 'Jl. Kenanga No. 3, Jakarta')
ON CONFLICT DO NOTHING;

-- Medicines
CREATE TABLE IF NOT EXISTS medicines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  generic_name text,
  category text,
  form text, -- tablet, kapsul, sirup, dll
  strength text, -- 500mg, 100ml, dll
  unit text NOT NULL DEFAULT 'tablet',
  barcode text UNIQUE,
  manufacturer text,
  supplier_id uuid REFERENCES suppliers(id),
  sell_price numeric(15,2) NOT NULL DEFAULT 0,
  buy_price numeric(15,2) NOT NULL DEFAULT 0,
  stock integer NOT NULL DEFAULT 0,
  min_stock integer NOT NULL DEFAULT 10,
  requires_prescription boolean NOT NULL DEFAULT false,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE medicines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_medicines" ON medicines;
CREATE POLICY "anon_select_medicines" ON medicines FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_medicines" ON medicines;
CREATE POLICY "anon_insert_medicines" ON medicines FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_medicines" ON medicines;
CREATE POLICY "anon_update_medicines" ON medicines FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_medicines" ON medicines;
CREATE POLICY "anon_delete_medicines" ON medicines FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines(name);
CREATE INDEX IF NOT EXISTS idx_medicines_category ON medicines(category);

INSERT INTO medicines (name, generic_name, category, form, strength, unit, manufacturer, sell_price, buy_price, stock, min_stock, requires_prescription) VALUES
  ('Paracetamol 500mg Tablet', 'Paracetamol', 'Analgesik', 'Tablet', '500mg', 'tablet', 'Kimia Farma', 500, 350, 200, 50, false),
  ('Amoxicillin 500mg Kapsul', 'Amoxicillin', 'Antibiotik', 'Kapsul', '500mg', 'kapsul', 'Indofarma', 2500, 1800, 150, 30, true),
  ('OBH Combi Sirup 100ml', 'Dextromethorphan', 'Batuk & Flu', 'Sirup', '100ml', 'botol', 'Combiphar', 25000, 18000, 0, 10, false),
  ('Mefenamic Acid 500mg Tablet', 'Asam Mefenamat', 'Analgesik', 'Tablet', '500mg', 'tablet', 'Kimia Farma', 1500, 1000, 32, 40, true),
  ('Codeine 15mg Tablet', 'Kodein', 'Analgesik Opioid', 'Tablet', '15mg', 'tablet', 'Indofarma', 5000, 3500, 80, 20, true),
  ('Lansoprazole 30mg Kapsul', 'Lansoprazole', 'Antasida', 'Kapsul', '30mg', 'kapsul', 'Dexa Medica', 3500, 2500, 60, 15, true),
  ('Omeprazole 20mg Kapsul', 'Omeprazole', 'Antasida', 'Kapsul', '20mg', 'kapsul', 'Sanbe Farma', 3000, 2000, 90, 20, false),
  ('Cetirizine 10mg Tablet', 'Cetirizine', 'Antihistamin', 'Tablet', '10mg', 'tablet', 'Hexpharm', 2000, 1400, 120, 30, false),
  ('Metformin 500mg Tablet', 'Metformin', 'Antidiabetes', 'Tablet', '500mg', 'tablet', 'Kimia Farma', 1200, 800, 75, 25, true)
ON CONFLICT DO NOTHING;

-- Medicine Batches
CREATE TABLE IF NOT EXISTS medicine_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_id uuid NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  batch_number text NOT NULL,
  expiry_date date NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  buy_price numeric(15,2),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(medicine_id, batch_number)
);

ALTER TABLE medicine_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_batches" ON medicine_batches;
CREATE POLICY "anon_select_batches" ON medicine_batches FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_batches" ON medicine_batches;
CREATE POLICY "anon_insert_batches" ON medicine_batches FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_batches" ON medicine_batches;
CREATE POLICY "anon_update_batches" ON medicine_batches FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_batches" ON medicine_batches;
CREATE POLICY "anon_delete_batches" ON medicine_batches FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_batches_medicine ON medicine_batches(medicine_id);
CREATE INDEX IF NOT EXISTS idx_batches_expiry ON medicine_batches(expiry_date);

-- Seed batches with near-expiry dates for demo
INSERT INTO medicine_batches (medicine_id, batch_number, expiry_date, quantity, buy_price)
SELECT id, 'BCOD7547', (now() + interval '59 days')::date, 80, 3500 FROM medicines WHERE name LIKE 'Codeine%' ON CONFLICT DO NOTHING;
INSERT INTO medicine_batches (medicine_id, batch_number, expiry_date, quantity, buy_price)
SELECT id, 'BMEF6738', (now() + interval '59 days')::date, 32, 1000 FROM medicines WHERE name LIKE 'Mefenamic%' ON CONFLICT DO NOTHING;
INSERT INTO medicine_batches (medicine_id, batch_number, expiry_date, quantity, buy_price)
SELECT id, '123456', (now() + interval '60 days')::date, 60, 2500 FROM medicines WHERE name LIKE 'Lansoprazole%' ON CONFLICT DO NOTHING;
INSERT INTO medicine_batches (medicine_id, batch_number, expiry_date, quantity, buy_price)
SELECT id, 'BOME2827', (now() + interval '89 days')::date, 90, 2000 FROM medicines WHERE name LIKE 'Omeprazole%' ON CONFLICT DO NOTHING;
INSERT INTO medicine_batches (medicine_id, batch_number, expiry_date, quantity, buy_price)
SELECT id, 'BPCT001', (now() + interval '365 days')::date, 200, 350 FROM medicines WHERE name LIKE 'Paracetamol%' ON CONFLICT DO NOTHING;
INSERT INTO medicine_batches (medicine_id, batch_number, expiry_date, quantity, buy_price)
SELECT id, 'BAMX001', (now() + interval '300 days')::date, 150, 1800 FROM medicines WHERE name LIKE 'Amoxicillin%' ON CONFLICT DO NOTHING;

-- Purchase Orders
CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number text UNIQUE NOT NULL,
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  expected_date date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'partial', 'received', 'cancelled')),
  total_amount numeric(15,2) DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_po" ON purchase_orders;
CREATE POLICY "anon_select_po" ON purchase_orders FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_po" ON purchase_orders;
CREATE POLICY "anon_insert_po" ON purchase_orders FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_po" ON purchase_orders;
CREATE POLICY "anon_update_po" ON purchase_orders FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_po" ON purchase_orders;
CREATE POLICY "anon_delete_po" ON purchase_orders FOR DELETE TO anon, authenticated USING (true);

-- Purchase Order Items
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  medicine_id uuid NOT NULL REFERENCES medicines(id),
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(15,2) NOT NULL DEFAULT 0,
  total_price numeric(15,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_poi" ON purchase_order_items;
CREATE POLICY "anon_select_poi" ON purchase_order_items FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_poi" ON purchase_order_items;
CREATE POLICY "anon_insert_poi" ON purchase_order_items FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_poi" ON purchase_order_items;
CREATE POLICY "anon_update_poi" ON purchase_order_items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_poi" ON purchase_order_items;
CREATE POLICY "anon_delete_poi" ON purchase_order_items FOR DELETE TO anon, authenticated USING (true);

-- Goods Receipts
CREATE TABLE IF NOT EXISTS goods_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number text UNIQUE NOT NULL,
  purchase_order_id uuid REFERENCES purchase_orders(id),
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  receipt_date date NOT NULL DEFAULT CURRENT_DATE,
  invoice_number text,
  total_amount numeric(15,2) DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'cancelled')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE goods_receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_gr" ON goods_receipts;
CREATE POLICY "anon_select_gr" ON goods_receipts FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_gr" ON goods_receipts;
CREATE POLICY "anon_insert_gr" ON goods_receipts FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_gr" ON goods_receipts;
CREATE POLICY "anon_update_gr" ON goods_receipts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_gr" ON goods_receipts;
CREATE POLICY "anon_delete_gr" ON goods_receipts FOR DELETE TO anon, authenticated USING (true);

-- Goods Receipt Items
CREATE TABLE IF NOT EXISTS goods_receipt_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goods_receipt_id uuid NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
  medicine_id uuid NOT NULL REFERENCES medicines(id),
  batch_number text NOT NULL,
  expiry_date date NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(15,2) NOT NULL DEFAULT 0,
  total_price numeric(15,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE goods_receipt_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_gri" ON goods_receipt_items;
CREATE POLICY "anon_select_gri" ON goods_receipt_items FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_gri" ON goods_receipt_items;
CREATE POLICY "anon_insert_gri" ON goods_receipt_items FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_gri" ON goods_receipt_items;
CREATE POLICY "anon_update_gri" ON goods_receipt_items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_gri" ON goods_receipt_items;
CREATE POLICY "anon_delete_gri" ON goods_receipt_items FOR DELETE TO anon, authenticated USING (true);

-- Sales
CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL,
  sale_date timestamptz NOT NULL DEFAULT now(),
  patient_id uuid REFERENCES patients(id),
  doctor_id uuid REFERENCES doctors(id),
  patient_name text,
  payment_method text NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'debit', 'kredit', 'bpjs', 'transfer')),
  subtotal numeric(15,2) NOT NULL DEFAULT 0,
  discount numeric(15,2) NOT NULL DEFAULT 0,
  total numeric(15,2) NOT NULL DEFAULT 0,
  paid_amount numeric(15,2) NOT NULL DEFAULT 0,
  change_amount numeric(15,2) NOT NULL DEFAULT 0,
  notes text,
  cashier_name text DEFAULT 'Kasir',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_sales" ON sales;
CREATE POLICY "anon_select_sales" ON sales FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_sales" ON sales;
CREATE POLICY "anon_insert_sales" ON sales FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_sales" ON sales;
CREATE POLICY "anon_update_sales" ON sales FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_sales" ON sales;
CREATE POLICY "anon_delete_sales" ON sales FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);

-- Sale Items
CREATE TABLE IF NOT EXISTS sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  medicine_id uuid NOT NULL REFERENCES medicines(id),
  medicine_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(15,2) NOT NULL DEFAULT 0,
  discount numeric(15,2) NOT NULL DEFAULT 0,
  total_price numeric(15,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_si" ON sale_items;
CREATE POLICY "anon_select_si" ON sale_items FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_si" ON sale_items;
CREATE POLICY "anon_insert_si" ON sale_items FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_si" ON sale_items;
CREATE POLICY "anon_update_si" ON sale_items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_si" ON sale_items;
CREATE POLICY "anon_delete_si" ON sale_items FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
