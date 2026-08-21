import { useState, useEffect } from 'react';
import { tenantFrom } from '@/lib/supabase';
import type { Doctor } from '@/lib/supabase';
import { Plus, Search, Edit2, Trash2, Stethoscope, Phone } from 'lucide-react';
import { Modal, Field } from './ObatStok';

export default function Dokter() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await tenantFrom('doctors').select('*').order('name');
    setDoctors(data ?? []);
    setLoading(false);
  }

  const filtered = doctors.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    (d.specialization ?? '').toLowerCase().includes(search.toLowerCase())
  );

  async function del(d: Doctor) {
    if (!confirm(`Hapus dokter "${d.name}"?`)) return;
    await tenantFrom('doctors').delete().eq('id', d.id);
    load();
  }

  if (loading) return <div className="flex items-center justify-center h-full"><div className="animate-spin w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Dokter</h1>
          <p className="text-gray-500 text-sm mt-1">Daftar dokter peresep</p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors">
          <Plus size={16} /> Tambah Dokter
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari dokter atau spesialisasi..." className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(d => (
          <div key={d.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center"><Stethoscope size={18} className="text-blue-500" /></div>
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{d.name}</p>
                  {d.specialization && <p className="text-xs text-teal-600 mt-0.5">{d.specialization}</p>}
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setEditing(d); setShowForm(true); }} className="p-1.5 text-gray-400 hover:text-teal-500 hover:bg-teal-50 rounded-lg transition-colors"><Edit2 size={14} /></button>
                <button onClick={() => del(d)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
              </div>
            </div>
            <div className="mt-3 space-y-1 text-sm text-gray-600">
              {d.sip_number && <p className="text-xs">SIP: <span className="font-mono">{d.sip_number}</span></p>}
              {d.clinic && <p className="text-xs">{d.clinic}</p>}
              {d.phone && <p className="flex items-center gap-1.5 text-xs"><Phone size={12} className="text-gray-400" /> {d.phone}</p>}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-50">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${d.is_active ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                {d.is_active ? 'Aktif' : 'Nonaktif'}
              </span>
            </div>
          </div>
        ))}
      </div>
      {filtered.length === 0 && <div className="text-center text-gray-400 py-16"><p>Tidak ada dokter</p></div>}

      {showForm && <DoctorForm doctor={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function DoctorForm({ doctor, onClose, onSaved }: { doctor: Doctor | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: doctor?.name ?? '',
    specialization: doctor?.specialization ?? '',
    sip_number: doctor?.sip_number ?? '',
    phone: doctor?.phone ?? '',
    email: doctor?.email ?? '',
    clinic: doctor?.clinic ?? '',
    address: doctor?.address ?? '',
    is_active: doctor?.is_active ?? true,
    notes: doctor?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      if (doctor) {
        await tenantFrom('doctors').update(form).eq('id', doctor.id);
      } else {
        await tenantFrom('doctors').insert(form);
      }
      onSaved();
    } finally { setSaving(false); }
  }

  return (
    <Modal title={doctor ? 'Edit Dokter' : 'Tambah Dokter'} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nama Dokter" className="col-span-2"><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input" /></Field>
        <Field label="Spesialisasi"><input value={form.specialization} onChange={e => setForm({ ...form, specialization: e.target.value })} placeholder="Umum, Anak, dll" className="input" /></Field>
        <Field label="No. SIP"><input value={form.sip_number} onChange={e => setForm({ ...form, sip_number: e.target.value })} className="input" /></Field>
        <Field label="Telepon"><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input" /></Field>
        <Field label="Email"><input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input" /></Field>
        <Field label="Klinik / RS"><input value={form.clinic} onChange={e => setForm({ ...form, clinic: e.target.value })} className="input" /></Field>
        <Field label="Alamat"><input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="input" /></Field>
        <Field label="Status" className="col-span-2">
          <label className="flex items-center gap-2 mt-1">
            <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4 accent-teal-500" />
            <span className="text-sm text-gray-600">Dokter aktif meresep</span>
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
