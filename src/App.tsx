import {
  useState,
  useEffect,
  useCallback,
} from 'react';

import {
  AuthProvider,
  useAuth,
  canAccess,
  defaultPageForRole,
} from '@/lib/auth';

import Layout, {
  type Page,
} from '@/components/Layout';

import {
  supabase,
  tenantFrom,
} from '@/lib/supabase';

import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import KasirPOS from '@/pages/KasirPOS';
import ObatStok from '@/pages/ObatStok';
import Pengadaan from '@/pages/Pengadaan';
import Penerimaan from '@/pages/Penerimaan';
import PBF from '@/pages/PBF';
import Pasien from '@/pages/Pasien';
import Dokter from '@/pages/Dokter';
import Laporan from '@/pages/Laporan';

import Pengaturan, {
  SETTINGS_UPDATED_EVENT,
  type AppSettings,
} from '@/pages/Pengaturan';

import UserManagement from '@/pages/UserManagement';

function getHashPage(): string {
  const hash =
    window.location.hash.replace(
      '#',
      '',
    );

  return hash || 'dashboard';
}

function setHashPage(
  page: string,
) {
  if (
    window.location.hash !==
    `#${page}`
  ) {
    window.location.hash =
      page;
  }
}

function AppContent() {
  const {
    profile,
    loading,
  } = useAuth();

  const [page, setPage] =
    useState<Page>(
      getHashPage() as Page,
    );

  const [pharmacyName, setPharmacyName] =
    useState('Apotek');

  const legalFooter =
    '© PT. Digital Salim Jaya Indonesia · Sistem POS Apotek';

  const [
    footerCopyright,
    setFooterCopyright,
  ] = useState(
    legalFooter,
  );

  /*
   * Memuat identitas apotek.
   *
   * Prioritas:
   *
   * 1. settings.pharmacy_name
   * 2. tenants.name
   * 3. "Apotek"
   */
  const loadSettings =
    useCallback(
      async () => {
        if (!profile) {
          return;
        }

        /*
         * Superadmin tidak harus
         * memiliki tenant.
         */
        if (
          profile.role ===
            'superadmin' &&
          !profile.tenant_id
        ) {
          setPharmacyName(
            'Panel Super Admin',
          );

          setFooterCopyright(
            legalFooter,
          );

          return;
        }

        /*
         * Reset terlebih dahulu
         * menggunakan data tenant
         * dari profile.
         */
        if (
          profile.tenant?.name &&
          profile.tenant.name.trim()
        ) {
          setPharmacyName(
            profile.tenant.name,
          );
        } else {
          setPharmacyName(
            'Apotek',
          );
        }

        if (
          profile.tenant
            ?.footer_copyright &&
          profile.tenant.footer_copyright.trim()
        ) {
          setFooterCopyright(
            profile.tenant
              .footer_copyright,
          );
        } else {
          setFooterCopyright(
            legalFooter,
          );
        }

        /*
         * User tanpa tenant
         * tidak dapat memuat
         * settings tenant.
         */
        if (
          !profile.tenant_id
        ) {
          return;
        }

        try {
          /*
           * Ambil ulang tenant
           * langsung dari database.
           *
           * Hal ini penting karena
           * profile di localStorage
           * bisa berisi nama tenant lama.
           */
          const {
            data: tenantData,
            error: tenantError,
          } = await supabase
            .from('tenants')
            .select(
              `
                id,
                name,
                address,
                phone,
                footer_copyright
              `,
            )
            .eq(
              'id',
              profile.tenant_id,
            )
            .maybeSingle();

          if (tenantError) {
            console.error(
              'Gagal memuat tenant:',
              tenantError,
            );
          } else if (
            tenantData
          ) {
            if (
              tenantData.name &&
              tenantData.name.trim()
            ) {
              setPharmacyName(
                tenantData.name,
              );
            }

            if (
              tenantData.footer_copyright &&
              tenantData.footer_copyright.trim()
            ) {
              setFooterCopyright(
                tenantData.footer_copyright,
              );
            } else {
              setFooterCopyright(
                legalFooter,
              );
            }
          }

          /*
           * Ambil settings
           * khusus tenant aktif.
           */
          const {
            data,
            error,
          } = await tenantFrom(
            'settings',
          )
            .select(
              'key, value',
            );

          if (error) {
            console.error(
              'Gagal memuat settings:',
              error,
            );

            return;
          }

          const map: AppSettings =
            {};

          (
            data ?? []
          ).forEach(
            (item: {
              key: string;
              value: string | null;
            }) => {
              if (
                item?.key
              ) {
                map[
                  item.key
                ] =
                  item.value ??
                  '';
              }
            },
          );

          /*
           * Nama dari halaman
           * Pengaturan memiliki
           * prioritas tertinggi.
           */
          if (
            map.pharmacy_name &&
            map.pharmacy_name.trim()
          ) {
            setPharmacyName(
              map.pharmacy_name.trim(),
            );
          }

        } catch (error) {
          console.error(
            'Terjadi kesalahan saat memuat settings:',
            error,
          );
        }
      },
      [
        profile,
      ],
    );

  /*
   * Memuat identitas ketika:
   *
   * - aplikasi pertama dibuka
   * - profile berubah
   * - login user berubah
   */
  useEffect(() => {
    loadSettings();
  }, [
    loadSettings,
  ]);

  /*
   * Menerima perubahan langsung
   * dari halaman Pengaturan.
   *
   * Dengan ini Layout langsung
   * berubah tanpa refresh halaman.
   */
  useEffect(() => {
    const onSettingsUpdated =
      (
        event: Event,
      ) => {
        const customEvent =
          event as CustomEvent<{
            settings?: AppSettings;
            tenant?: {
              id?: string;
              name?: string;
              address?: string;
              phone?: string;
              footer_copyright?: string;
            };
          }>;

        const settings =
          customEvent.detail
            ?.settings;

        const tenant =
          customEvent.detail
            ?.tenant;

        /*
         * Update nama apotek
         * dari settings.
         */
        if (
          settings
            ?.pharmacy_name &&
          settings.pharmacy_name.trim()
        ) {
          setPharmacyName(
            settings
              .pharmacy_name
              .trim(),
          );
        }

        /*
         * Jika settings kosong,
         * gunakan nama tenant
         * yang dikirim event.
         */
        else if (
          tenant?.name &&
          tenant.name.trim()
        ) {
          setPharmacyName(
            tenant.name.trim(),
          );
        }

        /*
         * Jika tidak ada data
         * dari event, gunakan
         * data tenant pada profile.
         */
        else if (
          profile?.tenant?.name &&
          profile.tenant.name.trim()
        ) {
          setPharmacyName(
            profile.tenant.name,
          );
        } else {
          setPharmacyName(
            'Apotek',
          );
        }

        /*
         * Footer jika suatu saat
         * dikirim dari event.
         */
        if (
          tenant
            ?.footer_copyright &&
          tenant.footer_copyright.trim()
        ) {
          setFooterCopyright(
            tenant.footer_copyright,
          );
        }

        /*
         * Pastikan data terbaru
         * juga dibaca ulang dari
         * database.
         */
        window.setTimeout(() => {
          loadSettings();
        }, 0);
      };

    window.addEventListener(
      SETTINGS_UPDATED_EVENT,
      onSettingsUpdated,
    );

    return () => {
      window.removeEventListener(
        SETTINGS_UPDATED_EVENT,
        onSettingsUpdated,
      );
    };
  }, [
    profile,
    loadSettings,
  ]);

  /*
   * Navigasi berdasarkan
   * hash URL.
   */
  useEffect(() => {
    const onHashChange =
      () => {
        setPage(
          getHashPage() as Page,
        );
      };

    window.addEventListener(
      'hashchange',
      onHashChange,
    );

    return () => {
      window.removeEventListener(
        'hashchange',
        onHashChange,
      );
    };
  }, []);

  /*
   * Memastikan halaman
   * sesuai dengan hak akses.
   */
  useEffect(() => {
    if (
      !profile ||
      loading
    ) {
      return;
    }

    if (
      !canAccess(
        profile.role,
        page,
      )
    ) {
      const allowed =
        defaultPageForRole(
          profile.role,
        );

      setPage(
        allowed as Page,
      );

      setHashPage(
        allowed,
      );
    }
  }, [
    profile,
    loading,
    page,
  ]);

  const handleNavigate =
    useCallback(
      (
        targetPage: string,
      ) => {
        if (
          profile &&
          canAccess(
            profile.role,
            targetPage,
          )
        ) {
          setPage(
            targetPage as Page,
          );

          setHashPage(
            targetPage,
          );
        }
      },
      [
        profile,
      ],
    );

  /*
   * Loading session.
   */
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="animate-spin w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  /*
   * Belum login.
   */
  if (!profile) {
    return <Login />;
  }

  /*
   * Halaman efektif berdasarkan
   * role user.
   */
  const effectivePage =
    canAccess(
      profile.role,
      page,
    )
      ? page
      : (
          defaultPageForRole(
            profile.role,
          ) as Page
        );

  return (
    <Layout
      currentPage={
        effectivePage
      }
      onNavigate={
        handleNavigate
      }
      pharmacyName={
        pharmacyName
      }
      footerCopyright={
        footerCopyright
      }
    >

      {effectivePage ===
        'dashboard' && (
        <Dashboard
          onNavigate={
            handleNavigate
          }
        />
      )}

      {effectivePage ===
        'kasir' && (
        <KasirPOS />
      )}

      {effectivePage ===
        'obat' && (
        <ObatStok />
      )}

      {effectivePage ===
        'pengadaan' && (
        <Pengadaan />
      )}

      {effectivePage ===
        'penerimaan' && (
        <Penerimaan />
      )}

      {effectivePage ===
        'pbf' && (
        <PBF />
      )}

      {effectivePage ===
        'pasien' && (
        <Pasien />
      )}

      {effectivePage ===
        'dokter' && (
        <Dokter />
      )}

      {effectivePage ===
        'laporan' && (
        <Laporan />
      )}

      {effectivePage ===
        'pengaturan' && (
        <Pengaturan />
      )}

      {effectivePage ===
        'pengguna' && (
        <UserManagement />
      )}

    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}