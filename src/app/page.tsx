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
import { PaginatedStayGrid } from '@/components/PaginatedStayGrid';
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
          q: 'Cách thanh toán phí giữ chỗ 12% hoạt động thế nào?',
          a: 'Khi đặt phòng qua VietNomad, bạn chỉ thanh toán trước 12% phí giữ chỗ và kiểm định (tính trên giá thuê chủ nhà) để khóa lịch và mở địa chỉ thật. Toàn bộ tiền thuê nhà bạn trả trực tiếp cho chủ nhà khi nhận phòng.',
        },
        {
          q: 'Nếu tốc độ Wi-Fi khi nhận phòng không đúng như cam kết thì sao?',
          a: 'Bạn được hoàn lại 100% khoản phí giữ chỗ 12% nếu tốc độ Wi-Fi hoặc bàn làm việc thực tế không đạt chứng nhận, kèm hỗ trợ đổi sang căn hộ khác cùng khu vực.',
        },
        {
          q: 'Thời gian thuê tối thiểu là bao nhiêu đêm?',
          a: 'Tối thiểu 7 đêm (1 tuần). Các gói giá được tính sẵn theo mốc 7, 14, 21 hoặc 30 đêm và cộng thêm từng đêm lẻ linh hoạt.',
        },
        {
          q: 'Đặt qua VietNomad và đặt trực tiếp chủ nhà khác nhau thế nào?',
          a: 'Đặt qua VietNomad cho phép giữ phòng ngay với phí 12% online và hưởng bảo chứng hoàn tiền Wi-Fi. Đặt trực tiếp chủ nhà sẽ chuyển bạn sang website riêng của chủ nhà với giá niêm yết gốc.',
        },
      ]
    : [
        {
          q: 'How does the 12% booking fee work?',
          a: 'To confirm a stay on VietNomad, you pay only the 12% booking and verification fee online to lock your dates and unlock the exact address. You pay the full host rent directly to your host when you check in.',
        },
        {
          q: 'What if the Wi-Fi at check-in is slower than promised?',
          a: 'You receive a 100% refund of your 12% booking fee if the Wi-Fi speed or desk setup fails to match the certificate at check-in, plus support finding a replacement nearby.',
        },
        {
          q: 'What is the minimum stay?',
          a: '7 nights (1 week). Pricing is ready upfront for 7, 14, 21, and 30-night stays, and you can add extra nights as needed.',
        },
        {
          q: 'What is the difference between Book on VietNomad and Direct Booking?',
          a: 'Book on VietNomad locks your dates immediately with a 12% online fee and full Wi-Fi refund protection. Direct Booking sends signed-in members straight to the host website with zero markup.',
        },
      ];

  return (
    <div className="space-y-20 pb-10">
      {/* Hero + Search Bar */}
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
                ? 'Chỗ ở thuê theo tuần và tháng tại Việt Nam'
                : 'Weekly and monthly stays across Vietnam'}
            </div>

            <h1 className="font-serif-display text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
              {isVi
                ? 'Thuê nhà ở dài ngày tại Việt Nam. Làm việc ổn định mỗi ngày.'
                : 'Extended stays in Vietnam, built for remote work.'}
            </h1>

            <p className="max-w-2xl text-base leading-relaxed text-[#DCECE5] sm:text-lg">
              {isVi
                ? 'Chỉ trả phí giữ chỗ 12% online để khóa phòng và trả tiền thuê trực tiếp cho chủ nhà khi nhận phòng. Wi-Fi đo thực tế từ 250 đến 680 Mbps, hoàn lại 100% phí nếu không đúng cam kết.'
                : 'Pay only a 12% booking fee online to hold your dates, then pay rent directly to your host at check-in. Verified Wi-Fi speeds from 250 to 680 Mbps with a 100% fee refund guarantee.'}
            </p>
          </div>

          <div className="mt-8">
            <HomeSearchBar destinations={destinations} />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
            <Link
              href="/deals"
              className="rounded-full bg-[#C25E28] px-3.5 py-1.5 font-semibold text-white hover:bg-[#ad5020]"
            >
              {isVi ? 'Xem ưu đãi thuê 1 tháng' : 'View monthly deals'}
            </Link>
            <Link
              href="/stays?destination=da-nang&minWifi=400"
              className="rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-[#FAF8F3] backdrop-blur-sm hover:bg-white/20"
            >
              {isVi ? 'Biển Đà Nẵng, 400+ Mbps' : 'Da Nang Beach, 400+ Mbps'}
            </Link>
            <Link
              href="/stays?lifestyle=heritage-slow"
              className="rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-[#FAF8F3] backdrop-blur-sm hover:bg-white/20"
            >
              {isVi ? 'Hội An yên tĩnh' : 'Hoi An quiet stays'}
            </Link>
            <Link
              href="/stays?model=stay_direct"
              className="rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-[#FAF8F3] backdrop-blur-sm hover:bg-white/20"
            >
              {isVi ? 'Đặt trực tiếp chủ nhà' : 'Direct host booking'}
            </Link>
          </div>

          <div className="mt-10 grid gap-3 border-t border-white/15 pt-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-3 text-sm text-[#E7F1EC]">
              <Zap className="h-5 w-5 shrink-0 text-[#E6B87A]" />
              <span>{isVi ? 'Chỉ trả 12% giữ chỗ, phần thuê trả khi nhận phòng' : 'Pay 12% online, pay host at check-in'}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-[#E7F1EC]">
              <Wifi className="h-5 w-5 shrink-0 text-[#E6B87A]" />
              <span>{isVi ? 'Wi-Fi đo thật, hoàn 100% phí nếu sai' : 'Tested Wi-Fi with 100% fee refund protection'}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-[#E7F1EC]">
              <Clock className="h-5 w-5 shrink-0 text-[#E6B87A]" />
              <span>{isVi ? 'Báo giá sẵn theo gói 7 đến 30 đêm' : 'Clear weekly and monthly pricing upfront'}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-[#E7F1EC]">
              <Utensils className="h-5 w-5 shrink-0 text-[#E6B87A]" />
              <span>{isVi ? 'Đủ bàn làm việc, bếp và máy giặt' : 'Dedicated desk, kitchen, and laundry'}</span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 rounded-2xl border border-white/15 bg-white/10 p-4 text-center text-[#FAF8F3] backdrop-blur-md sm:grid-cols-4">
            <div>
              <div className="font-serif-display text-2xl font-bold">{community.stats.members.toLocaleString()}</div>
              <div className="text-xs text-[#CDE0D9]">{isVi ? 'Thành viên' : 'Members'}</div>
            </div>
            <div>
              <div className="font-serif-display text-2xl font-bold">{community.stats.destinations}</div>
              <div className="text-xs text-[#CDE0D9]">{isVi ? 'Thành phố' : 'Cities'}</div>
            </div>
            <div>
              <div className="font-serif-display text-2xl font-bold">{community.stats.liveStays}</div>
              <div className="text-xs text-[#CDE0D9]">{isVi ? 'Chỗ ở đang mở' : 'Verified stays'}</div>
            </div>
            <div>
              <div className="font-serif-display text-2xl font-bold">{community.stats.totalUnits}</div>
              <div className="text-xs text-[#CDE0D9]">{isVi ? 'Phòng & biệt thự' : 'Open units'}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Inventory */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-[#C25E28]">
              {isVi ? 'Phòng đang còn trống' : 'Open right now'}
            </span>
            <h2 className="font-serif-display mt-1 text-3xl font-semibold text-[#17221E] sm:text-4xl">
              {isVi
                ? 'Wi-Fi rõ tốc độ. Giá thuê minh bạch.'
                : 'Tested Wi-Fi speeds. Clear monthly prices.'}
            </h2>
            <p className="mt-1 text-sm text-[#53635D]">
              {isVi
                ? 'Sắp xếp theo tốc độ Wi-Fi thực tế, hiển thị đủ tiền giữ chỗ 12% và tiền trả chủ nhà.'
                : 'Sorted by verified Wi-Fi speed with upfront 1-week and 1-month totals.'}
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

        <PaginatedStayGrid
          stays={stays}
          savedIds={Array.from(savedIds)}
          isAuthenticated={Boolean(user)}
        />
      </section>

      {/* Monthly Deals */}
      <section className="border-y border-[#E5DFD3] bg-[#F2EDE3]/70 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-[#C25E28]">
                {isVi ? 'Gói thuê 1 tháng' : 'Monthly stays'}
              </span>
              <h2 className="font-serif-display mt-1 text-3xl font-semibold text-[#17221E] sm:text-4xl">
                {isVi ? 'Chỗ ở giảm giá tốt nhất khi thuê 30 đêm' : 'Biggest savings on 30-night stays'}
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
                    {s.dealMonthLabel}, {isVi ? s.destinationNameVi : s.destinationNameEn}
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
                    <span className="text-xs text-[#53635D]">/ 30 {isVi ? 'đêm' : 'nights'}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Stay Longer Proof */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 max-w-2xl">
          <span className="text-xs font-semibold uppercase tracking-widest text-[#164E3F]">
            {isVi ? 'Ưu đãi theo độ dài lưu trú' : 'Lower nightly rates'}
          </span>
          <h2 className="font-serif-display mt-1 text-3xl font-semibold text-[#17221E] sm:text-4xl">
            {isVi ? 'Thuê càng lâu, giá mỗi đêm càng giảm.' : 'Stay longer and pay less per night.'}
          </h2>
          <p className="mt-1 text-sm text-[#53635D]">
            {isVi
              ? 'Giá tự động giảm khi bạn chuyển từ gói 1 tuần sang 1 tháng, không ẩn phụ phí.'
              : 'Rates drop automatically from 1-week to 1-month stays, with total costs visible right away.'}
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
                  {isVi ? `Giảm ${s.stayLongerSavingsPct}%/đêm` : `Save ${s.stayLongerSavingsPct}%`}
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

      {/* Smart Stay Finder */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <AiConciergeBox isAuthenticated={Boolean(user)} />
      </div>

      {/* Map */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 max-w-2xl">
          <span className="text-xs font-semibold uppercase tracking-widest text-[#C25E28]">
            {isVi ? '6 thành phố tại Việt Nam' : 'Cities and Visa Guide'}
          </span>
          <h2 className="font-serif-display mt-1 text-3xl font-semibold text-[#17221E] sm:text-4xl">
            {isVi ? 'Bạn muốn ở thành phố nào tại Việt Nam?' : 'Where will you stay in Vietnam?'}
          </h2>
        </div>
        <VietnamMap destinations={destinations} />
      </section>

      {/* Comparison Table */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 max-w-2xl">
          <span className="text-xs font-semibold uppercase tracking-widest text-[#164E3F]">
            {isVi ? 'Vì sao chọn VietNomad' : 'Built for long stays'}
          </span>
          <h2 className="font-serif-display mt-1 text-3xl font-semibold text-[#17221E] sm:text-4xl">
            {isVi
              ? 'Thiết kế cho làm việc dài ngày, khác biệt hoàn toàn phòng du lịch ngắn hạn.'
              : 'Made for multi-week remote work, not short weekend trips.'}
          </h2>
        </div>

        <div className="overflow-x-auto rounded-3xl border border-[#E5DFD3] bg-white lacquer-shadow">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-[#FAF8F3] text-xs uppercase tracking-wider text-[#53635D]">
              <tr>
                <th className="px-6 py-4">{isVi ? 'Tiêu chí' : 'Feature'}</th>
                <th className="px-6 py-4 font-bold text-[#164E3F]">VietNomad Stays</th>
                <th className="px-6 py-4">{isVi ? 'Nền tảng du lịch thông thường' : 'Typical booking sites'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DFD3]">
              {[
                [
                  isVi ? 'Thanh toán và rủi ro' : 'Payment & risk',
                  isVi
                    ? 'Chỉ trả phí giữ chỗ 12% online. Trả tiền thuê trực tiếp cho chủ nhà khi nhận phòng và được hoàn 100% phí nếu Wi-Fi sai cam kết.'
                    : 'Pay only a 12% booking fee online. Pay rent to the host at check-in with a 100% Wi-Fi refund guarantee.',
                  isVi
                    ? 'Phải trả trước 100% tiền thuê ngay khi đặt, thủ tục hoàn tiền phức tạp.'
                    : 'Pay 100% upfront with slow refund disputes.',
                ],
                [
                  isVi ? 'Tốc độ Wi-Fi' : 'Wi-Fi speed',
                  isVi ? 'Đo thực tế tốc độ tải xuống, tải lên và độ trễ trước khi đăng.' : 'Tested download, upload, and latency speeds shown upfront.',
                  isVi ? 'Chủ nhà tự điền thông tin, không có số đo cụ thể.' : 'Self-reported without speed measurements.',
                ],
                [
                  isVi ? 'Minh bạch giá' : 'Pricing',
                  isVi ? 'Hiện sẵn tiền giữ chỗ 12% và tiền trả chủ nhà cho gói 7 đến 30 đêm.' : '7 to 30-night totals split clearly between online fee and host check-in rent.',
                  isVi ? 'Đến bước thanh toán cuối mới hiện thêm phí dọn phòng và thuế.' : 'Extra service and cleaning fees added at checkout.',
                ],
                [
                  isVi ? 'Bàn làm việc' : 'Workspaces',
                  isVi ? 'Bắt buộc có ảnh thực tế góc làm việc và khoảng cách tới coworking gần nhất.' : 'Required workspace photos plus distance to nearby coworking.',
                  isVi ? 'Ít ảnh chi tiết về bàn ghế làm việc.' : 'Optional filter, rarely photographed.',
                ],
                [
                  isVi ? 'Tiện ích sinh hoạt' : 'Daily living',
                  isVi ? 'Tất cả chỗ ở đều có bếp nấu và máy giặt.' : 'Kitchen and laundry required in every listing.',
                  isVi ? 'Nhiều phòng khách sạn không có bếp và giặt ủi.' : 'Often lacks kitchen or laundry.',
                ],
                [
                  isVi ? 'Quyền lợi chủ nhà' : 'For hosts',
                  isVi ? 'Chủ nhà nhận đủ 100% tiền thuê tại check-in, không mất hoa hồng.' : 'Hosts keep 100% of check-in rent with 0% commission.',
                  isVi ? 'Thu 15% đến 20% hoa hồng trên mỗi đơn.' : 'Charges 15% to 20% commission per booking.',
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

      {/* Lifestyles */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-[#C25E28]">
              {isVi ? 'Phong cách ở' : 'Lifestyles'}
            </span>
            <h2 className="font-serif-display mt-1 text-3xl font-semibold text-[#17221E] sm:text-4xl">
              {isVi ? 'Chọn không gian phù hợp nhịp sống của bạn.' : 'Pick a place that fits how you work and live.'}
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

      {/* Membership + Community + Host CTA */}
      <section className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-3 lg:px-8">
        <div className="flex flex-col justify-between rounded-3xl border border-[#A67C2E]/30 bg-white p-7 lacquer-shadow">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#FAF8F3] px-3 py-1 text-xs font-semibold text-[#A67C2E]">
              <Sparkles className="h-3.5 w-3.5" /> {isVi ? 'Thẻ hội viên 99 EUR/năm' : 'Nomad Pass, €99/yr'}
            </span>
            <h3 className="font-serif-display text-2xl font-semibold text-[#17221E]">
              {isVi ? 'Hoàn 4% tiền thưởng và hóa đơn miễn VAT' : 'Earn 4% credit and VAT-free invoices'}
            </h3>
            <p className="text-sm text-[#53635D]">
              {isVi
                ? 'Nhận 4% tiền thưởng cho mọi lần đặt phòng qua VietNomad và kích hoạt xuất hóa đơn miễn VAT khi nhập mã số thuế.'
                : 'Get 4% credit back automatically on VietNomad bookings and enable VAT-free business invoicing with your Tax ID.'}
            </p>
          </div>
          <Link
            href="/membership"
            className="mt-6 inline-flex items-center gap-2 font-semibold text-[#A67C2E] hover:underline"
          >
            {isVi ? 'Xem quyền lợi hội viên' : 'View membership'} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="flex flex-col justify-between rounded-3xl border border-[#E5DFD3] bg-white p-7 lacquer-shadow">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#FAEDE5] px-3 py-1 text-xs font-semibold text-[#C25E28]">
              <Coffee className="h-3.5 w-3.5" /> {isVi ? 'Cộng đồng và Tiện ích' : 'Community & Gear'}
            </span>
            <h3 className="font-serif-display text-2xl font-semibold text-[#17221E]">
              {isVi ? 'Gặp gỡ cuối tuần và thuê màn hình, eSIM' : 'Weekly meetups, eSIMs, and 4K monitor rentals'}
            </h3>
            <p className="text-sm text-[#53635D]">
              {isVi
                ? 'Tham gia buổi gặp mặt tại Đà Nẵng, Sài Gòn, Hà Nội và đặt trước eSIM 5G hoặc màn hình rời giao tận nhà.'
                : 'Join weekend brunches in Da Nang, Saigon, and Hanoi, or order Viettel 5G eSIMs and 4K monitor rentals.'}
            </p>
          </div>
          <Link
            href="/community"
            className="mt-6 inline-flex items-center gap-2 font-semibold text-[#C25E28] hover:underline"
          >
            {isVi ? 'Xem lịch sự kiện và tiện ích' : 'View meetups & gear'} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="flex flex-col justify-between rounded-3xl bg-[#164E3F] p-7 text-white lacquer-shadow">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-[#E6B87A]">
              <Building2 className="h-3.5 w-3.5" /> {isVi ? 'Dành cho chủ nhà' : 'For hosts'}
            </span>
            <h3 className="font-serif-display text-2xl font-semibold">
              {isVi ? 'Nhận đủ 100% tiền thuê khi khách check-in, 0% hoa hồng' : 'Keep 100% of rent at check-in with 0% commission'}
            </h3>
            <p className="text-sm text-[#DCECE5]">
              {isVi
                ? 'Khách đóng 12% giữ chỗ trước để cam kết đến ở, bạn thu đủ toàn bộ tiền thuê tại chỗ và đồng bộ lịch tự động từ Airbnb hoặc Booking.com.'
                : 'Guests pay a 12% online fee to lock dates and pay 100% of your rent directly at check-in. Sync your calendar from Airbnb or Booking.com.'}
            </p>
          </div>
          <Link
            href="/list-your-stay"
            className="mt-6 inline-flex items-center gap-2 font-semibold text-[#E6B87A] hover:underline"
          >
            {isVi ? 'Đăng cho thuê nhà' : 'List your property'} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-[#164E3F]">
            {isVi ? 'Câu hỏi thường gặp' : 'Questions & answers'}
          </span>
          <h2 className="font-serif-display mt-1 text-3xl font-semibold text-[#17221E]">
            {isVi ? 'Thông tin cần biết trước khi đặt phòng' : 'Common questions before you book'}
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
