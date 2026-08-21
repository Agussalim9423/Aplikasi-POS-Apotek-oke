import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Save, Building2 } from 'lucide-react';
import { Field } from './ObatStok';

export type AppSettings = Record<string, string>;

export const SETTINGS_UPDATED_EVENT =
  'apotek:settings-updated';

const DEFAULT_SETTINGS: AppSettings = {
  pharmacy_name: '',
  pharmacy_address: '',
  pharmacy_phone: '',
  pharmacy_email: '',
  pharmacist_name: '',
  sipa_number: '',
  sia_number: '',
  low_stock_threshold: '',
  expiry_warning_days: '',
};

export default function Pengaturan() {
  console.log('========================================');
  console.log('=== PENGATURAN WEB VERSION ===');
  console.log('VERSION: FIX-SAVE-2026-08-22-01');
  console.log(
    'SUPABASE URL:',
    import.meta.env.VITE_SUPABASE_URL
  );
  console.log('========================================');

  const { profile } = useAuth();

  console.log(
    'PROFILE EMAIL:',
    profile?.email
  );

  console.log(
    'TENANT ID:',
    profile?.tenant_id
  );

  const [settings, setSettings] =
    useState<AppSettings>(DEFAULT_SETTINGS);

  const [saving, setSaving] =
    useState(false);

  const [saved, setSaved] =
    useState(false);

  const [error, setError] =
    useState('');

  useEffect(() => {
    if (profile?.tenant_id) {
      loadSettings();
    } else if (profile) {
      setError(
        'Tenant ID tidak ditemukan pada akun yang sedang login.'
      );
    }
  }, [profile?.tenant_id]);

  function updateSetting(
    key: string,
    value: string
  ) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function loadSettings() {
    if (!profile?.tenant_id) {
      setError('Tenant ID tidak ditemukan.');

      return;
    }

    console.log(
      '========================================'
    );

    console.log(
      'LOAD SETTINGS TENANT:',
      profile.tenant_id
    );

    try {
      const { data, error: loadError } =
        await supabase
          .from('settings')
          .select('id, tenant_id, key, value')
          .eq(
            'tenant_id',
            profile.tenant_id
          );

      console.log(
        'HASIL LOAD SETTINGS:',
        data
      );

      if (loadError) {
        console.error(
          'ERROR LOAD SETTINGS:',
          loadError
        );

        throw loadError;
      }

      const result: AppSettings = {
        ...DEFAULT_SETTINGS,
      };

      for (const row of data ?? []) {
        result[row.key] =
          row.value ?? '';
      }

      console.log(
        'SETTINGS YANG DIMUAT:',
        result
      );

      setSettings(result);

      setError('');
    } catch (err: any) {
      console.error(
        'GAGAL MEMUAT SETTINGS:',
        err
      );

      setError(
        err?.message ??
          'Gagal memuat pengaturan.'
      );
    }
  }

  async function saveSettings() {
    if (!profile?.tenant_id) {
      const message =
        'Tenant ID tidak ditemukan. Silakan logout lalu login kembali.';

      console.error(message);

      setError(message);

      alert(
        'GAGAL MENYIMPAN!\n\n' +
          message
      );

      return;
    }

    setSaving(true);
    setSaved(false);
    setError('');

    const tenantId =
      profile.tenant_id;

    console.log(
      '========================================'
    );

    console.log(
      'MULAI MENYIMPAN SETTINGS'
    );

    console.log(
      'VERSION:',
      'FIX-SAVE-2026-08-22-01'
    );

    console.log(
      'SUPABASE URL:',
      import.meta.env.VITE_SUPABASE_URL
    );

    console.log(
      'PROFILE:',
      profile
    );

    console.log(
      'TENANT ID:',
      tenantId
    );

    console.log(
      'DATA SETTINGS:',
      settings
    );

    try {
      const now =
        new Date().toISOString();

      const rows = Object.entries(
        settings
      ).map(
        ([key, value]) => ({
          tenant_id: tenantId,
          key,
          value: value ?? '',
          updated_at: now,
        })
      );

      console.log(
        'ROWS YANG AKAN DISIMPAN:',
        rows
      );

      /*
       * Simpan satu per satu.
       *
       * Cara ini tidak membutuhkan unique constraint
       * tenant_id,key untuk menggunakan upsert.
       */

      for (const row of rows) {
        console.log(
          'MEMPROSES KEY:',
          row.key,
          'VALUE:',
          row.value
        );

        const {
          data: existingData,
          error: existingError,
        } = await supabase
          .from('settings')
          .select('id')
          .eq(
            'tenant_id',
            tenantId
          )
          .eq(
            'key',
            row.key
          )
          .maybeSingle();

        console.log(
          'CEK DATA LAMA:',
          row.key,
          existingData
        );

        if (existingError) {
          console.error(
            'ERROR CEK DATA:',
            existingError
          );

          throw existingError;
        }

        if (existingData?.id) {
          console.log(
            'UPDATE SETTINGS:',
            row.key
          );

          const {
            data: updatedData,
            error: updateError,
          } = await supabase
            .from('settings')
            .update({
              value: row.value,
              updated_at: now,
            })
            .eq(
              'id',
              existingData.id
            )
            .eq(
              'tenant_id',
              tenantId
            )
            .select(
              'id, tenant_id, key, value'
            );

          console.log(
            'HASIL UPDATE:',
            updatedData
          );

          if (updateError) {
            console.error(
              'ERROR UPDATE:',
              updateError
            );

            throw updateError;
          }

          if (
            !updatedData ||
            updatedData.length === 0
          ) {
            throw new Error(
              'Update tidak mengubah data untuk key: ' +
                row.key
            );
          }
        } else {
          console.log(
            'INSERT SETTINGS:',
            row.key
          );

          const {
            data: insertedData,
            error: insertError,
          } = await supabase
            .from('settings')
            .insert({
              tenant_id: tenantId,
              key: row.key,
              value: row.value,
              updated_at: now,
            })
            .select(
              'id, tenant_id, key, value'
            );

          console.log(
            'HASIL INSERT:',
            insertedData
          );

          if (insertError) {
            console.error(
              'ERROR INSERT:',
              insertError
            );

            throw insertError;
          }

          if (
            !insertedData ||
            insertedData.length === 0
          ) {
            throw new Error(
              'Insert tidak mengembalikan data untuk key: ' +
                row.key
            );
          }
        }
      }

      console.log(
        'SEMUA SETTINGS BERHASIL DIPROSES'
      );

      /*
       * Update data utama tenant.
       * Ini digunakan untuk identitas aplikasi
       * seperti nama apotek.
       */

      const {
        data: tenantData,
        error: tenantError,
      } = await supabase
        .from('tenants')
        .update({
          name:
            settings.pharmacy_name ||
            'Apotek',

          address:
            settings.pharmacy_address ||
            null,

          phone:
            settings.pharmacy_phone ||
            null,
        })
        .eq(
          'id',
          tenantId
        )
        .select(
          'id, name, address, phone'
        );

      console.log(
        'HASIL UPDATE TENANT:',
        tenantData
      );

      if (tenantError) {
        console.error(
          'ERROR UPDATE TENANT:',
          tenantError
        );

        throw tenantError;
      }

      if (
        !tenantData ||
        tenantData.length === 0
      ) {
        throw new Error(
          'Data tenant tidak berhasil diperbarui.'
        );
      }

      /*
       * Baca ulang langsung dari database
       * untuk memastikan data benar-benar tersimpan.
       */

      console.log(
        'MEMVERIFIKASI DATA KE SUPABASE...'
      );

      const {
        data: verifyData,
        error: verifyError,
      } = await supabase
        .from('settings')
        .select(
          'tenant_id, key, value'
        )
        .eq(
          'tenant_id',
          tenantId
        );

      console.log(
        'HASIL VERIFIKASI:',
        verifyData
      );

      if (verifyError) {
        console.error(
          'ERROR VERIFIKASI:',
          verifyError
        );

        throw verifyError;
      }

      const verifyMap: AppSettings = {
        ...DEFAULT_SETTINGS,
      };

      for (
        const row of verifyData ?? []
      ) {
        verifyMap[row.key] =
          row.value ?? '';
      }

      console.log(
        'DATA AKHIR DARI DATABASE:',
        verifyMap
      );

      if (
        verifyMap.pharmacy_name !==
        settings.pharmacy_name
      ) {
        throw new Error(
          'VERIFIKASI GAGAL.\n\n' +
            'Nama yang ingin disimpan: "' +
            settings.pharmacy_name +
            '"\n\n' +
            'Nama yang terbaca dari database: "' +
            verifyMap.pharmacy_name +
            '"'
        );
      }

      setSettings(
        verifyMap
      );

      window.dispatchEvent(
        new CustomEvent(
          SETTINGS_UPDATED_EVENT,
          {
            detail: {
              settings: verifyMap,
              tenant: {
                id: tenantId,
                name:
                  settings.pharmacy_name ||
                  'Apotek',
                address:
                  settings.pharmacy_address ||
                  '',
                phone:
                  settings.pharmacy_phone ||
                  '',
              },
            },
          }
        )
      );

      console.log(
        'EVENT SETTINGS_UPDATED DIKIRIM'
      );

      setSaved(true);

      setTimeout(() => {
        setSaved(false);
      }, 2000);

      alert(
        'BERHASIL DISIMPAN KE SUPABASE!\n\n' +
          'Tenant ID:\n' +
          tenantId +
          '\n\n' +
          'Nama Apotek:\n' +
          verifyMap.pharmacy_name
      );

    } catch (err: any) {
      console.error(
        '========================================'
      );

      console.error(
        'GAGAL MENYIMPAN SETTINGS:',
        err
      );

      console.error(
        'ERROR MESSAGE:',
        err?.message
      );

      console.error(
        'ERROR DETAIL:',
        err?.details
      );

      console.error(
        'ERROR HINT:',
        err?.hint
      );

      console.error(
        'ERROR CODE:',
        err?.code
      );

      const message =
        err?.message ??
        'Pengaturan gagal disimpan.';

      setError(message);

      alert(
        'GAGAL MENYIMPAN!\n\n' +
          message
      );

    } finally {
      setSaving(false);

      console.log(
        'PROSES SIMPAN SELESAI'
      );

      console.log(
        '========================================'
      );
    }
  }

  return (
    <div className="p-6 space-y-4 max-w-2xl">

      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Pengaturan
        </h1>

        <p className="text-gray-500 text-sm mt-1">
          Informasi apotek dan preferensi sistem
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">

        <div className="flex items-center gap-2 text-teal-600 font-semibold">
          <Building2 size={18} />
          Informasi Apotek
        </div>

        <Field label="Nama Apotek">
          <input
            value={settings.pharmacy_name}
            onChange={(e) =>
              updateSetting(
                'pharmacy_name',
                e.target.value
              )
            }
            className="input"
          />
        </Field>

        <Field label="Alamat">
          <textarea
            value={settings.pharmacy_address}
            onChange={(e) =>
              updateSetting(
                'pharmacy_address',
                e.target.value
              )
            }
            rows={2}
            className="input"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">

          <Field label="Telepon">
            <input
              value={settings.pharmacy_phone}
              onChange={(e) =>
                updateSetting(
                  'pharmacy_phone',
                  e.target.value
                )
              }
              className="input"
            />
          </Field>

          <Field label="Email">
            <input
              value={settings.pharmacy_email}
              onChange={(e) =>
                updateSetting(
                  'pharmacy_email',
                  e.target.value
                )
              }
              className="input"
            />
          </Field>

        </div>

        <div className="grid grid-cols-2 gap-3">

          <Field label="Apoteker Penanggung Jawab">
            <input
              value={settings.pharmacist_name}
              onChange={(e) =>
                updateSetting(
                  'pharmacist_name',
                  e.target.value
                )
              }
              className="input"
            />
          </Field>

          <Field label="No. SIPA">
            <input
              value={settings.sipa_number}
              onChange={(e) =>
                updateSetting(
                  'sipa_number',
                  e.target.value
                )
              }
              className="input"
            />
          </Field>

        </div>

        <Field label="No. SIA">
          <input
            value={settings.sia_number}
            onChange={(e) =>
              updateSetting(
                'sia_number',
                e.target.value
              )
            }
            className="input"
          />
        </Field>

      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">

        <div className="text-teal-600 font-semibold">
          Preferensi Stok
        </div>

        <div className="grid grid-cols-2 gap-3">

          <Field label="Ambang Stok Rendah (unit)">
            <input
              type="number"
              value={
                settings.low_stock_threshold
              }
              onChange={(e) =>
                updateSetting(
                  'low_stock_threshold',
                  e.target.value
                )
              }
              className="input"
            />
          </Field>

          <Field label="Peringatan Kadaluarsa (hari)">
            <input
              type="number"
              value={
                settings.expiry_warning_days
              }
              onChange={(e) =>
                updateSetting(
                  'expiry_warning_days',
                  e.target.value
                )
              }
              className="input"
            />
          </Field>

        </div>

      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        onClick={saveSettings}
        disabled={saving}
        className="bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors"
      >
        <Save size={16} />

        {saving
          ? 'Menyimpan...'
          : saved
          ? 'Tersimpan!'
          : 'Simpan Pengaturan'}
      </button>

    </div>
  );
}