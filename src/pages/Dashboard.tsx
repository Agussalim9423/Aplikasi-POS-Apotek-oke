import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { tenantFrom, formatCurrency, formatDate } from '@/lib/supabase';
import type { Medicine, MedicineBatch, Sale } from '@/lib/supabase';
import {
  TrendingUp, Pill, Package, AlertTriangle, Clock,
  ShoppingCart, ArrowRight, Trophy
} from 'lucide-react';

type TopMedicine = { name: string; total_qty: number; total_revenue: number; unit: string };

type DashboardStats = {
  todaySales: number;
  todayTransactions: number;
  totalMedicines: number;
  stockValue: number;
  lowStockCount: number;
  expiringCount: number;
  lowStockItems: Medicine[];
  expiringBatches: (MedicineBatch & { medicines: Medicine })[];
  recentSales: Sale[];
  topMedicines: TopMedicine[];
};

type Props = { onNavigate: (page: string) => void };

export default function Dashboard({ onNavigate }: Props) {
  const [stats, setStats] = useState<DashboardStats>({
    todaySales: 0, todayTransactions: 0, totalMedicines: 0, expiringCount: 0,
    stockValue: 0, lowStockCount: 0, lowStockItems: [],
    expiringBatches: [], recentSales: [], topMedicines: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    setLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [medicinesRes, todaySalesRes, batchesRes, recentSalesRes, topMedsRes] = await Promise.all([
        tenantFrom('medicines').select('*').eq('is_active', true),
        tenantFrom('sales').select('total').gte('sale_date', today.toISOString()),
        tenantFrom('medicine_batches').select('*, medicines(*)').lte('expiry_date', new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0]).order('expiry_date'),
        tenantFrom('sales').select('*, patients(name), doctors(name)').order('sale_date', { ascending: false }).limit(5),
        tenantFrom('sale_items').select('medicine_name, quantity, total_price, medicines(unit)'),
      ]);

      const medicines: Medicine[] = medicinesRes.data ?? [];
      const lowStockItems = medicines.filter(m => m.stock <= m.min_stock);
      const stockValue = medicines.reduce((s, m) => s + m.stock * m.buy_price, 0);
      const todaySales = (todaySalesRes.data ?? []).reduce((s: number, r: { total: number }) => s + r.total, 0);

      const medMap = new Map<string, { name: string; total_qty: number; total_revenue: number; unit: string }>();
      for (const item of (topMedsRes.data ?? [])) {
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
      const topMedicines = Array.from(medMap.values()).sort((a, b) => b.total_qty - a.total_qty).slice(0, 5);
      const expiringCount = (batchesRes.data ?? []).filter((batch: { expiry_date: string }) => new Date(batch.expiry_date).getTime() <= Date.now() + 90 * 86400000).length;

      setStats({
        todaySales,
        todayTransactions: todaySalesRes.data?.length ?? 0,
        totalMedicines: medicines.length,
        stockValue,
        lowStockCount: lowStockItems.length,
        expiringCount,
        lowStockItems: lowStockItems.slice(0, 5),
        expiringBatches: (batchesRes.data ?? []) as (MedicineBatch & { medicines: Medicine })[],
        recentSales: recentSalesRes.data ?? [],
        topMedicines,
      });
    } finally {
      setLoading(false);
    }
  }

  const daysUntilExpiry = (dateStr: string) =>
    Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Ringkasan operasional</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <StatCard
          label="PENJUALAN HARI INI"
          value={formatCurrency(stats.todaySales)}
          sub={`${stats.todayTransactions} transaksi`}
          icon={<TrendingUp size={20} className="text-white" />}
          iconBg="bg-teal-500"
        />
        <StatCard
          label="TOTAL OBAT"
          value={String(stats.totalMedicines)}
          sub="item terdaftar"
          icon={<Pill size={20} className="text-white" />}
          iconBg="bg-blue-500"
        />
        <StatCard
          label="NILAI STOK"
          value={formatCurrency(stats.stockValue)}
          sub="nilai inventaris"
          icon={<Package size={20} className="text-white" />}
          iconBg="bg-green-500"
        />
        <StatCard
          label="ALERT STOK RENDAH"
          value={String(stats.lowStockCount)}
          sub="perlu pesan ulang"
          icon={<AlertTriangle size={20} className="text-white" />}
          iconBg="bg-orange-500"
        />
        <StatCard
          label="AKAN KADALUARSA"
          value={String(stats.expiringCount)}
          sub="dalam <= 3 bulan"
          icon={<Clock size={20} className="text-white" />}
          iconBg="bg-amber-500"
        />
      </div>

      {/* Alerts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Low Stock */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <div className="flex items-center gap-2 font-semibold text-gray-800">
              <AlertTriangle size={16} className="text-orange-400" />
              Peringatan Stok Rendah
            </div>
            <button
              onClick={() => onNavigate('obat')}
              className="text-sm text-teal-600 hover:text-teal-700 flex items-center gap-1"
            >
              Lihat <ArrowRight size={14} />
            </button>
          </div>
          <div className="divide-y divide-gray-50">
            {stats.lowStockItems.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">Semua stok aman</p>
            ) : (
              stats.lowStockItems.map(med => (
                <div key={med.id} className="flex items-center justify-between px-5 py-3.5 bg-orange-50/30 hover:bg-orange-50/60 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{med.name}</p>
                    <p className="text-xs text-gray-400">Reorder: {med.min_stock} {med.unit}</p>
                  </div>
                  <span className={`text-sm font-bold ${med.stock === 0 ? 'text-red-500' : 'text-orange-500'}`}>
                    {med.stock} {med.unit}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Expiring */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <div className="flex items-center gap-2 font-semibold text-gray-800">
              <Clock size={16} className="text-red-400" />
              Peringatan Kadaluarsa
            </div>
            <button
              onClick={() => onNavigate('obat')}
              className="text-sm text-teal-600 hover:text-teal-700 flex items-center gap-1"
            >
              Lihat <ArrowRight size={14} />
            </button>
          </div>
          <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
            {stats.expiringBatches.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">Tidak ada obat mendekati kadaluarsa</p>
            ) : (
              stats.expiringBatches.map(batch => {
                const days = daysUntilExpiry(batch.expiry_date);
                return (
                  <div key={batch.id} className="flex items-center justify-between px-5 py-3.5 bg-red-50/30 hover:bg-red-50/60 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{batch.medicines?.name}</p>
                      <p className="text-xs text-gray-400">Batch {batch.batch_number}</p>
                    </div>
                    <span className="text-xs font-semibold text-red-500 bg-red-50 px-2 py-1 rounded-full">
                      {days <= 30 ? '≤1 bulan' : days <= 60 ? '≤2 bulan' : '≤3 bulan'} ({days}h)
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Top Medicines + Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Top Medicines */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <div className="flex items-center gap-2 font-semibold text-gray-800">
            <Trophy size={16} className="text-amber-400" />
            Obat Terlaris
          </div>
          <button
            onClick={() => onNavigate('laporan')}
            className="text-sm text-teal-600 hover:text-teal-700 flex items-center gap-1"
          >
            Detail <ArrowRight size={14} />
          </button>
        </div>
        <div className="divide-y divide-gray-50">
          {stats.topMedicines.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-10">Belum ada data penjualan</p>
          ) : (
            stats.topMedicines.map((med, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/50 transition-colors">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  i === 0 ? 'bg-amber-100 text-amber-600' :
                  i === 1 ? 'bg-gray-200 text-gray-600' :
                  i === 2 ? 'bg-orange-100 text-orange-600' :
                  'bg-gray-100 text-gray-400'
                }`}>{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{med.name}</p>
                  <p className="text-xs text-gray-400">{med.total_qty} {med.unit} terjual</p>
                </div>
                <span className="text-sm font-semibold text-teal-600">{formatCurrency(med.total_revenue)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <div className="flex items-center gap-2 font-semibold text-gray-800">
            <ShoppingCart size={16} className="text-teal-500" />
            Transaksi Terbaru
          </div>
          <button
            onClick={() => onNavigate('laporan')}
            className="text-sm text-teal-600 hover:text-teal-700 flex items-center gap-1"
          >
            Semua <ArrowRight size={14} />
          </button>
        </div>
        {stats.recentSales.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-10">Belum ada transaksi hari ini</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="text-left px-5 py-3">No. Invoice</th>
                  <th className="text-left px-5 py-3">Pasien</th>
                  <th className="text-left px-5 py-3">Waktu</th>
                  <th className="text-left px-5 py-3">Pembayaran</th>
                  <th className="text-right px-5 py-3">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stats.recentSales.map(sale => (
                  <tr key={sale.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 font-mono text-teal-600 font-medium">{sale.invoice_number}</td>
                    <td className="px-5 py-3 text-gray-700">{sale.patient_name || sale.patients?.name || 'Umum'}</td>
                    <td className="px-5 py-3 text-gray-500">{formatDate(sale.sale_date)}</td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-600 capitalize">{sale.payment_method}</span>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-800">{formatCurrency(sale.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, icon, iconBg }: {
  label: string; value: string; sub: string;
  icon: ReactNode; iconBg: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start justify-between">
      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-1 leading-tight">{value}</p>
        <p className="text-xs text-gray-400 mt-1">{sub}</p>
      </div>
      <div className={`${iconBg} w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
    </div>
  );
}
