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
import { formatCmsTypeLabel, formatMoneyFromVnd } from '@/lib/i18n';
import { getServerPreferences } from '@/lib/preferences';
import {
  getCommunityAndMarketplaceData,
  getDestinations,
  getLifestyles,
  searchStays,
} from '@/modules/catalog';
import { getPublishedCmsContents } from '@/modules/cms';
import { getPlatformFeeConfig } from '@/modules/platform-settings';
import { AiConciergeBox } from '@/components/AiConciergeBox';
import { HomeSearchBar } from '@/components/HomeSearchBar';
import { PaginatedStayGrid } from '@/components/PaginatedStayGrid';
import { VietnamMap } from '@/components/VietnamMap';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [prefs, user, destinations, lifestyles, stays, community, feeConfig, cmsItems] =
    await Promise.all([
      getServerPreferences(),
      getCurrentUser(),
      getDestinations(),
      getLifestyles(),
      searchStays({ sort: 'featured' }),
      getCommunityAndMarketplaceData(),
      getPlatformFeeConfig(),
      getPublishedCmsContents({
        contentTypes: [
          'hero_banner',
          'article',
          'destination_guide',
          'community_story',
          'landing_page',
          'faq',
        ],
        limit: 24,
      }),
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
  const serviceFeePct = Math.round(feeConfig.serviceFeeRate * 100);
  const hostCommissionPct = Math.round(feeConfig.hostCommissionRate * 100);
  const premiumRewardPct = Math.round(feeConfig.premiumRewardRate * 100);
  const minNights = feeConfig.defaultMinNights;

  const dealsStays = [...stays]
    .filter((s) => s.dealSavingsPct > 0)
    .sort((a, b) => b.dealSavingsPct - a.dealSavingsPct)
    .slice(0, 4);

  const stayLongerProof = [...stays]
    .sort((a, b) => b.stayLongerSavingsPct - a.stayLongerSavingsPct)
    .slice(0, 4);

  const heroBanner = cmsItems.find((c) => c.contentType === 'hero_banner');
  const cmsGuides = cmsItems
    .filter((c) =>
      ['article', 'destination_guide', 'community_story', 'landing_page'].includes(c.contentType)
    )
    .slice(0, 3);
  const cmsFaqs = cmsItems
    .filter((c) => c.contentType === 'faq')
    .map((c) => ({
      q: isVi ? c.titleVi : c.titleEn,
      a: isVi ? c.bodyVi : c.bodyEn,
    }));

  const defaultFaqs = isVi
    ? [
        {
          q: `Phí dịch vụ ${serviceFeePct}% online hoạt động thế nào?`,
          a: `Khi đặt phòng trên VietNomad Stays, bạn thanh toán ${serviceFeePct}% phí dịch vụ online để xác nhận giữ phòng và nhận địa chỉ cụ thể. Toàn bộ tiền thuê nhà còn lại bạn trả trực tiếp cho chủ nhà khi nhận phòng (${hostCommissionPct}% hoa hồng chủ nhà).`,
        },
        {
          q: 'Chủ nhà có bắt buộc phải có bàn làm việc hay kiểm định Wi-Fi để đăng phòng không?',
          a: 'Không. Chủ nhà đăng phòng miễn phí và tự khai trung thực các tiện nghi thực tế như bếp, máy giặt, bàn làm việc hoặc tốc độ Wi-Fi. Những căn đạt chuẩn có thể đăng ký thêm badge Wi-Fi Verified hoặc Work-Ready.',
        },
        {
          q: 'Thời gian lưu trú tối thiểu là bao lâu?',
          a: `Tối thiểu ${minNights} đêm. Bạn có thể chọn gói 7, 14, 21 hoặc 30 đêm và cộng thêm đêm lẻ theo nhu cầu.`,
        },
        {
          q: 'Làm sao tìm chỗ ở phù hợp cho gia đình, nghỉ dưỡng hoặc làm việc từ xa?',
          a: 'Tại trang Chỗ ở, bạn có thể lọc theo thành phố, số đêm, bếp riêng, máy giặt, thú cưng, tốc độ Wi-Fi, bàn làm việc hoặc các badge kiểm định tùy chọn.',
        },
      ]
    : [
        {
          q: `How does the ${serviceFeePct}% online service fee work?`,
          a: `You pay the ${serviceFeePct}% service fee online to confirm your booking and receive the exact property address. You pay the remaining stay rent directly to your host at check-in (${hostCommissionPct}% host commission).`,
        },
        {
          q: 'Are dedicated desks or Wi-Fi tests required to stay or host?',
          a: 'No. Hosting is free to join with zero mandatory hardware or speedtest gates. Hosts list real home amenities (kitchen, laundry, desks, Wi-Fi speed) and can optionally apply for Wi-Fi Verified or Work-Ready badges.',
        },
        {
          q: 'What is the minimum stay length?',
          a: `${minNights} nights. Pricing is calculated upfront for 7, 14, 21, or 30 nights, and you can add extra nights anytime.`,
        },
        {
          q: 'How can I filter for kitchens, laundry, or work setups?',
          a: 'On the Stays page, filter directly by city, stay length, private kitchen, in-unit washer, pet policy, Wi-Fi speed, desk setup, or optional verified badges.',
        },
      ];
  const faqs = [...cmsFaqs, ...defaultFaqs];

  return (
    <div className="space-y-20 pb-10">
      {/* Hero + Search Bar */}
      <section className="relative overflow-hidden border-b border-[#E5DFD3] bg-[#0F392E]">
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/hero-vietnam-workation.jpg"
            alt="Oceanfront terrace in Vietnam"
            className="h-full w-full object-cover opacity-55"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0F392E]/75 via-[#0F392E]/55 to-[#0F392E]/90" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 pb-14 pt-14 sm:px-6 sm:pt-20 lg:px-8">
          <div className="max-w-3xl space-y-5 text-[#FAF8F3]">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-medium backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-[#68D391]" />
              {isVi
                ? 'Chỗ ở thuê theo tuần & tháng khắp Việt Nam'
                : 'Weekly & monthly stays across Vietnam'}
            </div>

            <h1 className="font-serif-display text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
              {heroBanner
                ? isVi
                  ? heroBanner.titleVi
                  : heroBanner.titleEn
                : isVi
                  ? 'Ở thoải mái theo tuần và tháng tại Việt Nam.'
                  : 'Feel at home on longer stays in Vietnam.'}
            </h1>

            <p className="max-w-2xl text-base leading-relaxed text-[#DCECE5] sm:text-lg">
              {heroBanner && (heroBanner.bodyEn || heroBanner.bodyVi)
                ? isVi
                  ? heroBanner.bodyVi
                  : heroBanner.bodyEn
                : isVi
                  ? `Đặt phòng theo tuần hoặc tháng với chi phí rõ ràng: thanh toán ${serviceFeePct}% phí dịch vụ online để giữ chỗ, phần tiền thuê trả trực tiếp cho chủ nhà khi nhận phòng.`
                  : `Book apartments, villas, and local stays by the week or month. Pay the ${serviceFeePct}% service fee online to reserve, and pay your host at check-in.`}
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
              {isVi ? 'Ưu đãi thuê 1 tháng' : 'Monthly deals'}
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
              Wi-Fi Verified
            </Link>
            <Link
              href="/stays?workReady=1"
              className="rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-[#FAF8F3] backdrop-blur-sm hover:bg-white/20"
            >
              Work-Ready
            </Link>
          </div>

          <div className="mt-10 grid gap-3 border-t border-white/15 pt-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-3 text-sm text-[#E7F1EC]">
              <Zap className="h-5 w-5 shrink-0 text-[#E6B87A]" />
              <span>
                {isVi
                  ? `Trả ${serviceFeePct}% phí online, trả tiền thuê khi nhận phòng`
                  : `Pay ${serviceFeePct}% online, pay host at check-in`}
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm text-[#E7F1EC]">
              <Wifi className="h-5 w-5 shrink-0 text-[#E6B87A]" />
              <span>{isVi ? 'Thông số Wi-Fi rõ ràng & badge tùy chọn' : 'Clear Wi-Fi info & optional verified badges'}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-[#E7F1EC]">
              <Clock className="h-5 w-5 shrink-0 text-[#E6B87A]" />
              <span>{isVi ? 'Giá gói rõ ràng từ 7 đến 30 đêm' : 'Upfront pricing for 7 to 30 nights'}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-[#E7F1EC]">
              <Utensils className="h-5 w-5 shrink-0 text-[#E6B87A]" />
              <span>{isVi ? 'Bếp, máy giặt, bàn làm việc & khu vực quanh nhà' : 'Filter by kitchen, laundry, desk & neighborhood'}</span>
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
                ? `Hiển thị rõ tiền giữ chỗ ${serviceFeePct}% và phần trả chủ nhà khi nhận phòng cùng thông số Wi-Fi & tiện ích.`
                : `Upfront 1-week and 1-month totals with transparent ${serviceFeePct}% online fee, amenities, and optional badges.`}
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
                      {formatMoneyFromVnd(s.monthDisplayVnd, currency, { fxRates: feeConfig.fxRates })}
                    </span>
                    {s.compareMonthDisplayVnd && (
                      <span className="text-xs text-[#53635D] line-through">
                        {formatMoneyFromVnd(s.compareMonthDisplayVnd, currency, { fxRates: feeConfig.fxRates })}
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
                    {formatMoneyFromVnd(s.weekNightVnd, currency, { fxRates: feeConfig.fxRates })}/{isVi ? 'đêm' : 'nt'}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-[#C25E28]" />
                <div className="text-right">
                  <div className="font-semibold text-[#164E3F]">{isVi ? '1 tháng' : '1 month'}</div>
                  <div className="font-bold text-[#164E3F]">
                    {formatMoneyFromVnd(s.monthNightVnd, currency, { fxRates: feeConfig.fxRates })}/{isVi ? 'đêm' : 'nt'}
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
            {isVi ? 'Vì sao chọn VietNomad' : 'Built for longer stays'}
          </span>
          <h2 className="font-serif-display mt-1 text-3xl font-semibold text-[#17221E] sm:text-4xl">
            {isVi
              ? 'Thiết kế cho kỳ nghỉ và lưu trú dài ngày.'
              : 'Built for multi-week stays, not quick overnight trips.'}
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
                  isVi ? 'Thanh toán' : 'Payment split',
                  isVi
                    ? `Chỉ trả ${serviceFeePct}% phí dịch vụ online để giữ chỗ, tiền thuê trả trực tiếp cho chủ nhà khi nhận phòng.`
                    : `Pay the ${serviceFeePct}% service fee online to reserve, then pay your host directly at check-in.`,
                  isVi
                    ? 'Phải trả trước 100% tiền thuê ngay khi đặt phòng.'
                    : 'Pay 100% upfront weeks before arrival.',
                ],
                [
                  isVi ? 'Thông tin Wi-Fi' : 'Wi-Fi details',
                  isVi ? 'Tốc độ Wi-Fi do chủ nhà cung cấp và tùy chọn badge đã kiểm định.' : 'Host-reported speeds with optional verified badges.',
                  isVi ? 'Thông tin Wi-Fi chung chung, ít thông số cụ thể.' : 'Vague Wi-Fi mentions with no speed metrics.',
                ],
                [
                  isVi ? 'Minh bạch giá' : 'Pricing clarity',
                  isVi
                    ? `Hiện rõ phí online ${serviceFeePct}% và phần trả chủ nhà cho gói 7 đến 30 đêm.`
                    : `7 to 30-night totals split clearly between ${serviceFeePct}% online fee and check-in rent.`,
                  isVi ? 'Đến bước thanh toán cuối mới hiện thêm phụ phí.' : 'Extra service and cleaning fees added at checkout.',
                ],
                [
                  isVi ? 'Góc làm việc' : 'Workspaces',
                  isVi ? 'Lọc được bàn làm việc, ghế, màn hình rời và chỗ làm việc chung gần nhà.' : 'Filter by desk setup, chair, monitor, and nearby coworking when needed.',
                  isVi ? 'Ít thông tin chi tiết về bàn ghế hay không gian yên tĩnh.' : 'Limited details on workspace setups.',
                ],
                [
                  isVi ? 'Tiện nghi sinh hoạt' : 'Daily living',
                  isVi ? 'Ghi rõ loại bếp và máy giặt (riêng, chung hoặc dịch vụ) ngay trên mỗi chỗ ở.' : 'Clear kitchen and laundry options listed upfront on every stay.',
                  isVi ? 'Thường phải nhắn hỏi chủ nhà mới rõ chi tiết bếp và giặt đồ.' : 'Unclear kitchen or laundry setups.',
                ],
                [
                  isVi ? 'Quyền lợi chủ nhà' : 'Host terms',
                  isVi
                    ? `Chủ nhà nhận đủ 100% tiền thuê tại check-in, ${hostCommissionPct}% hoa hồng.`
                    : `Hosts keep 100% of check-in rent with ${hostCommissionPct}% commission.`,
                  isVi ? 'Thường thu 15% đến 20% hoa hồng mỗi đơn.' : 'Often charges 15% to 20% host commission.',
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
              {isVi ? 'Chọn không gian phù hợp với chuyến đi của bạn.' : 'Find a stay style that fits your trip.'}
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
              <Sparkles className="h-3.5 w-3.5" /> {isVi ? 'Thẻ hội viên · €99/năm' : 'Nomad Pass · €99/yr'}
            </span>
            <h3 className="font-serif-display text-2xl font-semibold text-[#17221E]">
              {isVi
                ? `Nhận lại ${premiumRewardPct}% tiền thưởng & hóa đơn miễn VAT`
                : `Get ${premiumRewardPct}% reward credit & VAT-free invoices`}
            </h3>
            <p className="text-sm text-[#53635D]">
              {isVi
                ? `Nhận ${premiumRewardPct}% tiền thưởng cho mỗi đặt phòng và xuất hóa đơn miễn VAT khi lưu mã số thuế.`
                : `Earn ${premiumRewardPct}% reward credit on bookings and enable VAT-free invoicing with your Tax ID.`}
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
              <Coffee className="h-3.5 w-3.5" /> {isVi ? 'Cộng đồng & Tiện ích' : 'Community & Extras'}
            </span>
            <h3 className="font-serif-display text-2xl font-semibold text-[#17221E]">
              {isVi ? 'Gặp gỡ địa phương, thuê màn hình và eSIM' : 'Local meetups, eSIMs, and equipment rentals'}
            </h3>
            <p className="text-sm text-[#53635D]">
              {isVi
                ? 'Tham gia buổi gặp mặt tại Đà Nẵng, TP.HCM, Hà Nội hoặc đặt trước eSIM 5G và màn hình rời giao tận nơi.'
                : 'Join local gatherings in Da Nang, Ho Chi Minh City, and Hanoi, or reserve 5G eSIMs and monitor rentals.'}
            </p>
          </div>
          <Link
            href="/community"
            className="mt-6 inline-flex items-center gap-2 font-semibold text-[#C25E28] hover:underline"
          >
            {isVi ? 'Xem sự kiện và tiện ích' : 'Explore community & extras'} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="flex flex-col justify-between rounded-3xl bg-[#164E3F] p-7 text-white lacquer-shadow">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-[#E6B87A]">
              <Building2 className="h-3.5 w-3.5" /> {isVi ? 'Dành cho chủ nhà' : 'For hosts'}
            </span>
            <h3 className="font-serif-display text-2xl font-semibold">
              {isVi
                ? `Giữ trọn 100% tiền thuê khi nhận phòng (${hostCommissionPct}% hoa hồng)`
                : `Keep 100% of rent at check-in (${hostCommissionPct}% commission)`}
            </h3>
            <p className="text-sm text-[#DCECE5]">
              {isVi
                ? `Khách trả ${serviceFeePct}% phí dịch vụ online để xác nhận, phần tiền thuê thu trực tiếp khi khách nhận phòng. Hỗ trợ đồng bộ lịch iCal.`
                : `Guests pay the ${serviceFeePct}% service fee online to confirm, then pay rent directly at check-in. Sync calendars easily with iCal.`}
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

      {/* CMS Guides & Local Stories */}
      {cmsGuides.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-[#164E3F]">
                {isVi ? 'Cẩm nang địa phương' : 'Local Guides'}
              </span>
              <h2 className="font-serif-display mt-1 text-3xl font-semibold text-[#17221E]">
                {isVi ? 'Kinh nghiệm lưu trú và khám phá Việt Nam' : 'Guides & stories across Vietnam'}
              </h2>
            </div>
            <Link href="/guides" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#164E3F] hover:underline">
              {isVi ? 'Xem tất cả cẩm nang' : 'Explore all guides'} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {cmsGuides.map((g) => (
              <Link
                key={g.id}
                href={`/guides/${g.slug}`}
                className="group flex flex-col justify-between rounded-3xl border border-[#E5DFD3] bg-white p-6 transition hover:border-[#164E3F] lacquer-shadow"
              >
                <div>
                  <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold">
                    <span className="rounded-full bg-[#E7F1EC] px-2.5 py-0.5 uppercase tracking-wide text-[#164E3F]">
                      {formatCmsTypeLabel(g.contentType, prefs.locale)}
                    </span>
                    {g.destinationNameEn && (
                      <span className="text-[#C25E28]">
                        {isVi ? g.destinationNameVi || g.destinationNameEn : g.destinationNameEn}
                      </span>
                    )}
                  </div>
                  <h3 className="font-serif-display text-xl font-semibold text-[#17221E] group-hover:text-[#164E3F]">
                    {isVi ? g.titleVi : g.titleEn}
                  </h3>
                  <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-[#53635D]">
                    {(isVi ? g.bodyVi : g.bodyEn).slice(0, 160)}
                  </p>
                </div>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#164E3F]">
                  {isVi ? 'Đọc bài viết' : 'Read guide'} <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

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
