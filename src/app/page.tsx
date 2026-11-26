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
          a: 'Mọi chỗ ở đều đặt thống nhất qua BookingFlow: bạn thanh toán trước 12% phí giữ chỗ online để khóa lịch và mở địa chỉ thật. Toàn bộ 100% tiền thuê nhà bạn trả trực tiếp cho chủ nhà khi nhận phòng (0% hoa hồng chủ nhà).',
        },
        {
          q: 'Chủ nhà có bắt buộc phải kiểm định Wi-Fi hay đủ bàn làm việc để đăng phòng không?',
          a: 'Không. Chủ nhà đăng phòng hoàn toàn miễn phí (€0) và tự khai trung thực tiện nghi (tốc độ Wi-Fi, bàn làm việc, ghế công thái học, màn hình, bếp, máy giặt). Những căn muốn nổi bật thêm có thể xin cấp badge Wi-Fi Verified hoặc Work-Ready từ Admin.',
        },
        {
          q: 'Thời gian thuê tối thiểu là bao nhiêu đêm?',
          a: 'Tối thiểu 7 đêm (1 tuần). Các gói giá được tính sẵn theo mốc 7, 14, 21 hoặc 30 đêm và cộng thêm từng đêm lẻ linh hoạt.',
        },
        {
          q: 'Làm sao tìm đúng căn có bàn làm việc hoặc đã kiểm định Wi-Fi?',
          a: 'Trên trang Tìm chỗ ở, bạn có thể lọc trực tiếp theo tốc độ Wi-Fi tối thiểu, bàn làm việc riêng, màn hình 4K, bếp riêng hoặc tick chọn badge Wi-Fi Verified / Work-Ready.',
        },
      ]
    : [
        {
          q: 'How does the unified 12% BookingFlow fee work?',
          a: 'Every listing on VietNomad Stays uses BookingFlow: pay only a 12% online service fee to lock your dates and unlock the exact address, then pay 100% of your stay rent directly to your host at check-in (0% host commission).',
        },
        {
          q: 'Are Wi-Fi tests or desks mandatory for hosts to list?',
          a: 'No. Hosting is completely free (€0) with zero mandatory hardware or speedtest gates. Hosts self-declare their Wi-Fi speed and amenities, and can optionally apply for Wi-Fi Verified or Work-Ready badges.',
        },
        {
          q: 'What is the minimum stay?',
          a: '7 nights (1 week). Pricing is ready upfront for 7, 14, 21, and 30-night stays, and you can add extra nights as needed.',
        },
        {
          q: 'How do I filter for verified Wi-Fi or specific work setups?',
          a: 'Use the Search Stays filters to select dedicated desks, ergonomic chairs, 4K monitors, kitchen & laundry types, or toggle the optional Wi-Fi Verified and Work-Ready badges.',
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
                ? 'Chỗ ở thoải mái theo tuần & tháng khắp Việt Nam'
                : 'Comfortable weekly & monthly stays across Vietnam'}
            </div>

            <h1 className="font-serif-display text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
              {isVi
                ? 'Ở thoải mái dài ngày tại Việt Nam. Sẵn sàng sống và làm việc linh hoạt.'
                : 'Comfortable extended stays in Vietnam, built for living & remote work.'}
            </h1>

            <p className="max-w-2xl text-base leading-relaxed text-[#DCECE5] sm:text-lg">
              {isVi
                ? 'Đặt thống nhất qua BookingFlow: chỉ trả 12% phí giữ chỗ online để khóa phòng và trả 100% tiền thuê trực tiếp cho chủ nhà khi nhận phòng. Dễ dàng lọc tốc độ Wi-Fi, bàn làm việc, bếp và badge kiểm định tùy chọn.'
                : 'Unified BookingFlow checkout: pay just 12% online to reserve dates, then settle rent directly with your host at check-in. Filter freely by reported Wi-Fi speed, home comforts, workspace setup, or optional verified badges.'}
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
              href="/stays?destination=da-nang&minWifi=300"
              className="rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-[#FAF8F3] backdrop-blur-sm hover:bg-white/20"
            >
              {isVi ? 'Biển Đà Nẵng, 300+ Mbps' : 'Da Nang Beach, 300+ Mbps'}
            </Link>
            <Link
              href="/stays?wifiVerified=1"
              className="rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-[#FAF8F3] backdrop-blur-sm hover:bg-white/20"
            >
              {isVi ? 'Badge Wi-Fi Verified' : 'Wi-Fi Verified badge'}
            </Link>
            <Link
              href="/stays?workReady=1"
              className="rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-[#FAF8F3] backdrop-blur-sm hover:bg-white/20"
            >
              {isVi ? 'Badge Work-Ready' : 'Work-Ready badge'}
            </Link>
          </div>

          <div className="mt-10 grid gap-3 border-t border-white/15 pt-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-3 text-sm text-[#E7F1EC]">
              <Zap className="h-5 w-5 shrink-0 text-[#E6B87A]" />
              <span>{isVi ? 'Chỉ trả 12% giữ chỗ, phần thuê trả khi nhận phòng' : 'Pay 12% online, pay host at check-in'}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-[#E7F1EC]">
              <Wifi className="h-5 w-5 shrink-0 text-[#E6B87A]" />
              <span>{isVi ? 'Tốc độ Wi-Fi minh bạch & badge kiểm định tùy chọn' : 'Reported Wi-Fi speeds & optional verified badges'}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-[#E7F1EC]">
              <Clock className="h-5 w-5 shrink-0 text-[#E6B87A]" />
              <span>{isVi ? 'Báo giá sẵn theo gói 7 đến 30 đêm' : 'Clear weekly and monthly pricing upfront'}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-[#E7F1EC]">
              <Utensils className="h-5 w-5 shrink-0 text-[#E6B87A]" />
              <span>{isVi ? 'Lọc linh hoạt bàn làm việc, bếp và đời sống bản địa' : 'Filter by desk, kitchen, laundry & local life'}</span>
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
              <div className="text-xs text-[#CDE0D9]">{isVi ? 'Chỗ ở đang mở' : 'Live stays'}</div>
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
                ? 'Không gian sống thoải mái. Giá thuê minh bạch.'
                : 'Comfortable spaces. Clear monthly prices.'}
            </h2>
            <p className="mt-1 text-sm text-[#53635D]">
              {isVi
                ? 'Hiển thị rõ tiền giữ chỗ 12% và phần trả chủ nhà khi nhận phòng cùng thông số Wi-Fi & tiện ích.'
                : 'Upfront 1-week and 1-month totals with transparent 12% online deposit, amenities, and optional badges.'}
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
                    ? 'Chỉ trả phí giữ chỗ 12% online để khóa lịch, toàn bộ tiền thuê trả trực tiếp cho chủ nhà khi nhận phòng.'
                    : 'Pay only a 12% booking fee online to lock dates, then pay host rent directly at check-in.',
                  isVi
                    ? 'Phải trả trước 100% tiền thuê ngay khi đặt, thủ tục hoàn tiền phức tạp.'
                    : 'Pay 100% upfront with slow refund disputes.',
                ],
                [
                  isVi ? 'Tốc độ Wi-Fi & Badge' : 'Wi-Fi & Badges',
                  isVi ? 'Chủ nhà khai rõ tốc độ + tùy chọn badge Wi-Fi Verified & Work-Ready để lọc nhanh.' : 'Host-reported speeds plus optional Wi-Fi Verified & Work-Ready badges.',
                  isVi ? 'Thông tin Wi-Fi chung chung, khó lọc chỗ làm việc chuẩn.' : 'Vague Wi-Fi mentions without work-ready filters.',
                ],
                [
                  isVi ? 'Minh bạch giá' : 'Pricing',
                  isVi ? 'Hiện sẵn tiền giữ chỗ 12% và tiền trả chủ nhà cho gói 7 đến 30 đêm.' : '7 to 30-night totals split clearly between online fee and host check-in rent.',
                  isVi ? 'Đến bước thanh toán cuối mới hiện thêm phí dọn phòng và thuế.' : 'Extra service and cleaning fees added at checkout.',
                ],
                [
                  isVi ? 'Không gian làm việc' : 'Workspaces',
                  isVi ? 'Lọc chi tiết bàn làm việc, ghế công thái học, màn hình 4K và coworking gần kề.' : 'Filter directly by desk, ergonomic chair, 4K monitor, and nearby coworking.',
                  isVi ? 'Ít thông tin chi tiết về góc làm việc dài ngày.' : 'Minimal details for remote work setups.',
                ],
                [
                  isVi ? 'Tiện ích sinh hoạt' : 'Daily living',
                  isVi ? 'Chủ nhà khai rõ loại bếp và giặt sấy (riêng, chung hoặc không) cho từng căn.' : 'Clear kitchen and laundry details self-declared on every listing.',
                  isVi ? 'Khó biết rõ tiện nghi bếp núc hay giặt đồ trước khi hỏi chủ.' : 'Unclear kitchen or laundry setups.',
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
