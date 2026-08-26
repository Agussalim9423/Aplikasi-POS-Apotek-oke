import { useState, useEffect } from 'react';
import {
  tenantFrom,
  formatCurrency,
  formatDate,
  generateReceiptNumber,
} from '@/lib/supabase';
import type {
  GoodsReceipt,
  GoodsReceiptItem,
  Supplier,
  Medicine,
  PurchaseOrder,
} from '@/lib/supabase';
import {
  Plus,
  Search,
  Eye,
  CheckCircle,
  X,
  PackageCheck,
  AlertCircle,
  Printer,
  Trash2,
} from 'lucide-react';
import { Modal, Field } from './ObatStok';

type Settings = {
  pharmacy_name: string;
  pharmacy_address: string;
  pharmacy_phone: string;
  pharmacist_name: string;
  sipa_number: string;
  sia_number: string;
};

const DEFAULT_SETTINGS: Settings = {
  pharmacy_name: 'Apotek',
  pharmacy_address: '',
  pharmacy_phone: '',
  pharmacist_name: '',
  sipa_number: '',
  sia_number: '',
};

async function fetchSettings(): Promise<Settings> {
  const { data } = await tenantFrom('settings').select('key, value');

  const map: Record<string, string> = {};

  (data ?? []).forEach(
    (s: { key: string; value: string | null }) => {
      map[s.key] = s.value ?? '';
    }
  );

  return {
    ...DEFAULT_SETTINGS,
    pharmacy_name:
      map.pharmacy_name ?? DEFAULT_SETTINGS.pharmacy_name,
    pharmacy_address: map.pharmacy_address ?? '',
    pharmacy_phone: map.pharmacy_phone ?? '',
    pharmacist_name: map.pharmacist_name ?? '',
    sipa_number: map.sipa_number ?? '',
    sia_number: map.sia_number ?? '',
  };
}

export default function Penerimaan() {
  const [receipts, setReceipts] = useState<
    (GoodsReceipt & { suppliers: Supplier })[]
  >([]);

  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

  const [viewGR, setViewGR] = useState<
    | (GoodsReceipt & {
        suppliers: Supplier;
        goods_receipt_items: (
          GoodsReceiptItem & {
            medicines: Medicine;
          }
        )[];
        purchase_orders: PurchaseOrder | null;
      })
    | null
  >(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadReceipts();
  }, []);

  async function loadReceipts() {
    setLoading(true);

    try {
      const { data, error } = await tenantFrom('goods_receipts')
        .select('*, suppliers(*)')
        .order('created_at', {
          ascending: false,
        });

      if (error) throw error;

      setReceipts(
        (data ?? []) as (GoodsReceipt & {
          suppliers: Supplier;
        })[]
      );
    } catch (error) {
      console.error('Gagal memuat penerimaan:', error);
      setReceipts([]);
    } finally {
      setLoading(false);
    }
  }

  const filtered = receipts.filter((r) => {
    const receiptNumber = r.receipt_number ?? '';
    const supplierName = r.suppliers?.name ?? '';

    return (
      receiptNumber
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      supplierName
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  });

  async function deleteGR(gr: GoodsReceipt) {
    if (
      !confirm(
        `Hapus penerimaan "${gr.receipt_number}"?${
          gr.status === 'verified'
            ? ' Stok obat yang sudah ditambahkan akan dikurangi kembali.'
            : ''
        }`
      )
    ) {
      return;
    }

    try {
      const { data: items, error: itemsError } =
        await tenantFrom('goods_receipt_items')
          .select('*, medicines(*)')
          .eq('goods_receipt_id', gr.id);

      if (itemsError) throw itemsError;

      if (items && gr.status === 'verified') {
        for (const item of items as (GoodsReceiptItem & {
          medicines: Medicine;
        })[]) {
          if (!item.medicines) continue;

          const currentMedicineStock = Number(
            item.medicines.stock ?? 0
          );

          const newMedicineStock = Math.max(
            0,
            currentMedicineStock -
              Number(item.quantity ?? 0)
          );

          const { error: medicineError } =
            await tenantFrom('medicines')
              .update({
                stock: newMedicineStock,
                updated_at: new Date().toISOString(),
              })
              .eq('id', item.medicine_id);

          if (medicineError) throw medicineError;

          const { data: batch, error: batchError } =
            await tenantFrom('medicine_batches')
              .select('*')
              .eq('medicine_id', item.medicine_id)
              .eq('batch_number', item.batch_number)
              .maybeSingle();

          if (batchError) throw batchError;

          if (batch) {
            const currentBatchStock = Number(
              batch.stock_quantity ??
                batch.quantity ??
                0
            );

            const newBatchStock =
              currentBatchStock -
              Number(item.quantity ?? 0);

            if (newBatchStock <= 0) {
              const { error: deleteBatchError } =
                await tenantFrom('medicine_batches')
                  .delete()
                  .eq('id', batch.id);

              if (deleteBatchError) {
                throw deleteBatchError;
              }
            } else {
              const { error: updateBatchError } =
                await tenantFrom('medicine_batches')
                  .update({
                    quantity: newBatchStock,
                    stock_quantity: newBatchStock,
                  })
                  .eq('id', batch.id);

              if (updateBatchError) {
                throw updateBatchError;
              }
            }
          }
        }
      }

      const { error: itemsDeleteError } =
        await tenantFrom('goods_receipt_items')
          .delete()
          .eq('goods_receipt_id', gr.id);

      if (itemsDeleteError) {
        throw itemsDeleteError;
      }

      const { error: receiptDeleteError } =
        await tenantFrom('goods_receipts')
          .delete()
          .eq('id', gr.id);

      if (receiptDeleteError) {
        throw receiptDeleteError;
      }

      if (gr.purchase_order_id) {
        const { error: poError } =
          await tenantFrom('purchase_orders')
            .update({
              status: 'sent',
            })
            .eq('id', gr.purchase_order_id);

        if (poError) throw poError;
      }

      await loadReceipts();

      alert(
        `Penerimaan "${gr.receipt_number}" berhasil dihapus.`
      );
    } catch (err: any) {
      console.error(
        'Gagal menghapus penerimaan:',
        err
      );

      alert(
        'Gagal menghapus penerimaan: ' +
          (err?.message || 'Terjadi kesalahan')
      );
    }
  }

  async function verifyGR(gr: GoodsReceipt) {
    if (
      !confirm(
        `Verifikasi penerimaan "${gr.receipt_number}"? Stok obat akan diperbarui.`
      )
    ) {
      return;
    }

    try {
      const { data: items, error: itemsError } =
        await tenantFrom('goods_receipt_items')
          .select('*, medicines(*)')
          .eq('goods_receipt_id', gr.id);

      if (itemsError) throw itemsError;

      if (!items || items.length === 0) {
        alert('Tidak ada item pada penerimaan ini.');
        return;
      }

      for (const item of items as (GoodsReceiptItem & {
        medicines: Medicine;
      })[]) {
        if (!item.medicines) {
          throw new Error(
            `Data obat tidak ditemukan untuk item ${item.id}`
          );
        }

        const modal =
          item.cost_price &&
          Number(item.cost_price) > 0
            ? Number(item.cost_price)
            : Number(item.unit_price);

        const currentMedicineStock = Number(
          item.medicines.stock ?? 0
        );

        const newMedicineStock =
          currentMedicineStock +
          Number(item.quantity ?? 0);

        const { error: medicineError } =
          await tenantFrom('medicines')
            .update({
              stock: newMedicineStock,
              buy_price: modal,
              sell_price:
                item.sell_price &&
                Number(item.sell_price) > 0
                  ? item.sell_price
                  : item.medicines.sell_price,
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.medicine_id);

        if (medicineError) {
          throw medicineError;
        }

        const { data: existingBatch, error: batchLookupError } =
          await tenantFrom('medicine_batches')
            .select('*')
            .eq('medicine_id', item.medicine_id)
            .eq('batch_number', item.batch_number)
            .maybeSingle();

        if (batchLookupError) {
          throw batchLookupError;
        }

        if (existingBatch) {
          const currentBatchStock = Number(
            existingBatch.stock_quantity ??
              existingBatch.quantity ??
              0
          );

          const newBatchStock =
            currentBatchStock +
            Number(item.quantity ?? 0);

          const { error: batchUpdateError } =
            await tenantFrom('medicine_batches')
              .update({
                quantity: newBatchStock,
                stock_quantity: newBatchStock,
                expiry_date: item.expiry_date,
                buy_price: modal,
              })
              .eq('id', existingBatch.id);

          if (batchUpdateError) {
            throw batchUpdateError;
          }
        } else {
          const { error: batchInsertError } =
            await tenantFrom('medicine_batches')
              .insert({
                medicine_id: item.medicine_id,
                batch_number: item.batch_number,
                expiry_date: item.expiry_date,
                quantity: item.quantity,
                stock_quantity: item.quantity,
                buy_price: modal,
              });

          if (batchInsertError) {
            throw batchInsertError;
          }
        }
      }

      const { error: receiptError } =
        await tenantFrom('goods_receipts')
          .update({
            status: 'verified',
          })
          .eq('id', gr.id);

      if (receiptError) {
        throw receiptError;
      }

      if (gr.purchase_order_id) {
        const { error: poError } =
          await tenantFrom('purchase_orders')
            .update({
              status: 'received',
            })
            .eq('id', gr.purchase_order_id);

        if (poError) {
          throw poError;
        }
      }

      await loadReceipts();

      alert(
        `Penerimaan "${gr.receipt_number}" berhasil diverifikasi.`
      );
    } catch (err: any) {
      console.error(
        'Gagal memverifikasi penerimaan:',
        err
      );

      alert(
        'Gagal memverifikasi penerimaan: ' +
          (err?.message || 'Terjadi kesalahan')
      );
    }
  }

  async function viewDetail(id: string) {
    try {
      const { data, error } =
        await tenantFrom('goods_receipts')
          .select(
            '*, suppliers(*), purchase_orders(*), goods_receipt_items(*, medicines(*))'
          )
          .eq('id', id)
          .single();

      if (error) throw error;

      setViewGR(data as any);
    } catch (error) {
      console.error(
        'Gagal memuat detail penerimaan:',
        error
      );

      alert('Gagal memuat detail penerimaan.');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Penerimaan Obat
          </h1>

          <p className="text-gray-500 text-sm mt-1">
            Terima barang dari PBF dan perbarui stok
          </p>
        </div>

        <button
          onClick={() => setShowForm(true)}
          className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors"
        >
          <Plus size={16} />
          Terima Barang
        </button>
      </div>

      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nomor penerimaan atau supplier..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3">
                  No. Penerimaan
                </th>

                <th className="text-left px-4 py-3">
                  Supplier
                </th>

                <th className="text-left px-4 py-3">
                  Tanggal
                </th>

                <th className="text-left px-4 py-3">
                  No. Invoice
                </th>

                <th className="text-center px-4 py-3">
                  Status
                </th>

                <th className="text-center px-4 py-3">
                  Aksi
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-50">
              {filtered.map((gr) => (
                <tr
                  key={gr.id}
                  className="hover:bg-gray-50/50 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-teal-600 font-medium">
                    {gr.receipt_number}
                  </td>

                  <td className="px-4 py-3 text-gray-700">
                    {gr.suppliers?.name}
                  </td>

                  <td className="px-4 py-3 text-gray-500">
                    {formatDate(gr.receipt_date)}
                  </td>

                  <td className="px-4 py-3 text-gray-500">
                    {gr.invoice_number ?? '-'}
                  </td>

                  <td className="px-4 py-3 text-center">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        gr.status === 'verified'
                          ? 'bg-green-100 text-green-600'
                          : gr.status === 'cancelled'
                          ? 'bg-red-100 text-red-600'
                          : 'bg-orange-100 text-orange-600'
                      }`}
                    >
                      {gr.status === 'verified'
                        ? 'Terverifikasi'
                        : gr.status === 'cancelled'
                        ? 'Dibatalkan'
                        : 'Pending'}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => void viewDetail(gr.id)}
                        title="Lihat"
                        className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Eye size={14} />
                      </button>

                      <button
                        onClick={() => void printGR(gr.id)}
                        title="Print Berita Acara"
                        className="p-1.5 text-gray-400 hover:text-teal-500 hover:bg-teal-50 rounded-lg transition-colors"
                      >
                        <Printer size={14} />
                      </button>

                      {gr.status === 'pending' && (
                        <button
                          onClick={() => void verifyGR(gr)}
                          title="Verifikasi & Update Stok"
                          className="p-1.5 text-gray-400 hover:text-green-500 hover:bg-green-50 rounded-lg transition-colors"
                        >
                          <CheckCircle size={14} />
                        </button>
                      )}

                      <button
                        onClick={() => void deleteGR(gr)}
                        title="Hapus"
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="text-center text-gray-400 py-16">
            <PackageCheck
              size={32}
              className="mx-auto mb-2 text-gray-300"
            />

            <p>Belum ada penerimaan barang</p>
          </div>
        )}
      </div>

      {showForm && (
        <GRForm
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            void loadReceipts();
          }}
        />
      )}

      {viewGR && (
        <GRDetail
          gr={viewGR}
          onClose={() => setViewGR(null)}
          onVerify={() => {
            void verifyGR(viewGR);
            setViewGR(null);
          }}
          onPrint={() => void printGR(viewGR.id)}
        />
      )}
    </div>
  );
}

async function printGR(grId: string) {
  try {
    const { data: gr, error } =
      await tenantFrom('goods_receipts')
        .select(
          '*, suppliers(*), purchase_orders(*), goods_receipt_items(*, medicines(*))'
        )
        .eq('id', grId)
        .single();

    if (error) throw error;

    if (!gr) return;

    const settings = await fetchSettings();

    printBeritaAcara(gr, settings);
  } catch (error) {
    console.error(
      'Gagal mencetak penerimaan:',
      error
    );

    alert('Gagal menyiapkan dokumen untuk dicetak.');
  }
}

function printBeritaAcara(
  gr: any,
  settings: Settings
) {
  const receiptDate = new Date(gr.receipt_date);

  const dateStr =
    receiptDate.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

  const timeStr =
    receiptDate.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });

  const fmtMoney = (v: number) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(v || 0);

  const itemRows = gr.goods_receipt_items
    .map((item: any, idx: number) => {
      const med = item.medicines;

      const expDate =
        new Date(
          item.expiry_date
        ).toLocaleDateString('id-ID', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });

      const base =
        Number(item.quantity) *
        Number(item.unit_price);

      const disc = Number(item.discount ?? 0);
      const tax = Number(item.tax ?? 0);

      const sub =
        base - disc + tax;

      return `
        <tr>
          <td style="text-align:center;padding:6px 4px;border:1px solid #ccc;">${idx + 1}</td>
          <td style="padding:6px 8px;border:1px solid #ccc;">${med?.name ?? '-'}</td>
          <td style="padding:6px 8px;border:1px solid #ccc;">${med?.form ?? '-'} ${med?.strength ?? ''}</td>
          <td style="text-align:center;padding:6px 8px;border:1px solid #ccc;">${item.quantity}</td>
          <td style="text-align:center;padding:6px 8px;border:1px solid #ccc;">${item.batch_number}</td>
          <td style="text-align:center;padding:6px 8px;border:1px solid #ccc;">${expDate}</td>
          <td style="text-align:right;padding:6px 8px;border:1px solid #ccc;">${fmtMoney(item.unit_price)}</td>
          <td style="text-align:right;padding:6px 8px;border:1px solid #ccc;">${fmtMoney(disc)}</td>
          <td style="text-align:right;padding:6px 8px;border:1px solid #ccc;">${fmtMoney(tax)}</td>
          <td style="text-align:right;padding:6px 8px;border:1px solid #ccc;font-weight:bold;">${fmtMoney(sub)}</td>
        </tr>
      `;
    })
    .join('');

  const condition =
    gr.package_condition || 'Baik';

  const sumSubtotal =
    gr.goods_receipt_items.reduce(
      (s: number, i: any) =>
        s +
        Number(i.quantity) *
          Number(i.unit_price),
      0
    );

  const sumDiscount =
    gr.goods_receipt_items.reduce(
      (s: number, i: any) =>
        s + Number(i.discount ?? 0),
      0
    );

  const sumTax =
    gr.goods_receipt_items.reduce(
      (s: number, i: any) =>
        s + Number(i.tax ?? 0),
      0
    );

  const sumTotal =
    sumSubtotal -
    sumDiscount +
    sumTax;

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Berita Acara ${gr.receipt_number}</title>

<style>
  * {
    font-family: 'Times New Roman', serif;
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    padding: 20px;
    color: #000;
  }

  .doc-header {
    text-align: center;
    margin-bottom: 20px;
  }

  .doc-title {
    font-size: 18px;
    font-weight: bold;
    text-transform: uppercase;
  }

  .doc-subtitle {
    font-size: 13px;
    margin-top: 4px;
  }

  .section {
    margin-bottom: 14px;
  }

  .section-title {
    font-weight: bold;
    font-size: 12px;
    text-transform: uppercase;
    border-bottom: 1px solid #000;
    padding-bottom: 2px;
    margin-bottom: 6px;
  }

  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    font-size: 12px;
  }

  .info-row {
    margin-bottom: 2px;
  }

  .info-label {
    display: inline-block;
    width: 150px;
    font-weight: bold;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
    margin-top: 8px;
  }

  th {
    background: #f0f0f0;
    font-weight: bold;
  }

  .condition-box {
    margin-top: 10px;
    padding: 8px 12px;
    border: 1px solid #ccc;
    font-size: 12px;
  }

  .footer-note {
    margin-top: 20px;
    font-size: 11px;
    color: #555;
    border-top: 1px dashed #999;
    padding-top: 8px;
  }

  @media print {
    body {
      padding: 10px;
    }
  }
</style>
</head>

<body>

<div class="doc-header">
  <div class="doc-title">
    BERITA ACARA PENERIMAAN BARANG
  </div>

  <div class="doc-subtitle">
    No: ${gr.receipt_number}
  </div>
</div>

<div class="section">
  <div class="section-title">
    A. Identitas Pengirim (PBF / Distributor)
  </div>

  <div class="info-grid">
    <div>
      <div class="info-row">
        <span class="info-label">Nama PBF:</span>
        ${gr.suppliers?.name ?? '-'}
      </div>

      <div class="info-row">
        <span class="info-label">Alamat:</span>
        ${gr.suppliers?.address ?? '-'}
      </div>

      <div class="info-row">
        <span class="info-label">Telepon:</span>
        ${gr.suppliers?.phone ?? '-'}
      </div>
    </div>

    <div>
      <div class="info-row">
        <span class="info-label">No. Izin PBF:</span>
        ${gr.suppliers?.pbf_license ?? '-'}
      </div>

      <div class="info-row">
        <span class="info-label">Contact Person:</span>
        ${gr.suppliers?.contact_person ?? '-'}
      </div>
    </div>
  </div>
</div>

<div class="section">
  <div class="section-title">
    B. Identitas Penerima (Fasilitas Kefarmasian)
  </div>

  <div class="info-grid">
    <div>
      <div class="info-row">
        <span class="info-label">Nama Fasilitas:</span>
        ${settings.pharmacy_name}
      </div>

      <div class="info-row">
        <span class="info-label">Alamat:</span>
        ${settings.pharmacy_address}
      </div>

      <div class="info-row">
        <span class="info-label">Telepon:</span>
        ${settings.pharmacy_phone}
      </div>
    </div>

    <div>
      <div class="info-row">
        <span class="info-label">No. SIA:</span>
        ${settings.sia_number || '-'}
      </div>

      <div class="info-row">
        <span class="info-label">No. SIPA APJ:</span>
        ${settings.sipa_number || '-'}
      </div>
    </div>
  </div>
</div>

<div class="section">
  <div class="section-title">
    C. Informasi Dokumen
  </div>

  <div class="info-grid">
    <div>
      <div class="info-row">
        <span class="info-label">Nomor Dokumen:</span>
        ${gr.receipt_number}
      </div>

      <div class="info-row">
        <span class="info-label">No. Surat Jalan/Invoice:</span>
        ${gr.invoice_number ?? '-'}
      </div>
    </div>

    <div>
      <div class="info-row">
        <span class="info-label">Tanggal Penerimaan:</span>
        ${dateStr}, ${timeStr}
      </div>

      <div class="info-row">
        <span class="info-label">No. Acuan SP:</span>
        ${gr.purchase_orders?.po_number ?? '-'}
      </div>
    </div>
  </div>
</div>

<div class="section">
  <div class="section-title">
    D. Rincian Obat yang Diterima
  </div>

  <table>
    <thead>
      <tr>
        <th style="padding:6px;border:1px solid #ccc;">No</th>
        <th style="padding:6px;border:1px solid #ccc;">Nama Obat</th>
        <th style="padding:6px;border:1px solid #ccc;">Bentuk</th>
        <th style="padding:6px;border:1px solid #ccc;">Qty</th>
        <th style="padding:6px;border:1px solid #ccc;">Batch</th>
        <th style="padding:6px;border:1px solid #ccc;">Kadaluarsa</th>
        <th style="padding:6px;border:1px solid #ccc;">Harga</th>
        <th style="padding:6px;border:1px solid #ccc;">Diskon</th>
        <th style="padding:6px;border:1px solid #ccc;">PPN</th>
        <th style="padding:6px;border:1px solid #ccc;">Subtotal</th>
      </tr>
    </thead>

    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <div style="margin-top:10px;display:flex;justify-content:flex-end;">
    <table style="font-size:12px;min-width:280px;">
      <tr>
        <td style="padding:4px 8px;">Subtotal Harga</td>
        <td style="text-align:right;padding:4px 8px;">
          ${fmtMoney(sumSubtotal)}
        </td>
      </tr>

      <tr>
        <td style="padding:4px 8px;">Total Diskon</td>
        <td style="text-align:right;padding:4px 8px;">
          -${fmtMoney(sumDiscount)}
        </td>
      </tr>

      <tr>
        <td style="padding:4px 8px;">Total PPN</td>
        <td style="text-align:right;padding:4px 8px;">
          ${fmtMoney(sumTax)}
        </td>
      </tr>

      <tr style="border-top:2px solid #333;">
        <td style="padding:6px 8px;font-weight:bold;">
          Total Harga
        </td>

        <td style="text-align:right;padding:6px 8px;font-weight:bold;">
          ${fmtMoney(sumTotal)}
        </td>
      </tr>
    </table>
  </div>
</div>

<div class="section">
  <div class="section-title">
    E. Hasil Pemeriksaan Kondisi Fisik Barang
  </div>

  <div class="condition-box">
    <strong>Kondisi Kemasan:</strong>
    ${condition}

    <br />

    Catatan:
    ${gr.notes || '-'}
  </div>
</div>

${
  gr.notes
    ? `<div class="footer-note">
        <strong>Catatan:</strong>
        ${gr.notes}
      </div>`
    : ''
}

</body>
</html>
`;

  const iframe =
    document.createElement('iframe');

  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';

  document.body.appendChild(iframe);

  const doc =
    iframe.contentWindow?.document;

  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  iframe.contentWindow?.focus();

  setTimeout(() => {
    iframe.contentWindow?.print();

    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 1000);
  }, 300);
}

function GRForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [suppliers, setSuppliers] =
    useState<Supplier[]>([]);

  const [medicines, setMedicines] =
    useState<Medicine[]>([]);

  const [pos, setPos] =
    useState<PurchaseOrder[]>([]);

  const [supplierId, setSupplierId] =
    useState('');

  const [poId, setPoId] =
    useState('');

  const [invoiceNumber, setInvoiceNumber] =
    useState('');

  const [notes, setNotes] =
    useState('');

  const [packageCondition, setPackageCondition] =
    useState('Baik');

  const [items, setItems] = useState<{
  medicine: Medicine;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  sellPrice: number;
  priceRegular: number;
  pricePrescription: number;
  priceDoctor: number;
  discountPercent: number;
  taxPercent: number;
  isNew?: boolean;
}[]>([]);

  const [
    pendingHppChanges,
    setPendingHppChanges,
  ] = useState<
    {
      medicine: Medicine;
      receivedCost: number;
      regularPrice: number;
      prescriptionPrice: number;
      doctorPrice: number;
    }[]
  >([]);

  const [medSearch, setMedSearch] =
    useState('');

  const [saving, setSaving] =
    useState(false);

  const [showNewMed, setShowNewMed] =
    useState(false);

  const [newMed, setNewMed] = useState({
    name: '',
    form: 'Tablet',
    unit: 'strip',
    pieces_per_strip: 10,
    category: '',
    sell_price: 0,
    price_regular: 0,
    price_prescription: 0,
    price_doctor: 0,
    buy_price: 0,
  });

  useEffect(() => {
    void loadInitialData();
  }, []);

  async function loadInitialData() {
    try {
      const [
        suppliersResponse,
        medicinesResponse,
        posResponse,
      ] = await Promise.all([
        tenantFrom('suppliers')
          .select('*')
          .eq('is_active', true)
          .order('name'),

        tenantFrom('medicines')
          .select('*')
          .eq('is_active', true)
          .order('name'),

        tenantFrom('purchase_orders')
          .select('*')
          .in('status', ['sent', 'partial'])
          .order('created_at', {
            ascending: false,
          }),
      ]);

      setSuppliers(
        (suppliersResponse.data ?? []) as Supplier[]
      );

      setMedicines(
        (medicinesResponse.data ?? []) as Medicine[]
      );

      setPos(
        (posResponse.data ?? []) as PurchaseOrder[]
      );
    } catch (error) {
      console.error(
        'Gagal memuat data penerimaan:',
        error
      );
    }
  }

  async function loadPOItems(poId: string) {
  setPoId(poId);

  const { data: poItems } = await tenantFrom('purchase_order_items')
    .select('*, medicines(*)')
    .eq('purchase_order_id', poId);

  if (poItems) {
    const { data: po } = await tenantFrom('purchase_orders')
      .select('supplier_id')
      .eq('id', poId)
      .single();

    setSupplierId(po?.supplier_id ?? '');

    setItems(
      (poItems as any).map((i: any) => ({
        medicine: i.medicines,
        batchNumber: '',
        expiryDate: '',
        quantity: i.quantity,
        unit: i.unit ?? i.medicines?.unit ?? 'pcs',

        unitPrice: i.unit_price ?? i.medicines?.buy_price ?? 0,

        sellPrice:
          i.medicines?.price_regular ??
          i.medicines?.sell_price ??
          0,

        priceRegular:
          i.medicines?.price_regular ??
          i.medicines?.sell_price ??
          0,

        pricePrescription:
          i.medicines?.price_prescription ??
          i.medicines?.price_regular ??
          i.medicines?.sell_price ??
          0,

        priceDoctor:
          i.medicines?.price_doctor ??
          i.medicines?.price_regular ??
          i.medicines?.sell_price ??
          0,

        discountPercent: 0,
        taxPercent: 0,
      }))
    );
  }
}

  const filteredMeds = medicines.filter(
    (m) =>
      m.name
        .toLowerCase()
        .includes(
          medSearch.toLowerCase()
        ) &&
      !items.find(
        (i) =>
          i.medicine.id === m.id
      )
  );

  function addMed(med: Medicine) {
  setItems(prev => [
    ...prev,
    {
      medicine: med,
      batchNumber: '',
      expiryDate: '',
      quantity: 1,
      unit: med.unit || 'pcs',

      unitPrice: med.buy_price || 0,

      sellPrice:
        med.price_regular ??
        med.sell_price ??
        0,

      priceRegular:
        med.price_regular ??
        med.sell_price ??
        0,

      pricePrescription:
        med.price_prescription ??
        med.price_regular ??
        med.sell_price ??
        0,

      priceDoctor:
        med.price_doctor ??
        med.price_regular ??
        med.sell_price ??
        0,

      discountPercent: 0,
      taxPercent: 0,
    }
  ]);

  setMedSearch('');
}

  async function createNewMedicine() {
    if (!newMed.name.trim()) {
      alert('Nama obat wajib diisi');
      return;
    }

    const isStrip =
      newMed.form === 'Tablet' ||
      newMed.form === 'Kapsul';

    try {
      const { data, error } =
        await tenantFrom('medicines')
          .insert({
            name: newMed.name.trim(),
            generic_name:
              newMed.name.trim(),
            category:
              newMed.category.trim() ||
              'Lainnya',
            form: newMed.form,
            unit: isStrip
              ? 'strip'
              : newMed.unit,
            pieces_per_strip: isStrip
              ? newMed.pieces_per_strip
              : 1,
            sell_price:
              newMed.sell_price,
            price_regular:
              newMed.price_regular ||
              newMed.sell_price,
            price_prescription:
              newMed.price_prescription ||
              newMed.sell_price,
            price_doctor:
              newMed.price_doctor,
            buy_price:
              newMed.buy_price,
            stock: 0,
            min_stock: 10,
            requires_prescription: false,
            is_active: true,
          })
          .select()
          .single();

      if (error) throw error;

      const med = data as Medicine;

      setMedicines((prev) => [
        ...prev,
        med,
      ]);

  setItems(prev => [
  ...prev,
  {
    medicine: med,
    batchNumber: '',
    expiryDate: '',
    quantity: 1,
    unit: med.unit || 'pcs',
    unitPrice: med.buy_price || 0,

    sellPrice:
      med.price_regular ??
      med.sell_price ??
      0,

    priceRegular:
      med.price_regular ??
      med.sell_price ??
      0,

    pricePrescription:
      med.price_prescription ??
      med.price_regular ??
      med.sell_price ??
      0,

    priceDoctor:
      med.price_doctor ??
      med.price_regular ??
      med.sell_price ??
      0,

    discountPercent: 0,
    taxPercent: 0,
    isNew: true,
  }
]);
      setNewMed({
        name: '',
        form: 'Tablet',
        unit: 'strip',
        pieces_per_strip: 10,
        category: '',
        sell_price: 0,
        price_regular: 0,
        price_prescription: 0,
        price_doctor: 0,
        buy_price: 0,
      });

      setShowNewMed(false);
      setMedSearch('');
    } catch (err: any) {
      console.error(
        'Gagal membuat obat baru:',
        err
      );

      alert(
        'Gagal membuat obat baru: ' +
          (err?.message ||
            'Terjadi kesalahan')
      );
    }
  }

  function lineBase(
    i: typeof items[number]
  ) {
    return (
      Number(i.quantity) *
      Number(i.unitPrice)
    );
  }

  function discountNominal(
    i: typeof items[number]
  ) {
    return (
      lineBase(i) *
      Number(i.discountPercent) /
      100
    );
  }

  function taxNominal(
    i: typeof items[number]
  ) {
    return (
      (lineBase(i) -
        discountNominal(i)) *
      Number(i.taxPercent) /
      100
    );
  }

  function lineTotal(
    i: typeof items[number]
  ) {
    return (
      lineBase(i) -
      discountNominal(i) +
      taxNominal(i)
    );
  }

  function costPerUnit(
    i: typeof items[number]
  ) {
    return Number(i.quantity) > 0
      ? lineTotal(i) /
          Number(i.quantity)
      : 0;
  }

  function projectedPrices(
    i: typeof items[number]
  ) {
    const oldCost =
      Number(i.medicine.buy_price ?? 0);

    const receivedCost =
      costPerUnit(i);

    const currentRegular =
      Number(
        i.medicine.price_regular ??
          i.medicine.sell_price ??
          0
      );

    const currentPrescription =
      Number(
        i.medicine.price_prescription ??
          i.medicine.sell_price ??
          0
      );

    const currentDoctor =
      Number(
        i.medicine.price_doctor ??
          i.medicine.price_regular ??
          i.medicine.sell_price ??
          0
      );

    const regularMargin =
      oldCost > 0
        ? (currentRegular - oldCost) /
          oldCost
        : 0.3;

    const prescriptionMargin =
      oldCost > 0
        ? (currentPrescription -
            oldCost) /
          oldCost
        : regularMargin;

    const doctorMargin =
      oldCost > 0
        ? (currentDoctor - oldCost) /
          oldCost
        : regularMargin;

    return {
      regular: Math.round(
        receivedCost *
          (1 +
            Math.max(
              0,
              regularMargin
            ))
      ),

      prescription: Math.round(
        receivedCost *
          (1 +
            Math.max(
              0,
              prescriptionMargin
            ))
      ),

      doctor: Math.round(
        receivedCost *
          (1 +
            Math.max(
              0,
              doctorMargin
            ))
      ),
    };
  }

  const subtotal =
    items.reduce(
      (s, i) =>
        s + lineBase(i),
      0
    );

  const totalDiscount =
    items.reduce(
      (s, i) =>
        s +
        discountNominal(i),
      0
    );

  const totalTax =
    items.reduce(
      (s, i) =>
        s + taxNominal(i),
      0
    );

  const grandTotal =
    subtotal -
    totalDiscount +
    totalTax;

  function calculateHppChanges() {
    return items
      .filter(
        (item) =>
          item.unitPrice > 0 &&
          Math.abs(
            item.unitPrice -
              Number(
                item.medicine.buy_price ??
                  0
              )
          ) > 0.01
      )
      .map((item) => {
        const oldCost =
          Number(
            item.medicine.buy_price ??
              0
          );

        const receivedCost =
          costPerUnit(item);

        const regularMargin =
          oldCost > 0
            ? (
                Number(
                  item.medicine.price_regular ??
                    item.medicine.sell_price ??
                    0
                ) - oldCost
              ) / oldCost
            : 0.3;

        const prescriptionMargin =
          oldCost > 0
            ? (
                Number(
                  item.medicine.price_prescription ??
                    item.medicine.sell_price ??
                    0
                ) - oldCost
              ) / oldCost
            : regularMargin;

        const doctorMargin =
          oldCost > 0
            ? (
                Number(
                  item.medicine.price_doctor ??
                    item.medicine.price_regular ??
                    item.medicine.sell_price ??
                    0
                ) - oldCost
              ) / oldCost
            : regularMargin;

        return {
          medicine: item.medicine,
          receivedCost,

          regularPrice: Math.round(
            receivedCost *
              (1 +
                Math.max(
                  0,
                  regularMargin
                ))
          ),

          prescriptionPrice:
            Math.round(
              receivedCost *
                (1 +
                  Math.max(
                    0,
                    prescriptionMargin
                  ))
            ),

          doctorPrice: Math.round(
            receivedCost *
              (1 +
                Math.max(
                  0,
                  doctorMargin
                ))
          ),
        };
      });
  }

  async function save(
    updateHpp?: boolean
  ) {
    if (
      !supplierId ||
      items.length === 0 ||
      items.some(
        (i) =>
          !i.batchNumber ||
          !i.expiryDate ||
          Number(i.unitPrice) <= 0 ||
          Number(i.quantity) <= 0
      )
    ) {
      alert(
        'Lengkapi supplier, batch number, tanggal kadaluarsa, jumlah, dan Harga Beli/Unit (> 0)!'
      );

      return;
    }

    if (updateHpp === undefined) {
      const changes =
        calculateHppChanges();

      if (changes.length > 0) {
        setPendingHppChanges(
          changes
        );

        return;
      }
    }

    setSaving(true);

    try {
      if (updateHpp) {
        for (const change of pendingHppChanges) {
          const {
            error: medicineError,
          } =
            await tenantFrom('medicines')
              .update({
                buy_price:
                  change.receivedCost,
                price_regular:
                  change.regularPrice,
                price_prescription:
                  change.prescriptionPrice,
                price_doctor:
                  change.doctorPrice,
                sell_price:
                  change.regularPrice,
                updated_at:
                  new Date().toISOString(),
              })
              .eq(
                'id',
                change.medicine.id
              );

          if (medicineError) {
            throw medicineError;
          }
        }
      }

      const receiptNumber =
        generateReceiptNumber();

      const { data: gr, error } =
        await tenantFrom('goods_receipts')
          .insert({
            receipt_number:
              receiptNumber,
            purchase_order_id:
              poId || null,
            supplier_id:
              supplierId,
            invoice_number:
              invoiceNumber || null,
            total_amount:
              grandTotal,
            notes,
            package_condition:
              packageCondition,
            status: 'pending',
          })
          .select()
          .single();

      if (error) throw error;

      const {
        error: itemsError,
      } =
        await tenantFrom('goods_receipt_items')
          .insert(
            items.map((i) => ({
              goods_receipt_id:
                gr.id,
              medicine_id:
                i.medicine.id,
              batch_number:
                i.batchNumber,
              expiry_date:
                i.expiryDate,
              quantity:
                i.quantity,
              unit:
                i.unit,
              unit_price:
                i.unitPrice,
              discount:
                discountNominal(i),
              tax:
                taxNominal(i),
              discount_percent:
                i.discountPercent,
              tax_percent:
                i.taxPercent,
              sell_price:
                i.sellPrice,
              cost_price:
                costPerUnit(i),
              total_price:
                lineTotal(i),
            }))
          );

      if (itemsError) {
        throw itemsError;
      }

      onSaved();
    } catch (err: any) {
      console.error(
        'Gagal menyimpan penerimaan:',
        err
      );

      alert(
        'Gagal menyimpan penerimaan: ' +
          (err?.message ||
            'Terjadi kesalahan')
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Terima Barang"
      onClose={onClose}
      wide
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dari PO (opsional)">
            <select
              value={poId}
              onChange={(e) =>
                void loadPOItems(
                  e.target.value
                )
              }
              className="input"
            >
              <option value="">
                - Tanpa PO / Langsung -
              </option>

              {pos.map((p) => (
                <option
                  key={p.id}
                  value={p.id}
                >
                  {p.po_number}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Supplier / PBF">
            <select
              value={supplierId}
              onChange={(e) =>
                setSupplierId(
                  e.target.value
                )
              }
              className="input"
            >
              <option value="">
                - Pilih -
              </option>

              {suppliers.map((s) => (
                <option
                  key={s.id}
                  value={s.id}
                >
                  {s.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="No. Invoice Supplier">
            <input
              value={invoiceNumber}
              onChange={(e) =>
                setInvoiceNumber(
                  e.target.value
                )
              }
              className="input"
              placeholder="INV-..."
            />
          </Field>

          <Field label="Kondisi Kemasan">
            <select
              value={packageCondition}
              onChange={(e) =>
                setPackageCondition(
                  e.target.value
                )
              }
              className="input"
            >
              <option value="Baik">
                Baik (utuh, tersegel)
              </option>

              <option value="Rusak ringan">
                Rusak ringan
              </option>

              <option value="Rusak / Bocor">
                Rusak / Bocor
              </option>

              <option value="Tidak sesuai pesanan">
                Tidak sesuai pesanan
              </option>
            </select>
          </Field>

          <Field label="Catatan">
            <input
              value={notes}
              onChange={(e) =>
                setNotes(
                  e.target.value
                )
              }
              className="input"
            />
          </Field>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              value={medSearch}
              onChange={(e) =>
                setMedSearch(
                  e.target.value
                )
              }
              placeholder="Cari obat..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            />

            {medSearch &&
              filteredMeds.length > 0 && (
                <div className="absolute z-20 w-full bg-white border border-gray-200 rounded-xl shadow-lg mt-1 max-h-48 overflow-y-auto">
                  {filteredMeds
                    .slice(0, 8)
                    .map((m) => (
                      <button
                        key={m.id}
                        onClick={() =>
                          addMed(m)
                        }
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                      >
                        {m.name}
                      </button>
                    ))}
                </div>
              )}
          </div>

          <button
            type="button"
            onClick={() =>
              setShowNewMed(
                (s) => !s
              )
            }
            className="shrink-0 px-3 py-2 border border-teal-200 text-teal-600 rounded-xl text-sm font-medium hover:bg-teal-50 flex items-center gap-1.5"
          >
            <Plus size={16} />
            Obat Baru
          </button>
        </div>

        {showNewMed && (
          <div className="border border-teal-100 bg-teal-50/50 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-teal-700">
              Tambah Obat Baru
            </p>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Nama Obat">
                <input
                  value={newMed.name}
                  onChange={(e) =>
                    setNewMed({
                      ...newMed,
                      name: e.target.value,
                    })
                  }
                  className="input"
                  placeholder="Nama obat"
                />
              </Field>

              <Field label="Kategori">
                <select
                  value={
                    newMed.category ===
                      'Lainnya' ||
                    newMed.category.startsWith(
                      'Lainnya: '
                    )
                      ? 'Lainnya'
                      : newMed.category
                  }
                  onChange={(e) =>
                    setNewMed({
                      ...newMed,
                      category:
                        e.target.value,
                    })
                  }
                  className="input"
                >
                  <option value="">
                    - Pilih -
                  </option>

                  <option>
                    Obat Bebas
                  </option>

                  <option>
                    Obat Bebas Terbatas
                  </option>

                  <option>
                    Obat Keras
                  </option>

                  <option>
                    Obat Narkotika
                  </option>

                  <option>
                    Obat Herbal
                  </option>

                  <option>
                    Suplemen
                  </option>

                  <option>
                    Minuman
                  </option>

                  <option>
                    Alat Kesehatan
                  </option>

                  <option>
                    Lainnya
                  </option>
                </select>
              </Field>

              {newMed.category ===
                'Lainnya' && (
                <Field label="Sebutkan Kategori">
                  <input
                    value={
                      newMed.category.startsWith(
                        'Lainnya: '
                      )
                        ? newMed.category.substring(
                            10
                          )
                        : ''
                    }
                    onChange={(e) =>
                      setNewMed({
                        ...newMed,
                        category:
                          e.target.value
                            ? `Lainnya: ${e.target.value}`
                            : 'Lainnya',
                      })
                    }
                    className="input"
                    placeholder="Ketik kategori..."
                  />
                </Field>
              )}

              <Field label="Bentuk Sediaan">
                <select
                  value={newMed.form}
                  onChange={(e) => {
                    const f =
                      e.target.value;

                    const isStrip =
                      f === 'Tablet' ||
                      f === 'Kapsul';

                    setNewMed({
                      ...newMed,
                      form: f,
                      unit: isStrip
                        ? 'strip'
                        : newMed.unit,
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

              {(newMed.form ===
                'Tablet' ||
                newMed.form ===
                  'Kapsul') && (
                <Field label="Jumlah per Strip">
                  <input
                    type="number"
                    min="1"
                    value={
                      newMed.pieces_per_strip
                    }
                    onChange={(e) =>
                      setNewMed({
                        ...newMed,
                        pieces_per_strip:
                          Number(
                            e.target.value
                          ),
                      })
                    }
                    className="input"
                  />
                </Field>
              )}

              <Field label="Harga Beli / unit">
                <input
                  type="number"
                  value={
                    newMed.buy_price
                  }
                  onChange={(e) =>
                    setNewMed({
                      ...newMed,
                      buy_price:
                        Number(
                          e.target.value
                        ),
                    })
                  }
                  className="input"
                />
              </Field>

              <Field label="Harga Umum / unit">
                <input
                  type="number"
                  value={
                    newMed.price_regular
                  }
                  onChange={(e) =>
                    setNewMed({
                      ...newMed,
                      price_regular:
                        Number(
                          e.target.value
                        ),
                      sell_price:
                        Number(
                          e.target.value
                        ),
                    })
                  }
                  className="input"
                />
              </Field>

              <Field label="Harga Resep / unit">
                <input
                  type="number"
                  value={
                    newMed.price_prescription
                  }
                  onChange={(e) =>
                    setNewMed({
                      ...newMed,
                      price_prescription:
                        Number(
                          e.target.value
                        ),
                    })
                  }
                  className="input"
                />
              </Field>

              <Field label="Harga Dokter / unit">
                <input
                  type="number"
                  value={
                    newMed.price_doctor
                  }
                  onChange={(e) =>
                    setNewMed({
                      ...newMed,
                      price_doctor:
                        Number(
                          e.target.value
                        ),
                    })
                  }
                  className="input"
                />
              </Field>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() =>
                  setShowNewMed(false)
                }
                className="flex-1 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50"
              >
                Batal
              </button>

              <button
                onClick={() =>
                  void createNewMedicine()
                }
                className="flex-1 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-sm font-semibold"
              >
                Tambah ke Penerimaan
              </button>
            </div>
          </div>
        )}

        <div className="border border-gray-100 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="text-left px-2 py-2">
                  Obat
                </th>

                <th className="text-left px-2 py-2 w-28">
                  No. Batch
                </th>

                <th className="text-left px-2 py-2 w-36">
                  Kadaluarsa
                </th>

                <th className="text-center px-2 py-2 w-24">
                  Satuan
                </th>

                <th className="text-center px-2 py-2 w-20">
                  Qty
                </th>

                <th className="text-right px-2 py-2 w-28">
                  Harga Beli
                </th>

                <th className="text-right px-2 py-2 w-24">
                  Harga Umum
                </th>

                <th className="text-right px-2 py-2 w-24">
                  Harga Resep
                </th>

                <th className="text-right px-2 py-2 w-24">
                  Harga Dokter
                </th>

                <th className="text-right px-2 py-2 w-24">
                  Diskon %
                </th>

                <th className="text-right px-2 py-2 w-24">
                  PPN %
                </th>

                <th className="text-right px-2 py-2 w-28">
                  Subtotal
                </th>

                <th className="w-8" />
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-50">
              {items.map(
                (item, idx) => (
                  <tr
                    key={
                      item.medicine.id
                    }
                  >
                    <td className="px-2 py-1.5 font-medium text-gray-700 text-xs">
                      {item.medicine.name}
                    </td>

                    <td className="px-2 py-1.5">
                      <input
                        value={
                          item.batchNumber
                        }
                        onChange={(e) =>
                          setItems(
                            (prev) =>
                              prev.map(
                                (
                                  it,
                                  i
                                ) =>
                                  i === idx
                                    ? {
                                        ...it,
                                        batchNumber:
                                          e.target
                                            .value,
                                      }
                                    : it
                              )
                          )
                        }
                        placeholder="Batch"
                        className="w-full px-2 py-1 border border-gray-200 rounded text-xs"
                      />
                    </td>

                    <td className="px-2 py-1.5">
                      <input
                        type="date"
                        value={
                          item.expiryDate
                        }
                        onChange={(e) =>
                          setItems(
                            (prev) =>
                              prev.map(
                                (
                                  it,
                                  i
                                ) =>
                                  i === idx
                                    ? {
                                        ...it,
                                        expiryDate:
                                          e.target
                                            .value,
                                      }
                                    : it
                              )
                          )
                        }
                        className="w-full px-2 py-1 border border-gray-200 rounded text-xs"
                      />
                    </td>

                    <td className="px-2 py-1.5">
                      <select
                        value={
                          item.unit
                        }
                        onChange={(e) =>
                          setItems(
                            (prev) =>
                              prev.map(
                                (
                                  it,
                                  i
                                ) =>
                                  i === idx
                                    ? {
                                        ...it,
                                        unit: e
                                          .target
                                          .value,
                                      }
                                    : it
                              )
                          )
                        }
                        className="w-24 px-1 py-1 border border-gray-200 rounded text-xs"
                      >
                        <option>
                          Botol
                        </option>
                        <option>
                          Box
                        </option>
                        <option>
                          Strip
                        </option>
                        <option>
                          Pcs
                        </option>
                        <option>
                          Kapsul
                        </option>
                        <option>
                          Tablet
                        </option>
                        <option>
                          Tube
                        </option>
                        <option>
                          Ampul
                        </option>
                      </select>
                    </td>

                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        min="1"
                        value={
                          item.quantity
                        }
                        onChange={(e) =>
                          setItems(
                            (prev) =>
                              prev.map(
                                (
                                  it,
                                  i
                                ) =>
                                  i === idx
                                    ? {
                                        ...it,
                                        quantity:
                                          Number(
                                            e
                                              .target
                                              .value
                                          ),
                                      }
                                    : it
                              )
                          )
                        }
                        className="w-16 px-1 py-1 border border-gray-200 rounded text-xs text-center"
                      />
                    </td>

                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        min="0"
                        value={
                          item.unitPrice
                        }
                        onChange={(e) =>
                          setItems(
                            (prev) =>
                              prev.map(
                                (
                                  it,
                                  i
                                ) =>
                                  i === idx
                                    ? {
                                        ...it,
                                        unitPrice:
                                          Number(
                                            e
                                              .target
                                              .value
                                          ),
                                      }
                                    : it
                              )
                          )
                        }
                        className="w-24 px-1 py-1 border border-gray-200 rounded text-xs text-right"
                      />
                    </td>

                    <td className="px-2 py-1.5 text-right text-xs text-teal-700 font-semibold">
                      {formatCurrency(
                        projectedPrices(
                          item
                        ).regular
                      )}
                    </td>

                    <td className="px-2 py-1.5 text-right text-xs text-blue-700 font-semibold">
                      {formatCurrency(
                        projectedPrices(
                          item
                        ).prescription
                      )}
                    </td>

                    <td className="px-2 py-1.5 text-right text-xs text-indigo-700 font-semibold">
                      {formatCurrency(
                        projectedPrices(
                          item
                        ).doctor
                      )}
                    </td>

                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          item.discountPercent
                        }
                        onChange={(e) =>
                          setItems(
                            (prev) =>
                              prev.map(
                                (
                                  it,
                                  i
                                ) =>
                                  i === idx
                                    ? {
                                        ...it,
                                        discountPercent:
                                          Number(
                                            e
                                              .target
                                              .value
                                          ),
                                      }
                                    : it
                              )
                          )
                        }
                        className="w-20 px-1 py-1 border border-gray-200 rounded text-xs text-right"
                      />
                    </td>

                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          item.taxPercent
                        }
                        onChange={(e) =>
                          setItems(
                            (prev) =>
                              prev.map(
                                (
                                  it,
                                  i
                                ) =>
                                  i === idx
                                    ? {
                                        ...it,
                                        taxPercent:
                                          Number(
                                            e
                                              .target
                                              .value
                                          ),
                                      }
                                    : it
                              )
                          )
                        }
                        className="w-20 px-1 py-1 border border-gray-200 rounded text-xs text-right"
                      />
                    </td>

                    <td className="px-2 py-1.5 text-right font-semibold text-gray-800 text-xs">
                      {formatCurrency(
                        lineTotal(
                          item
                        )
                      )}
                    </td>

                    <td className="px-2 py-1.5">
                      <button
                        onClick={() =>
                          setItems(
                            (prev) =>
                              prev.filter(
                                (
                                  _,
                                  i
                                ) =>
                                  i !==
                                  idx
                              )
                          )
                        }
                        className="p-1 text-gray-300 hover:text-red-500"
                      >
                        <X size={12} />
                      </button>
                    </td>
                  </tr>
                )
              )}

              {items.length === 0 && (
                <tr>
                  <td
                    colSpan={13}
                    className="text-center text-gray-400 py-6"
                  >
                    Cari obat untuk ditambahkan
                  </td>
                </tr>
              )}
            </tbody>

            {items.length > 0 && (
              <tfoot className="bg-gray-50">
                <tr>
                  <td
                    colSpan={9}
                    className="px-2 py-2 text-right font-semibold text-gray-700 text-sm"
                  >
                    Subtotal
                  </td>

                  <td className="px-2 py-2 text-right font-semibold text-gray-700 text-sm">
                    -{formatCurrency(
                      totalDiscount
                    )}
                  </td>

                  <td className="px-2 py-2 text-right font-semibold text-gray-700 text-sm">
                    {formatCurrency(
                      totalTax
                    )}
                  </td>

                  <td className="px-2 py-2 text-right font-bold text-teal-600">
                    {formatCurrency(
                      grandTotal
                    )}
                  </td>

                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {items.some(
          (i) =>
            !i.batchNumber ||
            !i.expiryDate ||
            Number(i.unitPrice) <=
              0 ||
            Number(i.quantity) <=
              0
        ) && (
          <div className="flex items-center gap-2 text-orange-600 text-sm bg-orange-50 rounded-xl p-3">
            <AlertCircle size={16} />

            Pastikan batch, tanggal
            kadaluarsa, jumlah, dan Harga
            Beli/Unit sudah diisi
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Batal
          </button>

          <button
            onClick={() =>
              void save()
            }
            disabled={saving}
            className="flex-1 py-2.5 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold"
          >
            {saving
              ? 'Menyimpan...'
              : 'Simpan Penerimaan'}
          </button>
        </div>

        {pendingHppChanges.length >
          0 && (
          <div
            className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4"
            onClick={() =>
              setPendingHppChanges(
                []
              )
            }
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5"
              onClick={(e) =>
                e.stopPropagation()
              }
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                  <AlertCircle
                    size={20}
                  />
                </div>

                <div>
                  <h3 className="font-bold text-gray-900">
                    Harga beli berubah
                  </h3>

                  <p className="text-sm text-gray-500 mt-1">
                    Apakah Anda ingin
                    memperbarui HPP & Harga
                    Jual obat ini di master
                    data?
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-2 max-h-40 overflow-y-auto">
                {pendingHppChanges.map(
                  (change) => (
                    <div
                      key={
                        change.medicine.id
                      }
                      className="text-sm bg-gray-50 rounded-lg px-3 py-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-700">
                          {
                            change.medicine
                              .name
                          }
                        </span>

                        <span className="text-gray-500">
                          HPP{' '}
                          {formatCurrency(
                            change.medicine
                              .buy_price
                          )}{' '}
                          →{' '}
                          {formatCurrency(
                            change.receivedCost
                          )}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mt-1 text-xs text-gray-500">
                        <span>
                          Umum:{' '}
                          {formatCurrency(
                            change.regularPrice
                          )}
                        </span>

                        <span>
                          Resep:{' '}
                          {formatCurrency(
                            change.prescriptionPrice
                          )}
                        </span>

                        <span>
                          Dokter:{' '}
                          {formatCurrency(
                            change.doctorPrice
                          )}
                        </span>
                      </div>
                    </div>
                  )
                )}
              </div>

              <div className="flex gap-2 mt-5">
                <button
                  onClick={() => {
                    setPendingHppChanges(
                      []
                    );

                    void save(false);
                  }}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Tidak, simpan saja
                </button>

                <button
                  onClick={() => {
                    void save(true);

                    setPendingHppChanges(
                      []
                    );
                  }}
                  className="flex-1 py-2.5 bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-sm font-semibold"
                >
                  Ya, perbarui master
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function GRDetail({
  gr,
  onClose,
  onVerify,
  onPrint,
}: {
  gr: GoodsReceipt & {
    suppliers: Supplier;
    goods_receipt_items: (
      GoodsReceiptItem & {
        medicines: Medicine;
      }
    )[];
    purchase_orders: PurchaseOrder | null;
  };

  onClose: () => void;
  onVerify: () => void;
  onPrint: () => void;
}) {
  return (
    <Modal
      title={`Detail Penerimaan - ${gr.receipt_number}`}
      onClose={onClose}
      wide
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-400 uppercase font-semibold">
              Supplier
            </p>

            <p className="font-medium text-gray-800 mt-1">
              {gr.suppliers?.name}
            </p>

            <p className="text-gray-500 text-xs">
              {gr.suppliers?.address}
            </p>
          </div>

          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase font-semibold">
              Tanggal Terima
            </p>

            <p className="font-medium text-gray-800 mt-1">
              {formatDate(
                gr.receipt_date
              )}
            </p>

            {gr.invoice_number && (
              <p className="text-xs text-gray-500 mt-1">
                Invoice:{' '}
                {gr.invoice_number}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-400 uppercase font-semibold">
              No. Acuan SP
            </p>

            <p className="font-medium text-gray-800 mt-1">
              {gr.purchase_orders
                ?.po_number ?? '-'}
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-400 uppercase font-semibold">
              Kondisi Kemasan
            </p>

            <p className="font-medium text-gray-800 mt-1">
              {gr.package_condition ??
                'Baik'}
            </p>
          </div>
        </div>

        <div className="border border-gray-100 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="text-left px-3 py-2">
                  Obat
                </th>

                <th className="text-left px-3 py-2">
                  Batch
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

                <th className="text-right px-3 py-2">
                  Harga Jual
                </th>

                <th className="text-right px-3 py-2">
                  Diskon
                </th>

                <th className="text-right px-3 py-2">
                  PPN
                </th>

                <th className="text-right px-3 py-2">
                  Modal/Unit
                </th>

                <th className="text-right px-3 py-2">
                  Subtotal
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-50">
              {gr.goods_receipt_items.map(
                (item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2 font-medium text-gray-700">
                      {
                        item.medicines
                          ?.name
                      }
                    </td>

                    <td className="px-3 py-2 font-mono text-gray-600">
                      {item.batch_number}
                    </td>

                    <td className="px-3 py-2 text-gray-600">
                      {formatDate(
                        item.expiry_date
                      )}
                    </td>

                    <td className="px-3 py-2 text-center text-gray-700">
                      {item.quantity}
                    </td>

                    <td className="px-3 py-2 text-right text-gray-600">
                      {formatCurrency(
                        item.unit_price
                      )}
                    </td>

                    <td className="px-3 py-2 text-right text-gray-600">
                      {formatCurrency(
                        item.sell_price
                      )}
                    </td>

                    <td className="px-3 py-2 text-right text-gray-600">
                      {item.discount_percent}%
                      <br />

                      <span className="text-xs text-gray-400">
                        -
                        {formatCurrency(
                          item.discount
                        )}
                      </span>
                    </td>

                    <td className="px-3 py-2 text-right text-gray-600">
                      {item.tax_percent}%
                      <br />

                      <span className="text-xs text-gray-400">
                        {formatCurrency(
                          item.tax
                        )}
                      </span>
                    </td>

                    <td className="px-3 py-2 text-right text-gray-600">
                      {formatCurrency(
                        item.cost_price
                      )}
                    </td>

                    <td className="px-3 py-2 text-right font-semibold text-gray-800">
                      {formatCurrency(
                        item.total_price
                      )}
                    </td>
                  </tr>
                )
              )}
            </tbody>

            <tfoot className="bg-gray-50">
              <tr>
                <td
                  colSpan={9}
                  className="px-3 py-2 text-right font-semibold text-gray-700"
                >
                  Total
                </td>

                <td className="px-3 py-2 text-right font-bold text-teal-600">
                  {formatCurrency(
                    gr.total_amount
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="ml-auto w-64 space-y-1 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span>

            <span>
              {formatCurrency(
                gr.goods_receipt_items.reduce(
                  (s, i) =>
                    s +
                    Number(
                      i.unit_price
                    ) *
                      Number(
                        i.quantity
                      ),
                  0
                )
              )}
            </span>
          </div>

          <div className="flex justify-between text-gray-600">
            <span>Diskon</span>

            <span>
              -
              {formatCurrency(
                gr.goods_receipt_items.reduce(
                  (s, i) =>
                    s +
                    Number(
                      i.discount
                    ),
                  0
                )
              )}
            </span>
          </div>

          <div className="flex justify-between text-gray-600">
            <span>PPN</span>

            <span>
              {formatCurrency(
                gr.goods_receipt_items.reduce(
                  (s, i) =>
                    s +
                    Number(i.tax),
                  0
                )
              )}
            </span>
          </div>

          <div className="flex justify-between font-bold text-gray-800 pt-1 border-t border-gray-200">
            <span>Grand Total</span>

            <span className="text-teal-600">
              {formatCurrency(
                gr.total_amount
              )}
            </span>
          </div>
        </div>

        {gr.notes && (
          <div className="text-sm text-gray-600 bg-gray-50 rounded-xl p-3">
            <span className="font-semibold text-gray-700">
              Catatan:{' '}
            </span>

            {gr.notes}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Tutup
          </button>

          <button
            onClick={onPrint}
            className="flex-1 py-2.5 bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
          >
            <Printer size={16} />
            Print
          </button>

          {gr.status ===
            'pending' && (
            <button
              onClick={onVerify}
              className="flex-1 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            >
              <CheckCircle
                size={16}
              />
              Verifikasi & Update Stok
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}