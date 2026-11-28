import Link from 'next/link';
import type { Metadata } from 'next';
import { getServerPreferences } from '@/lib/preferences';
import { formatShortDateLabel } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Visa Việt Nam | VietNomad Stays',
  description:
    'Liên kết chính thức để kiểm tra quy định nhập cảnh Việt Nam, e-Visa và thông tin xuất nhập cảnh mới nhất.',
};

/**
 * Visa Việt Nam (Community spec §9, approved: links-only). We do not publish
 * per-nationality rules we cannot verify — this page points at the official
 * sources instead. Destination-level visa notes stay on destination pages
 * (admin-managed data, unchanged).
 */
const LAST_REVIEWED = '2026-11-28';

const OFFICIAL_SOURCES = [
  {
    href: 'https://evisa.xuatnhapcanh.gov.vn',
    titleEn: 'Official e-Visa application portal',
    titleVi: 'Cổng thông tin e-Visa chính thức',
    noteEn: 'Apply for 90-day single or multiple-entry e-Visas online.',
    noteVi: 'Đăng ký e-Visa90 ngày (1 lần hoặc nhiều lần) trực tuyến.',
  },
  {
    href: 'https://xuatnhapcanh.gov.vn',
    titleEn: 'Vietnam Immigration Department',
    titleVi: 'Cục Quản lý xuất nhập cảnh',
    noteEn: 'Entry/exit rules, notices, and official policy updates.',
    noteVi: 'Quy định xuất nhập cảnh, thông báo và chính sách mới nhất.',
  },
];

export default async function VisaGuidePage() {
  const prefs = await getServerPreferences();
  const isVi = prefs.locale === 'vi';

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <Link href="/guides" className="text-sm font-semibold text-[#164E3F] hover:underline">
        {isVi ? '← Cẩm nang' : '← Guides'}
      </Link>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-[#17221E] sm:text-4xl">
        {isVi ? 'Visa Việt Nam' : 'Vietnam visa'}
      </h1>

      <p className="mt-4 text-sm leading-relaxed text-[#53635D]">
        {isVi
          ? 'Quy định nhập cảnh thay đổi theo quốc gia và theo thời điểm. VietNomad không công bố thời hạn miễn thị thực theo từng hộ chiếu khi chưa kiểm chứng — hãy kiểm tra tại nguồn chính thức trước khi đặt chuyến đi.'
          : 'Entry rules differ by nationality and change over time. VietNomad does not publish per-passport windows we cannot verify — check the official sources before you book.'}
      </p>

      <ul className="mt-8 space-y-6">
        {OFFICIAL_SOURCES.map((s) => (
          <li key={s.href}>
            <a
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group block"
            >
              <span className="text-base font-semibold text-[#17221E] group-hover:text-[#164E3F]">
                {isVi ? s.titleVi : s.titleEn}
              </span>
              <span className="mt-1 block text-sm text-[#53635D]">
                {isVi ? s.noteVi : s.noteEn}
              </span>
              <span className="mt-1 block break-all text-xs text-[#164E3F]">{s.href}</span>
            </a>
          </li>
        ))}
      </ul>

      <div className="mt-10 border-t border-[#E5DFD3] pt-5 text-xs text-[#53635D]">
        <p>
          {isVi ? 'Nguồn thông tin chính thức' : 'Official sources'} ·{' '}
          {isVi ? 'Cập nhật' : 'Reviewed'}:{' '}
          {formatShortDateLabel(LAST_REVIEWED, prefs.locale)}
        </p>
        <p className="mt-2">
          {isVi
            ? 'Thông tin về visa theo từng điểm đến (nếu có) được hiển thị trên trang điểm đến tương ứng.'
            : 'Destination-level visa notes, where available, appear on each destination page.'}
        </p>
      </div>
    </div>
  );
}
