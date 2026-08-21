import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
  global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }) },
});

const TENANT_TABLES = new Set([
  'settings', 'suppliers', 'medicines', 'medicine_batches', 'patients', 'doctors',
  'purchase_orders', 'purchase_order_items', 'goods_receipts', 'goods_receipt_items',
  'sales', 'sale_items', 'medicine_units', 'app_users', 'operational_expenses',
]);

function getTenantId(): string | null {
  try {
    const session = localStorage.getItem('apotek_auth_session');
    if (!session) return null;
    const profile = JSON.parse(session) as { tenant_id?: string | null };
    return profile.tenant_id ?? null;
  } catch {
    return null;
  }
}

export function tenantFrom(table: string): any {
  const tenantId = getTenantId();
  const shouldScope = TENANT_TABLES.has(table) && Boolean(tenantId);
  const source = supabase.from(table);
  const wrap = (builder: any): any => new Proxy(builder, {
    get(target: any, property: string | symbol) {
      if (property === 'then') return target.then.bind(target);
      const method = target[property];
      if (typeof method !== 'function') return method;
      return (...args: any[]) => {
        let nextArgs = args;
        if (property === 'insert' || property === 'upsert') {
          const value = args[0];
          const addTenant = (row: Record<string, unknown>) => shouldScope && !row.tenant_id ? { ...row, tenant_id: tenantId } : row;
          nextArgs = [Array.isArray(value) ? value.map(addTenant) : addTenant(value), ...args.slice(1)];
        }
        const next = method.apply(target, nextArgs);
        if (shouldScope && (property === 'select' || property === 'update' || property === 'delete' || property === 'upsert')) {
          return wrap(next.eq('tenant_id', tenantId));
        }
        return wrap(next);
      };
    },
  });
  return wrap(source);
}

export type Medicine = {
  id: string;
  name: string;
  generic_name: string | null;
  category: string | null;
  form: string | null;
  strength: string | null;
  unit: string;
  pieces_per_strip: number;
  barcode: string | null;
  manufacturer: string | null;
  supplier_id: string | null;
  sell_price: number;
  price_regular: number;
  price_prescription: number;
  price_doctor: number;
  buy_price: number;
  stock: number;
  min_stock: number;
  requires_prescription: boolean;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type MedicineBatch = {
  id: string;
  medicine_id: string;
  batch_number: string;
  expiry_date: string;
  quantity: number;
  stock_quantity: number;
  buy_price: number | null;
  created_at: string;
};

export type MedicineUnit = {
  id: string;
  medicine_id: string;
  tenant_id: string | null;
  unit_name: string;
  conversion_factor: number;
  price_regular: number;
  price_prescription: number;
  price_doctor: number;
  is_base_unit: boolean;
  created_at: string;
};

export type Supplier = {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  contact_person: string | null;
  npwp: string | null;
  pbf_license: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
};

export type Patient = {
  id: string;
  name: string;
  date_of_birth: string | null;
  gender: 'L' | 'P' | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  allergy: string | null;
  bpjs_number: string | null;
  nik: string | null;
  notes: string | null;
  created_at: string;
};

export type Doctor = {
  id: string;
  name: string;
  specialization: string | null;
  sip_number: string | null;
  phone: string | null;
  email: string | null;
  clinic: string | null;
  address: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
};

export type PurchaseOrder = {
  id: string;
  po_number: string;
  supplier_id: string;
  order_date: string;
  order_date_manual: string | null;
  sp_type: string;
  expected_date: string | null;
  status: 'draft' | 'sent' | 'partial' | 'received' | 'cancelled';
  total_amount: number;
  notes: string | null;
  created_at: string;
  suppliers?: Supplier;
};

export type PurchaseOrderItem = {
  id: string;
  purchase_order_id: string;
  medicine_id: string;
  quantity: number;
  unit: string | null;
  unit_price: number;
  total_price: number;
  notes: string | null;
  medicines?: Medicine;
};

export type GoodsReceipt = {
  id: string;
  receipt_number: string;
  purchase_order_id: string | null;
  supplier_id: string;
  receipt_date: string;
  invoice_number: string | null;
  total_amount: number;
  status: 'pending' | 'verified' | 'cancelled';
  notes: string | null;
  package_condition: string | null;
  created_at: string;
  suppliers?: Supplier;
};

export type GoodsReceiptItem = {
  id: string;
  goods_receipt_id: string;
  medicine_id: string;
  batch_number: string;
  expiry_date: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  discount: number;
  tax: number;
  cost_price: number;
  sell_price: number;
  discount_percent: number;
  tax_percent: number;
  medicines?: Medicine;
};

export type Sale = {
  id: string;
  invoice_number: string;
  sale_date: string;
  patient_id: string | null;
  doctor_id: string | null;
  patient_name: string | null;
  payment_method: 'cash' | 'debit' | 'kredit' | 'bpjs' | 'transfer';
  sale_type: 'regular' | 'prescription' | 'doctor';
  subtotal: number;
  discount: number;
  total: number;
  paid_amount: number;
  change_amount: number;
  notes: string | null;
  cashier_name: string | null;
  created_at: string;
  patients?: Patient;
  doctors?: Doctor;
};

export type SaleItem = {
  id: string;
  sale_id: string;
  medicine_id: string;
  medicine_name: string;
  quantity: number;
  unit_price: number;
  cost_price: number;
  discount: number;
  total_price: number;
  batch_id: string | null;
  unit_id: string | null;
  unit_name: string | null;
  conversion_factor: number;
};

export type OperationalExpense = {
  id: string;
  tenant_id: string | null;
  category: string;
  description: string | null;
  amount: number;
  expense_date: string;
  created_at: string;
};

export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

export const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

export const generateInvoiceNumber = () => {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `INV${y}${m}${d}-${rand}`;
};

export const generatePONumber = () => {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `PO${y}${m}-${rand}`;
};

export const generateReceiptNumber = () => {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `GR${y}${m}-${rand}`;
};

export const generateBarcode = () => {
  const ts = Date.now().toString(36).toUpperCase().slice(-6);
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `AP${ts}${rand}`;
};
