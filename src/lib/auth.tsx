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
    password: string
  ) => Promise<{ error: string | null }>;
  signUp: (
    data: SignUpData
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  profile: null,
  loading: true,
  signIn: async () => ({
    error: 'not implemented',
  }),
  signUp: async () => ({
    error: 'not implemented',
  }),
  signOut: async () => {},
});

const STORAGE_KEY = 'apotek_auth_session';

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    async function restoreSession() {
      try {
        const raw = localStorage.getItem(
          STORAGE_KEY
        );

        if (!raw) {
          return;
        }

        const savedProfile =
          JSON.parse(raw) as Profile;

        /*
         * Validasi user langsung dari database.
         * Jangan percaya tenant_id dari localStorage.
         */
        const {
          data: userData,
          error: userError,
        } = await supabase
          .from('app_users')
          .select(
            'id, email, full_name, role, is_active, tenant_id'
          )
          .eq('id', savedProfile.id)
          .maybeSingle();

        if (
          userError ||
          !userData ||
          !userData.is_active
        ) {
          localStorage.removeItem(
            STORAGE_KEY
          );
          setProfile(null);
          return;
        }

        let tenant: Tenant | null =
          null;

        /*
         * Jika user memiliki tenant_id,
         * pastikan tenant tersebut benar-benar ada.
         */
        if (userData.tenant_id) {
          const {
            data: tenantData,
            error: tenantError,
          } = await supabase
            .from('tenants')
            .select(
              'id, name, address, phone, footer_copyright, status'
            )
            .eq(
              'id',
              userData.tenant_id
            )
            .maybeSingle();

          /*
           * Tenant tidak ditemukan.
           * Jangan gunakan tenant_id lama dari localStorage.
           */
          if (
            tenantError ||
            !tenantData
          ) {
            localStorage.removeItem(
              STORAGE_KEY
            );

            setProfile(null);
            return;
          }

          tenant =
            tenantData as Tenant;
        }

        const freshProfile: Profile = {
          id: userData.id,
          email: userData.email,
          full_name: userData.full_name,
          role: userData.role as Role,
          is_active: userData.is_active,
          tenant_id: userData.tenant_id,
          tenant,
        };

        /*
         * Update localStorage dengan data terbaru.
         */
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(
            freshProfile
          )
        );

        setProfile(
          freshProfile
        );
      } catch (error) {
        console.error(
          'Gagal memulihkan sesi:',
          error
        );

        localStorage.removeItem(
          STORAGE_KEY
        );

        setProfile(null);
      } finally {
        setLoading(false);
      }
    }

    restoreSession();
  }, []);

  async function signIn(
    email: string,
    password: string
  ) {
    const {
      data,
      error,
    } = await supabase
      .from('app_users')
      .select(
        'id, email, full_name, role, is_active, tenant_id'
      )
      .eq(
        'email',
        email.toLowerCase()
      )
      .eq(
        'password',
        password
      )
      .maybeSingle();

    if (error) {
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

    if (!data.is_active) {
      return {
        error:
          'Akun ini tidak aktif',
      };
    }

    let tenant: Tenant | null =
      null;

    if (data.tenant_id) {
      const {
        data: tenantData,
        error: tenantError,
      } = await supabase
        .from('tenants')
        .select(
          'id, name, address, phone, footer_copyright, status'
        )
        .eq(
          'id',
          data.tenant_id
        )
        .maybeSingle();

      /*
       * tenant_id pada user ada,
       * tetapi tenant tidak ditemukan.
       */
      if (
        tenantError ||
        !tenantData
      ) {
        return {
          error:
            'Data tenant/apotek untuk akun ini tidak ditemukan. Hubungi administrator.',
        };
      }

      tenant =
        tenantData as Tenant;

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
     * Owner, assistant, dan kasir
     * harus memiliki tenant.
     */
    if (
      data.role !== 'superadmin' &&
      !data.tenant_id
    ) {
      return {
        error:
          'Akun ini belum terhubung ke tenant/apotek.',
      };
    }

    const session: Profile = {
      id: data.id,
      email: data.email,
      full_name: data.full_name,
      role: data.role as Role,
      is_active: data.is_active,
      tenant_id: data.tenant_id,
      tenant,
    };

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(session)
    );

    setProfile(session);

    return {
      error: null,
    };
  }

  async function signUp(
    data: SignUpData
  ) {
    const {
      data: existing,
    } = await supabase
      .from('app_users')
      .select('id')
      .eq(
        'email',
        data.email.toLowerCase()
      )
      .maybeSingle();

    if (existing) {
      return {
        error:
          'Email sudah terdaftar. Silakan gunakan email lain.',
      };
    }

    const {
      data: tenantData,
      error: tenantError,
    } = await supabase
      .from('tenants')
      .insert({
        name: data.pharmacyName,
        address:
          data.pharmacyAddress,
        status: 'pending',
      })
      .select('id')
      .single();

    if (
      tenantError ||
      !tenantData
    ) {
      return {
        error:
          'Gagal membuat apotek: ' +
          (
            tenantError?.message ??
            'unknown'
          ),
      };
    }

    const {
      error: userError,
    } = await supabase
      .from('app_users')
      .insert({
        email:
          data.email.toLowerCase(),
        password: data.password,
        full_name:
          data.ownerName,
        role: 'owner',
        is_active: true,
        tenant_id:
          tenantData.id,
      });

    if (userError) {
      await supabase
        .from('tenants')
        .delete()
        .eq(
          'id',
          tenantData.id
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
      STORAGE_KEY
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(
    AuthContext
  );
}

export const ROLE_PAGES: Record<
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
  page: string
): boolean {
  return (
    ROLE_PAGES[
      role
    ]?.includes(page) ?? false
  );
}

export function defaultPageForRole(
  role: Role
): string {
  return (
    ROLE_PAGES[
      role
    ]?.[0] ?? 'dashboard'
  );
}

export const ROLE_LABELS: Record<
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