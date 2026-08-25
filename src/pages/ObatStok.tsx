import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { tenantFrom, formatCurrency, formatDate, generateBarcode } from '@/lib/supabase';
import type { Medicine, MedicineBatch, MedicineUnit, Supplier } from '@/lib/supabase';
import BarcodeScanner from '@/components/BarcodeScanner';
import BarcodeLabel from '@/components/BarcodeLabel';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  AlertTriangle,
  Clock,
  Package,
  Filter,
  ChevronDown,
  Printer,
  ScanLine,
  Barcode,
  Download,
  Upload,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

type BatchWithMed = MedicineBatch & { medicines: Medicine | null };

type ImportRow = {
  rowNumber: number;
  name: string;
  generic_name: string;
  category: string;
  form: string;
  strength: string;
  unit: string;
  pieces_per_strip: number;
  barcode: string;
  manufacturer: string;
  buy_price: number;
  price_regular: number;
  price_prescription: number;
  price_doctor: number;
  stock: number;
  min_stock: number;
  requires_prescription: boolean;
  description: string;
  status: 'valid' | 'warning' | 'error';
  message: string;
};

const CATEGORIES = [
  'Obat Bebas',
  'Obat Bebas Terbatas',
  'Obat Keras',
  'Obat Narkotika',
  'Obat Herbal',
  'Suplemen',
  'Minuman',
  'Alat Kesehatan',
  'Lainnya',
];

const NON_OBAT_CATEGORIES = [
  'Minuman',
  'Alat Kesehatan',
  'Lainnya',
];

const PACKAGING_UNITS = [
  'Botol',
  'Strip',
  'Box',
  'Tube',
  'Tablet',
  'Kapsul',
  'Ampul',
  'Vial',
  'Sachet',
  'Pcs',
  'Roll',
];

function databaseMessage(error: unknown): string {
  if (error instanceof Error) return error.message;

  if (typeof error === 'object' && error !== null) {
    const databaseError = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };

    return [
      databaseError.message,
      databaseError.details,
      databaseError.hint,
      databaseError.code ? `Kode ${databaseError.code}` : '',
    ]
      .filter(Boolean)
      .join(' | ') || JSON.stringify(error);
  }

  return String(error);
}

function parsePrice(value: number | string | null | undefined): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  }

  const raw = String(value ?? '').trim();

  if (!raw) return 0;

  const cleaned = raw
    .replace(/Rp/gi, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '');

  const parsed = Number(cleaned);

  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function parseNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }

  const raw = String(value ?? '').trim();

  if (!raw) return fallback;

  const cleaned = raw
    .replace(/[^0-9,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');

  const parsed = Number(cleaned);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolean(value: unknown): boolean {
  const text = String(value ?? '')
    .trim()
    .toLowerCase();

  return [
    'ya',
    'yes',
    'true',
    '1',
    'y',
  ].includes(text);
}

function normalizeKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ');
}

function getRowValue(
  row: Record<string, unknown>,
  aliases: string[],
): unknown {
  const entries = Object.entries(row);

  for (const alias of aliases) {
    const normalizedAlias = normalizeKey(alias);

    const found = entries.find(
      ([key]) => normalizeKey(key) === normalizedAlias,
    );

    if (found) return found[1];
  }

  return '';
}

function isMissingSchemaField(
  error: unknown,
  field: string,
): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const databaseError = error as {
    code?: string;
    message?: string;
  };

  const message = databaseError.message?.toLowerCase() ?? '';

  return (
    databaseError.code === '42703' ||
    (databaseError.code === 'PGRST204' &&
      message.includes(field.toLowerCase())) ||
    message.includes(field.toLowerCase())
  );
}

function isMissingUnitsTable(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const databaseError = error as {
    code?: string;
    message?: string;
  };

  return (
    databaseError.code === 'PGRST205' ||
    databaseError.code === '42P01' ||
    (databaseError.message
      ?.toLowerCase()
      .includes('medicine_units') ??
      false)
  );
}

function printStockOpname(meds: Medicine[]) {
  const now = new Date();

  const dateStr = now.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const rows = meds
    .map(
      (m, i) => `
    <tr>
      <td style="text-align:center;">${i + 1}</td>
      <td>${m.name}</td>
      <td style="text-align:center;">${m.category ?? '-'}</td>
      <td style="text-align:center;">${m.unit}</td>
      <td style="text-align:center;">${m.stock}</td>
      <td style="text-align:center;">${m.min_stock}</td>
      <td></td>
      <td></td>
    </tr>`,
    )
    .join('');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Stok Opname</title>
<style>
  * {
    font-family: 'Times New Roman', serif;
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    padding: 20px;
  }

  h2 {
    text-align: center;
    margin-bottom: 4px;
  }

  .subtitle {
    text-align: center;
    font-size: 13px;
    margin-bottom: 16px;
  }

  th, td {
    border: 1px solid #000;
    padding: 5px 8px;
  }

  th {
    background: #f0f0f0;
    font-weight: bold;
  }

  .sign {
    margin-top: 28px;
    display: flex;
    justify-content: flex-end;
    font-size: 13px;
  }

  .sign-box {
    text-align: center;
  }

  .sign-name {
    font-weight: bold;
    margin-top: 48px;
  }

  @media print {
    body {
      padding: 10px;
    }
  }
</style>
</head>

<body>
  <h2>LAPORAN STOK OPNAME</h2>

  <div class="subtitle">
    Tanggal: ${dateStr}
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:30px;">No</th>
        <th>Nama Obat</th>
        <th style="width:120px;">Kategori</th>
        <th style="width:60px;">Satuan</th>
        <th style="width:70px;">Stok Sistem</th>
        <th style="width:70px;">Min. Stok</th>
        <th style="width:80px;">Stok Fisik</th>
        <th style="width:80px;">Selisih</th>
      </tr>
    </thead>

    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="sign">
    <div class="sign-box">
      <div>Petugas,</div>
      <div class="sign-name">
        (________________)
      </div>
    </div>
  </div>
</body>
</html>`;

  const iframe = document.createElement('iframe');

  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;

  if (!doc) return;

  doc.open();
  doc.write(html);
  doc.close();

  iframe.contentWindow?.focus();

  setTimeout(() => {
    iframe.contentWindow?.print();

    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }, 300);
}

export default function ObatStok() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [batches, setBatches] = useState<BatchWithMed[]>([]);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);

  const [stockFilter, setStockFilter] = useState<
    'all' | 'low' | 'out'
  >('all');

  const [showCatDropdown, setShowCatDropdown] =
    useState(false);

  const [showForm, setShowForm] = useState(false);

  const [editing, setEditing] =
    useState<Medicine | null>(null);

  const [showBatches, setShowBatches] =
    useState<Medicine | null>(null);

  const [showBarcodeLabel, setShowBarcodeLabel] =
    useState<Medicine | null>(null);

  const [showScanner, setShowScanner] =
    useState(false);

  const [stockEditMed, setStockEditMed] =
    useState<Medicine | null>(null);

  const [stockEditQty, setStockEditQty] =
    useState(0);

  const [loading, setLoading] =
    useState(true);

  const [showImport, setShowImport] =
    useState(false);

  const [importRows, setImportRows] =
    useState<ImportRow[]>([]);

  const [importing, setImporting] =
    useState(false);

  const [importProgress, setImportProgress] =
    useState(0);

  const [importMode, setImportMode] =
    useState<'skip' | 'update'>('skip');

  const [importFileName, setImportFileName] =
    useState('');

  const fileInputRef =
    useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  /*
   * Supabase/PostgREST dapat mengembalikan maksimal 1000 baris untuk
   * satu request. Karena sebelumnya halaman ini melakukan satu select()
   * tanpa pagination, daftar obat berhenti pada 1000 jenis.
   *
   * Semua data sekarang diambil bertahap per 1000 baris sampai halaman
   * terakhir, sehingga jumlah jenis obat tidak dibatasi 1000.
   */
  async function loadData() {
    setLoading(true);

    const pageSize = 1000;

    async function loadAllMedicines(): Promise<Medicine[]> {
      const all: Medicine[] = [];
      let from = 0;

      while (true) {
        const { data, error } = await tenantFrom('medicines')
          .select('*')
          .eq('is_active', true)
          .order('name')
          .range(from, from + pageSize - 1);

        if (error) throw error;

        const page = (data ?? []) as Medicine[];
        all.push(...page);

        if (page.length < pageSize) break;
        from += pageSize;
      }

      return all;
    }

    async function loadAllSuppliers(): Promise<Supplier[]> {
      const all: Supplier[] = [];
      let from = 0;

      while (true) {
        const { data, error } = await tenantFrom('suppliers')
          .select('*')
          .eq('is_active', true)
          .order('name')
          .range(from, from + pageSize - 1);

        if (error) throw error;

        const page = (data ?? []) as Supplier[];
        all.push(...page);

        if (page.length < pageSize) break;
        from += pageSize;
      }

      return all;
    }

    async function loadAllBatches(): Promise<BatchWithMed[]> {
      const all: BatchWithMed[] = [];
      let from = 0;

      while (true) {
        const { data, error } = await tenantFrom('medicine_batches')
          .select('*, medicines(*)')
          .order('expiry_date')
          .range(from, from + pageSize - 1);

        if (error) throw error;

        const page = (data ?? []) as BatchWithMed[];
        all.push(...page);

        if (page.length < pageSize) break;
        from += pageSize;
      }

      return all;
    }

    try {
      const [allMedicines, allSuppliers, allBatches] =
        await Promise.all([
          loadAllMedicines(),
          loadAllSuppliers(),
          loadAllBatches(),
        ]);

      setMedicines(allMedicines);
      setSuppliers(allSuppliers);
      setBatches(allBatches);
    } catch (error) {
      console.error('Gagal memuat data obat:', error);
      alert(`Gagal memuat data: ${databaseMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }

  const filtered = medicines.filter(m => {
    const matchSearch =
      m.name
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      (m.generic_name ?? '')
        .toLowerCase()
        .includes(search.toLowerCase());

    const matchCat =
      categoryFilter.length === 0 ||
      categoryFilter.includes(m.category ?? '');

    const matchStock =
      stockFilter === 'all' ||
      (stockFilter === 'low' &&
        m.stock <= m.min_stock &&
        m.stock > 0) ||
      (stockFilter === 'out' &&
        m.stock === 0);

    return (
      matchSearch &&
      matchCat &&
      matchStock
    );
  });

  function exportMedicines() {
    if (medicines.length === 0) {
      alert('Belum ada data obat untuk diexport.');
      return;
    }

    const exportData = medicines.map(med => ({
      'Nama Obat': med.name,
      'Nama Generik': med.generic_name ?? '',
      Kategori: med.category ?? '',
      'Bentuk Sediaan': med.form ?? '',
      Kekuatan: med.strength ?? '',
      Satuan: med.unit ?? '',
      'Jumlah per Strip':
        med.pieces_per_strip ?? 1,
      Barcode: med.barcode ?? '',
      Produsen: med.manufacturer ?? '',
      'Harga Beli': med.buy_price ?? 0,
      'Harga Jual Umum':
        med.price_regular ??
        med.sell_price ??
        0,
      'Harga Jual Resep':
        med.price_prescription ??
        med.sell_price ??
        0,
      'Harga Jual Dokter':
        med.price_doctor ?? 0,
      Stok: med.stock ?? 0,
      'Minimum Stok':
        med.min_stock ?? 0,
      'Butuh Resep':
        med.requires_prescription
          ? 'Ya'
          : 'Tidak',
      Deskripsi: med.description ?? '',
    }));

    const worksheet =
      XLSX.utils.json_to_sheet(exportData);

    worksheet['!cols'] = [
      { wch: 30 },
      { wch: 25 },
      { wch: 25 },
      { wch: 20 },
      { wch: 15 },
      { wch: 15 },
      { wch: 18 },
      { wch: 22 },
      { wch: 25 },
      { wch: 15 },
      { wch: 20 },
      { wch: 20 },
      { wch: 20 },
      { wch: 12 },
      { wch: 15 },
      { wch: 15 },
      { wch: 35 },
    ];

    const workbook =
      XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      'Daftar Obat',
    );

    XLSX.writeFile(
      workbook,
      `Daftar_Obat_${
        new Date()
          .toISOString()
          .slice(0, 10)
      }.xlsx`,
    );
  }

  function exportCSV() {
    if (medicines.length === 0) {
      alert('Belum ada data obat untuk diexport.');
      return;
    }

    const exportData = medicines.map(med => ({
      'Nama Obat': med.name,
      'Nama Generik': med.generic_name ?? '',
      Kategori: med.category ?? '',
      'Bentuk Sediaan': med.form ?? '',
      Kekuatan: med.strength ?? '',
      Satuan: med.unit ?? '',
      'Jumlah per Strip':
        med.pieces_per_strip ?? 1,
      Barcode: med.barcode ?? '',
      Produsen: med.manufacturer ?? '',
      'Harga Beli': med.buy_price ?? 0,
      'Harga Jual Umum':
        med.price_regular ??
        med.sell_price ??
        0,
      'Harga Jual Resep':
        med.price_prescription ??
        med.sell_price ??
        0,
      'Harga Jual Dokter':
        med.price_doctor ?? 0,
      Stok: med.stock ?? 0,
      'Minimum Stok':
        med.min_stock ?? 0,
      'Butuh Resep':
        med.requires_prescription
          ? 'Ya'
          : 'Tidak',
      Deskripsi: med.description ?? '',
    }));

    const worksheet =
      XLSX.utils.json_to_sheet(exportData);

    const csv =
      XLSX.utils.sheet_to_csv(
        worksheet,
        {
          FS: ',',
          RS: '\n',
        },
      );

    const blob = new Blob(
      ['\uFEFF' + csv],
      {
        type:
          'text/csv;charset=utf-8;',
      },
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement('a');

    link.href = url;

    link.download =
      `Daftar_Obat_${
        new Date()
          .toISOString()
          .slice(0, 10)
      }.csv`;

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  function downloadImportTemplate() {
    const template = [
      {
        'Nama Obat': 'Contoh Paracetamol',
        'Nama Generik': 'Paracetamol',
        Kategori: 'Obat Bebas',
        'Bentuk Sediaan': 'Tablet',
        Kekuatan: '500mg',
        Satuan: 'Strip',
        'Jumlah per Strip': 10,
        Barcode: '',
        Produsen: 'Contoh Produsen',
        'Harga Beli': 5000,
        'Harga Jual Umum': 7000,
        'Harga Jual Resep': 6500,
        'Harga Jual Dokter': 6000,
        Stok: 100,
        'Minimum Stok': 10,
        'Butuh Resep': 'Tidak',
        Deskripsi: '',
      },
    ];

    const worksheet =
      XLSX.utils.json_to_sheet(template);

    worksheet['!cols'] = [
      { wch: 30 },
      { wch: 25 },
      { wch: 25 },
      { wch: 20 },
      { wch: 15 },
      { wch: 15 },
      { wch: 18 },
      { wch: 22 },
      { wch: 25 },
      { wch: 15 },
      { wch: 20 },
      { wch: 20 },
      { wch: 20 },
      { wch: 12 },
      { wch: 15 },
      { wch: 15 },
      { wch: 35 },
    ];

    const workbook =
      XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      'Template Import',
    );

    XLSX.writeFile(
      workbook,
      'Template_Import_Obat.xlsx',
    );
  }

  async function handleImportFile(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file =
      event.target.files?.[0];

    if (!file) return;

    const allowed =
      /\.(xlsx|xls|csv)$/i.test(
        file.name,
      );

    if (!allowed) {
      alert(
        'Format file tidak didukung. Gunakan XLSX, XLS, atau CSV.',
      );

      event.target.value = '';

      return;
    }

    try {
      const data =
        await file.arrayBuffer();

      const workbook =
        XLSX.read(data, {
          type: 'array',
        });

      const firstSheet =
        workbook.SheetNames[0];

      if (!firstSheet) {
        alert(
          'File tidak memiliki sheet/data.',
        );

        return;
      }

      const worksheet =
        workbook.Sheets[firstSheet];

      const rows =
        XLSX.utils.sheet_to_json<
          Record<string, unknown>
        >(worksheet, {
          defval: '',
        });

      if (rows.length === 0) {
        alert(
          'File tidak memiliki data.',
        );

        return;
      }

      const existingBarcodes =
        new Set(
          medicines
            .map(m =>
              m.barcode
                ?.trim()
                .toLowerCase(),
            )
            .filter(Boolean),
        );

      const fileBarcodes =
        new Set<string>();

      const parsed: ImportRow[] =
        rows.map((row, index) => {
          const name = String(
            getRowValue(row, [
              'Nama Obat',
              'nama',
              'name',
              'nama_obat',
            ]),
          ).trim();

          const genericName = String(
            getRowValue(row, [
              'Nama Generik',
              'generic_name',
              'generic name',
            ]),
          ).trim();

          let category = String(
            getRowValue(row, [
              'Kategori',
              'kategori obat',
              'Kategori Obat',
              'category',
              'Category',
              'golongan',
            ]),
          ).trim();

          let form = String(
            getRowValue(row, [
              'Bentuk Sediaan',
              'bentuk sediaan',
              'Sediaan',
              'sediaan',
              'form',
              'Form',
              'bentuk',
            ]),
          ).trim();

          const strength = String(
            getRowValue(row, [
              'Kekuatan',
              'kekuatan obat',
              'strength',
              'Strength',
              'dosis',
              'Dosis',
            ]),
          ).trim();

          if (!category) {
            category = 'Lainnya';
          }

          if (!form) {
            form = 'Tablet';
          }

          let unit = String(
            getRowValue(row, [
              'Satuan',
              'satuan obat',
              'Satuan Obat',
              'unit',
              'Unit',
              'UOM',
              'uom',
              'Kemasan',
              'kemasan',
            ]),
          ).trim();

          if (!unit) {
            const normalizedForm = form
              .toLowerCase()
              .trim();

            if (
              normalizedForm.includes('tablet') ||
              normalizedForm.includes('kapsul') ||
              normalizedForm.includes('kaplet') ||
              normalizedForm.includes('pil') ||
              normalizedForm.includes('softgel')
            ) {
              unit = 'Strip';
            } else if (
              normalizedForm.includes('sirup') ||
              normalizedForm.includes('syrup') ||
              normalizedForm.includes('suspensi') ||
              normalizedForm.includes('drops') ||
              normalizedForm.includes('tetes') ||
              normalizedForm.includes('elixir')
            ) {
              unit = 'Botol';
            } else if (
              normalizedForm.includes('salep') ||
              normalizedForm.includes('krim') ||
              normalizedForm.includes('gel') ||
              normalizedForm.includes('ointment') ||
              normalizedForm.includes('cream')
            ) {
              unit = 'Tube';
            } else if (
              normalizedForm.includes('injeksi') ||
              normalizedForm.includes('injection') ||
              normalizedForm.includes('ampul')
            ) {
              unit = 'Ampul';
            } else if (
              normalizedForm.includes('vial')
            ) {
              unit = 'Vial';
            } else if (
              normalizedForm.includes('sachet')
            ) {
              unit = 'Sachet';
            } else if (
              normalizedForm.includes('roll')
            ) {
              unit = 'Roll';
            } else if (
              normalizedForm.includes('box')
            ) {
              unit = 'Box';
            } else {
              unit = 'Pcs';
            }
          }

          const piecesPerStrip =
            Math.max(
              1,
              parseNumber(
                getRowValue(row, [
                  'Jumlah per Strip',
                  'pieces_per_strip',
                  'isi strip',
                ]),
                1,
              ),
            );

          let barcode = String(
            getRowValue(row, [
              'Barcode',
              'barcode',
            ]),
          ).trim();

          const manufacturer =
            String(
              getRowValue(row, [
                'Produsen',
                'manufacturer',
              ]),
            ).trim();

          const buyPrice =
            parsePrice(
              getRowValue(row, [
                'Harga Beli',
                'buy_price',
              ]),
            );

          const priceRegular =
            parsePrice(
              getRowValue(row, [
                'Harga Jual Umum',
                'price_regular',
                'sell_price',
              ]),
            );

          const pricePrescription =
            parsePrice(
              getRowValue(row, [
                'Harga Jual Resep',
                'price_prescription',
              ]),
            );

          const priceDoctor =
            parsePrice(
              getRowValue(row, [
                'Harga Jual Dokter',
                'price_doctor',
              ]),
            );

          const stock =
            Math.max(
              0,
              parseNumber(
                getRowValue(row, [
                  'Stok',
                  'stock',
                ]),
              ),
            );

          const minStock =
            Math.max(
              0,
              parseNumber(
                getRowValue(row, [
                  'Minimum Stok',
                  'Min Stok',
                  'min_stock',
                ]),
                10,
              ),
            );

          const requiresPrescription =
            parseBoolean(
              getRowValue(row, [
                'Butuh Resep',
                'requires_prescription',
              ]),
            );

          const description =
            String(
              getRowValue(row, [
                'Deskripsi',
                'description',
              ]),
            ).trim();

          const messages: string[] = [];

          let status:
            | 'valid'
            | 'warning'
            | 'error' = 'valid';

          if (!name) {
            status = 'error';

            messages.push(
              'Nama obat wajib diisi',
            );
          }

          if (!category) {
            category = 'Lainnya';
          }

          if (!unit) {
            unit = 'Pcs';
          }

          if (!barcode) {
            barcode = generateBarcode();

            if (status !== 'error') {
              status = 'warning';
            }

            messages.push(
              'Barcode otomatis dibuat',
            );
          }

          const normalizedBarcode =
            barcode
              .trim()
              .toLowerCase();

          if (
            existingBarcodes.has(
              normalizedBarcode,
            )
          ) {
            if (status !== 'error') {
              status = 'warning';
            }

            messages.push(
              'Barcode sudah ada',
            );
          }

          if (
            fileBarcodes.has(
              normalizedBarcode,
            )
          ) {
            status = 'error';

            messages.push(
              'Barcode duplikat dalam file',
            );
          }

          fileBarcodes.add(
            normalizedBarcode,
          );

          return {
            rowNumber: index + 2,
            name,
            generic_name: genericName,
            category,
            form,
            strength,
            unit,
            pieces_per_strip:
              piecesPerStrip,
            barcode,
            manufacturer,
            buy_price: buyPrice,
            price_regular:
              priceRegular,
            price_prescription:
              pricePrescription,
            price_doctor:
              priceDoctor,
            stock,
            min_stock: minStock,
            requires_prescription:
              NON_OBAT_CATEGORIES.includes(
                category,
              )
                ? false
                : requiresPrescription,
            description,
            status,
            message:
              messages.length > 0
                ? messages.join(', ')
                : 'Siap diimport',
          };
        });

      setImportRows(parsed);

      setImportFileName(file.name);

      setShowImport(true);
    } catch (error) {
      alert(
        `Gagal membaca file: ${databaseMessage(
          error,
        )}`,
      );
    } finally {
      event.target.value = '';
    }
  }

  async function executeImport() {
    const validRows =
      importRows.filter(
        row =>
          row.status !== 'error',
      );

    if (validRows.length === 0) {
      alert(
        'Tidak ada data valid untuk diimport.',
      );

      return;
    }

    const confirmed =
      confirm(
        `Import ${validRows.length} data obat?\n\n` +
          `Mode duplikat: ${
            importMode === 'update'
              ? 'Update data berdasarkan barcode'
              : 'Lewati data yang sudah ada'
          }`,
      );

    if (!confirmed) return;

    setImporting(true);
    setImportProgress(0);

    let success = 0;
    let skipped = 0;
    let failed = 0;

    try {
      const barcodeMap =
        new Map(
          medicines
            .filter(
              m => m.barcode,
            )
            .map(m => [
              m.barcode!
                .trim()
                .toLowerCase(),
              m,
            ]),
        );

      for (
        let i = 0;
        i < validRows.length;
        i++
      ) {
        const row =
          validRows[i];

        const normalizedBarcode =
          row.barcode
            .trim()
            .toLowerCase();

        const existing =
          barcodeMap.get(
            normalizedBarcode,
          );

        try {
          const payload = {
            name: row.name.trim(),
            generic_name:
              row.generic_name.trim() ||
              null,
            category:
              row.category.trim(),
            form:
              row.form.trim() ||
              'Tablet',
            strength:
              row.strength.trim() ||
              null,
            unit:
              row.unit.trim() ||
              'Pcs',
            pieces_per_strip:
              row.pieces_per_strip || 1,
            barcode:
              row.barcode.trim() ||
              generateBarcode(),
            manufacturer:
              row.manufacturer.trim() ||
              null,
            sell_price:
              row.price_regular || 0,
            price_regular:
              row.price_regular || 0,
            price_prescription:
              row.price_prescription || 0,
            price_doctor:
              row.price_doctor || 0,
            buy_price:
              row.buy_price || 0,
            stock:
              row.stock || 0,
            min_stock:
              row.min_stock || 0,
            requires_prescription:
              row.requires_prescription,
            description:
              row.description.trim() ||
              null,
          };

          if (existing) {
            if (
              importMode === 'skip'
            ) {
              skipped++;
            } else {
              const { error } =
                await tenantFrom(
                  'medicines',
                )
                  .update({
                    ...payload,
                    updated_at:
                      new Date().toISOString(),
                  })
                  .eq(
                    'id',
                    existing.id,
                  );

              if (error) {
                throw error;
              }

              success++;
            }
          } else {
            const { error } =
              await tenantFrom(
                'medicines',
              ).insert(payload);

            if (error) {
              throw error;
            }

            success++;
          }
        } catch (error) {
          console.error(
            'Import gagal:',
            row,
            error,
          );

          failed++;
        }

        setImportProgress(
          Math.round(
            ((i + 1) /
              validRows.length) *
              100,
          ),
        );
      }

      await loadData();

      alert(
        `Import selesai!\n\n` +
          `Berhasil: ${success}\n` +
          `Dilewati: ${skipped}\n` +
          `Gagal: ${failed}`,
      );

      setShowImport(false);
      setImportRows([]);
      setImportFileName('');
    } catch (error) {
      alert(
        `Import gagal: ${databaseMessage(
          error,
        )}`,
      );
    } finally {
      setImporting(false);
      setImportProgress(0);
    }
  }

  async function deleteMedicine(
    med: Medicine,
  ) {
    if (
      !confirm(
        `Hapus obat "${med.name}"?`,
      )
    ) {
      return;
    }

    const { error } =
      await tenantFrom(
        'medicines',
      )
        .delete()
        .eq('id', med.id);

    if (error) {
      const { error: softError } =
        await tenantFrom(
          'medicines',
        )
          .update({
            is_active: false,
            updated_at:
              new Date().toISOString(),
          })
          .eq('id', med.id);

      if (softError) {
        alert(
          `Gagal menghapus obat: ${softError.message}`,
        );
      } else {
        alert(
          `Obat "${med.name}" memiliki riwayat transaksi, jadi disembunyikan dari katalog aktif.`,
        );
      }
    }

    loadData();
  }

  const daysUntil = (
    date: string,
  ) =>
    Math.ceil(
      (new Date(date).getTime() -
        Date.now()) /
        86400000,
    );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">

      {/* HEADER */}

      <div className="flex flex-wrap items-center justify-between gap-4">

        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Obat & Stok
          </h1>

          <p className="text-gray-500 text-sm mt-1">
            Kelola katalog obat, stok,
            batch kadaluarsa, import,
            dan export data
          </p>
        </div>

        <div className="flex flex-wrap gap-2">

          <button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors"
          >
            <Plus size={16} />
            Tambah Obat
          </button>

          <button
            onClick={() =>
              fileInputRef.current?.click()
            }
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors"
          >
            <Upload size={16} />
            Import
          </button>

          <button
            onClick={exportMedicines}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors"
          >
            <Download size={16} />
            Export Excel
          </button>

          <button
            onClick={exportCSV}
            className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors"
          >
            <FileText size={16} />
            Export CSV
          </button>

          <button
            onClick={
              downloadImportTemplate
            }
            className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors"
          >
            <FileSpreadsheet size={16} />
            Template
          </button>

          <button
            onClick={() =>
              setShowScanner(true)
            }
            className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors"
          >
            <ScanLine size={16} />
            Scan Barcode
          </button>

          <button
            onClick={() =>
              printStockOpname(
                filtered,
              )
            }
            className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors"
          >
            <Printer size={16} />
            Cetak Stok
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleImportFile}
            className="hidden"
          />

        </div>

      </div>

      {/* FILTER */}

      <div className="flex flex-wrap items-center gap-3">

        <div className="relative flex-1 min-w-[200px]">

          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />

          <input
            value={search}
            onChange={e =>
              setSearch(
                e.target.value,
              )
            }
            placeholder="Cari obat..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
          />

        </div>

        <div className="relative">

          <button
            onClick={() =>
              setShowCatDropdown(
                !showCatDropdown,
              )
            }
            className="flex items-center gap-2 pl-4 pr-9 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white font-medium text-gray-700"
          >
            <Filter size={14} />

            {categoryFilter.length === 0
              ? 'Semua Kategori'
              : `${categoryFilter.length} Kategori`}
          </button>

          <ChevronDown
            size={14}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />

          {showCatDropdown && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() =>
                  setShowCatDropdown(
                    false,
                  )
                }
              />

              <div className="absolute z-20 mt-1 w-56 bg-white border border-gray-200 rounded-xl shadow-lg max-h-72 overflow-y-auto">

                <div className="p-2 flex items-center justify-between border-b border-gray-100">

                  <span className="text-xs font-semibold text-gray-500">
                    Pilih Kategori
                  </span>

                  {categoryFilter.length >
                    0 && (
                    <button
                      onClick={() =>
                        setCategoryFilter(
                          [],
                        )
                      }
                      className="text-xs text-teal-600 hover:underline"
                    >
                      Reset
                    </button>
                  )}

                </div>

                {CATEGORIES.map(c => (
                  <label
                    key={c}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                  >

                    <input
                      type="checkbox"
                      checked={categoryFilter.includes(
                        c,
                      )}
                      onChange={e => {
                        if (
                          e.target.checked
                        ) {
                          setCategoryFilter([
                            ...categoryFilter,
                            c,
                          ]);
                        } else {
                          setCategoryFilter(
                            categoryFilter.filter(
                              x => x !== c,
                            ),
                          );
                        }
                      }}
                      className="w-4 h-4 rounded border-gray-300 text-teal-500 focus:ring-teal-400"
                    />

                    <span className="text-sm text-gray-700">
                      {c}
                    </span>

                  </label>
                ))}

              </div>
            </>
          )}

        </div>

        <div className="flex bg-white border border-gray-200 rounded-xl p-0.5">

          {(
            [
              'all',
              'low',
              'out',
            ] as const
          ).map(f => (

            <button
              key={f}
              onClick={() =>
                setStockFilter(f)
              }
              className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                stockFilter === f
                  ? 'bg-teal-500 text-white'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f === 'all'
                ? 'Semua'
                : f === 'low'
                  ? 'Stok Rendah'
                  : 'Habis'}
            </button>

          ))}

        </div>

      </div>

      {/* TABLE */}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        <div className="overflow-x-auto">

          <table className="w-full text-sm">

            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">

              <tr>
                <th className="text-left px-4 py-3">
                  Nama Obat
                </th>

                <th className="text-left px-4 py-3">
                  Kategori
                </th>

                <th className="text-left px-4 py-3">
                  Supplier
                </th>

                <th className="text-right px-4 py-3">
                  Harga Beli
                </th>

                <th className="text-right px-4 py-3">
                  Harga Umum
                </th>

                <th className="text-right px-4 py-3">
                  Harga Resep
                </th>

                <th className="text-right px-4 py-3">
                  Harga Dokter
                </th>

                <th className="text-center px-4 py-3">
                  Stok
                </th>

                <th className="text-center px-4 py-3">
                  Batch
                </th>

                <th className="text-center px-4 py-3">
                  Aksi
                </th>

                <th className="text-center px-4 py-3">
                  Barcode
                </th>
              </tr>

            </thead>

            <tbody className="divide-y divide-gray-50">

              {filtered.map(med => {

                const medBatches =
                  batches.filter(
                    b =>
                      b.medicine_id ===
                        med.id &&
                      (b.stock_quantity ??
                        b.quantity) >
                        0,
                  );

                const soonestExpiry =
                  medBatches.length > 0
                    ? medBatches.reduce(
                        (
                          min,
                          b,
                        ) =>
                          new Date(
                            b.expiry_date,
                          ) <
                          new Date(
                            min.expiry_date,
                          )
                            ? b
                            : min,
                      )
                    : null;

                const daysLeft =
                  soonestExpiry
                    ? daysUntil(
                        soonestExpiry.expiry_date,
                      )
                    : null;

                return (
                  <tr
                    key={med.id}
                    className="hover:bg-gray-50/50 transition-colors"
                  >

                    <td className="px-4 py-3">

                      <div className="flex items-center gap-2">

                        <div>

                          <p className="font-medium text-gray-800">
                            {med.name}
                          </p>

                          <p className="text-xs text-gray-400">
                            {med.generic_name} ·{' '}
                            {med.form}{' '}
                            {med.strength}
                          </p>

                        </div>

                        {med.stock <=
                          med.min_stock && (
                          <span title="Stok di bawah safety stock">
                            <AlertTriangle
                              size={15}
                              className="text-red-500 flex-shrink-0"
                            />
                          </span>
                        )}

                        {daysLeft !==
                          null &&
                          daysLeft <= 90 && (
                            <span title="Akan kadaluarsa dalam 3 bulan">
                              <Clock
                                size={15}
                                className="text-amber-500 flex-shrink-0"
                              />
                            </span>
                          )}

                        {med.requires_prescription && (
                          <span className="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold">
                            R/
                          </span>
                        )}

                      </div>

                    </td>

                    <td className="px-4 py-3 text-gray-600">
                      {med.category}
                    </td>

                    <td className="px-4 py-3 text-gray-600">
                      {suppliers.find(
                        s =>
                          s.id ===
                          med.supplier_id,
                      )?.name ?? '-'}
                    </td>

                    <td className="px-4 py-3 text-right text-gray-600">
                      {formatCurrency(
                        med.buy_price,
                      )}
                    </td>

                    <td className="px-4 py-3 text-right font-semibold text-teal-600">
                      {formatCurrency(
                        med.price_regular ||
                          med.sell_price,
                      )}
                    </td>

                    <td className="px-4 py-3 text-right font-semibold text-blue-600">
                      {formatCurrency(
                        med.price_prescription ||
                          med.sell_price,
                      )}
                    </td>

                    <td className="px-4 py-3 text-right font-semibold text-indigo-600">
                      {formatCurrency(
                        med.price_doctor ||
                          med.price_regular ||
                          med.sell_price,
                      )}
                    </td>

                    <td className="px-4 py-3 text-center">

                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          med.stock === 0
                            ? 'bg-red-100 text-red-600'
                            : med.stock <=
                                med.min_stock
                              ? 'bg-red-100 text-red-600'
                              : 'bg-green-100 text-green-600'
                        }`}
                      >
                        {med.stock}{' '}
                        {med.unit}
                      </span>

                    </td>

                    <td className="px-4 py-3 text-center">

                      {daysLeft !==
                        null && (
                          <span
                            className={`text-xs px-2 py-1 rounded-full font-medium ${
                              daysLeft <= 30
                                ? 'bg-red-50 text-red-600'
                                : daysLeft <=
                                    90
                                  ? 'bg-yellow-50 text-yellow-700'
                                  : 'bg-gray-50 text-gray-500'
                            }`}
                          >
                            {formatDate(
                              soonestExpiry!
                                .expiry_date,
                            )}
                          </span>
                        )}

                    </td>

                    <td className="px-4 py-3">

                      <div className="flex items-center justify-center gap-1">

                        <button
                          onClick={() =>
                            setShowBatches(
                              med,
                            )
                          }
                          title="Lihat Batch"
                          className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Package size={14} />
                        </button>

                        <button
                          onClick={() => {
                            setEditing(
                              med,
                            );
                            setShowForm(
                              true,
                            );
                          }}
                          title="Edit"
                          className="p-1.5 text-gray-400 hover:text-teal-500 hover:bg-teal-50 rounded-lg transition-colors"
                        >
                          <Edit2 size={14} />
                        </button>

                        <button
                          onClick={() =>
                            deleteMedicine(
                              med,
                            )
                          }
                          title="Hapus"
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>

                      </div>

                    </td>

                    <td className="px-4 py-3 text-center">

                      <button
                        onClick={() =>
                          setShowBarcodeLabel(
                            med,
                          )
                        }
                        title="Cetak Barcode"
                        disabled={
                          !med.barcode
                        }
                        className="p-1.5 text-gray-400 hover:text-teal-500 hover:bg-teal-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Barcode size={14} />
                      </button>

                    </td>

                  </tr>
                );
              })}

            </tbody>

          </table>

        </div>

        {filtered.length === 0 && (
          <div className="text-center text-gray-400 py-16">

            <Package
              size={32}
              className="mx-auto mb-2 text-gray-300"
            />

            <p>
              Tidak ada obat ditemukan
            </p>

          </div>
        )}

      </div>

      {/* IMPORT MODAL */}

      {showImport && (

        <Modal
          title="Preview Import Obat"
          onClose={() => {
            if (!importing) {
              setShowImport(false);
            }
          }}
          wide
        >

          <div className="space-y-4">

            <div className="flex flex-wrap items-center justify-between gap-3 bg-blue-50 border border-blue-100 rounded-xl p-3">

              <div>

                <p className="font-semibold text-blue-800 text-sm">
                  {importFileName}
                </p>

                <p className="text-xs text-blue-600 mt-1">
                  {importRows.length} baris ditemukan
                </p>

              </div>

              <div className="text-sm">

                <span className="text-green-600 font-semibold">
                  {
                    importRows.filter(
                      r =>
                        r.status ===
                        'valid',
                    ).length
                  } valid
                </span>

                {' · '}

                <span className="text-amber-600 font-semibold">
                  {
                    importRows.filter(
                      r =>
                        r.status ===
                        'warning',
                    ).length
                  } peringatan
                </span>

                {' · '}

                <span className="text-red-600 font-semibold">
                  {
                    importRows.filter(
                      r =>
                        r.status ===
                        'error',
                    ).length
                  } error
                </span>

              </div>

            </div>

            <div className="flex gap-2">

              <button
                onClick={() =>
                  setImportMode(
                    'skip',
                  )
                }
                disabled={importing}
                className={`flex-1 px-3 py-2.5 rounded-xl text-sm font-medium border ${
                  importMode === 'skip'
                    ? 'bg-teal-500 text-white border-teal-500'
                    : 'bg-white border-gray-200 text-gray-600'
                }`}
              >
                Lewati Duplikat
              </button>

              <button
                onClick={() =>
                  setImportMode(
                    'update',
                  )
                }
                disabled={importing}
                className={`flex-1 px-3 py-2.5 rounded-xl text-sm font-medium border ${
                  importMode === 'update'
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white border-gray-200 text-gray-600'
                }`}
              >
                Update Berdasarkan Barcode
              </button>

            </div>

            {importing && (

              <div>

                <div className="flex justify-between text-xs text-gray-500 mb-1">

                  <span>
                    Sedang mengimport...
                  </span>

                  <span>
                    {importProgress}%
                  </span>

                </div>

                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">

                  <div
                    className="h-full bg-teal-500 transition-all"
                    style={{
                      width: `${importProgress}%`,
                    }}
                  />

                </div>

              </div>

            )}

            <div className="border border-gray-100 rounded-xl overflow-auto max-h-[420px]">

              <table className="w-full text-xs">

                <thead className="bg-gray-50 sticky top-0">

                  <tr>

                    <th className="text-left px-3 py-2">
                      Baris
                    </th>

                    <th className="text-left px-3 py-2">
                      Nama
                    </th>

                    <th className="text-left px-3 py-2">
                      Kategori
                    </th>

                    <th className="text-left px-3 py-2">
                      Barcode
                    </th>

                    <th className="text-right px-3 py-2">
                      Harga
                    </th>

                    <th className="text-center px-3 py-2">
                      Stok
                    </th>

                    <th className="text-left px-3 py-2">
                      Status
                    </th>

                  </tr>

                </thead>

                <tbody className="divide-y divide-gray-50">

                  {importRows.map(row => (

                    <tr
                      key={
                        row.rowNumber
                      }
                    >

                      <td className="px-3 py-2">
                        {row.rowNumber}
                      </td>

                      <td className="px-3 py-2 font-medium">
                        {row.name ||
                          '-'}
                      </td>

                      <td className="px-3 py-2">
                        {row.category ||
                          '-'}
                      </td>

                      <td className="px-3 py-2 font-mono">
                        {row.barcode}
                      </td>

                      <td className="px-3 py-2 text-right">
                        {formatCurrency(
                          row.price_regular,
                        )}
                      </td>

                      <td className="px-3 py-2 text-center">
                        {row.stock}
                      </td>

                      <td className="px-3 py-2">

                        <div className="flex items-center gap-1">

                          {row.status ===
                          'valid' ? (

                            <CheckCircle2
                              size={15}
                              className="text-green-500"
                            />

                          ) : row.status ===
                            'warning' ? (

                            <AlertTriangle
                              size={15}
                              className="text-amber-500"
                            />

                          ) : (

                            <AlertCircle
                              size={15}
                              className="text-red-500"
                            />

                          )}

                          <span
                            className={
                              row.status ===
                              'error'
                                ? 'text-red-600'
                                : row.status ===
                                    'warning'
                                  ? 'text-amber-600'
                                  : 'text-green-600'
                            }
                          >
                            {row.message}
                          </span>

                        </div>

                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

            <div className="flex gap-2">

              <button
                disabled={importing}
                onClick={() =>
                  setShowImport(false)
                }
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Batal
              </button>

              <button
                disabled={
                  importing ||
                  importRows.filter(
                    row =>
                      row.status !==
                      'error',
                  ).length === 0
                }
                onClick={
                  executeImport
                }
                className="flex-1 py-2.5 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold"
              >
                {importing
                  ? `Mengimport ${importProgress}%`
                  : 'Import Data'}
              </button>

            </div>

          </div>

        </Modal>
      )}

      {/* MEDICINE FORM */}

      {showForm && (

        <MedicineForm
          medicine={editing}
          suppliers={suppliers}
          onClose={() =>
            setShowForm(false)
          }
          onSaved={() => {
            setShowForm(false);
            loadData();
          }}
        />

      )}

      {/* BATCH MODAL */}

      {showBatches && (

        <BatchesModal
          medicine={showBatches}
          batches={batches.filter(
            b =>
              b.medicine_id ===
              showBatches.id,
          )}
          onClose={() =>
            setShowBatches(null)
          }
          onSaved={loadData}
        />

      )}

      {/* BARCODE LABEL */}

      {showBarcodeLabel && (

        <BarcodeLabel
          medicine={
            showBarcodeLabel
          }
          onClose={() =>
            setShowBarcodeLabel(null)
          }
        />

      )}

      {/* BARCODE SCANNER */}

      {showScanner && (

        <BarcodeScanner
          title="Scan Barcode - Stok Opname"
          onScan={handleScan}
          onClose={() =>
            setShowScanner(false)
          }
        />

      )}

      {/* QUICK STOCK EDIT */}

      {stockEditMed && (

        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() =>
            setStockEditMed(null)
          }
        >

          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm"
            onClick={e =>
              e.stopPropagation()
            }
          >

            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">

              <h3 className="font-bold text-gray-800">
                Update Stok Fisik
              </h3>

              <button
                onClick={() =>
                  setStockEditMed(
                    null,
                  )
                }
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X size={18} />
              </button>

            </div>

            <div className="p-5 space-y-4">

              <div>

                <p className="text-sm font-semibold text-gray-800">
                  {stockEditMed.name}
                </p>

                <p className="text-xs text-gray-400">
                  Stok sistem:{' '}
                  {stockEditMed.stock}{' '}
                  {stockEditMed.unit}
                </p>

              </div>

              <div>

                <label className="text-xs text-gray-500 font-medium">
                  Jumlah Stok Fisik
                </label>

                <input
                  type="number"
                  value={
                    stockEditQty
                  }
                  onChange={e =>
                    setStockEditQty(
                      Number(
                        e.target.value,
                      ),
                    )
                  }
                  autoFocus
                  className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-teal-400"
                />

                <p className="text-xs text-gray-400 mt-1">

                  Selisih:{' '}

                  <span
                    className={
                      stockEditQty -
                        stockEditMed.stock !==
                      0
                        ? 'font-bold text-amber-600'
                        : 'text-gray-400'
                    }
                  >
                    {stockEditQty -
                      stockEditMed.stock >
                    0
                      ? '+'
                      : ''}

                    {stockEditQty -
                      stockEditMed.stock}
                  </span>

                </p>

              </div>

              <div className="flex gap-2">

                <button
                  onClick={() =>
                    setStockEditMed(
                      null,
                    )
                  }
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Batal
                </button>

                <button
                  onClick={async () => {

                    await tenantFrom(
                      'medicines',
                    )
                      .update({
                        stock:
                          stockEditQty,
                        updated_at:
                          new Date().toISOString(),
                      })
                      .eq(
                        'id',
                        stockEditMed.id,
                      );

                    setStockEditMed(null);

                    loadData();

                  }}
                  className="flex-1 py-2.5 bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-sm font-semibold"
                >
                  Simpan
                </button>

              </div>

            </div>

          </div>

        </div>

      )}

    </div>
  );

  async function handleScan(
    code: string,
  ) {
    const found =
      medicines.find(
        m =>
          m.barcode ===
          code,
      );

    if (found) {
      setShowScanner(false);

      setStockEditMed(found);

      setStockEditQty(
        found.stock,
      );
    } else {
      alert(
        `Barcode "${code}" tidak ditemukan dalam katalog obat.`,
      );
    }
  }
}

function MedicineForm({
  medicine,
  suppliers,
  onClose,
  onSaved,
}: {
  medicine: Medicine | null;
  suppliers: Supplier[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] =
    useState({
      name:
        medicine?.name ?? '',
      generic_name:
        medicine?.generic_name ??
        '',
      category:
        medicine?.category ?? '',
      form:
        medicine?.form ??
        'Tablet',
      strength:
        medicine?.strength ?? '',
      unit:
        medicine?.unit ??
        'strip',
      pieces_per_strip:
        medicine?.pieces_per_strip ??
        10,
      barcode:
        medicine?.barcode ?? '',
      price_regular:
        medicine?.price_regular ??
        medicine?.sell_price ??
        0,
      price_prescription:
        medicine?.price_prescription ??
        medicine?.sell_price ??
        0,
      price_doctor:
        medicine?.price_doctor ??
        0,
      manufacturer:
        medicine?.manufacturer ??
        '',
      supplier_id:
        medicine?.supplier_id ?? '',
      sell_price:
        medicine?.sell_price ??
        0,
      buy_price:
        medicine?.buy_price ??
        0,
      stock:
        medicine?.stock ?? 0,
      min_stock:
        medicine?.min_stock ?? 10,
      requires_prescription:
        medicine?.requires_prescription ??
        false,
      description:
        medicine?.description ?? '',
    });

  const [saving, setSaving] =
    useState(false);

  const [units, setUnits] =
    useState<
      Omit<
        MedicineUnit,
        | 'id'
        | 'medicine_id'
        | 'tenant_id'
        | 'created_at'
      >[]
    >([
      {
        unit_name:
          medicine?.unit ??
          'tablet',
        conversion_factor: 1,
        price_regular:
          medicine?.price_regular ??
          medicine?.sell_price ??
          0,
        price_prescription:
          medicine?.price_prescription ??
          medicine?.sell_price ??
          0,
        price_doctor:
          medicine?.price_doctor ??
          0,
        is_base_unit: true,
      },
    ]);

  useEffect(() => {
    if (!medicine) return;

    tenantFrom(
      'medicine_units',
    )
      .select('*')
      .eq(
        'medicine_id',
        medicine.id,
      )
      .order(
        'conversion_factor',
      )
      .then(
        ({
          data,
        }: {
          data: MedicineUnit[] | null;
        }) => {
          if (
            data &&
            data.length > 0
          ) {
            setUnits(
              data.map(
                ({
                  unit_name,
                  conversion_factor,
                  price_regular,
                  price_prescription,
                  price_doctor,
                  is_base_unit,
                }) => ({
                  unit_name,
                  conversion_factor,
                  price_regular,
                  price_prescription,
                  price_doctor:
                    price_doctor ??
                    0,
                  is_base_unit,
                }),
              ),
            );
          }
        },
      );
  }, [medicine]);

  async function save() {
    if (
      !form.name.trim()
    ) {
      alert(
        'Nama obat wajib diisi.',
      );

      return;
    }

    if (
      !form.category
    ) {
      alert(
        'Kategori wajib dipilih.',
      );

      return;
    }

    setSaving(true);

    try {
      const doctorPrice =
        parsePrice(
          form.price_doctor,
        );

      const payload = {
        name:
          form.name.trim(),

        generic_name:
          form.generic_name.trim() ||
          null,

        category:
          form.category,

        form:
          form.form,

        strength:
          form.strength.trim() ||
          null,

        unit:
          form.unit ||
          'tablet',

        pieces_per_strip:
          form.pieces_per_strip ||
          1,

        barcode:
          form.barcode.trim() ||
          null,

        manufacturer:
          form.manufacturer.trim() ||
          null,

        supplier_id:
          form.supplier_id ||
          null,

        sell_price:
          form.price_regular ||
          form.sell_price ||
          0,

        price_regular:
          form.price_regular ||
          0,

        price_prescription:
          form.price_prescription ||
          0,

        price_doctor:
          doctorPrice,

        buy_price:
          form.buy_price ||
          0,

        stock:
          form.stock || 0,

        min_stock:
          form.min_stock || 0,

        requires_prescription:
          form.requires_prescription,

        description:
          form.description.trim() ||
          null,
      };

      let res;

      let savedMedicine:
        | Medicine
        | undefined =
        medicine ?? undefined;

      if (medicine) {
        res =
          await tenantFrom(
            'medicines',
          )
            .update({
              ...payload,
              updated_at:
                new Date().toISOString(),
            })
            .eq(
              'id',
              medicine.id,
            );
      } else {
        if (
          !payload.barcode
        ) {
          payload.barcode =
            generateBarcode();
        }

        res =
          await tenantFrom(
            'medicines',
          )
            .insert(payload)
            .select();
      }

      if (
        res.error &&
        isMissingSchemaField(
          res.error,
          'price_doctor',
        )
      ) {
        throw new Error(
          'Kolom medicines.price_doctor belum tersedia di Supabase. Jalankan migration 20260819100000_add_doctor_pricing.sql.',
        );
      }

      if (
        res.error
      ) {
        throw new Error(
          `Master obat gagal disimpan: ${databaseMessage(
            res.error,
          )}`,
        );
      }

      if (
        !medicine
      ) {
        savedMedicine =
          res.data?.[0] as
            | Medicine
            | undefined;
      }

      if (
        savedMedicine
      ) {
        const unitRows =
          units
            .filter(
              unit =>
                unit.unit_name.trim(),
            )
            .map(
              unit => ({
                ...unit,
                medicine_id:
                  savedMedicine!.id,
              }),
            );

        let unitsResult =
          await tenantFrom(
            'medicine_units',
          ).upsert(
            unitRows,
            {
              onConflict:
                'medicine_id,unit_name',
            },
          );

        if (
          unitsResult.error &&
          isMissingSchemaField(
            unitsResult.error,
            'price_doctor',
          )
        ) {
          const legacyUnitRows =
            unitRows.map(
              ({
                price_doctor:
                  _priceDoctor,
                ...unit
              }) => unit,
            );

          unitsResult =
            await tenantFrom(
              'medicine_units',
            ).upsert(
              legacyUnitRows,
              {
                onConflict:
                  'medicine_id,unit_name',
              },
            );
        }

        if (
          unitsResult.error &&
          !isMissingUnitsTable(
            unitsResult.error,
          )
        ) {
          throw new Error(
            `Unit obat gagal disimpan: ${databaseMessage(
              unitsResult.error,
            )}`,
          );
        }
      }

      onSaved();
    } catch (err) {
      alert(
        `Gagal menyimpan obat: ${databaseMessage(
          err,
        )}`,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={
        medicine
          ? 'Edit Obat'
          : 'Tambah Obat'
      }
      onClose={onClose}
    >

      <div className="grid grid-cols-2 gap-3">

        <Field
          label="Nama Obat"
          className="col-span-2"
        >
          <input
            value={form.name}
            onChange={e =>
              setForm({
                ...form,
                name:
                  e.target.value,
              })
            }
            className="input"
          />
        </Field>

        <Field label="Nama Generik">
          <input
            value={
              form.generic_name
            }
            onChange={e =>
              setForm({
                ...form,
                generic_name:
                  e.target.value,
              })
            }
            className="input"
          />
        </Field>

        <Field label="Kategori">

          <select
            value={
              form.category
            }
            onChange={e =>
              setForm({
                ...form,
                category:
                  e.target.value,
                requires_prescription:
                  NON_OBAT_CATEGORIES.includes(
                    e.target.value,
                  )
                    ? false
                    : form.requires_prescription,
              })
            }
            className="input"
          >

            <option value="">
              - Pilih Kategori -
            </option>

            {CATEGORIES.map(
              c => (
                <option
                  key={c}
                  value={c}
                >
                  {c}
                </option>
              ),
            )}

          </select>

        </Field>

        <Field label="Bentuk Sediaan">

          <select
            value={form.form}
            onChange={e => {
              const newForm =
                e.target.value;

              const isStrip =
                newForm ===
                  'Tablet' ||
                newForm ===
                  'Kapsul';

              setForm({
                ...form,
                form: newForm,
                unit: isStrip
                  ? 'Strip'
                  : form.unit,
              });
            }}
            className="input"
          >

            <option>
              Tablet
            </option>

            <option>
              Kapsul
            </option>

            <option>
              Sirup
            </option>

            <option>
              Injeksi
            </option>

            <option>
              Salep
            </option>

            <option>
              Tetes
            </option>

            <option>
              Lainnya
            </option>

          </select>

        </Field>

        <Field label="Kekuatan">

          <input
            value={
              form.strength
            }
            onChange={e =>
              setForm({
                ...form,
                strength:
                  e.target.value,
              })
            }
            placeholder="500mg"
            className="input"
          />

        </Field>

        <Field label="Satuan">

          <select
            value={form.unit}
            onChange={e =>
              setForm({
                ...form,
                unit:
                  e.target.value,
              })
            }
            className="input"
          >

            {PACKAGING_UNITS.map(
              unit => (
                <option
                  key={unit}
                  value={unit}
                >
                  {unit}
                </option>
              ),
            )}

          </select>

        </Field>

        {(form.form ===
          'Tablet' ||
          form.form ===
            'Kapsul') && (

          <Field label="Jumlah per Strip">

            <input
              type="number"
              min="1"
              value={
                form.pieces_per_strip
              }
              onChange={e =>
                setForm({
                  ...form,
                  pieces_per_strip:
                    Number(
                      e.target.value,
                    ),
                })
              }
              className="input"
            />

          </Field>

        )}

        <Field label="Barcode">

          <div className="flex gap-1">

            <input
              value={
                form.barcode
              }
              onChange={e =>
                setForm({
                  ...form,
                  barcode:
                    e.target.value,
                })
              }
              className="input flex-1"
              placeholder="Otomatis jika kosong"
            />

            <button
              type="button"
              onClick={() =>
                setForm({
                  ...form,
                  barcode:
                    generateBarcode(),
                })
              }
              className="px-3 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-semibold text-gray-600 whitespace-nowrap"
            >
              Auto
            </button>

          </div>

        </Field>

        <Field label="Produsen">

          <input
            value={
              form.manufacturer
            }
            onChange={e =>
              setForm({
                ...form,
                manufacturer:
                  e.target.value,
              })
            }
            className="input"
          />

        </Field>

        <Field label="Supplier">

          <select
            value={
              form.supplier_id
            }
            onChange={e =>
              setForm({
                ...form,
                supplier_id:
                  e.target.value,
              })
            }
            className="input"
          >

            <option value="">
              - Pilih -
            </option>

            {suppliers.map(
              s => (
                <option
                  key={s.id}
                  value={s.id}
                >
                  {s.name}
                </option>
              ),
            )}

          </select>

        </Field>

        <Field label="Harga Beli">

          <input
            type="number"
            value={
              form.buy_price
            }
            onChange={e =>
              setForm({
                ...form,
                buy_price:
                  Number(
                    e.target.value,
                  ),
              })
            }
            className="input"
          />

        </Field>

        <Field label="Harga Jual Umum">

          <input
            type="number"
            value={
              form.price_regular
            }
            onChange={e =>
              setForm({
                ...form,
                price_regular:
                  Number(
                    e.target.value,
                  ),
                sell_price:
                  Number(
                    e.target.value,
                  ),
              })
            }
            className="input"
          />

        </Field>

        <Field label="Harga Jual Resep">

          <input
            type="number"
            value={
              form.price_prescription
            }
            onChange={e =>
              setForm({
                ...form,
                price_prescription:
                  Number(
                    e.target.value,
                  ),
              })
            }
            className="input"
          />

        </Field>

        <Field label="Harga Jual Dokter">

          <input
            type="number"
            value={
              form.price_doctor
            }
            onChange={e =>
              setForm({
                ...form,
                price_doctor:
                  Number(
                    e.target.value,
                  ),
              })
            }
            className="input"
          />

        </Field>

        <Field label="Stok">

          <input
            type="number"
            value={form.stock}
            onChange={e =>
              setForm({
                ...form,
                stock: Number(
                  e.target.value,
                ),
              })
            }
            className="input"
          />

        </Field>

        <Field label="Min. Stok">

          <input
            type="number"
            value={
              form.min_stock
            }
            onChange={e =>
              setForm({
                ...form,
                min_stock:
                  Number(
                    e.target.value,
                  ),
              })
            }
            className="input"
          />

        </Field>

        {form.category &&
          !NON_OBAT_CATEGORIES.includes(
            form.category,
          ) && (

          <Field
            label="Butuh Resep"
            className="col-span-2"
          >

            <label className="flex items-center gap-2 mt-1">

              <input
                type="checkbox"
                checked={
                  form.requires_prescription
                }
                onChange={e =>
                  setForm({
                    ...form,
                    requires_prescription:
                      e.target.checked,
                  })
                }
                className="w-4 h-4 accent-teal-500"
              />

              <span className="text-sm text-gray-600">
                Obat keras /
                memerlukan resep dokter
              </span>

            </label>

          </Field>

        )}

      </div>

      <div className="flex gap-2 mt-5">

        <button
          onClick={onClose}
          className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          Batal
        </button>

        <button
          onClick={save}
          disabled={
            saving ||
            !form.name
          }
          className="flex-1 py-2.5 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold"
        >
          {saving
            ? 'Menyimpan...'
            : 'Simpan'}
        </button>

      </div>

    </Modal>
  );
}

function BatchesModal({
  medicine,
  batches,
  onClose,
  onSaved,
}: {
  medicine: Medicine;
  batches: BatchWithMed[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [newBatch, setNewBatch] =
    useState({
      batch_number: '',
      expiry_date: '',
      quantity: 0,
      buy_price: 0,
    });

  const [saving, setSaving] =
    useState(false);

  const daysUntil =
    (date: string) =>
      Math.ceil(
        (new Date(
          date,
        ).getTime() -
          Date.now()) /
          86400000,
      );

  async function addBatch() {
    if (
      !newBatch.batch_number ||
      !newBatch.expiry_date
    ) {
      return;
    }

    setSaving(true);

    try {
      const { error } =
        await tenantFrom(
          'medicine_batches',
        ).insert({
          medicine_id:
            medicine.id,
          batch_number:
            newBatch.batch_number.trim(),
          expiry_date:
            newBatch.expiry_date,
          quantity:
            newBatch.quantity ||
            0,
          stock_quantity:
            newBatch.quantity ||
            0,
          buy_price:
            newBatch.buy_price ||
            null,
        });

      if (error) {
        throw error;
      }

      setNewBatch({
        batch_number: '',
        expiry_date: '',
        quantity: 0,
        buy_price: 0,
      });

      onSaved();
    } catch (err) {
      alert(
        `Gagal menambah batch: ${databaseMessage(
          err,
        )}`,
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteBatch(
    id: string,
  ) {
    if (
      !confirm(
        'Hapus batch ini?',
      )
    ) {
      return;
    }

    try {
      const { error } =
        await tenantFrom(
          'medicine_batches',
        )
          .delete()
          .eq('id', id);

      if (error) {
        throw error;
      }

      onSaved();
    } catch (err) {
      alert(
        `Gagal menghapus batch: ${databaseMessage(
          err,
        )}`,
      );
    }
  }

  return (
    <Modal
      title={`Batch - ${medicine.name}`}
      onClose={onClose}
      wide
    >

      <div className="space-y-4">

        <div className="border border-gray-100 rounded-xl overflow-hidden">

          <table className="w-full text-sm">

            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">

              <tr>

                <th className="text-left px-3 py-2">
                  No. Batch
                </th>

                <th className="text-left px-3 py-2">
                  Kadaluarsa
                </th>

                <th className="text-center px-3 py-2">
                  Qty
                </th>

                <th className="text-right px-3 py-2">
                  Harga Beli
                </th>

                <th className="text-center px-3 py-2">
                  Status
                </th>

                <th className="px-3 py-2" />

              </tr>

            </thead>

            <tbody className="divide-y divide-gray-50">

              {batches.map(b => {

                const days =
                  daysUntil(
                    b.expiry_date,
                  );

                return (
                  <tr
                    key={b.id}
                    className="hover:bg-gray-50/50"
                  >

                    <td className="px-3 py-2 font-mono text-gray-700">
                      {b.batch_number}
                    </td>

                    <td className="px-3 py-2 text-gray-600">
                      {formatDate(
                        b.expiry_date,
                      )}
                    </td>

                    <td className="px-3 py-2 text-center text-gray-700">
                      {b.stock_quantity ??
                        b.quantity}
                    </td>

                    <td className="px-3 py-2 text-right text-gray-600">
                      {b.buy_price
                        ? formatCurrency(
                            b.buy_price,
                          )
                        : '-'}
                    </td>

                    <td className="px-3 py-2 text-center">

                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          days < 0
                            ? 'bg-red-100 text-red-600'
                            : days <= 30
                              ? 'bg-red-50 text-red-600'
                              : days <= 90
                                ? 'bg-orange-50 text-orange-600'
                                : 'bg-green-50 text-green-600'
                        }`}
                      >
                        {days < 0
                          ? 'Kadaluarsa'
                          : `${days} hari`}
                      </span>

                    </td>

                    <td className="px-3 py-2 text-right">

                      <button
                        onClick={() =>
                          deleteBatch(
                            b.id,
                          )
                        }
                        className="p-1 text-gray-300 hover:text-red-500"
                      >
                        <Trash2
                          size={14}
                        />
                      </button>

                    </td>

                  </tr>
                );
              })}

              {batches.length ===
                0 && (

                <tr>

                  <td
                    colSpan={6}
                    className="text-center text-gray-400 py-6"
                  >
                    Belum ada batch
                    terdaftar
                  </td>

                </tr>

              )}

            </tbody>

          </table>

        </div>

        <div className="bg-gray-50 rounded-xl p-3">

          <p className="text-sm font-semibold text-gray-700 mb-2">
            Tambah Batch Baru
          </p>

          <div className="grid grid-cols-4 gap-2">

            <input
              value={
                newBatch.batch_number
              }
              onChange={e =>
                setNewBatch({
                  ...newBatch,
                  batch_number:
                    e.target.value,
                })
              }
              placeholder="No. Batch"
              className="input"
            />

            <input
              type="date"
              value={
                newBatch.expiry_date
              }
              onChange={e =>
                setNewBatch({
                  ...newBatch,
                  expiry_date:
                    e.target.value,
                })
              }
              className="input"
            />

            <input
              type="number"
              value={
                newBatch.quantity ||
                ''
              }
              onChange={e =>
                setNewBatch({
                  ...newBatch,
                  quantity:
                    Number(
                      e.target.value,
                    ),
                })
              }
              placeholder="Qty"
              className="input"
            />

            <input
              type="number"
              value={
                newBatch.buy_price ||
                ''
              }
              onChange={e =>
                setNewBatch({
                  ...newBatch,
                  buy_price:
                    Number(
                      e.target.value,
                    ),
                })
              }
              placeholder="Harga Beli"
              className="input"
            />

          </div>

          <button
            onClick={addBatch}
            disabled={saving}
            className="mt-2 w-full py-2 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold"
          >
            {saving
              ? 'Menyimpan...'
              : 'Tambah Batch'}
          </button>

        </div>

      </div>

    </Modal>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={onClose}
    >

      <div
        className={`bg-white rounded-2xl shadow-2xl ${
          wide
            ? 'max-w-5xl'
            : 'max-w-xl'
        } w-full max-h-[90vh] overflow-y-auto`}
        onClick={e =>
          e.stopPropagation()
        }
      >

        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">

          <h3 className="font-bold text-gray-800">
            {title}
          </h3>

          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>

        </div>

        <div className="p-5">
          {children}
        </div>

      </div>

    </div>
  );
}

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>

      <label className="text-xs text-gray-500 font-medium">
        {label}
      </label>

      {children}

    </div>
  );
}
