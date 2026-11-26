'use client';

import Link from 'next/link';
import {
  BookOpen,
  CalendarClock,
  HelpCircle,
  Mail,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { usePreferences } from '@/components/PreferencesProvider';

export function HostHelpClient() {
  const { locale, serviceFeePct, hostCommissionPct } = usePreferences();
  const isVi = locale === 'vi';

  const guides = [
    {
      icon: Wallet,
      title: isVi
        ? `Mô hình thanh toán ${hostCommissionPct}% hoa hồng chủ nhà hoạt động ra sao?`
        : `How does the ${hostCommissionPct}% host commission model work?`,
      body: isVi
        ? `Khách thanh toán ${serviceFeePct}% phí dịch vụ đặt phòng trực tuyến cho VietNomad Stays để khóa lịch và xác thực đặt chỗ. Khi khách tới nhận phòng, bạn trực tiếp thu 100% giá phòng (chuyển khoản VietQR, thẻ hoặc tiền mặt) mà không bị nền tảng khấu trừ hoa hồng bất ngờ. Sau khi thu tiền, bạn vào mục Đặt phòng hoặc Tổng quan hôm nay bấm "Xác nhận nhận phòng & đã thu tiền".`
        : `Guests pay a ${serviceFeePct}% booking service fee online to VietNomad Stays to lock dates. Upon arrival, you collect 100% of your room rate directly from the guest (bank transfer, QR, card, or cash) with ${hostCommissionPct}% host commission. Once collected, click "Confirm check-in & rent received" inside Reservations or Today’s queue.`,
    },
    {
      icon: CalendarClock,
      title: isVi
        ? 'Cách kết hợp Giá từng ngày và Giá gói 7/14/21/30 đêm'
        : 'How do daily custom rates combine with 7/14/21/30-night packages?',
      body: isVi
        ? 'Khi bạn đặt giá tùy chỉnh cho các ngày lễ hoặc cuối tuần trong Lịch, đúng những đêm đó sẽ tính theo mức giá tùy chỉnh bạn nhập; các đêm còn lại trong kỳ ở tự động lấy mức giá gói 7/14/21/30 đêm tương ứng để luôn bảo đảm tối ưu doanh thu dài ngày.'
        : 'When you override specific dates (holidays or peak weekends) in Calendar, only those specific nights use your custom nightly rate. Unoverridden nights in the stay continue to use your 7/14/21/30-night long-stay package pricing automatically.',
    },
    {
      icon: RefreshCw,
      title: isVi
        ? 'Đồng bộ lịch iCal 2 chiều chống trùng phòng'
        : '2-way iCal sync & double-booking prevention',
      body: isVi
        ? 'Trong mục Lịch & Giá bán phòng, sao chép link xuất iCal (.ics) của VietNomad Stays để dán vào Airbnb/Booking.com, đồng thời dán link iCal từ kênh ngoài vào ô Nhập iCal. Hệ thống tự động khóa các đêm đã có khách ở kênh ngoài và sử dụng khóa giao dịch cơ sở dữ liệu để không bao giờ nhận trùng 2 đơn cùng ngày.'
        : 'Copy your RFC 5545 export link from Calendar into Airbnb or Booking.com, and paste your external iCal link into the Import box. VietNomad Stays blocks imported busy dates and enforces database-level night locks to eliminate double bookings.',
    },
    {
      icon: ShieldCheck,
      title: isVi
        ? 'Quy trình duyệt đơn khi tắt Đặt phòng tức thì'
        : 'Pending approval workflow (when Instant Book is off)',
      body: isVi
        ? `Nếu bạn tắt Instant Book trong phần Chỉnh sửa chỗ ở, đơn đặt mới sẽ giữ lịch tạm thời ở trạng thái Chờ duyệt. Khi bạn chấp nhận, lịch chuyển sang Đã khóa; nếu bạn từ chối, hệ thống tự động hoàn lại ${serviceFeePct}% phí đặt phòng cho khách và mở lại ngày trống.`
        : `When Instant Book is turned off for a property, new bookings arrive in Pending Host Approval. Approving confirms the stay; declining automatically releases the calendar dates and refunds the guest’s ${serviceFeePct}% booking fee.`,
    },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-serif-display text-2xl font-semibold text-[#17221E]">
          {isVi ? 'Trung tâm Trợ giúp Chủ nhà' : 'Host Help Center'}
        </h1>
        <p className="mt-0.5 text-xs text-[#53635D]">
          {isVi
            ? 'Hướng dẫn vận hành chuẩn, đồng bộ lịch đa kênh và giải đáp chính sách thanh toán.'
            : 'Operational guides for pricing overrides, iCal syncing, and direct check-in payouts.'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {guides.map((g) => {
          const Icon = g.icon;
          return (
            <article
              key={g.title}
              className="rounded-xl border border-[#E5DFD3] bg-white p-5 space-y-2"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-[#17221E]">
                <Icon className="h-4 w-4 shrink-0 text-[#164E3F]" strokeWidth={1.75} />
                <span>{g.title}</span>
              </div>
              <p className="text-xs leading-relaxed text-[#53635D]">{g.body}</p>
            </article>
          );
        })}
      </div>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#E5DFD3] bg-white p-5 text-xs">
        <div className="flex items-start gap-3">
          <HelpCircle className="mt-0.5 h-5 w-5 text-[#164E3F]" />
          <div>
            <div className="text-sm font-semibold text-[#17221E]">
              {isVi ? 'Cần hỗ trợ trực tiếp về đặt phòng hoặc thanh toán?' : 'Need direct support for a booking or payout?'}
            </div>
            <p className="mt-0.5 text-[#53635D]">
              {isVi
                ? 'Đội ngũ vận hành VietNomad Stays hỗ trợ chủ nhà từ 08:00 – 22:00 hằng ngày.'
                : 'VietNomad Stays Partner Operations is available daily from 08:00 to 22:00 ICT.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/host/messages"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3.5 py-2 font-semibold text-[#17221E] hover:border-[#164E3F]"
          >
            <BookOpen className="h-3.5 w-3.5" />
            {isVi ? 'Mở Hộp thư' : 'Open Inbox'}
          </Link>
          <a
            href="mailto:hosts@vietnomadstays.vn"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#164E3F] px-3.5 py-2 font-semibold text-white hover:bg-[#0F392E]"
          >
            <Mail className="h-3.5 w-3.5" />
            hosts@vietnomadstays.vn
          </a>
        </div>
      </section>
    </div>
  );
}
