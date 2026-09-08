import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth, ROLE_LABELS, type Role } from '@/lib/auth';

import {
  UserPlus,
  Trash2,
  Pencil,
  X,
  ShieldCheck,
  Mail,
  Lock,
  User as UserIcon,
  AlertCircle,
  Eye,
  EyeOff,
  Building2,
  Check,
  XCircle,
  Clock,
  CreditCard,
  Ban,
  Play,
  CalendarDays,
} from 'lucide-react';

type AppUser = {
  id: string;
  email: string;
  password: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  created_at: string;
};

type TenantStatus = 'pending' | 'approved' | 'rejected';

type SubscriptionStatus =
  | 'active'
  | 'suspended'
  | 'expired'
  | 'pending';

type Tenant = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  footer_copyright: string | null;

  status: TenantStatus;

  subscription_status: SubscriptionStatus | null;
  subscription_plan: string | null;
  subscription_start: string | null;
  subscription_end: string | null;
  monthly_price: number | null;
  suspended_at: string | null;

  created_at: string;
};

const roleColors: Record<Role, string> = {
  superadmin: 'bg-purple-100 text-purple-700',
  owner: 'bg-teal-100 text-teal-700',
  assistant: 'bg-blue-100 text-blue-700',
  kasir: 'bg-gray-100 text-gray-600',
};

const roleOptions: {
  value: Role;
  label: string;
}[] = [
  {
    value: 'owner',
    label: 'Owner',
  },
  {
    value: 'assistant',
    label: 'Assistant',
  },
  {
    value: 'kasir',
    label: 'Kasir',
  },
];

const statusConfig = {
  pending: {
    label: 'Menunggu',
    icon: Clock,
    color: 'bg-amber-100 text-amber-700',
    dot: 'bg-amber-500',
  },

  approved: {
    label: 'Disetujui',
    icon: Check,
    color: 'bg-green-100 text-green-700',
    dot: 'bg-green-500',
  },

  rejected: {
    label: 'Ditolak',
    icon: XCircle,
    color: 'bg-red-100 text-red-700',
    dot: 'bg-red-500',
  },
};

const subscriptionStatusConfig: Record<
  SubscriptionStatus,
  {
    label: string;
    color: string;
    icon: typeof Check;
  }
> = {
  active: {
    label: 'Aktif',
    color: 'bg-green-100 text-green-700',
    icon: Check,
  },

  suspended: {
    label: 'Ditangguhkan',
    color: 'bg-red-100 text-red-700',
    icon: Ban,
  },

  expired: {
    label: 'Berakhir',
    color: 'bg-orange-100 text-orange-700',
    icon: Clock,
  },

  pending: {
    label: 'Menunggu',
    color: 'bg-amber-100 text-amber-700',
    icon: Clock,
  },
};

export default function UserManagement() {
  const { profile: currentUser } = useAuth();

  const isSuperAdmin =
    currentUser?.role === 'superadmin';

  const [users, setUsers] =
    useState<AppUser[]>([]);

  const [tenants, setTenants] =
    useState<Tenant[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [showForm, setShowForm] =
    useState(false);

  const [editingUser, setEditingUser] =
    useState<AppUser | null>(null);

  const [search, setSearch] =
    useState('');

  const [error, setError] =
    useState<string | null>(null);

  const [showPassword, setShowPassword] =
    useState(false);

  const [email, setEmail] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [fullName, setFullName] =
    useState('');

  const [role, setRole] =
    useState<Role>('kasir');

  const [isActive, setIsActive] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [updatingTenantId, setUpdatingTenantId] =
    useState<string | null>(null);

  const loadUsers =
    useCallback(async () => {
      setLoading(true);

      let query =
        supabase
          .from('app_users')
          .select('*');

      if (
        !isSuperAdmin &&
        currentUser?.tenant_id
      ) {
        query = query.eq(
          'tenant_id',
          currentUser.tenant_id
        );
      }

      const {
        data,
        error: err,
      } = await query.order(
        'created_at',
        {
          ascending: true,
        }
      );

      if (err) {
        setError(
          'Gagal memuat data pengguna: ' +
            err.message
        );
      } else {
        setUsers(
          (data as AppUser[]) || []
        );
      }

      setLoading(false);
    }, [
      isSuperAdmin,
      currentUser?.tenant_id,
    ]);

  const loadTenants =
    useCallback(async () => {
      if (!isSuperAdmin) {
        return;
      }

      const {
        data,
        error: err,
      } = await supabase
        .from('tenants')
        .select('*')
        .order(
          'created_at',
          {
            ascending: false,
          }
        );

      if (err) {
        setError(
          'Gagal memuat data apotek: ' +
            err.message
        );
      } else {
        setTenants(
          (data as Tenant[]) || []
        );
      }
    }, [isSuperAdmin]);

  useEffect(() => {
    loadUsers();
    loadTenants();
  }, [
    loadUsers,
    loadTenants,
  ]);

  function resetForm() {
    setEmail('');
    setPassword('');
    setFullName('');
    setRole('kasir');
    setIsActive(true);
    setEditingUser(null);
    setShowPassword(false);
    setError(null);
  }

  function openAddForm() {
    resetForm();
    setShowForm(true);
  }

  function openEditForm(
    user: AppUser
  ) {
    setEditingUser(user);
    setEmail(user.email);
    setPassword(user.password);
    setFullName(user.full_name);
    setRole(user.role);
    setIsActive(user.is_active);
    setShowPassword(false);
    setError(null);
    setShowForm(true);
  }

  async function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();

    setError(null);

    if (
      !email.trim() ||
      !fullName.trim() ||
      !password.trim()
    ) {
      setError(
        'Semua field wajib diisi'
      );

      return;
    }

    setSaving(true);

    if (editingUser) {
      const {
        error: updateError,
      } = await supabase
        .from('app_users')
        .update({
          email: email
            .toLowerCase()
            .trim(),

          password: password.trim(),

          full_name:
            fullName.trim(),

          role,

          is_active:
            isActive,
        })
        .eq(
          'id',
          editingUser.id
        );

      if (updateError) {
        setError(
          'Gagal menyimpan: ' +
            updateError.message
        );

        setSaving(false);

        return;
      }
    } else {
      const {
        error: insertError,
      } = await supabase
        .from('app_users')
        .insert({
          email: email
            .toLowerCase()
            .trim(),

          password:
            password.trim(),

          full_name:
            fullName.trim(),

          role,

          is_active:
            isActive,

          tenant_id:
            currentUser?.tenant_id,
        });

      if (insertError) {
        setError(
          'Gagal menambah pengguna: ' +
            insertError.message
        );

        setSaving(false);

        return;
      }
    }

    setSaving(false);
    setShowForm(false);

    resetForm();

    loadUsers();
  }

  async function handleDelete(
    user: AppUser
  ) {
    if (
      user.id ===
      currentUser?.id
    ) {
      alert(
        'Anda tidak dapat menghapus akun yang sedang digunakan.'
      );

      return;
    }

    if (
      user.role === 'owner' &&
      users.filter(
        (u) =>
          u.role === 'owner' &&
          u.is_active
      ).length <= 1
    ) {
      alert(
        'Tidak dapat menghapus satu-satunya akun Owner yang aktif.'
      );

      return;
    }

    if (
      !confirm(
        `Hapus pengguna "${user.full_name}" (${user.email})?`
      )
    ) {
      return;
    }

    const {
      error: deleteError,
    } = await supabase
      .from('app_users')
      .delete()
      .eq(
        'id',
        user.id
      );

    if (deleteError) {
      alert(
        'Gagal menghapus: ' +
          deleteError.message
      );

      return;
    }

    loadUsers();
  }

  async function toggleActive(
    user: AppUser
  ) {
    if (
      user.id ===
        currentUser?.id &&
      user.is_active
    ) {
      alert(
        'Anda tidak dapat menonaktifkan akun yang sedang digunakan.'
      );

      return;
    }

    const {
      error: updateError,
    } = await supabase
      .from('app_users')
      .update({
        is_active:
          !user.is_active,
      })
      .eq(
        'id',
        user.id
      );

    if (updateError) {
      alert(
        'Gagal mengubah status: ' +
          updateError.message
      );

      return;
    }

    loadUsers();
  }

  async function approveTenant(
    tenant: Tenant
  ) {
    setUpdatingTenantId(
      tenant.id
    );

    const now =
      new Date();

    const endDate =
      new Date(now);

    endDate.setDate(
      endDate.getDate() + 30
    );

    const {
      error: err,
    } = await supabase
      .from('tenants')
      .update({
        status: 'approved',

        subscription_status:
          'active',

        subscription_start:
          now.toISOString(),

        subscription_end:
          endDate.toISOString(),

        subscription_plan:
          tenant.subscription_plan ||
          'Bulanan',

        footer_copyright:
          'PT. Digital Salim Jaya Indonesia',

        suspended_at:
          null,
      })
      .eq(
        'id',
        tenant.id
      );

    setUpdatingTenantId(
      null
    );

    if (err) {
      alert(
        'Gagal menyetujui: ' +
          err.message
      );

      return;
    }

    alert(
      'Apotek berhasil disetujui dan langganan aktif selama 30 hari.'
    );

    loadTenants();
  }

  async function rejectTenant(
    tenant: Tenant
  ) {
    if (
      !confirm(
        `Tolak pendaftaran apotek "${tenant.name}"?`
      )
    ) {
      return;
    }

    setUpdatingTenantId(
      tenant.id
    );

    const {
      error: err,
    } = await supabase
      .from('tenants')
      .update({
        status:
          'rejected',

        subscription_status:
          'suspended',

        suspended_at:
          new Date().toISOString(),
      })
      .eq(
        'id',
        tenant.id
      );

    setUpdatingTenantId(
      null
    );

    if (err) {
      alert(
        'Gagal menolak: ' +
          err.message
      );

      return;
    }

    loadTenants();
  }

  async function suspendTenant(
    tenant: Tenant
  ) {
    if (
      !confirm(
        `Tangguhkan akses "${tenant.name}"?\n\nPengguna tenant ini nantinya tidak dapat menggunakan aplikasi.`
      )
    ) {
      return;
    }

    setUpdatingTenantId(
      tenant.id
    );

    const {
      error: err,
    } = await supabase
      .from('tenants')
      .update({
        subscription_status:
          'suspended',

        suspended_at:
          new Date().toISOString(),
      })
      .eq(
        'id',
        tenant.id
      );

    setUpdatingTenantId(
      null
    );

    if (err) {
      alert(
        'Gagal menangguhkan: ' +
          err.message
      );

      return;
    }

    alert(
      `Akses ${tenant.name} berhasil ditangguhkan.`
    );

    loadTenants();
  }

  async function activateTenant(
    tenant: Tenant
  ) {
    setUpdatingTenantId(
      tenant.id
    );

    const {
      error: err,
    } = await supabase
      .from('tenants')
      .update({
        subscription_status:
          'active',

        suspended_at:
          null,
      })
      .eq(
        'id',
        tenant.id
      );

    setUpdatingTenantId(
      null
    );

    if (err) {
      alert(
        'Gagal mengaktifkan: ' +
          err.message
      );

      return;
    }

    alert(
      `Akses ${tenant.name} berhasil diaktifkan kembali.`
    );

    loadTenants();
  }

  async function extendSubscription(
    tenant: Tenant
  ) {
    if (
      !confirm(
        `Perpanjang langganan "${tenant.name}" selama 30 hari?`
      )
    ) {
      return;
    }

    setUpdatingTenantId(
      tenant.id
    );

    const today =
      new Date();

    let baseDate =
      new Date(today);

    if (
      tenant.subscription_end
    ) {
      const currentEnd =
        new Date(
          tenant.subscription_end
        );

      if (
        currentEnd >
        today
      ) {
        baseDate =
          currentEnd;
      }
    }

    const newEnd =
      new Date(
        baseDate
      );

    newEnd.setDate(
      newEnd.getDate() + 30
    );

    const startDate =
      tenant.subscription_start ||
      today.toISOString();

    const {
      error: err,
    } = await supabase
      .from('tenants')
      .update({
        subscription_status:
          'active',

        subscription_start:
          startDate,

        subscription_end:
          newEnd.toISOString(),

        subscription_plan:
          tenant.subscription_plan ||
          'Bulanan',

        suspended_at:
          null,
      })
      .eq(
        'id',
        tenant.id
      );

    setUpdatingTenantId(
      null
    );

    if (err) {
      alert(
        'Gagal memperpanjang langganan: ' +
          err.message
      );

      return;
    }

    alert(
      `Langganan ${tenant.name} berhasil diperpanjang sampai ${newEnd.toLocaleDateString(
        'id-ID',
        {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        }
      )}.`
    );

    loadTenants();
  }

  function formatDate(
    value: string | null
  ) {
    if (!value) {
      return '-';
    }

    return new Date(
      value
    ).toLocaleDateString(
      'id-ID',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }
    );
  }

  function getSubscriptionStatus(
    tenant: Tenant
  ): SubscriptionStatus {
    if (
      tenant.subscription_status ===
      'suspended'
    ) {
      return 'suspended';
    }

    if (
      tenant.subscription_end
    ) {
      const endDate =
        new Date(
          tenant.subscription_end
        );

      if (
        endDate <
        new Date()
      ) {
        return 'expired';
      }
    }

    return (
      tenant.subscription_status ||
      'pending'
    );
  }

  const filteredUsers =
    users.filter(
      (u) =>
        u.full_name
          .toLowerCase()
          .includes(
            search.toLowerCase()
          ) ||
        u.email
          .toLowerCase()
          .includes(
            search.toLowerCase()
          )
    );

  const pendingTenants =
    tenants.filter(
      (t) =>
        t.status ===
        'pending'
    );

  const approvedTenants =
    tenants.filter(
      (t) =>
        t.status ===
        'approved'
    );

  const rejectedTenants =
    tenants.filter(
      (t) =>
        t.status ===
        'rejected'
    );

  const activeSubscriptions =
    tenants.filter(
      (t) =>
        getSubscriptionStatus(
          t
        ) === 'active'
    );

  return (
    <div className="p-6 max-w-7xl mx-auto">

      <div className="flex items-center justify-between mb-6">

        <div>

          <h1 className="text-2xl font-bold text-gray-800">

            {isSuperAdmin
              ? 'Panel Super Admin'
              : 'Manajemen Pengguna'}

          </h1>

          <p className="text-sm text-gray-500 mt-1">

            {isSuperAdmin
              ? 'Kelola apotek, langganan, dan pengguna sistem'
              : 'Kelola akun staf apotek dan hak akses mereka'}

          </p>

        </div>

        {!isSuperAdmin && (

          <button
            onClick={
              openAddForm
            }
            className="flex items-center gap-2 bg-teal-500 hover:bg-teal-600 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm"
          >

            <UserPlus
              size={18}
            />

            <span>
              Tambah Pengguna
            </span>

          </button>

        )}

      </div>

      {isSuperAdmin && (

        <>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">

            <div className="bg-white rounded-xl border border-gray-100 p-4">

              <p className="text-xs text-gray-400 font-medium">
                Total Apotek
              </p>

              <p className="text-2xl font-bold text-gray-800 mt-1">
                {tenants.length}
              </p>

            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-4">

              <p className="text-xs text-gray-400 font-medium">
                Menunggu
              </p>

              <p className="text-2xl font-bold text-amber-600 mt-1">
                {pendingTenants.length}
              </p>

            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-4">

              <p className="text-xs text-gray-400 font-medium">
                Disetujui
              </p>

              <p className="text-2xl font-bold text-green-600 mt-1">
                {approvedTenants.length}
              </p>

            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-4">

              <p className="text-xs text-gray-400 font-medium">
                Ditolak
              </p>

              <p className="text-2xl font-bold text-red-500 mt-1">
                {rejectedTenants.length}
              </p>

            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-4">

              <p className="text-xs text-gray-400 font-medium">
                Langganan Aktif
              </p>

              <p className="text-2xl font-bold text-teal-600 mt-1">
                {activeSubscriptions.length}
              </p>

            </div>

          </div>

          {pendingTenants.length > 0 && (

            <div className="mb-6">

              <div className="flex items-center gap-2 mb-3">

                <Clock
                  size={18}
                  className="text-amber-500"
                />

                <h2 className="font-bold text-gray-800">
                  Pendaftaran Menunggu Persetujuan
                </h2>

                <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">

                  {pendingTenants.length}

                </span>

              </div>

              <div className="space-y-3">

                {pendingTenants.map(
                  (tenant) => (

                    <div
                      key={
                        tenant.id
                      }
                      className="bg-white rounded-xl border border-amber-200 p-4 flex items-center justify-between"
                    >

                      <div className="flex items-center gap-3">

                        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">

                          <Building2
                            size={20}
                            className="text-amber-600"
                          />

                        </div>

                        <div>

                          <p className="font-semibold text-gray-800">
                            {tenant.name}
                          </p>

                          <p className="text-xs text-gray-400">
                            {tenant.address ||
                              'Alamat tidak diisi'}
                          </p>

                          <p className="text-[11px] text-gray-400 mt-0.5">

                            Terdaftar:{' '}

                            {formatDate(
                              tenant.created_at
                            )}

                          </p>

                        </div>

                      </div>

                      <div className="flex items-center gap-2">

                        <button
                          onClick={() =>
                            rejectTenant(
                              tenant
                            )
                          }
                          disabled={
                            updatingTenantId ===
                            tenant.id
                          }
                          className="flex items-center gap-1.5 px-3 py-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 rounded-lg text-sm font-semibold transition-colors"
                        >

                          <XCircle
                            size={16}
                          />

                          Reject

                        </button>

                        <button
                          onClick={() =>
                            approveTenant(
                              tenant
                            )
                          }
                          disabled={
                            updatingTenantId ===
                            tenant.id
                          }
                          className="flex items-center gap-1.5 px-3 py-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors"
                        >

                          <Check
                            size={16}
                          />

                          Approve

                        </button>

                      </div>

                    </div>

                  )
                )}

              </div>

            </div>

          )}

          <div className="mb-6">

            <div className="flex items-center gap-2 mb-3">

              <CreditCard
                size={18}
                className="text-teal-600"
              />

              <h2 className="font-bold text-gray-800">
                Semua Apotek & Langganan
              </h2>

            </div>

            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">

              {loading ? (

                <div className="flex items-center justify-center py-16">

                  <div className="animate-spin w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full" />

                </div>

              ) : tenants.length ===
                0 ? (

                <div className="flex flex-col items-center justify-center py-16 text-gray-400">

                  <Building2
                    size={40}
                    className="mb-3 text-gray-300"
                  />

                  <p className="text-sm">
                    Belum ada apotek terdaftar
                  </p>

                </div>

              ) : (

                <div className="overflow-x-auto">

                  <table className="w-full">

                    <thead>

                      <tr className="border-b border-gray-100 bg-gray-50/50">

                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                          Nama Apotek
                        </th>

                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                          Status
                        </th>

                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                          Langganan
                        </th>

                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                          Paket
                        </th>

                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                          Berakhir
                        </th>

                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                          Harga/Bulan
                        </th>

                        <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                          Aksi
                        </th>

                      </tr>

                    </thead>

                    <tbody className="divide-y divide-gray-50">

                      {tenants.map(
                        (tenant) => {

                          const cfg =
                            statusConfig[
                              tenant.status
                            ];

                          const StatusIcon =
                            cfg.icon;

                          const subscriptionStatus =
                            getSubscriptionStatus(
                              tenant
                            );

                          const subscriptionCfg =
                            subscriptionStatusConfig[
                              subscriptionStatus
                            ];

                          const SubscriptionIcon =
                            subscriptionCfg.icon;

                          const isUpdating =
                            updatingTenantId ===
                            tenant.id;

                          return (

                            <tr
                              key={
                                tenant.id
                              }
                              className="hover:bg-gray-50/50 transition-colors"
                            >

                              <td className="px-4 py-3">

                                <div className="flex items-center gap-3">

                                  <div className="w-9 h-9 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">

                                    <Building2
                                      size={16}
                                      className="text-teal-700"
                                    />

                                  </div>

                                  <div>

                                    <p className="text-sm font-semibold text-gray-800">

                                      {tenant.name}

                                    </p>

                                    <p className="text-xs text-gray-400">

                                      {tenant.phone ||
                                        '-'}

                                    </p>

                                  </div>

                                </div>

                              </td>

                              <td className="px-4 py-3">

                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color}`}
                                >

                                  <StatusIcon
                                    size={12}
                                  />

                                  {cfg.label}

                                </span>

                              </td>

                              <td className="px-4 py-3">

                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${subscriptionCfg.color}`}
                                >

                                  <SubscriptionIcon
                                    size={12}
                                  />

                                  {
                                    subscriptionCfg.label
                                  }

                                </span>

                              </td>

                              <td className="px-4 py-3 text-sm text-gray-600">

                                {tenant.subscription_plan ||
                                  '-'}

                              </td>

                              <td className="px-4 py-3">

                                <div className="flex items-center gap-1.5 text-sm text-gray-600">

                                  <CalendarDays
                                    size={15}
                                    className="text-gray-400"
                                  />

                                  {formatDate(
                                    tenant.subscription_end
                                  )}

                                </div>

                              </td>

                              <td className="px-4 py-3 text-sm text-gray-600">

                                {tenant.monthly_price
                                  ? new Intl.NumberFormat(
                                      'id-ID',
                                      {
                                        style:
                                          'currency',
                                        currency:
                                          'IDR',
                                        maximumFractionDigits: 0,
                                      }
                                    ).format(
                                      tenant.monthly_price
                                    )
                                  : '-'}

                              </td>

                              <td className="px-4 py-3">

                                <div className="flex items-center justify-end gap-2">

                                  <button
                                    onClick={() =>
                                      extendSubscription(
                                        tenant
                                      )
                                    }
                                    disabled={
                                      isUpdating
                                    }
                                    title="Perpanjang 30 Hari"
                                    className="p-2 text-teal-600 hover:bg-teal-50 disabled:opacity-50 rounded-lg transition-colors"
                                  >

                                    <CalendarDays
                                      size={17}
                                    />

                                  </button>

                                  {subscriptionStatus ===
                                  'suspended' ? (

                                    <button
                                      onClick={() =>
                                        activateTenant(
                                          tenant
                                        )
                                      }
                                      disabled={
                                        isUpdating
                                      }
                                      title="Aktifkan Kembali"
                                      className="p-2 text-green-600 hover:bg-green-50 disabled:opacity-50 rounded-lg transition-colors"
                                    >

                                      <Play
                                        size={17}
                                      />

                                    </button>

                                  ) : (

                                    <button
                                      onClick={() =>
                                        suspendTenant(
                                          tenant
                                        )
                                      }
                                      disabled={
                                        isUpdating
                                      }
                                      title="Tangguhkan Langganan"
                                      className="p-2 text-red-500 hover:bg-red-50 disabled:opacity-50 rounded-lg transition-colors"
                                    >

                                      <Ban
                                        size={17}
                                      />

                                    </button>

                                  )}

                                </div>

                              </td>

                            </tr>

                          );

                        }
                      )}

                    </tbody>

                  </table>

                </div>

              )}

            </div>

          </div>

        </>

      )}

      {!isSuperAdmin && (

        <>

          <div className="grid grid-cols-3 gap-4 mb-6">

            <div className="bg-white rounded-xl border border-gray-100 p-4">

              <p className="text-xs text-gray-400 font-medium">
                Total Pengguna
              </p>

              <p className="text-2xl font-bold text-gray-800 mt-1">

                {users.length}

              </p>

            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-4">

              <p className="text-xs text-gray-400 font-medium">
                Aktif
              </p>

              <p className="text-2xl font-bold text-teal-600 mt-1">

                {
                  users.filter(
                    (u) =>
                      u.is_active
                  ).length
                }

              </p>

            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-4">

              <p className="text-xs text-gray-400 font-medium">
                Nonaktif
              </p>

              <p className="text-2xl font-bold text-gray-400 mt-1">

                {
                  users.filter(
                    (u) =>
                      !u.is_active
                  ).length
                }

              </p>

            </div>

          </div>

          <div className="mb-4">

            <input
              type="text"
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
              placeholder="Cari berdasarkan nama atau email..."
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            />

          </div>

          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">

            {loading ? (

              <div className="flex items-center justify-center py-16">

                <div className="animate-spin w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full" />

              </div>

            ) : filteredUsers.length ===
              0 ? (

              <div className="flex flex-col items-center justify-center py-16 text-gray-400">

                <UserIcon
                  size={40}
                  className="mb-3 text-gray-300"
                />

                <p className="text-sm">
                  Tidak ada pengguna ditemukan
                </p>

              </div>

            ) : (

              <div className="overflow-x-auto">

                <table className="w-full">

                  <thead>

                    <tr className="border-b border-gray-100 bg-gray-50/50">

                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                        Pengguna
                      </th>

                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                        Email
                      </th>

                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                        Role
                      </th>

                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                        Status
                      </th>

                      <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                        Aksi
                      </th>

                    </tr>

                  </thead>

                  <tbody className="divide-y divide-gray-50">

                    {filteredUsers.map(
                      (user) => (

                        <tr
                          key={
                            user.id
                          }
                          className="hover:bg-gray-50/50 transition-colors"
                        >

                          <td className="px-4 py-3">

                            <div className="flex items-center gap-3">

                              <div className="w-9 h-9 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">

                                <span className="text-teal-700 text-sm font-bold">

                                  {user.full_name
                                    .charAt(0)
                                    .toUpperCase()}

                                </span>

                              </div>

                              <div>

                                <p className="text-sm font-semibold text-gray-800">

                                  {
                                    user.full_name
                                  }

                                </p>

                                {user.id ===
                                  currentUser?.id && (

                                  <span className="text-[10px] text-teal-600 font-medium">
                                    Anda
                                  </span>

                                )}

                              </div>

                            </div>

                          </td>

                          <td className="px-4 py-3 text-sm text-gray-600">

                            {user.email}

                          </td>

                          <td className="px-4 py-3">

                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${roleColors[user.role]}`}
                            >

                              {user.role ===
                                'owner' && (

                                <ShieldCheck
                                  size={12}
                                />

                              )}

                              {
                                ROLE_LABELS[
                                  user.role
                                ]
                              }

                            </span>

                          </td>

                          <td className="px-4 py-3">

                            <button
                              onClick={() =>
                                toggleActive(
                                  user
                                )
                              }
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                user.is_active
                                  ? 'bg-teal-500'
                                  : 'bg-gray-300'
                              }`}
                            >

                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  user.is_active
                                    ? 'translate-x-4'
                                    : 'translate-x-0.5'
                                }`}
                              />

                            </button>

                          </td>

                          <td className="px-4 py-3">

                            <div className="flex items-center justify-end gap-1">

                              <button
                                onClick={() =>
                                  openEditForm(
                                    user
                                  )
                                }
                                className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                              >

                                <Pencil
                                  size={16}
                                />

                              </button>

                              <button
                                onClick={() =>
                                  handleDelete(
                                    user
                                  )
                                }
                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              >

                                <Trash2
                                  size={16}
                                />

                              </button>

                            </div>

                          </td>

                        </tr>

                      )
                    )}

                  </tbody>

                </table>

              </div>

            )}

          </div>

        </>

      )}

      {showForm && (

        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => {
            setShowForm(false);
            resetForm();
          }}
        >

          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">

              <h2 className="font-bold text-gray-800">

                {editingUser
                  ? 'Edit Pengguna'
                  : 'Tambah Pengguna'}

              </h2>

              <button
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >

                <X
                  size={20}
                />

              </button>

            </div>

            {error && (

              <div className="mx-6 mt-4 flex items-center gap-2 bg-red-50 text-red-600 text-sm rounded-xl px-3 py-2.5">

                <AlertCircle
                  size={16}
                  className="flex-shrink-0"
                />

                <span>
                  {error}
                </span>

              </div>

            )}

            <form
              onSubmit={
                handleSubmit
              }
              className="px-6 py-5 space-y-4"
            >

              <div>

                <label className="text-xs font-medium text-gray-500">
                  Nama Lengkap
                </label>

                <div className="relative mt-1">

                  <UserIcon
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    type="text"
                    value={
                      fullName
                    }
                    onChange={(e) =>
                      setFullName(
                        e.target.value
                      )
                    }
                    required
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />

                </div>

              </div>

              <div>

                <label className="text-xs font-medium text-gray-500">
                  Email
                </label>

                <div className="relative mt-1">

                  <Mail
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    type="email"
                    value={
                      email
                    }
                    onChange={(e) =>
                      setEmail(
                        e.target.value
                      )
                    }
                    required
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />

                </div>

              </div>

              <div>

                <label className="text-xs font-medium text-gray-500">
                  Password
                </label>

                <div className="relative mt-1">

                  <Lock
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    type={
                      showPassword
                        ? 'text'
                        : 'password'
                    }
                    value={
                      password
                    }
                    onChange={(e) =>
                      setPassword(
                        e.target.value
                      )
                    }
                    required
                    className="w-full pl-9 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        !showPassword
                      )
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >

                    {showPassword ? (

                      <EyeOff
                        size={16}
                      />

                    ) : (

                      <Eye
                        size={16}
                      />

                    )}

                  </button>

                </div>

              </div>

              <div>

                <label className="text-xs font-medium text-gray-500">
                  Role / Jabatan
                </label>

                <div className="grid grid-cols-3 gap-2 mt-1">

                  {roleOptions.map(
                    (opt) => (

                      <button
                        key={
                          opt.value
                        }
                        type="button"
                        onClick={() =>
                          setRole(
                            opt.value
                          )
                        }
                        className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors border ${
                          role ===
                          opt.value
                            ? 'bg-teal-50 border-teal-400 text-teal-700'
                            : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                      >

                        {opt.label}

                      </button>

                    )
                  )}

                </div>

              </div>

              <div className="flex items-center justify-between pt-1">

                <label className="text-sm font-medium text-gray-600">
                  Akun Aktif
                </label>

                <button
                  type="button"
                  onClick={() =>
                    setIsActive(
                      !isActive
                    )
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isActive
                      ? 'bg-teal-500'
                      : 'bg-gray-300'
                  }`}
                >

                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                      isActive
                        ? 'translate-x-5'
                        : 'translate-x-0.5'
                    }`}
                  />

                </button>

              </div>

              <div className="flex gap-3 pt-2">

                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 font-semibold rounded-xl text-sm hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={
                    saving
                  }
                  className="flex-1 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                >

                  {saving ? (

                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />

                  ) : null}

                  {editingUser
                    ? 'Simpan'
                    : 'Tambah'}

                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </div>
  );
}