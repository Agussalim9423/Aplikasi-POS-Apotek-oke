import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Heart, Lock, Mail, Eye, EyeOff, LogIn, AlertCircle, User, Building2, MapPin, CheckCircle2, ArrowLeft } from 'lucide-react';

export default function Login() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // Login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Register state
  const [ownerName, setOwnerName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [pharmacyName, setPharmacyName] = useState('');
  const [pharmacyAddress, setPharmacyAddress] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: signInError } = await signIn(email, password);
    if (signInError) {
      setError(signInError);
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!ownerName.trim() || !regEmail.trim() || !regPassword.trim() || !pharmacyName.trim() || !pharmacyAddress.trim()) {
      setError('Semua field wajib diisi');
      return;
    }

    setLoading(true);
    const { error: signUpError } = await signUp({
      ownerName: ownerName.trim(),
      email: regEmail.trim(),
      password: regPassword.trim(),
      pharmacyName: pharmacyName.trim(),
      pharmacyAddress: pharmacyAddress.trim(),
    });

    if (signUpError) {
      setError(signUpError);
    } else {
      setSuccess('Pendaftaran berhasil! Akun dan Apotek Anda sedang menunggu persetujuan Admin.');
      // Reset form
      setOwnerName('');
      setRegEmail('');
      setRegPassword('');
      setPharmacyName('');
      setPharmacyAddress('');
    }
    setLoading(false);
  }

  function switchMode(newMode: 'login' | 'register') {
    setMode(newMode);
    setError(null);
    setSuccess(null);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 via-white to-blue-50 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-teal-500 rounded-2xl shadow-lg shadow-teal-500/30 mb-4">
            <Heart size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Sistem POS Apotek</h1>
          <p className="text-sm text-gray-500 mt-1">Multi-Apotek Cloud</p>
        </div>

        {/* Login Card */}
        {mode === 'login' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xl shadow-gray-200/50 p-6">
            <h2 className="font-bold text-gray-800 mb-1">Masuk ke Akun</h2>
            <p className="text-sm text-gray-400 mb-5">Silakan login untuk melanjutkan</p>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm rounded-xl px-3 py-2.5 mb-4">
                <AlertCircle size={16} className="flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500">Email</label>
                <div className="relative mt-1">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="nama@apotek.id"
                    required
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500">Password</label>
                <div className="relative mt-1">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-9 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <LogIn size={16} />}
                {loading ? 'Memproses...' : 'Masuk'}
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-500">Belum punya akun apotek?</p>
              <button
                onClick={() => switchMode('register')}
                className="mt-1.5 text-sm font-semibold text-teal-600 hover:text-teal-700"
              >
                Daftar Apotek Baru
              </button>
            </div>
          </div>
        )}

        {/* Register Card */}
        {mode === 'register' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xl shadow-gray-200/50 p-6">
            <h2 className="font-bold text-gray-800 mb-1">Daftar Apotek Baru</h2>
            <p className="text-sm text-gray-400 mb-5">Buat akun dan daftarkan apotek Anda</p>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm rounded-xl px-3 py-2.5 mb-4">
                <AlertCircle size={16} className="flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="flex items-start gap-2 bg-green-50 text-green-700 text-sm rounded-xl px-3 py-2.5 mb-4">
                <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" />
                <span>{success}</span>
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500">Nama Pemilik</label>
                <div className="relative mt-1">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={ownerName}
                    onChange={e => setOwnerName(e.target.value)}
                    placeholder="Nama lengkap pemilik"
                    required
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500">Email</label>
                <div className="relative mt-1">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={regEmail}
                    onChange={e => setRegEmail(e.target.value)}
                    placeholder="nama@apotek.id"
                    required
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500">Password</label>
                <div className="relative mt-1">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-9 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Informasi Apotek</p>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500">Nama Apotek</label>
                <div className="relative mt-1">
                  <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={pharmacyName}
                    onChange={e => setPharmacyName(e.target.value)}
                    placeholder="Nama apotek Anda"
                    required
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500">Alamat Apotek</label>
                <div className="relative mt-1">
                  <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={pharmacyAddress}
                    onChange={e => setPharmacyAddress(e.target.value)}
                    placeholder="Alamat lengkap apotek"
                    required
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Building2 size={16} />}
                {loading ? 'Memproses...' : 'Daftar Apotek'}
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-gray-100 text-center">
              <button
                onClick={() => switchMode('login')}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-600 hover:text-teal-700"
              >
                <ArrowLeft size={14} /> Kembali ke Login
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">
          © PT. Digital Salim Jaya Indonesia · Sistem POS Apotek
        </p>
      </div>
    </div>
  );
}
