'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Check, CheckCircle2, Minus, Sparkles } from 'lucide-react';
import type { SessionUser } from '@/lib/auth/session';
import { NOMAD_PASS_PRICE_VND } from '@/lib/payment-types';
import { GatewayCheckoutPanel } from './GatewayCheckoutPanel';
import { usePreferences } from './PreferencesProvider';

export function MembershipUpgradeClient({ user }: { user: SessionUser | null }) {
  const { locale, premiumRewardPct } = usePreferences();
  const isVi = locale === 'vi';

  const [vatTaxId, setVatTaxId] = useState(user?.vatTaxId ?? '');
  const [done, setDone] = useState(user?.membershipTier === 'premium');

  return (
    <div className="mx-auto max-w-6xl space-y-12 px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid items-center gap-8 rounded-2xl border border-[#E5DFD3] bg-[#0F392E] p-8 text-[#FAF8F3] lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-[#E6B87A]">
            <Sparkles className="h-3.5 w-3.5" />
            {isVi ? 'Thẻ hội viên Nomad Pass, 99 EUR một năm' : 'Nomad Pass, €99 / year'}
          </span>
          <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
            {isVi
              ? `Nhận lại ${premiumRewardPct}% tiền thưởng và xuất hóa đơn miễn VAT.`
              : `Earn ${premiumRewardPct}% credit back and get VAT-free invoices.`}
          </h1>
          <p className="text-sm leading-relaxed text-[#DCECE5]">
            {isVi
              ? 'Chi phí dưới 2 EUR mỗi tuần. Chỉ một lần thuê nhà 1 tháng đã đủ bù lại toàn bộ phí hội viên cả năm.'
              : 'Costs under €2 a week. A single month-long booking earns back the entire annual fee.'}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 text-[#17221E] lg:col-span-5">
          {done ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-bold text-[#164E3F]">
                <CheckCircle2 className="h-5 w-5" />
                {isVi ? 'Tài khoản hội viên đang hoạt động' : 'Nomad Pass active'}
              </div>
              <p className="text-xs text-[#53635D]">
                {isVi
                  ? `Ưu đãi hoàn ${premiumRewardPct}% và miễn VAT tự động áp dụng khi bạn đặt phòng qua VietNomad.`
                  : `Your ${premiumRewardPct}% reward credit and VAT-free invoicing are ready to use at checkout.`}
              </p>
              <Link
                href="/stays"
                className="inline-block rounded-xl bg-[#164E3F] px-4 py-2.5 text-xs font-semibold text-white"
              >
                {isVi ? 'Tìm chỗ ở ngay' : 'Browse stays'}
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold text-[#164E3F]">€99 / {isVi ? 'năm' : 'year'}</span>
                <span className="rounded-full bg-[#E7F1EC] px-2.5 py-0.5 text-xs font-semibold text-[#164E3F]">
                  {isVi ? 'Kích hoạt ngay' : 'Instant activation'}
                </span>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#53635D]">
                  {isVi ? 'Mã số thuế công ty (nếu muốn miễn VAT)' : 'Business tax ID (optional for VAT-free stays)'}
                </label>
                <input
                  type="text"
                  value={vatTaxId}
                  onChange={(e) => setVatTaxId(e.target.value)}
                  placeholder="SE556012345601"
                  className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-sm"
                />
              </div>
              {user ? (
                <GatewayCheckoutPanel
                  purpose="membership_pass"
                  amountVnd={NOMAD_PASS_PRICE_VND}
                  vatTaxId={vatTaxId}
                  title={isVi ? 'Thanh toán thẻ hội viên 1 năm' : 'Pay 1-year Nomad Pass'}
                  subtitle={
                    isVi
                      ? `Nhận ngay ưu đãi hoàn ${premiumRewardPct}% tiền thưởng và xuất hóa đơn miễn VAT.`
                      : `Get ${premiumRewardPct}% stay credit and VAT-free invoices right away.`
                  }
                  onPaid={() => {
                    setDone(true);
                    window.location.reload();
                  }}
                />
              ) : (
                <Link
                  href="/login?next=/membership"
                  className="flex w-full items-center justify-center rounded-xl bg-[#C25E28] px-5 py-3 text-sm font-semibold text-white hover:bg-[#ad5020]"
                >
                  {isVi ? 'Đăng nhập để kích hoạt' : 'Log in to activate'}
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#E5DFD3] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#FAF8F3] text-xs uppercase tracking-wider text-[#53635D]">
            <tr>
              <th className="px-6 py-4">{isVi ? 'Quyền lợi' : 'Benefit'}</th>
              <th className="px-6 py-4">{isVi ? 'Tài khoản miễn phí' : 'Free account'}</th>
              <th className="px-6 py-4 font-bold text-[#164E3F]">{isVi ? 'Thẻ hội viên (€99/năm)' : 'Nomad Pass (€99/yr)'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5DFD3]">
            {[
              [isVi ? 'Đặt phòng trực tuyến' : 'Book stays online', true, true],
              [isVi ? `Hoàn ${premiumRewardPct}% tiền thưởng cho mỗi đặt phòng` : `Earn ${premiumRewardPct}% reward credit on VietNomad stays`, false, true],
              [isVi ? 'Xuất hóa đơn miễn VAT khi có mã số thuế' : 'VAT-free business invoicing with Tax ID', false, true],
              [isVi ? 'Nhận thông báo sớm chỗ ở giảm giá theo tháng' : 'Early access to monthly price drops', false, true],
              [isVi ? 'Lưu chỗ ở và so sánh tốc độ Wi-Fi' : 'Save stays and compare Wi-Fi speeds', true, true],
              [isVi ? 'Xem hướng dẫn Visa Việt Nam 90 ngày' : 'Vietnam 90-day e-Visa guide', true, true],
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
