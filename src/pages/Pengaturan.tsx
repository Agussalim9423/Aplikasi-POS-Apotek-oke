import { useEffect, useState } from 'react';
import {
  supabase,
  tenantFrom,
} from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  Save,
  Building2,
} from 'lucide-react';
import { Field } from './ObatStok';

export type AppSettings =
  Record<string, string>;

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
  const {
    profile,
    refreshProfile,
  } = useAuth();

  const [
    settings,
    setSettings,
  ] = useState<AppSettings>(
    DEFAULT_SETTINGS,
  );

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    saved,
    setSaved,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState('');

  useEffect(() => {
    if (
      profile?.tenant_id
    ) {
      loadSettings();
      return;
    }

    if (
      profile
    ) {
      setSettings(
        DEFAULT_SETTINGS,
      );

      setError(
        'Tenant ID tidak ditemukan pada akun yang sedang login. Silakan logout lalu login kembali.',
      );
    }
  }, [
    profile?.tenant_id,
  ]);

  function updateSetting(
    key: string,
    value: string,
  ) {
    setSettings(
      current => ({
        ...current,
        [key]: value,
      }),
    );

    setSaved(false);
    setError('');
  }

  async function loadSettings() {
    const tenantId =
      profile?.tenant_id;

    if (
      !tenantId
    ) {
      return;
    }

    try {
      setError('');

      /*
       * Ambil seluruh pengaturan tenant aktif.
       *
       * tenantFrom() otomatis membatasi
       * data berdasarkan tenant_id.
       */
      const {
        data,
        error: loadError,
      } = await tenantFrom(
        'settings',
      )
        .select(
          'id, tenant_id, key, value',
        );

      if (
        loadError
      ) {
        throw loadError;
      }

      const result: AppSettings = {
        ...DEFAULT_SETTINGS,
      };

      for (
        const row of data ?? []
      ) {
        if (
          row?.key &&
          Object.prototype.hasOwnProperty.call(
            DEFAULT_SETTINGS,
            row.key,
          )
        ) {
          result[
            row.key
          ] =
            row.value ?? '';
        }
      }

      /*
       * Jika tabel settings belum memiliki
       * data identitas, gunakan data tenant
       * sebagai nilai awal.
       */
      if (
        !result.pharmacy_name
      ) {
        result.pharmacy_name =
          profile?.tenant?.name ??
          '';
      }

      if (
        !result.pharmacy_address
      ) {
        result.pharmacy_address =
          profile?.tenant?.address ??
          '';
      }

      if (
        !result.pharmacy_phone
      ) {
        result.pharmacy_phone =
          profile?.tenant?.phone ??
          '';
      }

      setSettings(
        result,
      );
    } catch (
      err: any
    ) {
      console.error(
        'Gagal memuat pengaturan:',
        err,
      );

      setError(
        err?.message ??
          'Gagal memuat pengaturan.',
      );
    }
  }

  async function saveSettings() {
    const tenantId =
      profile?.tenant_id;

    if (
      !tenantId
    ) {
      setError(
        'Tenant ID tidak ditemukan. Silakan logout lalu login kembali.',
      );

      return;
    }

    setSaving(true);
    setSaved(false);
    setError('');

    try {
      const now =
        new Date().toISOString();

      /*
       * Ambil seluruh settings yang sudah ada.
       *
       * tenantFrom() sudah otomatis menambahkan:
       *
       * WHERE tenant_id = tenant aktif
       */
      const {
        data: existingSettings,
        error: existingError,
      } = await tenantFrom(
        'settings',
      )
        .select(
          'id, key',
        );

      if (
        existingError
      ) {
        throw existingError;
      }

      const existingByKey =
        new Map(
          (
            existingSettings ?? []
          ).map(
            (row: any) => [
              row.key,
              row.id,
            ],
          ),
        );

      /*
       * Simpan semua pengaturan.
       *
       * Jika key sudah ada:
       * UPDATE.
       *
       * Jika belum ada:
       * INSERT.
       *
       * tenantFrom() akan otomatis
       * memastikan tenant_id ikut
       * pada INSERT.
       */
      for (
        const [
          key,
          value,
        ] of Object.entries(
          settings,
        )
      ) {
        const existingId =
          existingByKey.get(
            key,
          );

        if (
          existingId
        ) {
          const {
            error: updateError,
          } = await tenantFrom(
            'settings',
          )
            .update({
              value:
                value ?? '',

              updated_at:
                now,
            })
            .eq(
              'id',
              existingId,
            );

          if (
            updateError
          ) {
            throw updateError;
          }
        } else {
          const {
            error: insertError,
          } = await tenantFrom(
            'settings',
          ).insert({
            /*
             * tenantFrom() juga akan
             * otomatis menambahkan
             * tenant_id.
             *
             * Tetap dikirim secara
             * eksplisit agar aman.
             */
            tenant_id:
              tenantId,

            key,

            value:
              value ?? '',

            updated_at:
              now,
          });

          if (
            insertError
          ) {
            throw insertError;
          }
        }
      }

      /*
       * Update identitas utama tenant.
       *
       * Data ini digunakan oleh:
       *
       * - auth.tsx
       * - profile.tenant
       * - layout
       * - dashboard
       * - bagian aplikasi lain
       */
      const {
        data: tenantData,
        error: tenantError,
      } = await supabase
        .from(
          'tenants',
        )
        .update({
          name:
            settings.pharmacy_name
              .trim() ||
            'Apotek',

          address:
            settings.pharmacy_address
              .trim() ||
            null,

          phone:
            settings.pharmacy_phone
              .trim() ||
            null,
        })
        .eq(
          'id',
          tenantId,
        )
        .select(
          `
            id,
            name,
            address,
            phone,
            footer_copyright,
            status
          `,
        )
        .maybeSingle();

      if (
        tenantError
      ) {
        throw tenantError;
      }

      if (
        !tenantData
      ) {
        throw new Error(
          'Data tenant tidak berhasil diperbarui.',
        );
      }

      /*
       * Baca ulang settings dari database.
       *
       * Ini memastikan data pada state
       * benar-benar berasal dari database.
       */
      const {
        data: verifyData,
        error: verifyError,
      } = await tenantFrom(
        'settings',
      )
        .select(
          'key, value',
        );

      if (
        verifyError
      ) {
        throw verifyError;
      }

      const verifiedSettings:
        AppSettings = {
          ...DEFAULT_SETTINGS,
        };

      for (
        const row of verifyData ?? []
      ) {
        if (
          row?.key &&
          Object.prototype.hasOwnProperty.call(
            DEFAULT_SETTINGS,
            row.key,
          )
        ) {
          verifiedSettings[
            row.key
          ] =
            row.value ?? '';
        }
      }

      /*
       * Sinkronkan kembali identitas
       * dari data tenant yang baru.
       */
      verifiedSettings.pharmacy_name =
        tenantData.name ??
        verifiedSettings.pharmacy_name;

      verifiedSettings.pharmacy_address =
        tenantData.address ??
        verifiedSettings.pharmacy_address;

      verifiedSettings.pharmacy_phone =
        tenantData.phone ??
        verifiedSettings.pharmacy_phone;

      setSettings(
        verifiedSettings,
      );

      /*
       * INI BAGIAN PENTING.
       *
       * auth.tsx akan membaca ulang
       * user dan tenant dari database,
       * lalu memperbarui:
       *
       * - profile
       * - profile.tenant
       * - localStorage
       */
      await refreshProfile();

      /*
       * Beri tahu app.tsx dan layout
       * bahwa pengaturan sudah berubah.
       */
      window.dispatchEvent(
        new CustomEvent(
          SETTINGS_UPDATED_EVENT,
          {
            detail: {
              settings:
                verifiedSettings,

              tenant: {
                id:
                  tenantData.id,

                name:
                  tenantData.name ??
                  'Apotek',

                address:
                  tenantData.address ??
                  '',

                phone:
                  tenantData.phone ??
                  '',

                footer_copyright:
                  tenantData.footer_copyright ??
                  '',
              },
            },
          },
        ),
      );

      setSaved(true);

      window.setTimeout(
        () => {
          setSaved(false);
        },
        2000,
      );
    } catch (
      err: any
    ) {
      console.error(
        'Gagal menyimpan pengaturan:',
        err,
      );

      setError(
        err?.message ??
          'Pengaturan gagal disimpan.',
      );
    } finally {
      setSaving(false);
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
            value={
              settings.pharmacy_name
            }
            onChange={e =>
              updateSetting(
                'pharmacy_name',
                e.target.value,
              )
            }
            className="input"
          />

        </Field>

        <Field label="Alamat">

          <textarea
            value={
              settings.pharmacy_address
            }
            onChange={e =>
              updateSetting(
                'pharmacy_address',
                e.target.value,
              )
            }
            rows={2}
            className="input"
          />

        </Field>

        <div className="grid grid-cols-2 gap-3">

          <Field label="Telepon">

            <input
              value={
                settings.pharmacy_phone
              }
              onChange={e =>
                updateSetting(
                  'pharmacy_phone',
                  e.target.value,
                )
              }
              className="input"
            />

          </Field>

          <Field label="Email">

            <input
              type="email"
              value={
                settings.pharmacy_email
              }
              onChange={e =>
                updateSetting(
                  'pharmacy_email',
                  e.target.value,
                )
              }
              className="input"
            />

          </Field>

        </div>

        <div className="grid grid-cols-2 gap-3">

          <Field label="Apoteker Penanggung Jawab">

            <input
              value={
                settings.pharmacist_name
              }
              onChange={e =>
                updateSetting(
                  'pharmacist_name',
                  e.target.value,
                )
              }
              className="input"
            />

          </Field>

          <Field label="No. SIPA">

            <input
              value={
                settings.sipa_number
              }
              onChange={e =>
                updateSetting(
                  'sipa_number',
                  e.target.value,
                )
              }
              className="input"
            />

          </Field>

        </div>

        <Field label="No. SIA">

          <input
            value={
              settings.sia_number
            }
            onChange={e =>
              updateSetting(
                'sia_number',
                e.target.value,
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
              onChange={e =>
                updateSetting(
                  'low_stock_threshold',
                  e.target.value,
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
              onChange={e =>
                updateSetting(
                  'expiry_warning_days',
                  e.target.value,
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
        onClick={
          saveSettings
        }
        disabled={
          saving
        }
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