import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Coffee,
  Laptop,
  Sparkles,
  Utensils,
  Wifi,
  Zap,
} from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/session';
import { dbQuery } from '@/lib/db';
import { formatMoneyFromVnd } from '@/lib/i18n';
import { getServerPreferences } from '@/lib/preferences';
import {
  getCommunityAndMarketplaceData,
  getDestinations,
  getLifestyles,
  searchStays,
} from '@/modules/catalog';
import { AiConciergeBox } from '@/components/AiConciergeBox';
import { HomeSearchBar } from '@/components/HomeSearchBar';
import { StayCard } from '@/components/StayCard';
import { VietnamMap } from '@/components/VietnamMap';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [prefs, user, destinations, lifestyles, stays, community] = await Promise.all([
    getServerPreferences(),
    getCurrentUser(),
    getDestinations(),
    getLifestyles(),
    searchStays({ sort: 'wifi_desc' }),
    getCommunityAndMarketplaceData(),
  ]);

  let savedIds = new Set<string>();
  if (user) {
    const sv = await dbQuery<{ stay_id: string }>(
      'SELECT stay_id FROM saved_stays WHERE user_id = $1',
      [user.id]
    );
    savedIds = new Set(sv.rows.map((r) => r.stay_id));
  }

  const isVi = prefs.locale === 'vi';
  const currency = prefs.currency;

  const dealsStays = [...stays]
    .filter((s) => s.dealSavingsPct > 0)
    .sort((a, b) => b.dealSavingsPct - a.dealSavingsPct)
    .slice(0, 4);

  const stayLongerProof = [...stays]
    .sort((a, b) => b.stayLongerSavingsPct - a.stayLongerSavingsPct)
    .slice(0, 4);

  const faqs = isVi
    ? [
        {
          q: 'Mô hình thanh toán phí đặt chỗ & xác minh 12% hoạt động thế nào?',
          a: 'Với mọi đặt phòng BookingFlow, bạn chỉ thanh toán Phí Đặt chỗ & Bảo chứng Kiểm định 12% (tính trên giá thuê của chủ nhà) qua cổng online để khóa lịch, mở địa chỉ thật và nhận chứng nhận Wi-Fi. Toàn bộ 100% tiền thuê nhà gốc bạn thanh toán trực tiếp cho chủ nhà khi nhận phòng.',
        },
        {
          q: 'Nếu tốc độ Wi-Fi thực tế lúc check-in không đạt chứng nhận thì sao?',
          a: 'Bạn được bảo vệ bởi Cam kết Hoàn 100% Phí Giữ Chỗ (Wi-Fi Guarantee). Nếu kiểm tra lúc nhận phòng thấy Wi-Fi hoặc góc làm việc không đúng chứng nhận, VietNomad hoàn trả 100% phí 12% ngay lập tức và hỗ trợ chuyển sang căn khác cùng khu vực.',
        },
        {
          q: 'Thời gian đặt phòng tối thiểu là bao lâu?',
          a: 'Tối thiểu 7 đêm (1 tuần). Nền tảng được thiết kế riêng cho người làm việc từ xa lưu trú theo tuần và tháng (7, 14, 21 hoặc 30 đêm + thêm ngày lẻ linh hoạt), không bán phòng nghỉ ngắn 1–2 đêm.',
        },
        {
          q: 'BookingFlow (0% hoa hồng) và StayDirect™ (1% referral) khác nhau thế nào?',
          a: 'BookingFlow khóa phòng tức thì với 12% phí đặt chỗ online (Chủ nhà nhận đủ 100% giá net khi bạn check-in, 0% hoa hồng). StayDirect™ chuyển thành viên sang website của chủ nhà ở mức giá bán lẻ 0% phí nền tảng.',
        },
      ]
    : [
        {
          q: 'How does the 12% online booking fee & pay-at-check-in model work?',
          a: 'For BookingFlow stays, you only pay the 12% Booking & Verification Fee online today to lock your dates and receive the exact address. You pay the remaining host net rate directly to the host upon check-in — never risking 100% of monthly rent upfront.',
        },
        {
          q: 'What happens if the Wi-Fi speed at check-in does not match the listing?',
          a: 'Every BookingFlow reservation includes our 100% Booking Fee Refund Guarantee. If on-site Wi-Fi speeds or workspace setup fail to match the verified certificate at check-in, you get a 100% refund of your online booking fee plus concierge relocation help.',
        },
        {
          q: 'What is the minimum stay?',
          a: '7 nights (1 week). VietNomad is built for remote workers staying 1–4+ weeks with standardized 7, 14, 21, and 30-night packages plus flexible extra nights — never weekend tourist room flips.',
        },
        {
          q: 'How do BookingFlow and StayDirect™ differ?',
          a: 'BookingFlow provides instant confirmation by paying just the 12% reservation fee online (0% commission deducted from host net rate at check-in). StayDirect™ sends logged-in members directly to the host’s own booking engine with 0% traveler markup.',
        },
      ];

  return (
    <div className="space-y-20 pb-10">
      {/* 1. Contemporary Vietnamese Hero + Search Widget */}
      <section className="relative overflow-hidden border-b border-[#E5DFD3] bg-[#0F392E]">
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/hero-vietnam-workation.jpg"
            alt="Vietnam Oceanfront Workation Terrace"
            className="h-full w-full object-cover opacity-55"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0F392E]/75 via-[#0F392E]/55 to-[#0F392E]/90" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 pb-14 pt-14 sm:px-6 sm:pt-20 lg:px-8">
          <div className="max-w-3xl space-y-5 text-[#FAF8F3]">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-medium backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-[#68D391]" />
              {isVi
                ? 'Nền tảng lưu trú dài ngày chuẩn Digital Nomad tại Việt Nam'
                : 'Vietnam’s Work-Ready Extended Stay Platform for Digital Nomads'}
            </div>

            <h1 className="font-serif-display text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
              {isVi
                ? 'Sống sâu tại Việt Nam. Làm việc vững vàng khắp thế giới.'
                : 'Digital nomad stays across Vietnam — built for real remote work.'}
            </h1>

            <p className="max-w-2xl text-base leading-relaxed text-[#DCECE5] sm:text-lg">
              {isVi
                ? 'Chỉ đặt cọc 12% online để khóa phòng (trả phần còn lại trực tiếp cho chủ nhà khi check-in). Wi-Fi kiểm định thực tế 250–680 Mbps, bảo chứng hoàn tiền 100% nếu sai cam kết.'
                : 'Lock your stay with just a 12% online booking fee and pay the host directly at check-in. Independently speed-tested Wi-Fi, ergonomic desks, kitchens, and our 100% Booking Fee Refund Guarantee.'}
            </p>
          </div>

          <div className="mt-8">
            <HomeSearchBar destinations={destinations} />
          </div>

          {/* Quick Intent Shortcuts */}
          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
            <Link
              href="/deals"
              className="rounded-full bg-[#C25E28] px-3.5 py-1.5 font-semibold text-white hover:bg-[#ad5020]"
            >
              {isVi ? 'Ưu đãi 1 tháng giảm sâu →' : 'Monthly Long-Stay Deals →'}
            </Link>
            <Link
              href="/stays?destination=da-nang&minWifi=400"
              className="rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-[#FAF8F3] backdrop-blur-sm hover:bg-white/20"
            >
              {isVi ? 'Biển Đà Nẵng · 400+ Mbps' : 'Da Nang Beach · 400+ Mbps'}
            </Link>
            <Link
              href="/stays?lifestyle=heritage-slow"
              className="rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-[#FAF8F3] backdrop-blur-sm hover:bg-white/20"
            >
              {isVi ? 'Di sản Hội An · Sống chậm' : 'Hoi An Heritage · Quiet Focus'}
            </Link>
            <Link
              href="/stays?model=stay_direct"
              className="rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-[#FAF8F3] backdrop-blur-sm hover:bg-white/20"
            >
              StayDirect™ · 0% Traveler Markup
            </Link>
          </div>

          {/* NomadStays 4 Trust Guarantees + Live Metrics */}
          <div className="mt-10 grid gap-3 border-t border-white/15 pt-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-3 text-sm text-[#E7F1EC]">
              <Zap className="h-5 w-5 shrink-0 text-[#E6B87A]" />
              <span>{isVi ? 'Chỉ trả 12% giữ chỗ · Trả chủ nhà khi nhận phòng' : 'Pay 12% booking fee online · Pay host at check-in'}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-[#E7F1EC]">
              <Wifi className="h-5 w-5 shrink-0 text-[#E6B87A]" />
              <span>{isVi ? 'Chứng nhận Speedtest & Hoàn phí 100%' : 'Verified Wi-Fi + 100% Fee Refund Guarantee'}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-[#E7F1EC]">
              <Clock className="h-5 w-5 shrink-0 text-[#E6B87A]" />
              <span>{isVi ? 'Giá gói 7–30 đêm minh bạch trước' : 'Weekly & monthly split prices upfront'}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-[#E7F1EC]">
              <Utensils className="h-5 w-5 shrink-0 text-[#E6B87A]" />
              <span>{isVi ? 'Bắt buộc bàn làm việc, bếp & giặt' : 'Workspaces, kitchens & laundry standard'}</span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 rounded-2xl border border-white/15 bg-white/10 p-4 text-center text-[#FAF8F3] backdrop-blur-md sm:grid-cols-4">
            <div>
              <div className="font-serif-display text-2xl font-bold">{community.stats.members.toLocaleString()}</div>
              <div className="text-xs text-[#CDE0D9]">{isVi ? 'Thành viên Nomad' : 'Nomad Members'}</div>
            </div>
            <div>
              <div className="font-serif-display text-2xl font-bold">{community.stats.destinations}</div>
              <div className="text-xs text-[#CDE0D9]">{isVi ? 'Thủ phủ Việt Nam' : 'Vietnam Hubs'}</div>
            </div>
            <div>
              <div className="font-serif-display text-2xl font-bold">{community.stats.liveStays}</div>
              <div className="text-xs text-[#CDE0D9]">{isVi ? 'Cơ sở đã kiểm định' : 'Verified Stays'}</div>
            </div>
            <div>
              <div className="font-serif-display text-2xl font-bold">{community.stats.totalUnits}</div>
              <div className="text-xs text-[#CDE0D9]">{isVi ? 'Phòng & Villa sẵn sàng' : 'Work-Ready Units'}</div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Real stays, live right now */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-[#C25E28]">
              {isVi ? 'Phòng trống thực tế ngay lúc này' : 'Real stays, live right now'}
            </span>
            <h2 className="font-serif-display mt-1 text-3xl font-semibold text-[#17221E] sm:text-4xl">
              {isVi
                ? 'Wi-Fi đáng tin cậy. Giá dài ngày minh bạch.'
                : 'Wi-Fi you can trust. Rates you’ll love.'}
            </h2>
            <p className="mt-1 text-sm text-[#53635D]">
              {isVi
                ? 'Xếp hạng theo tốc độ Wi-Fi đã đo kiểm, hiển thị sẵn tổng chi phí 1 tuần và 1 tháng.'
                : 'Independently tested speeds, with weekly and monthly totals shown upfront.'}
            </p>
          </div>
          <Link
            href="/stays"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#164E3F] hover:underline"
          >
            {isVi ? 'Xem tất cả chỗ ở' : 'Browse all stays'}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {stays.slice(0, 6).map((stay) => (
            <StayCard
              key={stay.id}
              stay={stay}
              initialSaved={savedIds.has(stay.id)}
              isAuthenticated={Boolean(user)}
            />
          ))}
        </div>
      </section>

      {/* 3. Deals — Biggest savings first */}
      <section className="border-y border-[#E5DFD3] bg-[#F2EDE3]/70 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-[#C25E28]">
                {isVi ? 'Ưu đãi lưu trú 1 tháng' : 'Plan your next base'}
              </span>
              <h2 className="font-serif-display mt-1 text-3xl font-semibold text-[#17221E] sm:text-4xl">
                {isVi ? 'Ưu đãi lớn nhất cho hợp đồng tháng' : 'Monthly Deals — Biggest savings first'}
              </h2>
            </div>
            <Link
              href="/deals"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#C25E28] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ad5020]"
            >
              {isVi ? 'Xem tất cả ưu đãi' : 'See all deals'}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {dealsStays.map((s) => (
              <Link
                key={s.id}
                href={`/stays/${s.slug}`}
                className="group overflow-hidden rounded-2xl border border-[#E5DFD3] bg-white transition hover:-translate-y-0.5 hover:border-[#C25E28]/50"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.heroImage}
                    alt={isVi ? s.titleVi : s.titleEn}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                  <span className="absolute left-3 top-3 rounded-full bg-[#C25E28] px-2.5 py-1 text-xs font-bold text-white">
                    {isVi ? `Giảm ${s.dealSavingsPct}%` : `Save ${s.dealSavingsPct}%`}
                  </span>
                  <span className="absolute bottom-3 left-3 rounded-full bg-[#164E3F] px-2.5 py-0.5 text-[11px] font-semibold text-white">
                    {s.wifiDownloadMbps} Mbps
                  </span>
                </div>
                <div className="p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#A67C2E]">
                    {s.dealMonthLabel} · {isVi ? s.destinationNameVi : s.destinationNameEn}
                  </div>
                  <h3 className="font-serif-display mt-0.5 text-lg font-semibold text-[#17221E]">
                    {isVi ? s.titleVi : s.titleEn}
                  </h3>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-base font-bold text-[#164E3F]">
                      {formatMoneyFromVnd(s.monthDisplayVnd, currency)}
                    </span>
                    {s.compareMonthDisplayVnd && (
                      <span className="text-xs text-[#53635D] line-through">
                        {formatMoneyFromVnd(s.compareMonthDisplayVnd, currency)}
                      </span>
                    )}
                    <span className="text-xs text-[#53635D]">/ 1 {isVi ? 'tháng' : 'month'}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Proof in the Price: Stay longer, pay less */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 max-w-2xl">
          <span className="text-xs font-semibold uppercase tracking-widest text-[#164E3F]">
            {isVi ? 'Chính sách giá dài ngày' : 'Proof in the price'}
          </span>
          <h2 className="font-serif-display mt-1 text-3xl font-semibold text-[#17221E] sm:text-4xl">
            {isVi ? 'Ở càng lâu, đơn giá mỗi đêm càng rẻ.' : 'Stay longer, pay less per night.'}
          </h2>
          <p className="mt-1 text-sm text-[#53635D]">
            {isVi
              ? 'Giá giảm tự động từ gói 1 tuần sang 1 tháng — không cần bắt đầu quy trình thanh toán mới thấy giá thật.'
              : 'Dynamic multi-week pricing rewards longer stays automatically — weekly and monthly totals always visible upfront.'}
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {stayLongerProof.map((s) => (
            <Link
              key={s.id}
              href={`/stays/${s.slug}`}
              className="rounded-2xl border border-[#E5DFD3] bg-white p-4 transition hover:border-[#164E3F]"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="rounded-full bg-[#E7F1EC] px-2.5 py-1 text-xs font-bold text-[#164E3F]">
                  {isVi ? `Tiết kiệm ${s.stayLongerSavingsPct}%/đêm` : `Save ${s.stayLongerSavingsPct}%`}
                </span>
                <span className="text-xs text-[#53635D]">
                  {isVi ? s.destinationNameVi : s.destinationNameEn}
                </span>
              </div>
              <h3 className="font-serif-display text-lg font-semibold text-[#17221E]">
                {isVi ? s.titleVi : s.titleEn}
              </h3>
              <div className="mt-3 flex items-center justify-between rounded-xl bg-[#FAF8F3] p-3 text-xs">
                <div>
                  <div className="text-[#53635D]">{isVi ? '1 tuần' : '1 week'}</div>
                  <div className="font-semibold text-[#17221E]">
                    {formatMoneyFromVnd(s.weekNightVnd, currency)}/{isVi ? 'đêm' : 'nt'}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-[#C25E28]" />
                <div className="text-right">
                  <div className="font-semibold text-[#164E3F]">{isVi ? '1 tháng' : '1 month'}</div>
                  <div className="font-bold text-[#164E3F]">
                    {formatMoneyFromVnd(s.monthNightVnd, currency)}/{isVi ? 'đêm' : 'nt'}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 5. Interactive AI Stay Concierge */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <AiConciergeBox isAuthenticated={Boolean(user)} />
      </div>

      {/* 6. Vietnam Map & Visa Readiness */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 max-w-2xl">
          <span className="text-xs font-semibold uppercase tracking-widest text-[#C25E28]">
            {isVi ? '6 Thủ phủ Remote Work Việt Nam' : 'Destinations & Visa Readiness'}
          </span>
          <h2 className="font-serif-display mt-1 text-3xl font-semibold text-[#17221E] sm:text-4xl">
            {isVi ? 'Bạn sẽ làm việc từ đâu tại Việt Nam?' : 'Where will you work from in Vietnam?'}
          </h2>
        </div>
        <VietnamMap destinations={destinations} />
      </section>

      {/* 7. How We Are Different + Comparison Table */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 max-w-2xl">
          <span className="text-xs font-semibold uppercase tracking-widest text-[#164E3F]">
            {isVi ? 'Sự khác biệt' : 'Life-ready, not tourist-ready'}
          </span>
          <h2 className="font-serif-display mt-1 text-3xl font-semibold text-[#17221E] sm:text-4xl">
            {isVi
              ? 'Nhà để sống & làm việc thật — không phải phòng du lịch ngắn ngày.'
              : 'Built for multi-week remote living, not 2-night holiday turnovers.'}
          </h2>
        </div>

        <div className="overflow-x-auto rounded-3xl border border-[#E5DFD3] bg-white lacquer-shadow">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-[#FAF8F3] text-xs uppercase tracking-wider text-[#53635D]">
              <tr>
                <th className="px-6 py-4">{isVi ? 'Nhu cầu Digital Nomad' : 'What Nomads Need'}</th>
                <th className="px-6 py-4 font-bold text-[#164E3F]">VietNomad Stays</th>
                <th className="px-6 py-4">{isVi ? 'Trang đặt phòng du lịch thông thường' : 'Typical Holiday Booking Sites'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DFD3]">
              {[
                [
                  isVi ? 'Thanh toán & Rủi ro' : 'Payment & Risk',
                  isVi
                    ? 'Chỉ trả phí giữ chỗ & kiểm định 12% online; trả 100% tiền thuê trực tiếp cho chủ nhà khi nhận phòng + Hoàn 100% phí nếu Wi-Fi sai cam kết'
                    : 'Pay only the 12% booking & verification fee online; pay host directly at check-in + 100% Wi-Fi refund guarantee',
                  isVi
                    ? 'Khóa 100% tiền thuê ngay khi đặt; quy trình khiếu nại & hoàn tiền phức tạp'
                    : '100% upfront lock-in with slow dispute refunds',
                ],
                [
                  isVi ? 'Kiểm định Wi-Fi' : 'Wi-Fi Speed',
                  isVi ? 'Đo Download/Upload/Jitter thực tế kèm chứng nhận Speedtest' : 'Tested Download/Upload/Jitter + Speedtest proof upfront',
                  isVi ? 'Chủ nhà tự đánh dấu "có Wi-Fi"' : 'Self-claimed or theoretical',
                ],
                [
                  isVi ? 'Giá hiển thị' : 'Pricing Transparency',
                  isVi ? 'Hiển thị rõ khoản trả hôm nay (12%) & khoản trả tại quầy cho gói 7–30 đêm' : 'Upfront 7–30N split: due today (12%) vs due directly to host',
                  isVi ? 'Phải chọn ngày mới hiện phí dịch vụ & thuế' : 'Hidden cleaning/service fees until checkout',
                ],
                [
                  isVi ? 'Góc làm việc & Coworking' : 'Workspaces',
                  isVi ? 'Bắt buộc có ảnh bàn ghế riêng + bản đồ Coworking lân cận' : 'Mandatory with workspace photos + nearby coworking km',
                  isVi ? 'Bộ lọc tùy chọn, ít khi chụp rõ bàn làm việc' : 'Optional checkbox, rarely photographed',
                ],
                [
                  isVi ? 'Tiện ích sinh hoạt' : 'Living Kit',
                  isVi ? '100% có bếp nấu và máy giặt/giặt ủi dài ngày' : 'Kitchen and laundry mandatory across all listings',
                  isVi ? 'Phòng khách sạn thiếu bếp và giặt ủi đắt đỏ' : 'Holiday setup lacking kitchen or laundry',
                ],
                [
                  isVi ? 'Chính sách cho Chủ nhà' : 'Partner Model',
                  isVi ? 'Chủ nhà giữ 100% giá thuê thu tại check-in (0% hoa hồng) hoặc 1% StayDirect™' : 'Hosts keep 100% of check-in rent (0% commission) or 1% StayDirect™',
                  isVi ? 'Thu 15%–20% hoa hồng mỗi đơn đặt phòng' : '15%–20%+ OTA commission per booking',
                ],
              ].map(([k, good, bad]) => (
                <tr key={k}>
                  <td className="px-6 py-4 font-semibold text-[#17221E]">{k}</td>
                  <td className="px-6 py-4 font-medium text-[#164E3F]">
                    <CheckCircle2 className="mr-1.5 inline h-4 w-4 text-[#164E3F]" />
                    {good}
                  </td>
                  <td className="px-6 py-4 text-[#53635D]">{bad}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 8. Nomad Lifestyles in Vietnam */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-[#C25E28]">
              {isVi ? 'Phong cách sống' : 'Lifestyles'}
            </span>
            <h2 className="font-serif-display mt-1 text-3xl font-semibold text-[#17221E] sm:text-4xl">
              {isVi ? 'Chọn nhịp sống hợp với bạn.' : 'Don’t just pick a map pin. Pick your lifestyle.'}
            </h2>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {lifestyles.map((l) => (
            <Link
              key={l.id}
              href={`/lifestyles/${l.slug}`}
              className="group relative overflow-hidden rounded-2xl border border-[#E5DFD3] bg-[#0F392E] text-white"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={l.heroImage}
                alt={isVi ? l.nameVi : l.nameEn}
                className="aspect-[4/3] w-full object-cover opacity-75 transition duration-500 group-hover:scale-105 group-hover:opacity-65"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <h3 className="font-serif-display text-xl font-semibold">
                  {isVi ? l.nameVi : l.nameEn}
                </h3>
                <p className="mt-1 line-clamp-2 text-xs text-[#DCECE5]">
                  {isVi ? l.descriptionVi : l.descriptionEn}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 9. Nomad Pass + Vietnam Brunch Club + Host CTA */}
      <section className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-3 lg:px-8">
        <div className="flex flex-col justify-between rounded-3xl border border-[#A67C2E]/30 bg-white p-7 lacquer-shadow">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#FAF8F3] px-3 py-1 text-xs font-semibold text-[#A67C2E]">
              <Sparkles className="h-3.5 w-3.5" /> Nomad Pass · €99/yr
            </span>
            <h3 className="font-serif-display text-2xl font-semibold text-[#17221E]">
              {isVi ? 'Hoàn 4% Credit & Hóa đơn Miễn VAT' : '4% Reward Credit & VAT-Free Stays'}
            </h3>
            <p className="text-sm text-[#53635D]">
              {isVi
                ? 'Tích 4% cho mọi đặt phòng BookingFlow, miễn thuế VAT doanh nghiệp đủ điều kiện và theo dõi lịch Visa Việt Nam.'
                : 'Earn 4% credit back automatically on BookingFlow stays, toggle VAT-free business invoicing, and get early deal drops.'}
            </p>
          </div>
          <Link
            href="/membership"
            className="mt-6 inline-flex items-center gap-2 font-semibold text-[#A67C2E] hover:underline"
          >
            {isVi ? 'Khám phá Nomad Pass' : 'Explore Membership'} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="flex flex-col justify-between rounded-3xl border border-[#E5DFD3] bg-white p-7 lacquer-shadow">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#FAEDE5] px-3 py-1 text-xs font-semibold text-[#C25E28]">
              <Coffee className="h-3.5 w-3.5" /> Vietnam Brunch Club
            </span>
            <h3 className="font-serif-display text-2xl font-semibold text-[#17221E]">
              {isVi ? 'Gặp gỡ cộng đồng Nomad & Chợ tiện ích' : 'Local Nomad Meetups & eSIM Marketplace'}
            </h3>
            <p className="text-sm text-[#53635D]">
              {isVi
                ? 'Tham gia buổi cà phê cuối tuần tại Đà Nẵng, Thảo Điền, Tây Hồ và đặt trước eSIM 5G, màn hình rời 4K.'
                : 'Join weekly founder brunches in Da Nang, Saigon, and Hanoi plus curated Viettel 5G eSIMs and 4K monitor rentals.'}
            </p>
          </div>
          <Link
            href="/community"
            className="mt-6 inline-flex items-center gap-2 font-semibold text-[#C25E28] hover:underline"
          >
            {isVi ? 'Xem lịch Meetup & Marketplace' : 'View Meetups & Marketplace'} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="flex flex-col justify-between rounded-3xl bg-[#164E3F] p-7 text-white lacquer-shadow">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-[#E6B87A]">
              <Building2 className="h-3.5 w-3.5" /> {isVi ? 'Dành cho Chủ nhà' : 'For Property Owners'}
            </span>
            <h3 className="font-serif-display text-2xl font-semibold">
              {isVi ? 'Nhận đủ 100% tiền thuê tại check-in · 0% hoa hồng' : 'Keep 100% of Rent at Check-in · 0% Commission'}
            </h3>
            <p className="text-sm text-[#DCECE5]">
              {isVi
                ? 'Khách đặt cọc 12% online để cam kết nhận phòng và trả 100% giá thuê net trực tiếp cho bạn khi đến nơi. Hỗ trợ đồng bộ lịch iCal tự động từ Airbnb/Booking.com.'
                : 'Guests pay a 12% online lock-in fee and pay 100% of your net rate directly at check-in — plus automated Airbnb/Booking.com iCal calendar sync.'}
            </p>
          </div>
          <Link
            href="/list-your-stay"
            className="mt-6 inline-flex items-center gap-2 font-semibold text-[#E6B87A] hover:underline"
          >
            {isVi ? 'Đăng ký Đối tác Lưu trú' : 'List Your Stay+'} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* 10. FAQ */}
      <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-[#164E3F]">
            {isVi ? 'Giải đáp trước khi đặt' : 'Before you book'}
          </span>
          <h2 className="font-serif-display mt-1 text-3xl font-semibold text-[#17221E]">
            {isVi ? 'Câu hỏi Digital Nomad thường hỏi' : 'Questions digital nomads actually ask'}
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((item) => (
            <details
              key={item.q}
              className="group rounded-2xl border border-[#E5DFD3] bg-white p-5 open:border-[#164E3F]"
            >
              <summary className="cursor-pointer list-none font-semibold text-[#17221E] flex items-center justify-between">
                <span>{item.q}</span>
                <Laptop className="h-4 w-4 text-[#164E3F] opacity-60 group-open:opacity-100" />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-[#53635D]">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
