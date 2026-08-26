import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL;

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: false,
    },

    global: {
      fetch: (
        input,
        init,
      ) =>
        fetch(input, {
          ...init,
          signal:
            AbortSignal.timeout(
              15000,
            ),
        }),
    },
  },
);

/*
 * Semua tabel yang wajib
 * dipisahkan berdasarkan tenant.
 */
const TENANT_TABLES =
  new Set([
    'settings',
    'suppliers',
    'medicines',
    'medicine_batches',
    'patients',
    'doctors',
    'purchase_orders',
    'purchase_order_items',
    'goods_receipts',
    'goods_receipt_items',
    'sales',
    'sale_items',
    'medicine_units',
    'app_users',
    'operational_expenses',
  ]);

/*
 * Mengambil tenant_id dari session.
 *
 * Mendukung beberapa struktur session:
 *
 * {
 *   tenant_id: "..."
 * }
 *
 * atau:
 *
 * {
 *   tenant: {
 *     id: "..."
 *   }
 * }
 */
export function getTenantId():
  | string
  | null {
  try {
    const session =
      localStorage.getItem(
        'apotek_auth_session',
      );

    if (!session) {
      return null;
    }

    const profile =
      JSON.parse(session);

    const tenantId =
      profile?.tenant_id ??
      profile?.tenant?.id ??
      null;

    if (
      !tenantId ||
      typeof tenantId !==
        'string'
    ) {
      return null;
    }

    return tenantId;
  } catch (error) {
    console.error(
      'Gagal membaca tenant dari session:',
      error,
    );

    return null;
  }
}

/*
 * Mengambil tenant_id wajib
 * untuk tabel yang menggunakan
 * sistem multi-tenant.
 */
function getRequiredTenantId(
  table: string,
): string | null {
  if (
    !TENANT_TABLES.has(
      table,
    )
  ) {
    return null;
  }

  const tenantId =
    getTenantId();

  if (!tenantId) {
    throw new Error(
      `Tenant ID tidak ditemukan untuk tabel "${table}". Silakan logout lalu login kembali.`,
    );
  }

  return tenantId;
}

/*
 * Menambahkan tenant_id secara
 * otomatis pada INSERT / UPSERT.
 */
function addTenantId(
  value: any,
  tenantId: string | null,
) {
  if (!tenantId) {
    return value;
  }

  if (
    Array.isArray(
      value,
    )
  ) {
    return value.map(
      row => ({
        ...row,
        tenant_id:
          row?.tenant_id ??
          tenantId,
      }),
    );
  }

  return {
    ...value,
    tenant_id:
      value?.tenant_id ??
      tenantId,
  };
}

/*
 * Wrapper utama Supabase
 * untuk tabel multi-tenant.
 *
 * Fungsi ini:
 *
 * 1. SELECT
 *    otomatis filter tenant_id.
 *
 * 2. INSERT
 *    otomatis menambahkan tenant_id.
 *
 * 3. UPSERT
 *    otomatis menambahkan tenant_id
 *    dan memastikan conflict tetap
 *    berada pada tenant yang aktif.
 *
 * 4. UPDATE
 *    hanya bisa mengubah data
 *    milik tenant aktif.
 *
 * 5. DELETE
 *    hanya bisa menghapus data
 *    milik tenant aktif.
 */
export function tenantFrom(
  table: string,
): any {
  const isTenantTable =
    TENANT_TABLES.has(
      table,
    );

  const tenantId =
    isTenantTable
      ? getRequiredTenantId(
          table,
        )
      : null;

  const source =
    supabase.from(
      table,
    );

  /*
   * applyTenantFilter()
   *
   * Filter tenant_id hanya
   * ditambahkan satu kali.
   */
  const applyTenantFilter = (
    query: any,
    tenantApplied: boolean,
  ) => {
    if (
      !isTenantTable ||
      !tenantId ||
      tenantApplied
    ) {
      return {
        query,
        tenantApplied,
      };
    }

    return {
      query: query.eq(
        'tenant_id',
        tenantId,
      ),

      tenantApplied: true,
    };
  };

  const wrap = (
    builder: any,
    tenantApplied = false,
  ): any =>
    new Proxy(
      builder,
      {
        get(
          target: any,
          property:
            | string
            | symbol,
        ) {
          /*
           * Promise support.
           */
          if (
            property === 'then'
          ) {
            return target.then.bind(
              target,
            );
          }

          if (
            property === 'catch'
          ) {
            return target.catch?.bind(
              target,
            );
          }

          if (
            property === 'finally'
          ) {
            return target.finally?.bind(
              target,
            );
          }

          const method =
            target[property];

          if (
            typeof method !==
            'function'
          ) {
            return method;
          }

          return (
            ...args: any[]
          ) => {
            let nextArgs =
              args;

            /*
             * INSERT
             *
             * tenant_id selalu
             * ditambahkan otomatis.
             */
            if (
              isTenantTable &&
              property ===
                'insert'
            ) {
              nextArgs = [
                addTenantId(
                  args[0],
                  tenantId,
                ),

                ...args.slice(
                  1,
                ),
              ];
            }

            /*
             * UPSERT
             *
             * tenant_id selalu
             * ditambahkan otomatis.
             */
            if (
              isTenantTable &&
              property ===
                'upsert'
            ) {
              nextArgs = [
                addTenantId(
                  args[0],
                  tenantId,
                ),

                ...args.slice(
                  1,
                ),
              ];
            }

            /*
             * Jalankan method asli.
             */
            let next =
              method.apply(
                target,
                nextArgs,
              );

            let nextTenantApplied =
              tenantApplied;

            /*
             * Method awal yang
             * membutuhkan tenant filter.
             *
             * SELECT
             * UPDATE
             * DELETE
             *
             * UPSERT tidak diberi
             * .eq() karena Supabase
             * insert/upsert builder
             * tidak selalu mendukung
             * filter seperti query update.
             *
             * tenant_id sudah dimasukkan
             * langsung ke data UPSERT.
             */
            if (
              isTenantTable &&
              tenantId &&
              !tenantApplied &&
              (
                property ===
                  'select' ||
                property ===
                  'update' ||
                property ===
                  'delete'
              )
            ) {
              const filtered =
                applyTenantFilter(
                  next,
                  false,
                );

              next =
                filtered.query;

              nextTenantApplied =
                filtered.tenantApplied;
            }

            /*
             * Jika method berikutnya
             * menghasilkan query builder,
             * terus bungkus agar chain
             * tetap bisa digunakan.
             */
            return wrap(
              next,
              nextTenantApplied,
            );
          };
        },
      },
    );

  return wrap(
    source,
  );
}

/* =========================
   TYPES
========================= */

export type Medicine = {
  id: string;

  tenant_id?: string | null;

  name: string;

  generic_name:
    | string
    | null;

  category:
    | string
    | null;

  form:
    | string
    | null;

  strength:
    | string
    | null;

  unit: string;

  pieces_per_strip: number;

  barcode:
    | string
    | null;

  manufacturer:
    | string
    | null;

  supplier_id:
    | string
    | null;

  sell_price: number;

  price_regular: number;

  price_prescription: number;

  price_doctor: number;

  buy_price: number;

  stock: number;

  min_stock: number;

  requires_prescription: boolean;

  description:
    | string
    | null;

  is_active: boolean;

  created_at: string;

  updated_at: string;
};

export type MedicineBatch = {
  id: string;

  tenant_id?: string | null;

  medicine_id: string;

  batch_number: string;

  expiry_date: string;

  quantity: number;

  stock_quantity: number;

  buy_price:
    | number
    | null;

  created_at: string;
};

export type MedicineUnit = {
  id: string;

  medicine_id: string;

  tenant_id:
    | string
    | null;

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

  tenant_id?: string | null;

  name: string;

  code:
    | string
    | null;

  address:
    | string
    | null;

  phone:
    | string
    | null;

  email:
    | string
    | null;

  contact_person:
    | string
    | null;

  npwp:
    | string
    | null;

  pbf_license:
    | string
    | null;

  is_active: boolean;

  notes:
    | string
    | null;

  created_at: string;
};

export type Patient = {
  id: string;

  tenant_id?: string | null;

  name: string;

  date_of_birth:
    | string
    | null;

  gender:
    | 'L'
    | 'P'
    | null;

  phone:
    | string
    | null;

  email:
    | string
    | null;

  address:
    | string
    | null;

  allergy:
    | string
    | null;

  bpjs_number:
    | string
    | null;

  nik:
    | string
    | null;

  notes:
    | string
    | null;

  created_at: string;
};

export type Doctor = {
  id: string;

  tenant_id?: string | null;

  name: string;

  specialization:
    | string
    | null;

  sip_number:
    | string
    | null;

  phone:
    | string
    | null;

  email:
    | string
    | null;

  clinic:
    | string
    | null;

  address:
    | string
    | null;

  is_active: boolean;

  notes:
    | string
    | null;

  created_at: string;
};

export type PurchaseOrder = {
  id: string;

  tenant_id?: string | null;

  po_number: string;

  supplier_id: string;

  order_date: string;

  order_date_manual:
    | string
    | null;

  sp_type: string;

  expected_date:
    | string
    | null;

  status:
    | 'draft'
    | 'sent'
    | 'partial'
    | 'received'
    | 'cancelled';

  total_amount: number;

  notes:
    | string
    | null;

  created_at: string;

  suppliers?: Supplier;
};

export type PurchaseOrderItem = {
  id: string;

  tenant_id?: string | null;

  purchase_order_id: string;

  medicine_id: string;

  quantity: number;

  unit:
    | string
    | null;

  unit_price: number;

  total_price: number;

  notes:
    | string
    | null;

  medicines?: Medicine;
};

export type GoodsReceipt = {
  id: string;

  tenant_id?: string | null;

  receipt_number: string;

  purchase_order_id:
    | string
    | null;

  supplier_id: string;

  receipt_date: string;

  invoice_number:
    | string
    | null;

  total_amount: number;

  status:
    | 'pending'
    | 'verified'
    | 'cancelled';

  notes:
    | string
    | null;

  package_condition:
    | string
    | null;

  created_at: string;

  suppliers?: Supplier;
};

export type GoodsReceiptItem = {
  id: string;

  tenant_id?: string | null;

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

  tenant_id?: string | null;

  invoice_number: string;

  sale_date: string;

  patient_id:
    | string
    | null;

  doctor_id:
    | string
    | null;

  patient_name:
    | string
    | null;

  payment_method:
    | 'cash'
    | 'debit'
    | 'kredit'
    | 'bpjs'
    | 'transfer';

  sale_type:
    | 'regular'
    | 'prescription'
    | 'doctor';

  subtotal: number;

  discount: number;

  total: number;

  paid_amount: number;

  change_amount: number;

  notes:
    | string
    | null;

  cashier_name:
    | string
    | null;

  created_at: string;

  patients?: Patient;

  doctors?: Doctor;
};

export type SaleItem = {
  id: string;

  tenant_id?: string | null;

  sale_id: string;

  medicine_id: string;

  medicine_name: string;

  quantity: number;

  unit_price: number;

  cost_price: number;

  discount: number;

  total_price: number;

  batch_id:
    | string
    | null;

  unit_id:
    | string
    | null;

  unit_name:
    | string
    | null;

  conversion_factor: number;
};

export type OperationalExpense = {
  id: string;

  tenant_id:
    | string
    | null;

  category: string;

  description:
    | string
    | null;

  amount: number;

  expense_date: string;

  created_at: string;
};

/* =========================
   FORMATTERS
========================= */

export const formatCurrency = (
  amount: number,
) =>
  new Intl.NumberFormat(
    'id-ID',
    {
      style: 'currency',

      currency: 'IDR',

      minimumFractionDigits: 0,
    },
  ).format(
    Number(amount) || 0,
  );

export const formatDate = (
  dateStr: string,
) => {
  if (!dateStr) {
    return '-';
  }

  const date =
    new Date(dateStr);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return '-';
  }

  return date.toLocaleDateString(
    'id-ID',
    {
      day: '2-digit',

      month: 'short',

      year: 'numeric',
    },
  );
};

/* =========================
   NUMBER GENERATORS
========================= */

export const generateInvoiceNumber =
  () => {
    const now =
      new Date();

    const y = now
      .getFullYear()
      .toString()
      .slice(-2);

    const m =
      String(
        now.getMonth() +
          1,
      ).padStart(
        2,
        '0',
      );

    const d =
      String(
        now.getDate(),
      ).padStart(
        2,
        '0',
      );

    const rand =
      Math.floor(
        Math.random() *
          9000,
      ) + 1000;

    return `INV${y}${m}${d}-${rand}`;
  };

export const generatePONumber =
  () => {
    const now =
      new Date();

    const y = now
      .getFullYear()
      .toString()
      .slice(-2);

    const m =
      String(
        now.getMonth() +
          1,
      ).padStart(
        2,
        '0',
      );

    const rand =
      Math.floor(
        Math.random() *
          9000,
      ) + 1000;

    return `PO${y}${m}-${rand}`;
  };

export const generateReceiptNumber =
  () => {
    const now =
      new Date();

    const y = now
      .getFullYear()
      .toString()
      .slice(-2);

    const m =
      String(
        now.getMonth() +
          1,
      ).padStart(
        2,
        '0',
      );

    const rand =
      Math.floor(
        Math.random() *
          9000,
      ) + 1000;

    return `GR${y}${m}-${rand}`;
  };

export const generateBarcode =
  () => {
    const timestamp =
      Date.now()
        .toString(36)
        .toUpperCase()
        .slice(-6);

    const random =
      Math.floor(
        Math.random() *
          9000,
      ) + 1000;

    return `AP${timestamp}${random}`;
  };