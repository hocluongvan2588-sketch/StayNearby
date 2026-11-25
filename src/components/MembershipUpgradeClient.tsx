'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Check, CheckCircle2, Loader2, Minus, Sparkles } from 'lucide-react';
import type { SessionUser } from '@/lib/auth/session';
import { usePreferences } from './PreferencesProvider';

export function MembershipUpgradeClient({ user }: { user: SessionUser | null }) {
  const { locale } = usePreferences();
  const isVi = locale === 'vi';

  const [vatTaxId, setVatTaxId] = useState(user?.vatTaxId ?? '');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(user?.membershipTier === 'premium');

  async function handleUpgrade(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      window.location.assign('/login?next=/membership');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/membership/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vatTaxId }),
      });
      const json = await res.json();
      if (json.ok) {
        setDone(true);
        window.location.reload();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-14 px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid items-center gap-8 rounded-3xl border border-[#E5DFD3] bg-[#0F392E] p-8 text-[#FAF8F3] lg:grid-cols-12 lacquer-shadow">
        <div className="space-y-4 lg:col-span-7">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-[#E6B87A]">
            <Sparkles className="h-3.5 w-3.5" />
            Nomad Pass · €99 / {isVi ? 'năm' : 'year'}
          </span>
          <h1 className="font-serif-display text-4xl font-semibold leading-tight sm:text-5xl">
            {isVi
              ? 'Đi nhiều hơn. Tiết kiệm 4% mỗi chuyến & miễn VAT doanh nghiệp.'
              : 'Travel deeper in Vietnam. Earn 4% back & unlock VAT-free business stays.'}
          </h1>
          <p className="text-sm leading-relaxed text-[#DCECE5]">
            {isVi
              ? 'Chưa tới €2/tuần — một lần đặt phòng 1 tháng đã hoàn lại trọn chi phí hội viên.'
              : 'Less than €2 a week. A single month-long stay in Da Nang or Saigon pays back your membership immediately.'}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 text-[#17221E] lg:col-span-5">
          {done ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-bold text-[#164E3F]">
                <CheckCircle2 className="h-5 w-5" />
                {isVi ? 'Bạn đang là thành viên Nomad Pass Premium' : 'Nomad Pass Premium Active'}
              </div>
              <p className="text-xs text-[#53635D]">
                {isVi
                  ? '4% Reward Credit và chế độ miễn VAT đã sẵn sàng khi bạn đặt phòng.'
                  : '4% Reward Credit and VAT-Free toggles are now active across BookingFlow stays.'}
              </p>
              <Link
                href="/stays"
                className="inline-block rounded-xl bg-[#164E3F] px-4 py-2.5 text-xs font-semibold text-white"
              >
                {isVi ? 'Tìm chỗ ở áp dụng ưu đãi →' : 'Browse Stays with 4% Credit →'}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleUpgrade} className="space-y-4">
              <div className="flex items-baseline justify-between">
                <span className="font-serif-display text-2xl font-bold text-[#164E3F]">€99 / year</span>
                <span className="rounded-full bg-[#E7F1EC] px-2.5 py-0.5 text-xs font-semibold text-[#164E3F]">
                  Demo Instant Activate
                </span>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#53635D]">
                  {isVi ? 'Mã số thuế doanh nghiệp / VAT ID (tuỳ chọn)' : 'Business VAT / Tax ID (optional for VAT-free)'}
                </label>
                <input
                  type="text"
                  value={vatTaxId}
                  onChange={(e) => setVatTaxId(e.target.value)}
                  placeholder="e.g. SE556012345601 or US-EIN"
                  className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#C25E28] px-5 py-3 text-sm font-semibold text-white hover:bg-[#ad5020]"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {user
                  ? isVi
                    ? 'Kích hoạt Nomad Pass ngay'
                    : 'Activate Nomad Pass Now'
                  : isVi
                    ? 'Đăng nhập để kích hoạt'
                    : 'Log In to Activate'}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Free vs Premium Table */}
      <div className="overflow-hidden rounded-3xl border border-[#E5DFD3] bg-white lacquer-shadow">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#FAF8F3] text-xs uppercase tracking-wider text-[#53635D]">
            <tr>
              <th className="px-6 py-4">{isVi ? 'Quyền lợi' : 'Benefit'}</th>
              <th className="px-6 py-4">Free Member (€0)</th>
              <th className="px-6 py-4 font-bold text-[#164E3F]">Nomad Pass (€99/yr)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5DFD3]">
            {[
              [isVi ? 'Đặt phòng BookingFlow & StayDirect™' : 'Instant BookingFlow & StayDirect™ access', true, true],
              [isVi ? 'Hoàn 4% Reward Credit mọi đặt phòng' : '4% Reward Credit back on BookingFlow stays', false, true],
              [isVi ? 'Miễn thuế VAT doanh nghiệp đủ điều kiện' : 'VAT-Free booking option with Tax ID', false, true],
              [isVi ? 'Thông báo sớm Deal giảm giá 1 tháng' : 'Early monthly deal drop alerts', false, true],
              [isVi ? 'Lưu danh sách & So sánh tốc độ Wi-Fi' : 'Saved Favourites & Side-by-Side Comparison', true, true],
              [isVi ? 'Công cụ theo dõi Visa Việt Nam 90 ngày' : 'Vietnam 90-Day e-Visa & Exemption Tracker', true, true],
            ].map(([label, free, prem]) => (
              <tr key={String(label)}>
                <td className="px-6 py-4 font-medium text-[#17221E]">{label}</td>
                <td className="px-6 py-4">
                  {free ? <Check className="h-4 w-4 text-[#164E3F]" /> : <Minus className="h-4 w-4 text-[#53635D]" />}
                </td>
                <td className="px-6 py-4 font-semibold text-[#164E3F]">
                  {prem ? <Check className="h-4 w-4 text-[#164E3F]" /> : <Minus className="h-4 w-4" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
