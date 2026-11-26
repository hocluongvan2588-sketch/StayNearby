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
                ? 'Chỗ ở thuê theo tuần và tháng tại Việt Nam: lưu trú thoải mái, làm việc linh hoạt và hòa mình vào nhịp sống bản địa.'
                : 'Weekly and monthly stays in Vietnam for comfortable long stays, remote work, and local living.'}
            </p>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-[#E7F1EC]">
              {isVi ? 'Ở tối thiểu 7 đêm, không thu hoa hồng chủ nhà' : '7-night minimum, 0% host commission'}
            </div>
          </div>

          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#E6B87A]">
              {isVi ? 'Thành phố tại Việt Nam' : 'Cities in Vietnam'}
            </h4>
            <ul className="space-y-2 text-sm text-[#CDE0D9]">
              {destinations.map((d) => (
                <li key={d.id}>
                  <Link href={`/destinations/${d.slug}`} className="hover:text-white">
                    {isVi ? d.nameVi : d.nameEn} ({d.avgWifiMbps} Mbps)
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#E6B87A]">
              {isVi ? 'Dành cho khách thuê' : 'For Guests'}
            </h4>
            <ul className="space-y-2 text-sm text-[#CDE0D9]">
              <li>
                <Link href="/stays" className="hover:text-white">
                  {isVi ? 'Tìm chỗ ở từ 7 đêm' : 'Search stays (7+ nights)'}
                </Link>
              </li>
              <li>
                <Link href="/deals" className="hover:text-white">
                  {isVi ? 'Giá tốt theo tháng' : 'Monthly deals'}
                </Link>
              </li>
              <li>
                <Link href="/membership" className="hover:text-white">
                  {isVi ? 'Thẻ hội viên (Hoàn 4%)' : 'Nomad Pass (4% credit)'}
                </Link>
              </li>
              <li>
                <Link href="/community" className="hover:text-white">
                  {isVi ? 'Visa & Sự kiện gặp mặt' : 'Visa guide & Meetups'}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#E6B87A]">
              {isVi ? 'Dành cho chủ nhà' : 'For Hosts'}
            </h4>
            <ul className="space-y-2 text-sm text-[#CDE0D9]">
              <li>
                <Link href="/list-your-stay" className="hover:text-white">
                  {isVi ? 'Đăng cho thuê chỗ ở' : 'List a property'}
                </Link>
              </li>
              <li>
                <Link href="/host" className="hover:text-white">
                  {isVi ? 'Trang quản lý chủ nhà' : 'Host portal'}
                </Link>
              </li>
              <li>
                <Link href="/admin" className="hover:text-white">
                  {isVi ? 'Quản lý kiểm duyệt' : 'Admin verification'}
                </Link>
              </li>
              {demoEnabled && (
                <li>
                  <Link href="/admin/demo" className="hover:text-white">
                    {isVi ? 'Chuyển nhanh tài khoản mẫu' : 'Demo account switcher'}
                  </Link>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-white/15 pt-6 text-xs text-[#A8C4BB] sm:flex-row sm:items-center">
          <div>
            © {new Date().getFullYear()} VietNomad Stays.
          </div>
          <div>
            {isVi
              ? 'Trả phí giữ chỗ 12% online để khóa phòng. Trả tiền thuê trực tiếp cho chủ nhà khi nhận phòng.'
              : 'Pay the 12% booking fee online to reserve. Pay rent directly to your host at check-in.'}
          </div>
        </div>
      </div>
    </footer>
  );
}
