'use client';

import Link from 'next/link';
import type { DestinationSummary } from '@/modules/catalog';
import { usePreferences } from './PreferencesProvider';

export function SiteFooter({
  destinations,
}: {
  destinations: DestinationSummary[];
}) {
  const { locale, serviceFeePct, hostCommissionPct, premiumRewardPct, platformConfig } =
    usePreferences();
  const isVi = locale === 'vi';
  const minNights = platformConfig.defaultMinNights;

  return (
    <footer className="mt-20 border-t border-[#E5DFD3] bg-[#0F392E] text-[#FAF8F3]">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="space-y-3">
            <div className="font-serif-display text-2xl font-semibold tracking-tight">
              VietNomad Stays
            </div>
            <p className="text-sm leading-relaxed text-[#CDE0D9]">
              {isVi
                ? 'Chỗ ở thuê theo tuần và tháng khắp Việt Nam. Giá cả minh bạch, khu dân cư bản địa và không gian tiện nghi để ở, sống và làm việc.'
                : 'Weekly and monthly stays across Vietnam. Transparent pricing, local neighborhoods, and comfortable spaces to live, explore, and work.'}
            </p>
            <p className="pt-1 text-xs text-[#A8C4BB]">
              {isVi
                ? `Lưu trú từ ${minNights} đêm · ${hostCommissionPct}% hoa hồng chủ nhà`
                : `${minNights}-night minimum · ${hostCommissionPct}% host commission`}
            </p>
          </div>

          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#E6B87A]">
              {isVi ? 'Thành phố tại Việt Nam' : 'Cities in Vietnam'}
            </h4>
            <ul className="space-y-2.5 text-sm text-[#CDE0D9]">
              {destinations.map((d) => (
                <li key={d.id}>
                  <Link href={`/destinations/${d.slug}`} className="transition hover:text-white">
                    {isVi ? d.nameVi : d.nameEn}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#E6B87A]">
              {isVi ? 'Dành cho khách thuê' : 'For Guests'}
            </h4>
            <ul className="space-y-2.5 text-sm text-[#CDE0D9]">
              <li>
                <Link href="/stays" className="transition hover:text-white">
                  {isVi ? `Tìm chỗ ở từ ${minNights} đêm` : `Search stays (${minNights}+ nights)`}
                </Link>
              </li>
              <li>
                <Link href="/deals" className="transition hover:text-white">
                  {isVi ? 'Ưu đãi theo tháng' : 'Monthly deals'}
                </Link>
              </li>
              <li>
                <Link href="/guides" className="transition hover:text-white">
                  {isVi ? 'Cẩm nang địa phương' : 'City & living guides'}
                </Link>
              </li>
              <li>
                <Link href="/membership" className="transition hover:text-white">
                  {isVi ? `Thẻ hội viên (Hoàn ${premiumRewardPct}%)` : `Membership (${premiumRewardPct}% credit)`}
                </Link>
              </li>
              <li>
                <Link href="/community" className="transition hover:text-white">
                  {isVi ? 'Visa & Sự kiện gặp mặt' : 'Visa guide & meetups'}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#E6B87A]">
              {isVi ? 'Dành cho chủ nhà' : 'For Hosts'}
            </h4>
            <ul className="space-y-2.5 text-sm text-[#CDE0D9]">
              <li>
                <Link href="/list-your-stay" className="transition hover:text-white">
                  {isVi ? 'Đăng cho thuê chỗ ở' : 'List a property'}
                </Link>
              </li>
              <li>
                <Link href="/host" className="transition hover:text-white">
                  {isVi ? 'Kênh quản lý chủ nhà' : 'Host Console'}
                </Link>
              </li>
              <li>
                <Link href="/admin" className="transition hover:text-white">
                  {isVi ? 'Trang quản trị' : 'Admin portal'}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-white/15 pt-6 text-xs text-[#A8C4BB] sm:flex-row sm:items-center">
          <div>© {new Date().getFullYear()} VietNomad Stays.</div>
          <div>
            {isVi
              ? `Thanh toán ${serviceFeePct}% phí dịch vụ online để giữ phòng. Trả tiền thuê trực tiếp cho chủ nhà khi nhận phòng.`
              : `Pay the ${serviceFeePct}% service fee online to reserve. Pay rent directly to your host at check-in.`}
          </div>
        </div>
      </div>
    </footer>
  );
}
