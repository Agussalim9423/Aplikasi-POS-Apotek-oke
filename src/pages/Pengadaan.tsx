import { useState, useEffect } from 'react';
import { tenantFrom, formatCurrency, formatDate, generatePONumber } from '@/lib/supabase';
import type { PurchaseOrder, PurchaseOrderItem, Supplier, Medicine } from '@/lib/supabase';
import { Plus, Search, Eye, Trash2, X, ChevronDown, FileText, Send, Printer } from 'lucide-react';
import { Modal, Field } from './ObatStok';

const SP_TYPES = [
  { value: 'reguler', label: 'Reguler / Umum', desc: 'Obat Bebas, Bebas Terbatas, Keras (non-narkotika/psikotropika/prekursor/OOT)', copies: 2 },
  { value: 'narkotika', label: 'Narkotika', desc: 'Obat golongan Narkotika (1 jenis obat per SP)', copies: 4 },
  { value: 'psikotropika', label: 'Psikotropika', desc: 'Obat golongan Psikotropika (boleh beberapa jenis)', copies: 3 },
  { value: 'prekursor', label: 'Prekursor Farmasi', desc: 'Obat mengandung zat prekursor (wajib cantumkan zat aktif)', copies: 3 },
  { value: 'oot', label: 'Obat-Obat Tertentu (OOT)', desc: 'Obat keras yang sering disalahgunakan', copies: 3 },
] as const;

const SP_TYPE_LABELS: Record<string, string> = {
  reguler: 'Reguler / Umum', narkotika: 'Narkotika', psikotropika: 'Psikotropika', prekursor: 'Prekursor', oot: 'OOT',
};

const SP_TYPE_COLORS: Record<string, string> = {
  reguler: 'bg-teal-100 text-teal-700', narkotika: 'bg-red-100 text-red-700', psikotropika: 'bg-purple-100 text-purple-700', prekursor: 'bg-amber-100 text-amber-700', oot: 'bg-blue-100 text-blue-700',
};

type Settings = {
  pharmacy_name: string; pharmacy_address: string; pharmacy_phone: string;
  pharmacist_name: string; sipa_number: string; sia_number: string;
};

const DEFAULT_SETTINGS: Settings = {
  pharmacy_name: 'Apotek Avicenna', pharmacy_address: '', pharmacy_phone: '',
  pharmacist_name: '', sipa_number: '', sia_number: '',
};

export default function Pengadaan() {
  const [pos, setPos] = useState<(PurchaseOrder & { suppliers: Supplier })[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [viewPO, setViewPO] = useState<(PurchaseOrder & { suppliers: Supplier; purchase_order_items: (PurchaseOrderItem & { medicines: Medicine })[] }) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadPOs(); }, []);

  async function loadPOs() {
    setLoading(true);
    const { data } = await tenantFrom('purchase_orders').select('*, suppliers(*)').order('created_at', { ascending: false });
    setPos((data ?? []) as (PurchaseOrder & { suppliers: Supplier })[]);
    setLoading(false);
  }

  const filtered = pos.filter(p =>
    (p.po_number.toLowerCase().includes(search.toLowerCase()) || p.suppliers?.name.toLowerCase().includes(search.toLowerCase())) &&
    (statusFilter === 'all' || p.status === statusFilter) &&
    (typeFilter === 'all' || p.sp_type === typeFilter)
  );

  async function deletePO(po: PurchaseOrder) {
    if (!confirm(`Hapus SP "${po.po_number}"?\n\nSP yang sudah memiliki penerimaan barang tidak dapat dihapus.`)) return;
    const { error: itemErr } = await tenantFrom('purchase_order_items').delete().eq('purchase_order_id', po.id);
    if (itemErr) { alert('Gagal menghapus item SP: ' + itemErr.message); return; }
    const { error: poErr } = await tenantFrom('purchase_orders').delete().eq('id', po.id);
    if (poErr) { alert('Gagal menghapus SP: ' + poErr.message); return; }
    loadPOs();
  }

  async function sendPO(po: PurchaseOrder) {
    await tenantFrom('purchase_orders').update({ status: 'sent' }).eq('id', po.id);
    loadPOs();
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="animate-spin w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Surat Pesanan Obat</h1>
          <p className="text-gray-500 text-sm mt-1">Surat Pesanan obat ke PBF / Supplier</p>
        </div>
        <button onClick={() => setShowForm(true)} className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors">
          <Plus size={16} /> Buat SP Baru
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nomor SP atau supplier..." className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white" />
        </div>
        <div className="relative">
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="appearance-none pl-4 pr-9 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white font-medium text-gray-700">
            <option value="all">Semua Jenis SP</option>
            {SP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
        <div className="relative">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="appearance-none pl-4 pr-9 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white font-medium text-gray-700">
            <option value="all">Semua Status</option>
            <option value="draft">Draft</option>
            <option value="sent">Terkirim</option>
            <option value="partial">Sebagian</option>
            <option value="received">Diterima</option>
            <option value="cancelled">Batal</option>
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3">No. SP</th>
                <th className="text-left px-4 py-3">Jenis SP</th>
                <th className="text-left px-4 py-3">Supplier</th>
                <th className="text-left px-4 py-3">Tgl Pesan</th>
                <th className="text-center px-4 py-3">Status</th>
                <th className="text-center px-4 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(po => (
                <tr key={po.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-teal-600 font-medium">{po.po_number}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${SP_TYPE_COLORS[po.sp_type] ?? 'bg-gray-100 text-gray-600'}`}>{SP_TYPE_LABELS[po.sp_type] ?? po.sp_type}</span></td>
                  <td className="px-4 py-3 text-gray-700">{po.suppliers?.name}</td>
                  <td className="px-4 py-3 text-gray-500">{po.order_date_manual ? formatDate(po.order_date_manual) : formatDate(po.order_date)}</td>
                  <td className="px-4 py-3 text-center"><StatusBadge status={po.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => viewDetail(po.id)} title="Lihat" className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"><Eye size={14} /></button>
                      <button onClick={() => printPO(po.id)} title="Print SP" className="p-1.5 text-gray-400 hover:text-teal-500 hover:bg-teal-50 rounded-lg transition-colors"><Printer size={14} /></button>
                      {po.status === 'draft' && (
                        <button onClick={() => sendPO(po)} title="Kirim" className="p-1.5 text-gray-400 hover:text-teal-500 hover:bg-teal-50 rounded-lg transition-colors"><Send size={14} /></button>
                      )}
                      <button onClick={() => deletePO(po)} title="Hapus" className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center text-gray-400 py-16">
            <FileText size={32} className="mx-auto mb-2 text-gray-300" />
            <p>Belum ada Surat Pesanan</p>
          </div>
        )}
      </div>

      {showForm && <POForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); loadPOs(); }} />}
      {viewPO && <PODetail po={viewPO} onClose={() => setViewPO(null)} onPrint={() => printPO(viewPO.id)} />}
    </div>
  );

  async function viewDetail(id: string) {
    const { data } = await tenantFrom('purchase_orders').select('*, suppliers(*), purchase_order_items(*, medicines(*))').eq('id', id).single();
    setViewPO(data as any);
  }
}

async function fetchSettings(): Promise<Settings> {
  const { data } = await tenantFrom('settings').select('key, value');
  const map: Record<string, string> = {};
  (data ?? []).forEach((s: { key: string; value: string | null }) => { map[s.key] = s.value ?? ''; });
  return { ...DEFAULT_SETTINGS, pharmacy_name: map.pharmacy_name ?? DEFAULT_SETTINGS.pharmacy_name, pharmacy_address: map.pharmacy_address ?? '', pharmacy_phone: map.pharmacy_phone ?? '', pharmacist_name: map.pharmacist_name ?? '', sipa_number: map.sipa_number ?? '', sia_number: map.sia_number ?? '' };
}

async function printPO(poId: string) {
  const { data: po } = await tenantFrom('purchase_orders').select('*, suppliers(*), purchase_order_items(*, medicines(*))').eq('id', poId).single() as any;
  if (!po) return;
  const settings = await fetchSettings();
  printSuratPesanan(po, settings);
}

function printSuratPesanan(po: any, settings: Settings) {
  const spType = SP_TYPES.find(t => t.value === po.sp_type) ?? SP_TYPES[0];
  const orderDate = po.order_date_manual ? new Date(po.order_date_manual) : new Date(po.order_date);
  const dateStr = orderDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  const copies = spType.copies;
  const templateNote: Record<string, string> = {
    reguler: 'Template SP Biasa - Obat Umum',
    prekursor: 'Template SP Prekursor - wajib mencantumkan zat aktif',
    psikotropika: 'Template SP Psikotropika - arsip dan pelaporan khusus',
    narkotika: 'Template SP Narkotika - satu jenis obat per SP',
    oot: 'Template SP OOT - kebutuhan dan zat aktif wajib dicantumkan',
  };
  const copyLabels = ['PBF / Distributor', 'Arsip Apotek'];
  if (copies >= 3) copyLabels.push('Dinkes');
  if (copies >= 4) copyLabels.push('BPOM');

  const terbilangMap: Record<string, string> = {
    '0': 'nol', '1': 'satu', '2': 'dua', '3': 'tiga', '4': 'empat', '5': 'lima', '6': 'enam', '7': 'tujuh', '8': 'delapan', '9': 'sembilan',
  '10': 'sepuluh', '11': 'sebelas', '12': 'dua belas', '13': 'tiga belas', '14': 'empat belas', '15': 'lima belas', '16': 'enam belas', '17': 'tujuh belas', '18': 'delapan belas', '19': 'sembilan belas',
    '20': 'dua puluh', '30': 'tiga puluh', '40': 'empat puluh', '50': 'lima puluh', '60': 'enam puluh', '70': 'tujuh puluh', '80': 'delapan puluh', '90': 'sembilan puluh', '100': 'seratus',
  };

  function terbilang(n: number): string {
    if (n <= 100) return terbilangMap[String(n)] ?? String(n);
    if (n < 1000) {
      const ratus = Math.floor(n / 100);
      const sisa = n % 100;
      return `seratus ${sisa > 0 ? terbilang(sisa) : ''}`.trim();
    }
    if (n < 1000000) {
      const ribu = Math.floor(n / 1000);
      const sisa = n % 1000;
      const ribuStr = ribu === 1 ? 'seribu' : `${terbilang(ribu)} ribu`;
      return `${ribuStr}${sisa > 0 ? ' ' + terbilang(sisa) : ''}`;
    }
    return String(n);
  }

  const itemRows = po.purchase_order_items.map((item: any, idx: number) => {
    const med = item.medicines;
    const unit = item.unit ?? med?.unit ?? '';
    const qtyStr = `${item.quantity} ${unit} (${terbilang(item.quantity)} ${unit})`;
    return `
      <tr>
        <td style="text-align:center;padding:6px 4px;border:1px solid #ccc;">${idx + 1}</td>
        <td style="padding:6px 8px;border:1px solid #ccc;">${med?.name ?? '-'}</td>
        <td style="padding:6px 8px;border:1px solid #ccc;">${med?.form ?? '-'} ${med?.strength ?? ''}</td>
        <td style="text-align:center;padding:6px 8px;border:1px solid #ccc;">${qtyStr}</td>
        ${po.sp_type === 'prekursor' || po.sp_type === 'narkotika' || po.sp_type === 'oot' ? `<td style="padding:6px 8px;border:1px solid #ccc;">${med?.generic_name ?? med?.description ?? '-'}</td>` : ''}
      </tr>`;
  }).join('');

  const activeIngredientHeader = (po.sp_type === 'prekursor' || po.sp_type === 'narkotika' || po.sp_type === 'oot')
    ? '<th style="padding:6px 8px;border:1px solid #ccc;text-align:left;">Zat Aktif</th>' : '';

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>SP ${po.po_number}</title>
  <style>
    * { font-family: 'Times New Roman', serif; margin: 0; padding: 0; box-sizing: border-box; }
    body { padding: 20px; color: #000; }
    .sp-header { text-align: center; margin-bottom: 20px; }
    .sp-title { font-size: 18px; font-weight: bold; text-transform: uppercase; }
    .sp-type-badge { font-size: 13px; margin-top: 4px; font-weight: bold; }
    .copy-label { font-size: 11px; margin-top: 4px; color: #555; font-style: italic; }
    .section { margin-bottom: 12px; }
    .section-title { font-weight: bold; font-size: 12px; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 2px; margin-bottom: 6px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 12px; }
    .info-row { margin-bottom: 2px; }
    .info-label { display: inline-block; width: 140px; font-weight: bold; }
    .info-value { display: inline-block; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
    th { background: #f0f0f0; font-weight: bold; }
    .sign-section { margin-top: 40px; display: flex; justify-content: flex-end; font-size: 12px; }
    .sign-box { text-align: center; width: 200px; }
    .sign-name { font-weight: bold; text-decoration: underline; margin-top: 60px; }
    .footer-note { margin-top: 20px; font-size: 11px; color: #555; border-top: 1px dashed #999; padding-top: 8px; }
    @media print { body { padding: 10px; } }
  </style></head><body>
    <div class="sp-header">
      <div style="font-size:20px;font-weight:bold;letter-spacing:1px;">${settings.pharmacy_name}</div>
      <div style="font-size:12px;">${settings.pharmacy_address || '-'}</div>
      <div style="font-size:12px;">Telp: ${settings.pharmacy_phone || '-'}</div>
      <div style="border-bottom:3px double #000;margin:8px 0 14px;"></div>
      <div class="sp-title">SURAT PESANAN</div>
      <div class="sp-type-badge">${spType.label.toUpperCase()}</div>
      <div style="font-size:11px;margin-top:3px;">${templateNote[po.sp_type] ?? ''}</div>
      <div class="copy-label">Rangkap: ${copyLabels.join(' • ')}</div>
    </div>

    <div class="section">
      <div style="font-size:12px;"><strong>Nomor Surat Pesanan:</strong> ${po.po_number}</div>
      <div style="font-size:12px;"><strong>Tanggal:</strong> ${dateStr}</div>
    </div>

    ${(po.sp_type === 'prekursor' || po.sp_type === 'oot') ? '' : `
    <div class="section">
      <div class="section-title">Identitas Pemesan (Fasilitas Pelayanan Kefarmasian)</div>
      <div class="info-grid">
        <div>
          <div class="info-row"><span class="info-label">Nama Fasilitas:</span> <span class="info-value">${settings.pharmacy_name}</span></div>
          <div class="info-row"><span class="info-label">Alamat:</span> <span class="info-value">${settings.pharmacy_address}</span></div>
          <div class="info-row"><span class="info-label">Telepon:</span> <span class="info-value">${settings.pharmacy_phone}</span></div>
          <div class="info-row"><span class="info-label">No. SIA:</span> <span class="info-value">${settings.sia_number || '-'}</span></div>
        </div>
      </div>
    </div>`}

    <div class="section">
      <div class="section-title">Identitas Apoteker Penanggung Jawab (APJ)</div>
      <div class="info-grid">
        <div>
          <div class="info-row"><span class="info-label">Nama APJ:</span> <span class="info-value">${settings.pharmacist_name || '-'}</span></div>
          <div class="info-row"><span class="info-label">Jabatan:</span> <span class="info-value">Apoteker Penanggung Jawab</span></div>
          <div class="info-row"><span class="info-label">No. SIPA APJ:</span> <span class="info-value">${settings.sipa_number || '-'}</span></div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Identitas PBF / Distributor Tujuan</div>
      <div class="info-grid">
        <div>
          <div class="info-row"><span class="info-label">Nama PBF:</span> <span class="info-value">${po.suppliers?.name ?? '-'}</span></div>
          <div class="info-row"><span class="info-label">Alamat PBF:</span> <span class="info-value">${po.suppliers?.address ?? '-'}</span></div>
          <div class="info-row"><span class="info-label">Telepon PBF:</span> <span class="info-value">${po.suppliers?.phone ?? '-'}</span></div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Rincian Obat yang Dipesan</div>
      <table>
        <thead>
          <tr>
            <th style="width:30px;padding:6px 4px;border:1px solid #ccc;">No</th>
            <th style="text-align:left;padding:6px 8px;border:1px solid #ccc;">Nama Obat / Bahan Obat</th>
            <th style="text-align:left;padding:6px 8px;border:1px solid #ccc;">Bentuk Sediaan & Kekuatan</th>
            <th style="text-align:center;padding:6px 8px;border:1px solid #ccc;">Jumlah Pesanan (Satuan)</th>
            ${activeIngredientHeader}
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
    </div>

    ${(po.sp_type === 'prekursor' || po.sp_type === 'oot') ? `
    <div class="section">
      <p style="margin-top:12px;font-size:12px;line-height:1.6;">
        <strong>Obat ${po.sp_type === 'prekursor' ? 'Prekursor' : 'Obat-Obat Tertentu'} tersebut akan digunakan untuk memenuhi kebutuhan:</strong>
      </p>
      <div class="info-grid" style="margin-top:4px;">
        <div>
          <div class="info-row"><span class="info-label">Nama Fasilitas:</span> <span class="info-value">${settings.pharmacy_name}</span></div>
          <div class="info-row"><span class="info-label">Alamat:</span> <span class="info-value">${settings.pharmacy_address}</span></div>
          <div class="info-row"><span class="info-label">Telepon:</span> <span class="info-value">${settings.pharmacy_phone}</span></div>
          <div class="info-row"><span class="info-label">No. SIA:</span> <span class="info-value">${settings.sia_number || '-'}</span></div>
        </div>
      </div>
    </div>` : ''}

    <div class="sign-section">
      <div class="sign-box">
        <div>Palu, ${dateStr}</div>
        <div>Apoteker Penanggung Jawab,</div>
        <div class="sign-name" style="white-space:nowrap;">${settings.pharmacist_name || '____________'}</div>
        <div style="font-size:11px; white-space:nowrap;">No. SIPA: ${settings.sipa_number || '-'}</div>
      </div>
    </div>

    ${po.notes ? `<div class="footer-note"><strong>Catatan:</strong> ${po.notes}</div>` : ''}
    <div class="footer-note">
      Ketentuan: ${spType.desc}. Jumlah rangkap minimal ${spType.copies} (${copyLabels.join(', ')}).
    </div>
  </body></html>`;

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
    setTimeout(() => document.body.removeChild(iframe), 1000);
  }, 300);
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600', sent: 'bg-blue-100 text-blue-600', partial: 'bg-orange-100 text-orange-600', received: 'bg-green-100 text-green-600', cancelled: 'bg-red-100 text-red-600',
  };
  const labels: Record<string, string> = {
    draft: 'Draft', sent: 'Terkirim', partial: 'Sebagian', received: 'Diterima', cancelled: 'Batal',
  };
  return <span className={`px-2 py-1 rounded-full text-xs font-semibold ${styles[status]}`}>{labels[status]}</span>;
}

function POForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [spType, setSpType] = useState<string>('reguler');
  const [orderDateManual, setOrderDateManual] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [manualPoNumber, setManualPoNumber] = useState('');
  const [items, setItems] = useState<{ medicine: Medicine; quantity: number; unit: string; unitPrice: number }[]>([]);
  const [medSearch, setMedSearch] = useState('');
  const [showNewMed, setShowNewMed] = useState(false);
  const [newMed, setNewMed] = useState({ name: '', form: 'Tablet', unit: 'strip', pieces_per_strip: 10, category: '', sell_price: 0, buy_price: 0 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    tenantFrom('suppliers').select('*').eq('is_active', true).order('name').then((response: { data: Supplier[] | null }) => setSuppliers(response.data ?? []));
    tenantFrom('medicines').select('*').eq('is_active', true).order('name').then((response: { data: Medicine[] | null }) => setMedicines(response.data ?? []));
  }, []);

  const filteredMeds = medicines.filter(m =>
    m.name.toLowerCase().includes(medSearch.toLowerCase()) &&
    !items.find(i => i.medicine.id === m.id)
  );

  function addMed(med: Medicine) {
    if (spType === 'narkotika' && items.length >= 1) {
      alert('SP Narkotika hanya boleh 1 jenis obat per lembar. Hapus item yang ada terlebih dahulu.');
      return;
    }
    setItems(prev => [...prev, { medicine: med, quantity: 1, unit: med.unit || 'pcs', unitPrice: med.buy_price }]);
    setMedSearch('');
  }

  const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  async function createNewMedicine() {
    if (!newMed.name.trim()) { alert('Nama obat harus diisi'); return; }
    const isStrip = newMed.form === 'Tablet' || newMed.form === 'Kapsul';
    const unit = isStrip ? 'strip' : newMed.unit || 'pcs';
    const { data, error } = await tenantFrom('medicines').insert({
      name: newMed.name.trim(),
      form: newMed.form,
      unit,
      pieces_per_strip: isStrip ? newMed.pieces_per_strip : null,
      category: newMed.category || null,
      buy_price: newMed.buy_price,
      sell_price: newMed.sell_price,
      stock: 0,
      min_stock: 0,
      is_active: true,
    }).select().single();
    if (error) { alert('Gagal membuat obat baru: ' + error.message); return; }
    const med = data as Medicine;
    setMedicines(prev => [...prev, med]);
    if (spType === 'narkotika' && items.length >= 1) {
      alert('SP Narkotika hanya boleh 1 jenis obat per lembar. Item lama diganti dengan obat baru.');
      setItems([{ medicine: med, quantity: 1, unit: med.unit || 'pcs', unitPrice: med.buy_price }]);
    } else {
      setItems(prev => [...prev, { medicine: med, quantity: 1, unit: med.unit || 'pcs', unitPrice: med.buy_price }]);
    }
    setShowNewMed(false);
    setNewMed({ name: '', form: 'Tablet', unit: 'strip', pieces_per_strip: 10, category: '', sell_price: 0, buy_price: 0 });
    setMedSearch('');
  }

  async function save() {
    if (!supplierId || items.length === 0) return;
    if (spType === 'narkotika' && items.length > 1) {
      alert('SP Narkotika hanya boleh 1 jenis obat per lembar.');
      return;
    }
    setSaving(true);
    try {
      const poNumber = manualPoNumber.trim() || generatePONumber();
      const { data: po, error } = await tenantFrom('purchase_orders').insert({
        po_number: poNumber,
        supplier_id: supplierId,
        sp_type: spType,
        order_date_manual: orderDateManual || null,
        total_amount: total,
        notes,
        status: 'draft',
      }).select().single();
      if (error) throw error;
      await tenantFrom('purchase_order_items').insert(
        items.map(i => ({
          purchase_order_id: po.id,
          medicine_id: i.medicine.id,
          quantity: i.quantity,
          unit: i.unit,
          unit_price: i.unitPrice,
          total_price: i.quantity * i.unitPrice,
        }))
      );
      onSaved();
    } catch (err) {
      console.error(err);
      alert('Gagal membuat SP');
    } finally { setSaving(false); }
  }

  const selectedSpType = SP_TYPES.find(t => t.value === spType);

  return (
    <Modal title="Buat Surat Pesanan (SP)" onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Jenis Surat Pesanan">
            <select value={spType} onChange={e => { setSpType(e.target.value); if (e.target.value === 'narkotika' && items.length > 1) setItems(items.slice(0, 1)); }} className="input">
              {SP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Tanggal Pemesanan">
            <input type="date" value={orderDateManual} onChange={e => setOrderDateManual(e.target.value)} className="input" />
          </Field>
        </div>

        <Field label="Nomor Surat Pesanan (No. SP)">
          <input value={manualPoNumber} onChange={e => setManualPoNumber(e.target.value)} placeholder="Kosongkan untuk generate otomatis" className="input" />
        </Field>

        {selectedSpType && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
            <strong>{selectedSpType.label}:</strong> {selectedSpType.desc}. Rangkap minimal {selectedSpType.copies}.
            {spType === 'narkotika' && <span className="block mt-1 font-semibold">Hanya 1 jenis obat per SP.</span>}
          </div>
        )}

        <Field label="Supplier / PBF">
          <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className="input">
            <option value="">- Pilih PBF / Supplier -</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>

        <div className="flex items-center justify-between gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={medSearch} onChange={e => setMedSearch(e.target.value)} placeholder="Cari obat untuk ditambahkan..." className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
            {medSearch && filteredMeds.length > 0 && (
              <div className="absolute z-20 w-full bg-white border border-gray-200 rounded-xl shadow-lg mt-1 max-h-48 overflow-y-auto">
                {filteredMeds.slice(0, 8).map(m => (
                  <button key={m.id} onClick={() => addMed(m)} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex justify-between">
                    <span className="font-medium">{m.name}</span>
                    <span className="text-gray-400">Stok: {m.stock}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button type="button" onClick={() => setShowNewMed(s => !s)} className="shrink-0 px-3 py-2 border border-teal-200 text-teal-600 rounded-xl text-sm font-medium hover:bg-teal-50 flex items-center gap-1.5">
            <Plus size={16} /> Obat Baru
          </button>
        </div>

        {showNewMed && (
          <div className="border border-teal-100 bg-teal-50/50 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-teal-700">Tambah Obat Baru</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nama Obat">
                <input value={newMed.name} onChange={e => setNewMed({ ...newMed, name: e.target.value })} className="input" placeholder="Nama obat" />
              </Field>
              <Field label="Kategori">
                <select value={newMed.category === 'Lainnya' || newMed.category.startsWith('Lainnya: ') ? 'Lainnya' : newMed.category} onChange={e => setNewMed({ ...newMed, category: e.target.value })} className="input">
                  <option value="">- Pilih -</option>
                  <option>Obat Bebas</option><option>Obat Bebas Terbatas</option><option>Obat Keras</option><option>Obat Narkotika</option><option>Obat Herbal</option><option>Suplemen</option><option>Minuman</option><option>Alat Kesehatan</option><option>Lainnya</option>
                </select>
              </Field>
              {newMed.category === 'Lainnya' && (
                <Field label="Sebutkan Kategori">
                  <input value={newMed.category.startsWith('Lainnya: ') ? newMed.category.substring(10) : ''} onChange={e => setNewMed({ ...newMed, category: e.target.value ? `Lainnya: ${e.target.value}` : 'Lainnya' })} className="input" placeholder="Ketik kategori..." />
                </Field>
              )}
              <Field label="Bentuk Sediaan">
                <select value={newMed.form} onChange={e => {
                  const f = e.target.value;
                  const isStrip = f === 'Tablet' || f === 'Kapsul';
                  setNewMed({ ...newMed, form: f, unit: isStrip ? 'strip' : newMed.unit });
                }} className="input">
                  <option>Tablet</option><option>Kapsul</option><option>Sirup</option><option>Injeksi</option><option>Salep</option><option>Tetes</option><option>Lainnya</option>
                </select>
              </Field>
              {(newMed.form === 'Tablet' || newMed.form === 'Kapsul') && (
                <Field label="Jumlah per Strip">
                  <input type="number" min="1" value={newMed.pieces_per_strip} onChange={e => setNewMed({ ...newMed, pieces_per_strip: Number(e.target.value) })} className="input" />
                </Field>
              )}
              <Field label="Harga Beli / unit">
                <input type="number" value={newMed.buy_price} onChange={e => setNewMed({ ...newMed, buy_price: Number(e.target.value) })} className="input" />
              </Field>
              <Field label="Harga Jual / unit">
                <input type="number" value={newMed.sell_price} onChange={e => setNewMed({ ...newMed, sell_price: Number(e.target.value) })} className="input" />
              </Field>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowNewMed(false)} className="flex-1 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Batal</button>
              <button onClick={createNewMedicine} className="flex-1 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-sm font-semibold">Tambah ke SP</button>
            </div>
          </div>
        )}

        <div className="border border-gray-100 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="text-left px-3 py-2">Obat</th>
                <th className="text-center px-3 py-2 w-20">Jumlah</th>
                <th className="text-center px-3 py-2 w-24">Satuan</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((item, idx) => (
                <tr key={item.medicine.id}>
                  <td className="px-3 py-2 font-medium text-gray-700">
                    {item.medicine.name}
                    {(spType === 'prekursor' || spType === 'narkotika' || spType === 'oot') && (
                      <div className="text-xs text-gray-400">{item.medicine.generic_name ?? item.medicine.description ?? '-'}</div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" value={item.quantity} onChange={e => setItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: Number(e.target.value) } : it))} className="w-16 px-2 py-1 border border-gray-200 rounded-lg text-sm text-center" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="text" value={item.unit} onChange={e => setItems(prev => prev.map((it, i) => i === idx ? { ...it, unit: e.target.value } : it))} placeholder="box/botol/strip" className="w-20 px-2 py-1 border border-gray-200 rounded-lg text-sm text-center" />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))} className="p-1 text-gray-300 hover:text-red-500"><X size={14} /></button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={4} className="text-center text-gray-400 py-6">Belum ada item. Cari obat di atas.</td></tr>
              )}
            </tbody>

          </table>
        </div>

        <Field label="Catatan">
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="input" placeholder="Catatan untuk PBF / supplier..." />
        </Field>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">Batal</button>
          <button onClick={save} disabled={saving || !supplierId || items.length === 0} className="flex-1 py-2.5 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold">
            {saving ? 'Menyimpan...' : 'Simpan sebagai Draft'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function PODetail({ po, onClose, onPrint }: { po: PurchaseOrder & { suppliers: Supplier; purchase_order_items: (PurchaseOrderItem & { medicines: Medicine })[] }; onClose: () => void; onPrint: () => void }) {
  return (
    <Modal title={`Detail SP - ${po.po_number}`} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${SP_TYPE_COLORS[po.sp_type] ?? 'bg-gray-100 text-gray-600'}`}>{SP_TYPE_LABELS[po.sp_type] ?? po.sp_type}</span>
          <StatusBadge status={po.status} />
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-400 uppercase font-semibold">PBF / Supplier</p>
            <p className="font-medium text-gray-800 mt-1">{po.suppliers?.name}</p>
            <p className="text-gray-500 text-xs">{po.suppliers?.address}</p>
            <p className="text-gray-500 text-xs">{po.suppliers?.phone}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase font-semibold">Tanggal Pesan</p>
            <p className="font-medium text-gray-800 mt-1">{po.order_date_manual ? formatDate(po.order_date_manual) : formatDate(po.order_date)}</p>
          </div>
        </div>

        <div className="border border-gray-100 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="text-left px-3 py-2">Obat</th>
                <th className="text-center px-3 py-2">Jumlah</th>
                <th className="text-center px-3 py-2">Satuan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {po.purchase_order_items.map(item => (
                <tr key={item.id}>
                  <td className="px-3 py-2 font-medium text-gray-700">{item.medicines?.name ?? item.medicine_id}</td>
                  <td className="px-3 py-2 text-center text-gray-600">{item.quantity}</td>
                  <td className="px-3 py-2 text-center text-gray-600">{item.unit ?? item.medicines?.unit ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {po.notes && <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-600"><span className="font-semibold">Catatan: </span>{po.notes}</div>}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">Tutup</button>
          <button onClick={onPrint} className="flex-1 py-2.5 bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
            <Printer size={16} /> Print SP
          </button>
        </div>
      </div>
    </Modal>
  );
}
