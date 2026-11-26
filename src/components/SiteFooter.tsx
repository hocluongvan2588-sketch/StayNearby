'use client';

import Link from 'next/link';
import type { DestinationSummary } from '@/modules/catalog';
import { usePreferences } from './PreferencesProvider';

export function SiteFooter({
  destinations,
  demoEnabled = false,
}: {
  destinations: DestinationSummary[];
  demoEnabled?: boolean;
}) {
  const { locale } = usePreferences();
  const isVi = locale === 'vi';

  return (
    <footer className="mt-20 border-t border-[#E5DFD3] bg-[#0F392E] text-[#FAF8F3]">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="space-y-3">
            <div className="font-serif-display text-2xl font-semibold">VietNomad Stays</div>
            <p className="text-sm leading-relaxed text-[#CDE0D9]">
              {isVi
                ? 'Nền tảng lưu trú dài ngày chuẩn quốc tế dành cho người làm việc từ xa tại Việt Nam: Wi-Fi kiểm định thực tế, giá trọn gói 7–30+ đêm và không gian làm việc tiêu chuẩn.'
                : 'Vietnam’s work-ready extended-stay booking platform for digital nomads. Independently tested Wi-Fi, upfront weekly & monthly rates, workspaces, and full kitchens.'}
            </p>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-[#E7F1EC]">
              7+ Nights Minimum · 0% Host Commission
            </div>
          </div>

          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#E6B87A]">
              {isVi ? 'Điểm đến Việt Nam' : 'Vietnam Destinations'}
            </h4>
            <ul className="space-y-2 text-sm text-[#CDE0D9]">
              {destinations.map((d) => (
                <li key={d.id}>
                  <Link href={`/destinations/${d.slug}`} className="hover:text-white">
                    {isVi ? d.nameVi : d.nameEn} · {d.avgWifiMbps} Mbps
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#E6B87A]">
              {isVi ? 'Cách vận hành' : 'Nomad Platform'}
            </h4>
            <ul className="space-y-2 text-sm text-[#CDE0D9]">
              <li>
                <Link href="/stays" className="hover:text-white">
                  {isVi ? 'Tìm chỗ ở 7–30+ đêm' : 'Search Live Inventory'}
                </Link>
              </li>
              <li>
                <Link href="/deals" className="hover:text-white">
                  {isVi ? 'Ưu đãi tháng giá tốt' : 'Monthly Long-Stay Deals'}
                </Link>
              </li>
              <li>
                <Link href="/membership" className="hover:text-white">
                  {isVi ? 'Nomad Pass (Hoàn 4% & Miễn VAT)' : 'Nomad Pass (4% Credit & VAT-Free)'}
                </Link>
              </li>
              <li>
                <Link href="/community" className="hover:text-white">
                  {isVi ? 'Visa Việt Nam & Brunch Club' : 'Vietnam Visa & Brunch Club'}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#E6B87A]">
              {isVi ? 'Dành cho Đối tác & Quản trị' : 'Partners & Operations'}
            </h4>
            <ul className="space-y-2 text-sm text-[#CDE0D9]">
              <li>
                <Link href="/list-your-stay" className="hover:text-white">
                  {isVi ? 'BookingFlow vs StayDirect™' : 'List Your Stay (BookingFlow / StayDirect™)'}
                </Link>
              </li>
              <li>
                <Link href="/host" className="hover:text-white">
                  {isVi ? 'Cổng Chủ nhà & Ví 1%' : 'Host Console & Ad Wallet'}
                </Link>
              </li>
              <li>
                <Link href="/admin" className="hover:text-white">
                  {isVi ? 'Kiểm định & CRM Quản trị' : 'Admin Verification & CRM'}
                </Link>
              </li>
              {demoEnabled && (
                <li>
                  <Link href="/admin/demo" className="hover:text-white">
                    {isVi ? 'Tài khoản Demo 1 chạm' : 'Demo Accounts & Switch Role'}
                  </Link>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-white/15 pt-6 text-xs text-[#A8C4BB] sm:flex-row sm:items-center">
          <div>
            © {new Date().getFullYear()} VietNomad Stays · Crafted in Vietnam for global remote workers.
          </div>
          <div>
            {isVi
              ? 'Chỉ trả 12% giữ chỗ online · Phần còn lại thanh toán trực tiếp cho chủ nhà khi nhận phòng.'
              : 'Pay 12% today to reserve · Pay host directly at check-in · 9 global currencies supported.'}
          </div>
        </div>
      </div>
    </footer>
  );
}
