'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { usePreferences } from './PreferencesProvider';

export interface DemoAccountOption {
  key: string;
  email: string;
  password: string;
  role: 'nomad' | 'host' | 'admin';
  labelEn: string;
  labelVi: string;
}

export function LoginClient({
  nextPath,
  demoAccounts,
}: {
  nextPath: string;
  demoAccounts: DemoAccountOption[];
}) {
  const { locale } = usePreferences();
  const isVi = locale === 'vi';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function doLogin(targetEmail: string, targetPassword: string) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, password: targetPassword }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error?.message ?? (isVi ? 'Email hoặc mật khẩu chưa đúng.' : 'Invalid email or password.'));
        return;
      }
      const fallback =
        json.user.role === 'admin'
          ? '/admin'
          : json.user.role === 'host'
            ? '/host'
            : '/dashboard';
      window.location.assign(nextPath || fallback);
    } catch {
      setError(isVi ? 'Lỗi kết nối. Vui lòng thử lại.' : 'Network error. Please retry.');
    } finally {
      setLoading(false);
    }
  }

  const hasDemos = demoAccounts.length > 0;

  return (
    <div className={`mx-auto px-4 py-12 sm:px-6 lg:px-8 ${hasDemos ? 'max-w-4xl' : 'max-w-lg'}`}>
      <div
        className={`grid gap-8 rounded-2xl border border-[#E5DFD3] bg-white p-6 sm:p-10 ${
          hasDemos ? 'lg:grid-cols-12' : ''
        }`}
      >
        <div className={`space-y-5 ${hasDemos ? 'lg:col-span-6' : ''}`}>
          <div>
            <span className="text-xs font-semibold text-[#C25E28]">
              {isVi ? 'Tài khoản VietNomad' : 'VietNomad Account'}
            </span>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#17221E]">
              {isVi ? 'Đăng nhập' : 'Log in'}
            </h1>
            <p className="mt-1 text-sm text-[#53635D]">
              {isVi
                ? 'Xem lịch đặt phòng, tiền thưởng hoàn lại hoặc trang quản lý nhà.'
                : 'Manage your bookings, reward credit, or host listings.'}
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              doLogin(email, password);
            }}
            className="space-y-4"
          >
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#53635D]">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com"
                className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3.5 py-2.5 text-sm outline-none focus:border-[#164E3F]"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[#53635D]">
                {isVi ? 'Mật khẩu' : 'Password'}
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3.5 py-2.5 text-sm outline-none focus:border-[#164E3F]"
              />
            </div>

            {error && (
              <div className="rounded-xl bg-[#FAEDE5] p-3 text-xs font-medium text-[#C25E28]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#164E3F] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0F392E] disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isVi ? 'Đăng nhập' : 'Log in'}
            </button>
          </form>

          <p className="text-xs text-[#53635D]">
            {isVi ? 'Chưa có tài khoản?' : 'New here?'}{' '}
            <Link href="/register" className="font-semibold text-[#164E3F] hover:underline">
              {isVi ? 'Tạo tài khoản miễn phí' : 'Create a free account'}
            </Link>
          </p>
        </div>

        {hasDemos && (
          <div className="space-y-3 rounded-2xl border border-[#E5DFD3] bg-[#FAF8F3] p-5 lg:col-span-6">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#A67C2E]">
              <Sparkles className="h-4 w-4" />
              {isVi ? 'Đăng nhập nhanh tài khoản mẫu' : 'Quick demo login'}
            </div>
            <p className="text-xs text-[#53635D]">
              {isVi
                ? 'Chọn một tài khoản bên dưới để dùng thử tính năng cho khách thuê, chủ nhà và quản trị viên:'
                : 'Choose a sample account below to test guest, host, and admin workflows:'}
            </p>

            <div className="space-y-2 pt-1">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.key}
                  type="button"
                  disabled={loading}
                  onClick={() => doLogin(acc.email, acc.password)}
                  className="flex w-full items-center justify-between rounded-xl border border-[#E5DFD3] bg-white px-3.5 py-2.5 text-left transition hover:border-[#164E3F] hover:bg-[#E7F1EC]/40"
                >
                  <div>
                    <div className="text-xs font-bold text-[#17221E]">
                      {isVi ? acc.labelVi : acc.labelEn}
                    </div>
                    <div className="text-[11px] text-[#53635D]">{acc.email}</div>
                  </div>
                  <span className="rounded-lg bg-[#164E3F] px-2.5 py-1 text-[11px] font-semibold text-white">
                    {isVi ? 'Chọn' : 'Select'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function RegisterClient() {
  const { locale } = usePreferences();
  const isVi = locale === 'vi';

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nationality, setNationality] = useState('United States');
  const [role, setRole] = useState<'nomad' | 'host'>('nomad');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, password, nationality, role }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error?.message ?? (isVi ? 'Không thể tạo tài khoản.' : 'Could not register.'));
        return;
      }
      window.location.assign(role === 'host' ? '/list-your-stay' : '/dashboard');
    } catch {
      setError(isVi ? 'Lỗi kết nối. Vui lòng thử lại.' : 'Network error. Please retry.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <div className="space-y-6 rounded-2xl border border-[#E5DFD3] bg-white p-8">
        <div>
          <span className="text-xs font-semibold text-[#164E3F]">
            {isVi ? 'Đăng ký miễn phí' : 'Sign up free'}
          </span>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#17221E]">
            {isVi ? 'Tạo tài khoản VietNomad' : 'Create your VietNomad account'}
          </h1>
          <p className="mt-1 text-sm text-[#53635D]">
            {isVi
              ? 'Đặt phòng trực tiếp với chủ nhà, lưu chỗ ở yêu thích và đăng ký tham gia sự kiện.'
              : 'Book stays directly, save favorites, and RSVP to local events.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#53635D]">
              {isVi ? 'Họ và tên' : 'Full name'}
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3.5 py-2.5 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#53635D]">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3.5 py-2.5 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#53635D]">
                {isVi ? 'Quốc tịch' : 'Nationality'}
              </label>
              <input
                type="text"
                value={nationality}
                onChange={(e) => setNationality(e.target.value)}
                className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#53635D]">
                {isVi ? 'Loại tài khoản' : 'Account type'}
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'nomad' | 'host')}
                className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2.5 text-sm font-medium"
              >
                <option value="nomad">{isVi ? 'Khách thuê phòng' : 'Guest'}</option>
                <option value="host">{isVi ? 'Chủ nhà cho thuê' : 'Host'}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#53635D]">
              {isVi ? 'Mật khẩu (tối thiểu 8 ký tự)' : 'Password (8+ characters)'}
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3.5 py-2.5 text-sm"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-[#FAEDE5] p-3 text-xs font-medium text-[#C25E28]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#164E3F] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0F392E]"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isVi ? 'Tạo tài khoản' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
}
