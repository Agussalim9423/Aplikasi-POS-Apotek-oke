import { useState } from 'react';
import {
  LayoutDashboard, ShoppingCart, Pill, ClipboardList,
  PackageCheck, Truck, Users, Stethoscope, BarChart3,
  Settings, ChevronLeft, Menu, Heart, LogOut, ShieldCheck,
  type LucideIcon, AlertCircle
} from 'lucide-react';
import { useAuth, ROLE_LABELS, canAccess, type Role } from '@/lib/auth';

export type Page =
  | 'dashboard' | 'kasir' | 'obat' | 'pengadaan'
  | 'penerimaan' | 'pbf' | 'pasien' | 'dokter'
  | 'laporan' | 'pengaturan' | 'pengguna';

type LayoutProps = {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  children: React.ReactNode;
  pharmacyName: string;
  footerCopyright: string;
};

const navItems: { id: Page; label: string; icon: LucideIcon }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'kasir', label: 'Kasir POS', icon: ShoppingCart },
  { id: 'obat', label: 'Obat & Stok', icon: Pill },
  { id: 'pengadaan', label: 'Surat Pesanan Obat', icon: ClipboardList },
  { id: 'penerimaan', label: 'Penerimaan Obat', icon: PackageCheck },
  { id: 'pbf', label: 'PBF / Supplier', icon: Truck },
  { id: 'pasien', label: 'Pasien', icon: Users },
  { id: 'dokter', label: 'Dokter', icon: Stethoscope },
  { id: 'laporan', label: 'Laporan', icon: BarChart3 },
  { id: 'pengaturan', label: 'Pengaturan', icon: Settings },
  { id: 'pengguna', label: 'Manajemen Pengguna', icon: ShieldCheck },
];

const roleColors: Record<Role, string> = {
  superadmin: 'bg-purple-100 text-purple-700',
  owner: 'bg-teal-100 text-teal-700',
  assistant: 'bg-blue-100 text-blue-700',
  kasir: 'bg-gray-100 text-gray-600',
};

export default function Layout({ currentPage, onNavigate, children, pharmacyName, footerCopyright }: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { profile, signOut } = useAuth();

  const isPending = profile?.tenant?.status === 'pending';
  const isSuperAdmin = profile?.role === 'superadmin';

  // Filter nav items by role
  const visibleNavItems = profile
    ? navItems.filter(item => canAccess(profile.role, item.id))
    : navItems;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`flex flex-col bg-white border-r border-gray-200 transition-all duration-300 ${
          collapsed ? 'w-16' : 'w-64'
        } flex-shrink-0`}
      >
        {/* Logo */}
        <div className={`flex items-center gap-3 px-4 py-5 border-b border-gray-100 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-9 h-9 bg-teal-500 rounded-xl flex items-center justify-center flex-shrink-0">
            <Heart size={18} className="text-white" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <div className="font-bold text-gray-800 text-sm leading-tight">{pharmacyName}</div>
              <div className="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5">
                {isSuperAdmin ? 'Super Admin Panel' : 'Sistem POS Apotek'}
              </div>
            </div>
          )}
        </div>

        {/* Pending Notification */}
        {isPending && !collapsed && (
          <div className="mx-3 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-700">Menunggu Persetujuan</p>
                <p className="text-[11px] text-amber-600 mt-0.5 leading-relaxed">
                  Akun dan Apotek Anda sedang menunggu persetujuan Admin.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const active = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 mx-0 text-sm font-medium transition-all duration-150 group relative
                  ${active
                    ? 'bg-teal-50 text-teal-700 border-r-[3px] border-teal-500'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-r-[3px] border-transparent'
                  }
                  ${collapsed ? 'justify-center' : ''}
                `}
              >
                <Icon size={18} className={active ? 'text-teal-600' : 'text-gray-400 group-hover:text-gray-600'} />
                {!collapsed && <span>{item.label}</span>}
                {collapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                    {item.label}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* User info + logout */}
        <div className="border-t border-gray-100 p-3 space-y-2">
          {profile && !collapsed && (
            <div className="flex items-center gap-2.5 px-2 py-2 bg-gray-50 rounded-xl">
              <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">
                  {profile.full_name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="overflow-hidden flex-1">
                <p className="text-sm font-semibold text-gray-800 truncate">{profile.full_name}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${roleColors[profile.role]}`} />
                  <span className="text-[10px] text-gray-400">{ROLE_LABELS[profile.role]}</span>
                </div>
              </div>
            </div>
          )}
          {profile && collapsed && (
            <div className="flex justify-center">
              <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center">
                <span className="text-white text-xs font-bold">{profile.full_name.charAt(0).toUpperCase()}</span>
              </div>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 rounded-lg transition-all"
          >
            {collapsed
              ? <Menu size={18} className="mx-auto" />
              : <><ChevronLeft size={18} /><span>Tutup Menu</span></>
            }
          </button>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-all"
          >
            <LogOut size={18} className={collapsed ? 'mx-auto' : ''} />
            {!collapsed && <span>Keluar</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto flex flex-col">
        <div className="flex-1 overflow-auto">
          {children}
        </div>
        {/* Footer */}
        <footer className="border-t border-gray-100 bg-white px-6 py-3 text-center">
          <p className="text-xs text-gray-400">{footerCopyright}</p>
        </footer>
      </main>
    </div>
  );
}
