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

import { supabase } from '@/lib/supabase';

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
  const hash = window.location.hash.replace('#', '');

  return hash || 'dashboard';
}

function setHashPage(page: string) {
  if (window.location.hash !== `#${page}`) {
    window.location.hash = page;
  }
}

function AppContent() {
  const { profile, loading } = useAuth();

  const [page, setPage] = useState<Page>(
    getHashPage() as Page
  );

  const [pharmacyName, setPharmacyName] =
    useState('Apotek');

  const legalFooter =
    '© PT. Digital Salim Jaya Indonesia · Sistem POS Apotek';

  const [footerCopyright, setFooterCopyright] =
    useState(legalFooter);

  const loadSettings = useCallback(async () => {
    if (!profile) {
      return;
    }

    // Superadmin tanpa tenant
    if (
      profile.role === 'superadmin' &&
      !profile.tenant_id
    ) {
      setPharmacyName('Panel Super Admin');
      setFooterCopyright(legalFooter);
      return;
    }

    // Nama awal dari data tenant
    if (profile.tenant?.name) {
      setPharmacyName(profile.tenant.name);
    } else {
      setPharmacyName('Apotek');
    }

    // Footer dari tenant
    if (profile.tenant?.footer_copyright) {
      setFooterCopyright(
        profile.tenant.footer_copyright
      );
    } else {
      setFooterCopyright(legalFooter);
    }

    // Jika tidak ada tenant, selesai
    if (!profile.tenant_id) {
      return;
    }

    try {
      const { data, error } = await supabase
        .from('settings')
        .select('key, value')
        .eq('tenant_id', profile.tenant_id);

      if (error) {
        console.error(
          'Gagal memuat settings:',
          error
        );
        return;
      }

      const map: AppSettings = {};

      (data ?? []).forEach((item) => {
        map[item.key] = item.value ?? '';
      });

      // Nama apotek dari pengaturan
      if (
        map.pharmacy_name &&
        map.pharmacy_name.trim()
      ) {
        setPharmacyName(
          map.pharmacy_name
        );
      }

    } catch (error) {
      console.error(
        'Terjadi kesalahan saat memuat settings:',
        error
      );
    }
  }, [profile]);

  // Memuat identitas saat aplikasi dibuka / profile berubah
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Menerima perubahan langsung dari halaman Pengaturan
  useEffect(() => {
    const onSettingsUpdated = (
      event: Event
    ) => {
      const customEvent = event as CustomEvent<{
        settings: AppSettings;
      }>;

      const settings =
        customEvent.detail?.settings;

      if (!settings) {
        return;
      }

      if (
        settings.pharmacy_name &&
        settings.pharmacy_name.trim()
      ) {
        setPharmacyName(
          settings.pharmacy_name
        );
      } else if (profile?.tenant?.name) {
        setPharmacyName(
          profile.tenant.name
        );
      }
    };

    window.addEventListener(
      SETTINGS_UPDATED_EVENT,
      onSettingsUpdated
    );

    return () => {
      window.removeEventListener(
        SETTINGS_UPDATED_EVENT,
        onSettingsUpdated
      );
    };
  }, [profile]);

  // Navigasi berdasarkan hash URL
  useEffect(() => {
    const onHashChange = () => {
      setPage(
        getHashPage() as Page
      );
    };

    window.addEventListener(
      'hashchange',
      onHashChange
    );

    return () => {
      window.removeEventListener(
        'hashchange',
        onHashChange
      );
    };
  }, []);

  // Memastikan halaman sesuai hak akses user
  useEffect(() => {
    if (!profile || loading) {
      return;
    }

    if (
      !canAccess(
        profile.role,
        page
      )
    ) {
      const allowed =
        defaultPageForRole(
          profile.role
        );

      setPage(
        allowed as Page
      );

      setHashPage(allowed);
    }
  }, [
    profile,
    loading,
    page,
  ]);

  const handleNavigate = useCallback(
    (p: string) => {
      if (
        profile &&
        canAccess(
          profile.role,
          p
        )
      ) {
        setPage(
          p as Page
        );

        setHashPage(p);
      }
    },
    [profile]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="animate-spin w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!profile) {
    return <Login />;
  }

  const effectivePage =
    canAccess(
      profile.role,
      page
    )
      ? page
      : (
          defaultPageForRole(
            profile.role
          ) as Page
        );

  return (
    <Layout
      currentPage={effectivePage}
      onNavigate={handleNavigate}
      pharmacyName={pharmacyName}
      footerCopyright={footerCopyright}
    >
      {effectivePage === 'dashboard' && (
        <Dashboard
          onNavigate={handleNavigate}
        />
      )}

      {effectivePage === 'kasir' && (
        <KasirPOS />
      )}

      {effectivePage === 'obat' && (
        <ObatStok />
      )}

      {effectivePage === 'pengadaan' && (
        <Pengadaan />
      )}

      {effectivePage === 'penerimaan' && (
        <Penerimaan />
      )}

      {effectivePage === 'pbf' && (
        <PBF />
      )}

      {effectivePage === 'pasien' && (
        <Pasien />
      )}

      {effectivePage === 'dokter' && (
        <Dokter />
      )}

      {effectivePage === 'laporan' && (
        <Laporan />
      )}

      {effectivePage === 'pengaturan' && (
        <Pengaturan />
      )}

      {effectivePage === 'pengguna' && (
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