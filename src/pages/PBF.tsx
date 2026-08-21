import { useState, useEffect } from 'react';
import { tenantFrom } from '@/lib/supabase';
import type { Supplier } from '@/lib/supabase';
import { Plus, Search, Edit2, Trash2, Phone, MapPin, X } from 'lucide-react';
import { Modal, Field } from './ObatStok';

export default function PBF() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await tenantFrom('suppliers').select('*').order('name');
    setSuppliers(data ?? []);
    setLoading(false);
  }

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.code ?? '').toLowerCase().includes(search.toLowerCase())
  );

  async function del(s: Supplier) {
    if (!confirm(`Hapus supplier "${s.name}"?`)) return;
    await tenantFrom('suppliers').delete().eq('id', s.id);
    load();
  }

  if (loading) return <div className="flex items-center justify-center h-full"><div className="animate-spin w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">PBF / Supplier</h1>
          <p className="text-gray-500 text-sm mt-1">Data Pedagang Besar Farmasi dan supplier</p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors">
          <Plus size={16} /> Tambah Supplier
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari supplier..." className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(s => (
          <div key={s.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
                  <span className="text-teal-600 font-bold text-sm">{s.name.charAt(0)}</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-800 text-sm leading-tight">{s.name}</p>
                  {s.code && <p className="text-xs text-gray-400 mt-0.5">Kode: {s.code}</p>}
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setEditing(s); setShowForm(true); }} className="p-1.5 text-gray-400 hover:text-teal-500 hover:bg-teal-50 rounded-lg transition-colors"><Edit2 size={14} /></button>
                <button onClick={() => del(s)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
              </div>
            </div>
            <div className="mt-3 space-y-1.5 text-sm text-gray-600">
              {s.contact_person && <p className="text-xs text-gray-500">CP: {s.contact_person}</p>}
              {s.phone && <p className="flex items-center gap-1.5 text-xs"><Phone size={12} className="text-gray-400" /> {s.phone}</p>}
              {s.address && <p className="flex items-start gap-1.5 text-xs"><MapPin size={12} className="text-gray-400 mt-0.5 flex-shrink-0" /> {s.address}</p>}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-50">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.is_active ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                {s.is_active ? 'Aktif' : 'Nonaktif'}
              </span>
            </div>
          </div>
        ))}
      </div>
      {filtered.length === 0 && <div className="text-center text-gray-400 py-16"><p>Tidak ada supplier</p></div>}

      {showForm && <SupplierForm supplier={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function SupplierForm({ supplier, onClose, onSaved }: { supplier: Supplier | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: supplier?.name ?? '',
    code: supplier?.code ?? '',
    address: supplier?.address ?? '',
    phone: supplier?.phone ?? '',
    email: supplier?.email ?? '',
    contact_person: supplier?.contact_person ?? '',
    npwp: supplier?.npwp ?? '',
    pbf_license: supplier?.pbf_license ?? '',
    is_active: supplier?.is_active ?? true,
    notes: supplier?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      if (supplier) {
        await tenantFrom('suppliers').update(form).eq('id', supplier.id);
      } else {
        await tenantFrom('suppliers').insert(form);
      }
      onSaved();
    } finally { setSaving(false); }
  }

  return (
    <Modal title={supplier ? 'Edit Supplier' : 'Tambah Supplier'} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nama Supplier / PBF" className="col-span-2"><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input" /></Field>
        <Field label="Kode"><input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} className="input" /></Field>
        <Field label="Contact Person"><input value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} className="input" /></Field>
        <Field label="Telepon"><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input" /></Field>
        <Field label="Email"><input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input" /></Field>
        <Field label="Alamat" className="col-span-2"><textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} rows={2} className="input" /></Field>
        <Field label="NPWP"><input value={form.npwp} onChange={e => setForm({ ...form, npwp: e.target.value })} className="input" /></Field>
        <Field label="No. Izin PBF"><input value={form.pbf_license} onChange={e => setForm({ ...form, pbf_license: e.target.value })} className="input" /></Field>
        <Field label="Status" className="col-span-2">
          <label className="flex items-center gap-2 mt-1">
            <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4 accent-teal-500" />
            <span className="text-sm text-gray-600">Supplier aktif</span>
          </label>
        </Field>
      </div>
      <div className="flex gap-2 mt-5">
        <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">Batal</button>
        <button onClick={save} disabled={saving || !form.name} className="flex-1 py-2.5 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold">{saving ? 'Menyimpan...' : 'Simpan'}</button>
      </div>
    </Modal>
  );
}
