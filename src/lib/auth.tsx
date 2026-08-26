import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import { supabase } from '@/lib/supabase';

export type Role =
  | 'owner'
  | 'assistant'
  | 'kasir'
  | 'superadmin';

export type Tenant = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  footer_copyright: string | null;
  status: 'pending' | 'approved' | 'rejected';
};

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  tenant_id: string | null;
  tenant: Tenant | null;
};

type SignUpData = {
  ownerName: string;
  email: string;
  password: string;
  pharmacyName: string;
  pharmacyAddress: string;
};

type AuthState = {
  profile: Profile | null;
  loading: boolean;

  signIn: (
    email: string,
    password: string,
  ) => Promise<{
    error: string | null;
  }>;

  signUp: (
    data: SignUpData,
  ) => Promise<{
    error: string | null;
  }>;

  signOut: () => Promise<void>;

  refreshProfile: () => Promise<void>;
};

const AuthContext =
  createContext<AuthState>({
    profile: null,

    loading: true,

    signIn: async () => ({
      error: 'not implemented',
    }),

    signUp: async () => ({
      error: 'not implemented',
    }),

    signOut: async () => {},

    refreshProfile: async () => {},
  });

const STORAGE_KEY =
  'apotek_auth_session';

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [
    profile,
    setProfile,
  ] = useState<
    Profile | null
  >(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  /*
   * Mengambil ulang data user dan tenant
   * langsung dari database.
   *
   * Fungsi ini penting agar setelah data
   * identitas apotek diubah, session dan
   * tampilan aplikasi dapat diperbarui.
   */
  async function refreshProfile() {
    try {
      const raw =
        localStorage.getItem(
          STORAGE_KEY,
        );

      if (!raw) {
        setProfile(null);
        return;
      }

      const savedProfile =
        JSON.parse(
          raw,
        ) as Profile;

      /*
       * Ambil data user terbaru.
       */
      const {
        data: userData,
        error: userError,
      } = await supabase
        .from(
          'app_users',
        )
        .select(
          `
            id,
            email,
            full_name,
            role,
            is_active,
            tenant_id
          `,
        )
        .eq(
          'id',
          savedProfile.id,
        )
        .maybeSingle();

      /*
       * User tidak ditemukan atau tidak aktif.
       */
      if (
        userError ||
        !userData ||
        !userData.is_active
      ) {
        localStorage.removeItem(
          STORAGE_KEY,
        );

        setProfile(null);

        return;
      }

      let tenant:
        | Tenant
        | null = null;

      /*
       * Jika user memiliki tenant,
       * ambil data tenant terbaru.
       */
      if (
        userData.tenant_id
      ) {
        const {
          data: tenantData,
          error: tenantError,
        } = await supabase
          .from(
            'tenants',
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
          .eq(
            'id',
            userData.tenant_id,
          )
          .maybeSingle();

        /*
         * Tenant tidak ditemukan.
         *
         * Jangan menggunakan tenant lama
         * dari localStorage.
         */
        if (
          tenantError ||
          !tenantData
        ) {
          localStorage.removeItem(
            STORAGE_KEY,
          );

          setProfile(null);

          return;
        }

        tenant =
          tenantData as Tenant;
      }

      /*
       * User selain superadmin wajib
       * memiliki tenant.
       */
      if (
        userData.role !==
          'superadmin' &&
        !userData.tenant_id
      ) {
        localStorage.removeItem(
          STORAGE_KEY,
        );

        setProfile(null);

        return;
      }

      const freshProfile:
        Profile = {
          id:
            userData.id,

          email:
            userData.email,

          full_name:
            userData.full_name,

          role:
            userData.role as Role,

          is_active:
            userData.is_active,

          tenant_id:
            userData.tenant_id,

          tenant,
        };

      /*
       * Simpan session terbaru.
       */
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          freshProfile,
        ),
      );

      setProfile(
        freshProfile,
      );
    } catch (error) {
      console.error(
        'Gagal memulihkan session:',
        error,
      );

      localStorage.removeItem(
        STORAGE_KEY,
      );

      setProfile(null);
    }
  }

  /*
   * Restore session ketika aplikasi
   * pertama kali dibuka.
   */
  useEffect(() => {
    async function restoreSession() {
      try {
        await refreshProfile();
      } finally {
        setLoading(false);
      }
    }

    restoreSession();
  }, []);

  async function signIn(
    email: string,
    password: string,
  ) {
    const {
      data,
      error,
    } = await supabase
      .from(
        'app_users',
      )
      .select(
        `
          id,
          email,
          full_name,
          role,
          is_active,
          tenant_id
        `,
      )
      .eq(
        'email',
        email.toLowerCase(),
      )
      .eq(
        'password',
        password,
      )
      .maybeSingle();

    if (error) {
      console.error(
        'Login error:',
        error,
      );

      return {
        error:
          'Gagal terhubung ke server',
      };
    }

    if (!data) {
      return {
        error:
          'Email atau password salah',
      };
    }

    if (
      !data.is_active
    ) {
      return {
        error:
          'Akun ini tidak aktif',
      };
    }

    let tenant:
      | Tenant
      | null = null;

    /*
     * Ambil tenant berdasarkan tenant_id
     * langsung dari database.
     */
    if (
      data.tenant_id
    ) {
      const {
        data: tenantData,
        error: tenantError,
      } = await supabase
        .from(
          'tenants',
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
        .eq(
          'id',
          data.tenant_id,
        )
        .maybeSingle();

      if (
        tenantError ||
        !tenantData
      ) {
        console.error(
          'Tenant error:',
          tenantError,
        );

        return {
          error:
            'Data tenant/apotek untuk akun ini tidak ditemukan. Hubungi administrator.',
        };
      }

      tenant =
        tenantData as Tenant;

      /*
       * Blokir tenant yang ditolak.
       */
      if (
        tenant.status ===
        'rejected'
      ) {
        return {
          error:
            'Pendaftaran apotek Anda ditolak. Hubungi admin untuk informasi.',
        };
      }
    }

    /*
     * Semua user selain superadmin
     * wajib memiliki tenant.
     */
    if (
      data.role !==
        'superadmin' &&
      !data.tenant_id
    ) {
      return {
        error:
          'Akun ini belum terhubung ke tenant/apotek.',
      };
    }

    const session:
      Profile = {
        id:
          data.id,

        email:
          data.email,

        full_name:
          data.full_name,

        role:
          data.role as Role,

        is_active:
          data.is_active,

        tenant_id:
          data.tenant_id,

        tenant,
      };

    /*
     * Simpan tenant_id dan data tenant
     * ke localStorage.
     *
     * tenantFrom() akan menggunakan
     * tenant_id ini untuk otomatis
     * menambahkan tenant_id pada
     * INSERT / UPSERT.
     */
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        session,
      ),
    );

    setProfile(
      session,
    );

    return {
      error: null,
    };
  }

  async function signUp(
    data: SignUpData,
  ) {
    /*
     * Pastikan email belum digunakan.
     */
    const {
      data: existing,
      error: existingError,
    } = await supabase
      .from(
        'app_users',
      )
      .select(
        'id',
      )
      .eq(
        'email',
        data.email.toLowerCase(),
      )
      .maybeSingle();

    if (
      existingError
    ) {
      return {
        error:
          'Gagal memeriksa email: ' +
          existingError.message,
      };
    }

    if (
      existing
    ) {
      return {
        error:
          'Email sudah terdaftar. Silakan gunakan email lain.',
      };
    }

    /*
     * Buat tenant/apotek terlebih dahulu.
     */
    const {
      data: tenantData,
      error: tenantError,
    } = await supabase
      .from(
        'tenants',
      )
      .insert({
        name:
          data.pharmacyName.trim(),

        address:
          data.pharmacyAddress.trim() ||
          null,

        status:
          'pending',
      })
      .select(
        'id',
      )
      .single();

    if (
      tenantError ||
      !tenantData
    ) {
      console.error(
        'Tenant signup error:',
        tenantError,
      );

      return {
        error:
          'Gagal membuat apotek: ' +
          (
            tenantError?.message ??
            'unknown'
          ),
      };
    }

    /*
     * Setelah tenant berhasil dibuat,
     * buat akun owner dan hubungkan
     * tenant_id yang baru.
     */
    const {
      error: userError,
    } = await supabase
      .from(
        'app_users',
      )
      .insert({
        email:
          data.email
            .trim()
            .toLowerCase(),

        password:
          data.password,

        full_name:
          data.ownerName.trim(),

        role:
          'owner',

        is_active:
          true,

        tenant_id:
          tenantData.id,
      });

    /*
     * Jika pembuatan user gagal,
     * hapus tenant yang baru dibuat
     * agar tidak menjadi data orphan.
     */
    if (
      userError
    ) {
      await supabase
        .from(
          'tenants',
        )
        .delete()
        .eq(
          'id',
          tenantData.id,
        );

      console.error(
        'User signup error:',
        userError,
      );

      return {
        error:
          'Gagal membuat akun: ' +
          userError.message,
      };
    }

    return {
      error: null,
    };
  }

  async function signOut() {
    localStorage.removeItem(
      STORAGE_KEY,
    );

    setProfile(null);
  }

  return (
    <AuthContext.Provider
      value={{
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(
    AuthContext,
  );
}

export const ROLE_PAGES:
  Record<
    Role,
    string[]
  > = {
  superadmin: [
    'dashboard',
    'pengguna',
  ],

  owner: [
    'dashboard',
    'kasir',
    'obat',
    'pengadaan',
    'penerimaan',
    'pbf',
    'pasien',
    'dokter',
    'laporan',
    'pengaturan',
    'pengguna',
  ],

  assistant: [
    'dashboard',
    'kasir',
    'obat',
    'pengadaan',
    'penerimaan',
    'pbf',
    'pasien',
    'dokter',
    'laporan',
  ],

  kasir: [
    'kasir',
  ],
};

export function canAccess(
  role: Role,
  page: string,
): boolean {
  return (
    ROLE_PAGES[
      role
    ]?.includes(
      page,
    ) ?? false
  );
}

export function defaultPageForRole(
  role: Role,
): string {
  return (
    ROLE_PAGES[
      role
    ]?.[0] ??
    'dashboard'
  );
}

export const ROLE_LABELS:
  Record<
    Role,
    string
  > = {
  superadmin:
    'Super Admin',

  owner:
    'Owner',

  assistant:
    'Assistant',

  kasir:
    'Kasir',
};