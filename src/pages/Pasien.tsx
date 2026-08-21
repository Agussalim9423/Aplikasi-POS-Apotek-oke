import { useState, useEffect } from 'react';
import { tenantFrom, formatDate } from '@/lib/supabase';
import type { Patient } from '@/lib/supabase';
import { Plus, Search, Edit2, Trash2, X, User, Phone, AlertCircle } from 'lucide-react';
import { Modal, Field } from './ObatStok';

export default function Pasien() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await tenantFrom('patients').select('*').order('name');
    setPatients(data ?? []);
    setLoading(false);
  }

  const filtered = patients.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.phone ?? '').includes(search) ||
    (p.bpjs_number ?? '').includes(search)
  );

  async function del(p: Patient) {
    if (!confirm(`Hapus pasien "${p.name}"?`)) return;
    await tenantFrom('patients').delete().eq('id', p.id);
    load();
  }

  function age(dob: string | null) {
    if (!dob) return '-';
    const diff = Date.now() - new Date(dob).getTime();
    return Math.floor(diff / (365.25 * 86400000)) + ' th';
  }

  if (loading) return <div className="flex items-center justify-center h-full"><div className="animate-spin w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Pasien</h1>
          <p className="text-gray-500 text-sm mt-1">Catatan pasien dan riwayat alergi</p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors">
          <Plus size={16} /> Tambah Pasien
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama, telepon, atau BPJS..." className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white" />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3">Nama</th>
                <th className="text-left px-4 py-3">Tgl Lahir</th>
                <th className="text-left px-4 py-3">Usia</th>
                <th className="text-left px-4 py-3">Gender</th>
                <th className="text-left px-4 py-3">Telepon</th>
                <th className="text-left px-4 py-3">BPJS</th>
                <th className="text-left px-4 py-3">Alergi</th>
                <th className="text-center px-4 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center"><User size={14} className="text-blue-500" /></div>
                      <span className="font-medium text-gray-800">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{p.date_of_birth ? formatDate(p.date_of_birth) : '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{age(p.date_of_birth)}</td>
                  <td className="px-4 py-3 text-gray-500">{p.gender === 'L' ? 'Laki-laki' : p.gender === 'P' ? 'Perempuan' : '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{p.phone ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{p.bpjs_number ?? '-'}</td>
                  <td className="px-4 py-3">{p.allergy ? <span className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded-full flex items-center gap-1 w-fit"><AlertCircle size={10} /> {p.allergy}</span> : <span className="text-gray-300">-</span>}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => { setEditing(p); setShowForm(true); }} className="p-1.5 text-gray-400 hover:text-teal-500 hover:bg-teal-50 rounded-lg transition-colors"><Edit2 size={14} /></button>
                      <button onClick={() => del(p)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="text-center text-gray-400 py-16"><p>Tidak ada pasien</p></div>}
      </div>

      {showForm && <PatientForm patient={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function PatientForm({ patient, onClose, onSaved }: { patient: Patient | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: patient?.name ?? '',
    date_of_birth: patient?.date_of_birth ?? '',
    gender: patient?.gender ?? '',
    phone: patient?.phone ?? '',
    email: patient?.email ?? '',
    address: patient?.address ?? '',
    allergy: patient?.allergy ?? '',
    bpjs_number: patient?.bpjs_number ?? '',
    nik: patient?.nik ?? '',
    notes: patient?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const payload = { ...form, date_of_birth: form.date_of_birth || null, gender: (form.gender || null) as 'L' | 'P' | null };
      if (patient) {
        await tenantFrom('patients').update(payload).eq('id', patient.id);
      } else {
        await tenantFrom('patients').insert(payload);
      }
      onSaved();
    } finally { setSaving(false); }
  }

  return (
    <Modal title={patient ? 'Edit Pasien' : 'Tambah Pasien'} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nama Pasien" className="col-span-2"><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input" /></Field>
        <Field label="Tanggal Lahir"><input type="date" value={form.date_of_birth} onChange={e => setForm({ ...form, date_of_birth: e.target.value })} className="input" /></Field>
        <Field label="Jenis Kelamin">
          <select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })} className="input">
            <option value="">- Pilih -</option><option value="L">Laki-laki</option><option value="P">Perempuan</option>
          </select>
        </Field>
        <Field label="Telepon"><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input" /></Field>
        <Field label="Email"><input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input" /></Field>
        <Field label="No. BPJS"><input value={form.bpjs_number} onChange={e => setForm({ ...form, bpjs_number: e.target.value })} className="input" /></Field>
        <Field label="NIK"><input value={form.nik} onChange={e => setForm({ ...form, nik: e.target.value })} className="input" /></Field>
        <Field label="Alergi" className="col-span-2"><input value={form.allergy} onChange={e => setForm({ ...form, allergy: e.target.value })} placeholder="Contoh: Penisilin, Amoxicillin" className="input" /></Field>
        <Field label="Alamat" className="col-span-2"><textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} rows={2} className="input" /></Field>
      </div>
      <div className="flex gap-2 mt-5">
        <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">Batal</button>
        <button onClick={save} disabled={saving || !form.name} className="flex-1 py-2.5 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold">{saving ? 'Menyimpan...' : 'Simpan'}</button>
      </div>
    </Modal>
  );
}
