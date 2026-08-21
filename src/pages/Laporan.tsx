import { useState, useEffect } from 'react';
import { tenantFrom, formatCurrency, formatDate } from '@/lib/supabase';
import type { Sale, SaleItem, OperationalExpense, Doctor } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Search, Eye, TrendingUp, ShoppingBag, Calendar, Download, Trash2, AlertTriangle, Trophy, Wallet, Receipt, PiggyBank, BarChart3, Plus, Pencil, X, DollarSign, Zap, Users, Building2 } from 'lucide-react';
import { Modal } from './ObatStok';

type Tab = 'penjualan' | 'keuntungan';
type SaleTypeFilter = 'all' | 'regular' | 'prescription' | 'doctor';
type PeriodFilter = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

const SALE_TYPE_LABELS: Record<SaleTypeFilter, string> = {
  all: 'Gabungan (Semua)', regular: 'Penjualan Umum', prescription: 'Penjualan Resep', doctor: 'Penjualan Dokter',
};

const EXPENSE_CATEGORIES = [
  { value: 'Listrik', icon: Zap, color: 'text-yellow-600 bg-yellow-50' },
  { value: 'Gaji', icon: Users, color: 'text-blue-600 bg-blue-50' },
  { value: 'Sewa', icon: Building2, color: 'text-purple-600 bg-purple-50' },
  { value: 'Lainnya', icon: Receipt, color: 'text-gray-600 bg-gray-50' },
];

export default function Laporan() {
  const { profile } = useAuth();
  const canViewProfit = profile?.role === 'owner' || profile?.role === 'superadmin';
  const [tab, setTab] = useState<Tab>('penjualan');

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Laporan</h1>
        <p className="text-gray-500 text-sm mt-1">Riwayat transaksi, analisis keuntungan, dan pengeluaran operasional</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab('penjualan')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            tab === 'penjualan' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-500'
          }`}
        >
          <ShoppingBag size={16} /> Penjualan
        </button>
        {canViewProfit && (
          <button
            onClick={() => setTab('keuntungan')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              tab === 'keuntungan' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-500'
            }`}
          >
            <PiggyBank size={16} /> Keuntungan Bersih
          </button>
        )}
      </div>

      {tab === 'penjualan' && <PenjualanTab />}
      {tab === 'keuntungan' && canViewProfit && <KeuntunganTab />}
    </div>
  );
}

function PenjualanTab() {
  const [sales, setSales] = useState<(Sale & { patients: { name: string } | null; doctors: { name: string } | null })[]>([]);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [period, setPeriod] = useState<PeriodFilter>('monthly');
  const [saleTypeFilter, setSaleTypeFilter] = useState<SaleTypeFilter>('all');
  const [patientFilter, setPatientFilter] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('');
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [viewSale, setViewSale] = useState<(Sale & { sale_items: SaleItem[] | null; patients: { name: string } | null; doctors: { name: string } | null }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<(Sale & { sale_items: SaleItem[] | null; patients: { name: string } | null; doctors: { name: string } | null }) | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [topMedicines, setTopMedicines] = useState<{ name: string; total_qty: number; total_revenue: number; unit: string }[]>([]);
  const [reportHpp, setReportHpp] = useState(0);

  useEffect(() => { load(); }, [period, dateFrom, dateTo, saleTypeFilter]);
  useEffect(() => { tenantFrom('doctors').select('*').eq('is_active', true).order('name').then((result: { data: Doctor[] | null }) => setDoctors(result.data ?? [])); }, []);

  function getPeriodDates(): { from: string; to: string } {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    if (period === 'daily') return { from: dateFrom || today, to: dateFrom || today };
    if (period === 'weekly') {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay() + 1);
      return { from: start.toISOString().split('T')[0], to: today };
    }
    if (period === 'yearly') return { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-12-31` };
    if (period === 'custom') return { from: dateFrom, to: dateTo };
    return { from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, to: today };
  }

  async function load() {
    setLoading(true);
    let query = tenantFrom('sales').select('*, patients(name), doctors(name)').order('sale_date', { ascending: false });
    const range = getPeriodDates();
    if (range.from) query = query.gte('sale_date', new Date(range.from).toISOString());
    if (range.to) query = query.lte('sale_date', new Date(range.to + 'T23:59:59').toISOString());
    if (saleTypeFilter !== 'all') query = query.eq('sale_type', saleTypeFilter);
    const { data } = await query;
    setSales((data ?? []) as any);

    const itemsRes = await tenantFrom('sale_items').select('sale_id, medicine_name, quantity, total_price, cost_price, medicines(unit)');
    const saleIdSet = new Set((data ?? []).map((sale: { id: string }) => sale.id));
    setReportHpp((itemsRes.data ?? []).filter((item: { sale_id: string }) => saleIdSet.has(item.sale_id)).reduce((sum: number, item: { cost_price?: number; quantity: number }) => sum + (item.cost_price ?? 0) * item.quantity, 0));
    const medMap = new Map<string, { name: string; total_qty: number; total_revenue: number; unit: string }>();
    for (const item of (itemsRes.data ?? [])) {
      const key = item.medicine_name ?? '';
      if (!key) continue;
      const existing = medMap.get(key);
      if (existing) {
        existing.total_qty += item.quantity;
        existing.total_revenue += item.total_price;
      } else {
        medMap.set(key, { name: key, total_qty: item.quantity, total_revenue: item.total_price, unit: (item.medicines as { unit?: string } | null)?.unit ?? 'pcs' });
      }
    }
    setTopMedicines(Array.from(medMap.values()).sort((a, b) => b.total_qty - a.total_qty).slice(0, 10));
    setLoading(false);
  }

  const filtered = sales.filter(s =>
    s.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
    (s.patient_name ?? '').toLowerCase().includes(search.toLowerCase())
  ).filter(s => !patientFilter || (s.patient_name ?? s.patients?.name ?? '').toLowerCase().includes(patientFilter.toLowerCase()))
    .filter(s => !doctorFilter || s.doctor_id === doctorFilter);

  const totalRevenue = filtered.reduce((s, r) => s + r.total, 0);
  const totalTransactions = filtered.length;
  const avgTransaction = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
  const netProfit = totalRevenue - reportHpp;

  async function viewDetail(id: string) {
    const { data } = await tenantFrom('sales').select('*, sale_items(*), patients(name), doctors(name)').eq('id', id).single();
    setViewSale(data as any);
  }

  async function deleteSale(sale: Sale & { sale_items: SaleItem[] | null; patients: { name: string } | null; doctors: { name: string } | null }) {
    setDeleting(true);
    const { error: itemsError } = await tenantFrom('sale_items').delete().eq('sale_id', sale.id);
    if (itemsError) { setDeleting(false); return; }

    for (const item of sale.sale_items ?? []) {
      if (item.medicine_id) {
        const { data: med } = await tenantFrom('medicines').select('stock').eq('id', item.medicine_id).single();
        if (med) {
          await tenantFrom('medicines').update({ stock: (med.stock ?? 0) + item.quantity }).eq('id', item.medicine_id);
        }
      }
    }

    await tenantFrom('sales').delete().eq('id', sale.id);
    setDeleting(false);
    setDeleteTarget(null);
    await load();
  }

  function exportCSV() {
    const headers = ['Invoice', 'Tanggal', 'Pasien', 'Dokter', 'Pembayaran', 'Subtotal', 'Diskon', 'Total'];
    const rows = filtered.map(s => [
      s.invoice_number, formatDate(s.sale_date), s.patient_name || s.patients?.name || 'Umum',
      s.doctors?.name ?? '-', s.payment_method, s.subtotal, s.discount, s.total,
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `laporan-penjualan-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <div className="flex items-center justify-center h-full"><div className="animate-spin w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(SALE_TYPE_LABELS) as SaleTypeFilter[]).map(type => <button key={type} onClick={() => setSaleTypeFilter(type)} className={`px-3 py-2 rounded-lg text-xs font-semibold ${saleTypeFilter === type ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{SALE_TYPE_LABELS[type]}</button>)}
        </div>
        <button onClick={exportCSV} className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors">
          <Download size={16} /> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 text-xs text-gray-400 uppercase font-semibold"><TrendingUp size={14} /> Total Pendapatan</div>
          <p className="text-2xl font-bold text-teal-600 mt-1">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"><div className="flex items-center gap-2 text-xs text-gray-400 uppercase font-semibold"><Wallet size={14} /> HPP / Modal</div><p className="text-2xl font-bold text-orange-600 mt-1">{formatCurrency(reportHpp)}</p></div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"><div className="flex items-center gap-2 text-xs text-gray-400 uppercase font-semibold"><TrendingUp size={14} /> Profit Kotor</div><p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(netProfit)}</p></div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 text-xs text-gray-400 uppercase font-semibold"><ShoppingBag size={14} /> Transaksi</div>
          <p className="text-2xl font-bold text-gray-800 mt-1">{totalTransactions}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 text-xs text-gray-400 uppercase font-semibold"><Calendar size={14} /> Rata-rata / Transaksi</div>
          <p className="text-2xl font-bold text-gray-800 mt-1">{formatCurrency(avgTransaction)}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-50 font-semibold text-gray-800">
          <Trophy size={16} className="text-amber-400" /> Obat Terlaris
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3">Peringkat</th>
                <th className="text-left px-4 py-3">Nama Obat</th>
                <th className="text-right px-4 py-3">Jumlah Terjual</th>
                <th className="text-right px-4 py-3">Total Pendapatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {topMedicines.map((med, i) => (
                <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      i === 0 ? 'bg-amber-100 text-amber-600' :
                      i === 1 ? 'bg-gray-200 text-gray-600' :
                      i === 2 ? 'bg-orange-100 text-orange-600' :
                      'bg-gray-100 text-gray-400'
                    }`}>{i + 1}</div>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">{med.name}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{med.total_qty} {med.unit}</td>
                  <td className="px-4 py-3 text-right font-semibold text-teal-600">{formatCurrency(med.total_revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {topMedicines.length === 0 && <div className="text-center text-gray-400 py-10"><p>Belum ada data penjualan</p></div>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari invoice atau pasien..." className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white" />
        </div>
        <input value={patientFilter} onChange={e => setPatientFilter(e.target.value)} placeholder="Filter nama pasien" className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white" />
        <select value={doctorFilter} onChange={e => setDoctorFilter(e.target.value)} className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white"><option value="">Semua Dokter</option>{doctors.map(doctor => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}</select>
        <select value={period} onChange={e => setPeriod(e.target.value as PeriodFilter)} className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white"><option value="daily">Harian</option><option value="weekly">Mingguan</option><option value="monthly">Bulanan</option><option value="yearly">Tahunan</option><option value="custom">Custom</option></select>
        {(period === 'daily' || period === 'custom') && <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white" />}
        {period === 'custom' && <><span className="text-gray-400 text-sm">sampai</span><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white" /></>}
        <button onClick={load} className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold">Terapkan</button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3">No. Invoice</th>
                <th className="text-left px-4 py-3">Tanggal</th>
                <th className="text-left px-4 py-3">Pasien</th>
                <th className="text-left px-4 py-3">Dokter</th>
                <th className="text-left px-4 py-3">Jenis Penjualan</th>
                <th className="text-left px-4 py-3">Pembayaran</th>
                <th className="text-right px-4 py-3">Subtotal</th>
                <th className="text-right px-4 py-3">Diskon</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-center px-4 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-teal-600 font-medium">{s.invoice_number}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(s.sale_date)}</td>
                  <td className="px-4 py-3 text-gray-700">{s.patient_name || s.patients?.name || 'Umum'}</td>
                  <td className="px-4 py-3 text-gray-500">{s.doctors?.name ?? '-'}</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs bg-teal-50 text-teal-700">{SALE_TYPE_LABELS[s.sale_type as SaleTypeFilter] ?? s.sale_type}</span></td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-600 capitalize">{s.payment_method}</span></td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(s.subtotal)}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{formatCurrency(s.discount)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-800">{formatCurrency(s.total)}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => viewDetail(s.id)} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Lihat detail"><Eye size={14} /></button>
                      <button onClick={async () => { const { data } = await tenantFrom('sales').select('*, sale_items(*), patients(name), doctors(name)').eq('id', s.id).single(); setDeleteTarget(data as any); }} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Hapus transaksi"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="text-center text-gray-400 py-16"><p>Belum ada transaksi</p></div>}
      </div>

      {viewSale && <SaleDetail sale={viewSale} onClose={() => setViewSale(null)} />}

      {deleteTarget && (
        <Modal title="Konfirmasi Hapus Transaksi" onClose={() => !deleting && setDeleteTarget(null)}>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-red-50 rounded-xl">
              <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} />
              <div className="text-sm text-red-700">
                <p className="font-semibold">Yakin ingin menghapus transaksi ini?</p>
                <p className="mt-1 text-red-600">Invoice <span className="font-mono font-medium">{deleteTarget.invoice_number}</span> akan dihapus permanen. Stok obat akan dikembalikan sesuai jumlah yang terjual.</p>
              </div>
            </div>
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase"><tr><th className="text-left px-3 py-2">Obat</th><th className="text-center px-3 py-2">Qty</th><th className="text-right px-3 py-2">Total</th></tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {(deleteTarget.sale_items ?? []).map(item => (
                    <tr key={item.id}><td className="px-3 py-2 font-medium text-gray-700">{item.medicine_name ?? '-'}</td><td className="px-3 py-2 text-center text-gray-600">{item.quantity}</td><td className="px-3 py-2 text-right font-semibold text-gray-800">{formatCurrency(item.total_price)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between text-sm font-semibold text-gray-800 border-t border-gray-100 pt-3"><span>Total Transaksi</span><span className="text-red-600">{formatCurrency(deleteTarget.total)}</span></div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">Batal</button>
              <button onClick={() => deleteSale(deleteTarget)} disabled={deleting} className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                {deleting ? <><span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Menghapus...</> : <><Trash2 size={14} /> Hapus Transaksi</>}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function KeuntunganTab() {
  const [range, setRange] = useState<'today' | 'month' | 'custom'>('month');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sales, setSales] = useState<Sale[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [expenses, setExpenses] = useState<OperationalExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<OperationalExpense | null>(null);
  const [expenseCategory, setExpenseCategory] = useState('Lainnya');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState(0);
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => { load(); }, [range, dateFrom, dateTo]);

  function getRange(): { from: string; to: string } {
    const now = new Date();
    if (range === 'today') {
      const d = now.toISOString().split('T')[0];
      return { from: d, to: d };
    }
    if (range === 'month') {
      const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      return { from, to };
    }
    return { from: dateFrom, to: dateTo };
  }

  async function load() {
    setLoading(true);
    const { from, to } = getRange();
    if (!from || !to) { setLoading(false); return; }

    const fromIso = new Date(from).toISOString();
    const toIso = new Date(to + 'T23:59:59').toISOString();

    const [salesRes, itemsRes, expRes] = await Promise.all([
      tenantFrom('sales').select('*').gte('sale_date', fromIso).lte('sale_date', toIso),
      tenantFrom('sale_items').select('*'),
      tenantFrom('operational_expenses').select('*').gte('expense_date', from).lte('expense_date', to).order('expense_date', { ascending: false }),
    ]);

    const salesData = (salesRes.data as Sale[] | null) ?? [];
    const itemsData = (itemsRes.data as SaleItem[] | null) ?? [];
    const saleIds = new Set(salesData.map(s => s.id));
    const filteredItems = itemsData.filter(i => saleIds.has(i.sale_id));

    setSales(salesData);
    setSaleItems(filteredItems);
    setExpenses((expRes.data as OperationalExpense[] | null) ?? []);
    setLoading(false);
  }

  const totalRevenue = sales.reduce((s, r) => s + r.total, 0);
  const totalHPP = saleItems.reduce((s, i) => s + (i.cost_price || 0) * i.quantity, 0);
  const grossProfit = totalRevenue - totalHPP;
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const netProfit = grossProfit - totalExpenses;

  // Chart data: daily profit
  const dailyMap = new Map<string, { revenue: number; hpp: number; expense: number }>();
  for (const s of sales) {
    const d = s.sale_date.split('T')[0];
    const e = dailyMap.get(d) ?? { revenue: 0, hpp: 0, expense: 0 };
    e.revenue += s.total;
    dailyMap.set(d, e);
  }
  for (const i of saleItems) {
    const sale = sales.find(s => s.id === i.sale_id);
    if (!sale) continue;
    const d = sale.sale_date.split('T')[0];
    const e = dailyMap.get(d) ?? { revenue: 0, hpp: 0, expense: 0 };
    e.hpp += (i.cost_price || 0) * i.quantity;
    dailyMap.set(d, e);
  }
  for (const exp of expenses) {
    const d = exp.expense_date;
    const e = dailyMap.get(d) ?? { revenue: 0, hpp: 0, expense: 0 };
    e.expense += exp.amount;
    dailyMap.set(d, e);
  }
  const dailyData = Array.from(dailyMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(-30);
  const maxVal = Math.max(1, ...dailyData.map(d => Math.max(d[1].revenue, d[1].hpp + d[1].expense)));

  function resetExpenseForm() {
    setExpenseCategory('Lainnya');
    setExpenseDesc('');
    setExpenseAmount(0);
    setExpenseDate(new Date().toISOString().split('T')[0]);
    setEditingExpense(null);
  }

  async function saveExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!expenseAmount || expenseAmount <= 0) return;
    if (editingExpense) {
      await tenantFrom('operational_expenses').update({
        category: expenseCategory,
        description: expenseDesc,
        amount: expenseAmount,
        expense_date: expenseDate,
      }).eq('id', editingExpense.id);
    } else {
      await tenantFrom('operational_expenses').insert({
        category: expenseCategory,
        description: expenseDesc,
        amount: expenseAmount,
        expense_date: expenseDate,
      });
    }
    setShowExpenseForm(false);
    resetExpenseForm();
    load();
  }

  async function deleteExpense(id: string) {
    if (!confirm('Hapus pengeluaran ini?')) return;
    await tenantFrom('operational_expenses').delete().eq('id', id);
    load();
  }

  if (loading) return <div className="flex items-center justify-center h-full"><div className="animate-spin w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-4">
      {/* Range Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex bg-gray-100 rounded-xl p-1">
          <button onClick={() => setRange('today')} className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${range === 'today' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-500'}`}>Hari Ini</button>
          <button onClick={() => setRange('month')} className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${range === 'month' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-500'}`}>Bulan Ini</button>
          <button onClick={() => setRange('custom')} className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${range === 'custom' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-500'}`}>Kustom</button>
        </div>
        {range === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white" />
            <span className="text-gray-400 text-sm">sampai</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white" />
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 text-xs text-gray-400 uppercase font-semibold"><DollarSign size={14} /> Omset</div>
          <p className="text-xl font-bold text-teal-600 mt-1">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 text-xs text-gray-400 uppercase font-semibold"><Receipt size={14} /> HPP (Modal)</div>
          <p className="text-xl font-bold text-orange-500 mt-1">{formatCurrency(totalHPP)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 text-xs text-gray-400 uppercase font-semibold"><TrendingUp size={14} /> Laba Kotor</div>
          <p className="text-xl font-bold text-blue-600 mt-1">{formatCurrency(grossProfit)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 text-xs text-gray-400 uppercase font-semibold"><Wallet size={14} /> Biaya Operasional</div>
          <p className="text-xl font-bold text-red-500 mt-1">{formatCurrency(totalExpenses)}</p>
        </div>
        <div className={`bg-white rounded-2xl border shadow-sm p-5 ${netProfit >= 0 ? 'border-green-200' : 'border-red-200'}`}>
          <div className="flex items-center gap-2 text-xs text-gray-400 uppercase font-semibold"><PiggyBank size={14} /> Laba Bersih</div>
          <p className={`text-xl font-bold mt-1 ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(netProfit)}</p>
        </div>
      </div>

      {/* Chart */}
      {dailyData.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4 font-semibold text-gray-800">
            <BarChart3 size={16} className="text-teal-500" /> Grafik Keuntungan Harian
          </div>
          <div className="flex items-end gap-1 h-40 overflow-x-auto">
            {dailyData.map(([date, val]) => {
              const profit = val.revenue - val.hpp - val.expense;
              const h = Math.max(2, (Math.abs(profit) / maxVal) * 100);
              return (
                <div key={date} className="flex flex-col items-center gap-1 flex-shrink-0" style={{ minWidth: '30px' }}>
                  <div className="text-[9px] font-bold text-gray-500">{profit >= 0 ? '+' : ''}{Math.round(profit / 1000)}k</div>
                  <div className={`w-6 rounded-t ${profit >= 0 ? 'bg-teal-400' : 'bg-red-400'}`} style={{ height: `${h}%` }} title={`${date}: ${formatCurrency(profit)}`} />
                  <div className="text-[8px] text-gray-400">{date.slice(5)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Operational Expenses */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <div className="flex items-center gap-2 font-semibold text-gray-800">
            <Wallet size={16} className="text-red-400" /> Pengeluaran Operasional
          </div>
          <button onClick={() => { resetExpenseForm(); setShowExpenseForm(true); }} className="flex items-center gap-1.5 bg-teal-500 hover:bg-teal-600 text-white px-3 py-2 rounded-lg text-sm font-semibold transition-colors">
            <Plus size={14} /> Tambah
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3">Tanggal</th>
                <th className="text-left px-4 py-3">Kategori</th>
                <th className="text-left px-4 py-3">Deskripsi</th>
                <th className="text-right px-4 py-3">Jumlah</th>
                <th className="text-center px-4 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {expenses.map(exp => {
                const cat = EXPENSE_CATEGORIES.find(c => c.value === exp.category) ?? EXPENSE_CATEGORIES[3];
                const CatIcon = cat.icon;
                return (
                  <tr key={exp.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 text-gray-500">{formatDate(exp.expense_date)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cat.color}`}>
                        <CatIcon size={12} /> {exp.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{exp.description ?? '-'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-red-500">{formatCurrency(exp.amount)}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => { setEditingExpense(exp); setExpenseCategory(exp.category); setExpenseDesc(exp.description ?? ''); setExpenseAmount(exp.amount); setExpenseDate(exp.expense_date); setShowExpenseForm(true); }} className="p-1.5 text-gray-400 hover:text-teal-500 hover:bg-teal-50 rounded-lg transition-colors"><Pencil size={14} /></button>
                        <button onClick={() => deleteExpense(exp.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {expenses.length === 0 && <div className="text-center text-gray-400 py-10"><p>Belum ada pengeluaran operasional pada rentang ini</p></div>}
        </div>
      </div>

      {/* Expense Form Modal */}
      {showExpenseForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setShowExpenseForm(false); resetExpenseForm(); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">{editingExpense ? 'Edit' : 'Tambah'} Pengeluaran</h3>
              <button onClick={() => { setShowExpenseForm(false); resetExpenseForm(); }} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
            </div>
            <form onSubmit={saveExpense} className="p-5 space-y-4">
              <div>
                <label className="text-xs text-gray-500 font-medium">Kategori</label>
                <div className="grid grid-cols-4 gap-2 mt-1">
                  {EXPENSE_CATEGORIES.map(cat => {
                    const Icon = cat.icon;
                    return (
                      <button key={cat.value} type="button" onClick={() => setExpenseCategory(cat.value)} className={`flex flex-col items-center gap-1 py-2 rounded-xl text-xs font-medium border transition-colors ${expenseCategory === cat.value ? 'bg-teal-50 border-teal-400 text-teal-700' : 'bg-white border-gray-200 text-gray-500'}`}>
                        <Icon size={16} /> {cat.value}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium">Deskripsi</label>
                <input type="text" value={expenseDesc} onChange={e => setExpenseDesc(e.target.value)} placeholder="Keterangan pengeluaran..." className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium">Jumlah (Rp)</label>
                <input type="number" value={expenseAmount} onChange={e => setExpenseAmount(Number(e.target.value))} required min={1} className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium">Tanggal</label>
                <input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} required className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => { setShowExpenseForm(false); resetExpenseForm(); }} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">Batal</button>
                <button type="submit" className="flex-1 bg-teal-500 hover:bg-teal-600 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function SaleDetail({ sale, onClose }: { sale: Sale & { sale_items: SaleItem[] | null; patients: { name: string } | null; doctors: { name: string } | null }; onClose: () => void }) {
  function printSale() {
    const lines = (sale.sale_items ?? []).map(item => `<div>${item.medicine_name} x${item.quantity}<span style="float:right">${formatCurrency(item.total_price)}</span></div>`).join('');
    const html = `<!doctype html><html><head><title>${sale.invoice_number}</title><style>@page{size:58mm auto;margin:0}body{width:58mm;margin:0;padding:4mm;font:11px monospace;box-sizing:border-box}.center{text-align:center}.line{border-top:1px dashed #000;margin:4px 0}.total{font-weight:bold;font-size:13px}</style></head><body><div class="center"><b>NOTA APOTEK</b><br>${sale.invoice_number}<br>${new Date(sale.sale_date).toLocaleString('id-ID')}</div><div class="line"></div><div>Pasien: ${sale.patient_name || sale.patients?.name || 'Umum'}</div><div>Dokter: ${sale.doctors?.name || '-'}</div><div>Jenis: ${sale.sale_type}</div><div class="line"></div>${lines}<div class="line"></div><div>Subtotal <span style="float:right">${formatCurrency(sale.subtotal)}</span></div><div>Diskon <span style="float:right">-${formatCurrency(sale.discount)}</span></div><div class="total">TOTAL <span style="float:right">${formatCurrency(sale.total)}</span></div><div>Bayar <span style="float:right">${formatCurrency(sale.paid_amount)}</span></div><div>Kembali <span style="float:right">${formatCurrency(sale.change_amount)}</span></div><div class="line"></div><div class="center">Terima kasih</div></body></html>`;
    const win = window.open('', '_blank', 'width=420,height=600');
    if (!win) return;
    win.document.write(html); win.document.close(); win.focus(); setTimeout(() => win.print(), 250);
  }

  return (
    <Modal title={`Invoice ${sale.invoice_number}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-400 uppercase font-semibold">Pasien</p>
            <p className="font-medium text-gray-800 mt-1">{sale.patient_name || sale.patients?.name || 'Umum'}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase font-semibold">Tanggal</p>
            <p className="font-medium text-gray-800 mt-1">{formatDate(sale.sale_date)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase font-semibold">Dokter</p>
            <p className="font-medium text-gray-800 mt-1">{sale.doctors?.name ?? '-'}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase font-semibold">Pembayaran</p>
            <p className="font-medium text-gray-800 mt-1 capitalize">{sale.payment_method}</p>
          </div>
        </div>
        <div className="border border-gray-100 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase"><tr><th className="text-left px-3 py-2">Obat</th><th className="text-center px-3 py-2">Qty</th><th className="text-right px-3 py-2">Harga</th><th className="text-right px-3 py-2">Total</th></tr></thead>
            <tbody className="divide-y divide-gray-50">
              {(sale.sale_items ?? []).map(item => (
                <tr key={item.id}><td className="px-3 py-2 font-medium text-gray-700">{item.medicine_name ?? '-'}</td><td className="px-3 py-2 text-center text-gray-600">{item.quantity}</td><td className="px-3 py-2 text-right text-gray-600">{formatCurrency(item.unit_price)}</td><td className="px-3 py-2 text-right font-semibold text-gray-800">{formatCurrency(item.total_price)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{formatCurrency(sale.subtotal)}</span></div>
          <div className="flex justify-between text-gray-600"><span>Diskon</span><span>-{formatCurrency(sale.discount)}</span></div>
          <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-100 pt-2"><span>Total</span><span className="text-teal-600">{formatCurrency(sale.total)}</span></div>
          {sale.payment_method === 'cash' && (<><div className="flex justify-between text-gray-500"><span>Dibayar</span><span>{formatCurrency(sale.paid_amount)}</span></div><div className="flex justify-between text-gray-500"><span>Kembalian</span><span>{formatCurrency(sale.change_amount)}</span></div></>)}
        </div>
        <div className="flex gap-2"><button onClick={printSale} className="flex-1 py-2.5 bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2"><Download size={15} /> Cetak Nota</button><button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">Tutup</button></div>
      </div>
    </Modal>
  );
}
