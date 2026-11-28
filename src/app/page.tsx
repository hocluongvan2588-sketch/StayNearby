import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  Clock,
  Coffee,
  MapPin,
  ShieldCheck,
  Sparkles,
  Utensils,
} from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/session';
import { dbQuery } from '@/lib/db';
import { formatCmsTypeLabel, formatMoneyFromVnd } from '@/lib/i18n';
import { getServerPreferences } from '@/lib/preferences';
import {
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
  const [prefs, user, destinations, lifestyles, stays, feeConfig, cmsItems] =
    await Promise.all([
      getServerPreferences(),
      getCurrentUser(),
      getDestinations(),
      getLifestyles(),
      searchStays({ sort: 'featured' }),
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
      ['article', 'destination_guide', 'community_story', 'landing_page'].includes(
        c.contentType
      )
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
          q: `Cách thức thanh toán 2 bước (${serviceFeePct}% online) hoạt động như thế nào?`,
          a: `Khi đặt phòng trên VietNomad Stays, bạn thanh toán ${serviceFeePct}% phí dịch vụ online để xác nhận giữ phòng và nhận địa chỉ chính xác — đây là phí dịch vụ của nền tảng, không phải tiền đặt cọc và không được khấu trừ vào tiền thuê. Toàn bộ tiền thuê nhà còn lại bạn trả trực tiếp cho chủ nhà khi nhận phòng (${hostCommissionPct}% hoa hồng chủ nhà).`,
        },
        {
          q: 'Chỗ ở trên VietNomad phù hợp với những đối tượng khách nào?',
          a: 'Nền tảng dành cho khách du lịch trải nghiệm, cặp đôi, gia đình và người làm việc từ xa tìm kiếm căn hộ, biệt thự, boutique stay thuê theo tuần hoặc tháng với không gian sống đầy đủ và gợi ý khám phá khu vực bản địa.',
        },
        {
          q: 'Thời gian lưu trú tối thiểu là bao lâu?',
          a: `Tối thiểu ${minNights} đêm. Giá được tính minh bạch sẵn cho gói 7, 14, 21 hoặc 30 đêm và có thể cộng thêm đêm lẻ linh hoạt.`,
        },
        {
          q: 'Làm sao tìm chỗ ở theo tiện nghi sinh hoạt hoặc góc làm việc?',
          a: 'Tại trang Chỗ ở, bạn có thể lọc theo thành phố, phong cách trải nghiệm, bếp riêng, máy giặt, thân thiện thú cưng, hoặc lọc thêm tốc độ Wi-Fi và bàn làm việc riêng khi có nhu cầu.',
        },
      ]
    : [
        {
          q: `How does the ${serviceFeePct}% online booking fee work?`,
          a: `You pay the ${serviceFeePct}% service fee online to confirm your reservation and unlock the exact property address — this is VietNomad's service fee, not a deposit, and it is not deducted from the rent. You pay the stay rent directly to your host at check-in (${hostCommissionPct}% host commission).`,
        },
        {
          q: 'Who are VietNomad Stays designed for?',
          a: 'Travelers, couples, families, and remote workers looking for curated apartments, villas, and local stays by the week or month—combining comfortable living with neighborhood discovery.',
        },
        {
          q: 'What is the minimum stay length?',
          a: `${minNights} nights. Pricing is calculated transparently upfront for 7, 14, 21, or 30 nights, and you can add extra nights as needed.`,
        },
        {
          q: 'Can I filter for home comforts as well as workspace setups?',
          a: 'Yes. Filter on the Stays page by city, travel style, full kitchen, in-unit laundry, pet policy, and optionally by Wi-Fi speed or dedicated desk setup.',
        },
      ];
  const faqs = [...cmsFaqs, ...defaultFaqs];

  return (
    <div className="space-y-20 pb-12">
      {/* Hero + Search Bar */}
      <section className="relative overflow-hidden border-b border-[#E5DFD3] bg-[#0F392E]">
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/hero-vietnam-workation.jpg"
            alt="Oceanfront terrace in Vietnam"
            className="h-full w-full object-cover opacity-55"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0F392E]/70 via-[#0F392E]/45 to-[#0F392E]/90" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-16 sm:px-6 sm:pt-24 lg:px-8">
          <div className="max-w-3xl space-y-5 text-[#FAF8F3]">
            <h1 className="font-serif-display text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
              {heroBanner
                ? isVi
                  ? heroBanner.titleVi
                  : heroBanner.titleEn
                : isVi
                  ? 'Ở trọn vẹn hơn. Khám phá Việt Nam theo nhịp sống bản địa.'
                  : 'Stay longer. Live & explore Vietnam like a local.'}
            </h1>

            <p className="max-w-2xl text-base leading-relaxed text-[#E7F1EC] sm:text-lg">
              {heroBanner && (heroBanner.bodyEn || heroBanner.bodyVi)
                ? isVi
                  ? heroBanner.bodyVi
                  : heroBanner.bodyEn
                : isVi
                  ? 'Tìm không gian sống lý tưởng tại Việt Nam, từ những kỳ lưu trú theo tuần đến những tháng ngày khám phá và làm việc tại một điểm đến mới.'
                  : 'Find your ideal place to live in Vietnam — from week-long stays to months of exploring and working from a new destination.'}
            </p>
          </div>

          <div className="mt-8">
            <HomeSearchBar destinations={destinations} lifestyles={lifestyles} />
          </div>

          {/* Quick Destination & Experience Shortcuts */}
          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
            <Link
              href="/deals"
              className="rounded-full bg-[#C25E28] px-3.5 py-1.5 font-semibold text-white hover:bg-[#ad5020]"
            >
              {isVi ? 'Ưu đãi thuê theo tháng' : 'Monthly deals'}
            </Link>
            {destinations.slice(0, 4).map((d) => (
              <Link
                key={d.id}
                href={`/destinations/${d.slug}`}
                className="rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 font-medium text-[#FAF8F3] backdrop-blur-sm hover:bg-white/20"
              >
                {isVi ? d.nameVi : d.nameEn}
              </Link>
            ))}
          </div>

          {/* Four Pillars: Stay · Live · Explore · Transparent Booking */}
          <div className="mt-10 grid gap-4 border-t border-white/15 pt-7 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-start gap-3 text-sm text-[#E7F1EC]">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#E6B87A]" />
              <span>
                {isVi
                  ? 'Minh bạch chi phí từ đầu — thấy rõ tổng tiền trước khi xác nhận'
                  : 'Transparent pricing — see the full cost before you confirm'}
              </span>
            </div>
            <div className="flex items-start gap-3 text-sm text-[#E7F1EC]">
              <Utensils className="mt-0.5 h-5 w-5 shrink-0 text-[#E6B87A]" />
              <span>
                {isVi
                  ? 'Không gian sống đầy đủ bếp, máy giặt và tiện nghi sinh hoạt'
                  : 'Full kitchens, laundry, and thoughtful home comforts'}
              </span>
            </div>
            <div className="flex items-start gap-3 text-sm text-[#E7F1EC]">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#E6B87A]" />
              <span>
                {isVi
                  ? 'Gợi ý ẩm thực, quán cà phê và trải nghiệm ngay quanh nhà'
                  : 'Curated local dining, cafés, and neighborhood discovery'}
              </span>
            </div>
            <div className="flex items-start gap-3 text-sm text-[#E7F1EC]">
              <Clock className="mt-0.5 h-5 w-5 shrink-0 text-[#E6B87A]" />
              <span>
                {isVi
                  ? 'Giá gói minh bạch từ 7 đến 30 đêm, có lọc Wi-Fi & bàn làm việc khi cần'
                  : 'Transparent 7 to 30-night pricing, plus workspace options when needed'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Inventory */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-[26px] font-semibold tracking-tight text-[#17221E] sm:text-[32px]">
              {isVi
                ? 'Không gian sống thoải mái. Giá thuê minh bạch.'
                : 'Spaces built for living. Prices built for staying.'}
            </h2>
            <p className="mt-1.5 text-sm text-[#53635D]">
              {isVi
                ? 'Hiển thị sẵn giá trọn gói theo tuần và tháng, rõ ràng ngay từ đầu.'
                : 'Upfront weekly and monthly totals — clear from the very first look.'}
            </p>
          </div>
          <Link
            href="/stays"
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-[#164E3F] hover:underline"
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
      {dealsStays.length > 0 && (
        <section className="border-y border-[#E5DFD3] bg-[#F2EDE3]/60 py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <h2 className="text-[26px] font-semibold tracking-tight text-[#17221E] sm:text-[32px]">
                  {isVi
                    ? 'Ưu đãi tốt nhất cho kỳ lưu trú 1 tháng'
                    : 'Best savings on 30-night stays'}
                </h2>
                <p className="mt-1 text-sm text-[#53635D]">
                  {isVi
                    ? 'Mức giảm giá trực tiếp khi đặt trọn gói 30 đêm tại các chỗ ở được chọn lọc.'
                    : 'Direct monthly discounts already factored into total pricing.'}
                </p>
              </div>
              <Link
                href="/deals"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#C25E28] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#ad5020]"
              >
                {isVi ? 'Xem tất cả ưu đãi' : 'See all deals'}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {dealsStays.map((s) => (
                <Link key={s.id} href={`/stays/${s.slug}`} className="group block">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-[#F2EDE3]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={s.heroImage}
                      alt={isVi ? s.titleVi : s.titleEn}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                    <span className="absolute left-3 top-3 rounded-full bg-[#C25E28] px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
                      {isVi ? `Giảm ${s.dealSavingsPct}%` : `Save ${s.dealSavingsPct}%`}
                    </span>
                  </div>
                  <div className="pt-3">
                    <div className="text-xs font-medium text-[#53635D]">
                      {isVi ? s.destinationNameVi : s.destinationNameEn} · {s.dealMonthLabel}
                    </div>
                    <h3 className="mt-0.5 line-clamp-1 text-[16px] font-semibold text-[#17221E] group-hover:text-[#164E3F]">
                      {isVi ? s.titleVi : s.titleEn}
                    </h3>
                    <div className="mt-1.5 flex items-baseline gap-2">
                      <span className="text-sm font-semibold text-[#17221E]">
                        {formatMoneyFromVnd(s.monthDisplayVnd, currency, {
                          fxRates: feeConfig.fxRates,
                        })}
                      </span>
                      {s.compareMonthDisplayVnd && (
                        <span className="text-xs text-[#53635D] line-through">
                          {formatMoneyFromVnd(s.compareMonthDisplayVnd, currency, {
                            fxRates: feeConfig.fxRates,
                          })}
                        </span>
                      )}
                      <span className="text-xs text-[#53635D]">
                        / 30 {isVi ? 'đêm' : 'nights'}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Stay Longer Proof */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 max-w-2xl">
          <h2 className="text-[26px] font-semibold tracking-tight text-[#17221E] sm:text-[32px]">
            {isVi
              ? 'Ở càng lâu, giá mỗi đêm càng tiết kiệm'
              : 'Stay longer and pay less per night'}
          </h2>
          <p className="mt-1.5 text-sm text-[#53635D]">
            {isVi
              ? 'Đơn giá tự động giảm khi bạn chuyển từ gói 1 tuần sang 1 tháng, không phí ẩn.'
              : 'Nightly rates drop automatically as you move from 1-week to 1-month stays.'}
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {stayLongerProof.map((s) => (
            <Link
              key={s.id}
              href={`/stays/${s.slug}`}
              className="rounded-2xl border border-[#E5DFD3] bg-white p-5 transition hover:border-[#164E3F]"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="rounded-full bg-[#E7F1EC] px-2.5 py-0.5 text-xs font-semibold text-[#164E3F]">
                  {isVi
                    ? `Giảm ${s.stayLongerSavingsPct}%/đêm`
                    : `Save ${s.stayLongerSavingsPct}%`}
                </span>
                <span className="text-xs text-[#53635D]">
                  {isVi ? s.destinationNameVi : s.destinationNameEn}
                </span>
              </div>
              <h3 className="line-clamp-1 text-base font-semibold text-[#17221E]">
                {isVi ? s.titleVi : s.titleEn}
              </h3>
              <div className="mt-3 flex items-center justify-between rounded-xl bg-[#FAF8F3] p-3 text-xs">
                <div>
                  <div className="text-[#53635D]">{isVi ? '1 tuần' : '1 week'}</div>
                  <div className="font-semibold text-[#17221E]">
                    {formatMoneyFromVnd(s.weekNightVnd, currency, {
                      fxRates: feeConfig.fxRates,
                    })}
                    /{isVi ? 'đêm' : 'nt'}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-[#C25E28]" />
                <div className="text-right">
                  <div className="font-semibold text-[#164E3F]">
                    {isVi ? '1 tháng' : '1 month'}
                  </div>
                  <div className="font-bold text-[#164E3F]">
                    {formatMoneyFromVnd(s.monthNightVnd, currency, {
                      fxRates: feeConfig.fxRates,
                    })}
                    /{isVi ? 'đêm' : 'nt'}
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

      {/* Vietnam Interactive Destination Map */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 max-w-2xl">
          <h2 className="text-[26px] font-semibold tracking-tight text-[#17221E] sm:text-[32px]">
            {isVi
              ? 'Bạn muốn khám phá điểm đến nào tại Việt Nam?'
              : 'Where will you stay in Vietnam?'}
          </h2>
          <p className="mt-1.5 text-sm text-[#53635D]">
            {isVi
              ? 'Chọn từng thành phố để xem mùa đẹp nhất, chi phí sinh hoạt trung bình và chỗ ở đang mở.'
              : 'Explore climate, monthly living costs, visa notes, and open stays in each city.'}
          </p>
        </div>
        <VietnamMap destinations={destinations} />
      </section>

      {/* Lifestyles */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-[26px] font-semibold tracking-tight text-[#17221E] sm:text-[32px]">
            {isVi
              ? 'Chọn phong cách sống phù hợp với chuyến đi'
              : 'Find a stay style that fits your trip'}
          </h2>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {lifestyles.map((l) => (
            <Link
              key={l.id}
              href={`/lifestyles/${l.slug}`}
              className="group relative overflow-hidden rounded-2xl bg-[#0F392E] text-white"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={l.heroImage}
                alt={isVi ? l.nameVi : l.nameEn}
                className="aspect-[4/3] w-full object-cover opacity-80 transition duration-500 group-hover:scale-105 group-hover:opacity-70"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <h3 className="text-lg font-semibold">
                  {isVi ? l.nameVi : l.nameEn}
                </h3>
                <p className="mt-1 line-clamp-2 text-xs text-[#E7F1EC]">
                  {isVi ? l.descriptionVi : l.descriptionEn}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Transparent Comparison Table */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 max-w-2xl">
          <h2 className="text-[26px] font-semibold tracking-tight text-[#17221E] sm:text-[32px]">
            {isVi
              ? 'Thiết kế cho kỳ nghỉ và lưu trú dài ngày'
              : 'Built for longer stays, not quick overnight trips'}
          </h2>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-[#E5DFD3] bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-[#FAF8F3] text-xs font-semibold text-[#53635D]">
              <tr>
                <th className="px-6 py-4">{isVi ? 'Tiêu chí' : 'Comparison'}</th>
                <th className="px-6 py-4 text-[#164E3F]">VietNomad Stays</th>
                <th className="px-6 py-4">
                  {isVi ? 'Nền tảng đặt phòng thông thường' : 'Typical booking platforms'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DFD3]">
              {[
                [
                  isVi ? 'Thanh toán' : 'Payment split',
                  isVi
                    ? 'Giữ chỗ online, phần tiền thuê thanh toán trực tiếp cho chủ nhà khi nhận phòng.'
                    : `Reserve online, then settle rent directly with your host at check-in.`,
                  isVi
                    ? 'Thường yêu cầu thanh toán 100% trước nhiều tuần.'
                    : 'Pay 100% upfront weeks before arrival.',
                ],
                [
                  isVi ? 'Tiện nghi sinh hoạt' : 'Daily living',
                  isVi
                    ? 'Minh bạch thông tin bếp, máy giặt, diện tích và khu vực xung quanh ngay từ đầu.'
                    : 'Upfront details on kitchen, laundry, floor size, and neighborhood spots.',
                  isVi
                    ? 'Ít thông tin chi tiết cho lưu trú nhiều tuần.'
                    : 'Often unclear kitchen or laundry setups.',
                ],
                [
                  isVi ? 'Khám phá bản địa' : 'Local discovery',
                  isVi
                    ? 'Tích hợp gợi ý ẩm thực, cà phê, điểm tham quan và nhịp sống địa phương quanh từng chỗ ở.'
                    : 'Curated local dining, cafés, sights, and neighborhood highlights around each stay.',
                  isVi
                    ? 'Chỉ tập trung vào phòng ngủ, thiếu bối cảnh khu phố.'
                    : 'Focused only on room inventory with sparse local context.',
                ],
                [
                  isVi ? 'Khi cần làm việc' : 'Optional workspace',
                  isVi
                    ? 'Lọc tốc độ Wi-Fi, bàn ghế làm việc và kiểm định thực tế chỉ khi bạn cần.'
                    : 'Filter by Wi-Fi speeds, desk setup, and verification badges whenever needed.',
                  isVi
                    ? 'Thông số Wi-Fi chung chung, không rõ thực tế.'
                    : 'Vague Wi-Fi claims with little detail.',
                ],
                [
                  isVi ? 'Quyền lợi chủ nhà' : 'Host terms',
                  isVi
                    ? `Chủ nhà giữ trọn 100% tiền thuê tại check-in (${hostCommissionPct}% hoa hồng chủ nhà).`
                    : `Hosts keep 100% of check-in rent (${hostCommissionPct}% commission).`,
                  isVi
                    ? 'Thường thu 15% đến 20% hoa hồng chủ nhà.'
                    : 'Often charges 15% to 20% host commission.',
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

      {/* Membership + Community + Host CTA */}
      <section className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-3 lg:px-8">
        <div className="flex flex-col justify-between rounded-2xl border border-[#E5DFD3] bg-white p-7">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#FAF8F3] px-3 py-1 text-xs font-semibold text-[#A67C2E]">
              <Sparkles className="h-3.5 w-3.5" />{' '}
              {isVi ? 'Thẻ hội viên · €99/năm' : 'Nomad Pass · €99/yr'}
            </span>
            <h3 className="text-xl font-semibold text-[#17221E]">
              {isVi
                ? `Hoàn ${premiumRewardPct}% tiền thưởng & hóa đơn miễn VAT`
                : `Get ${premiumRewardPct}% reward credit & VAT-free invoices`}
            </h3>
            <p className="text-sm leading-relaxed text-[#53635D]">
              {isVi
                ? `Tích lũy ${premiumRewardPct}% tiền thưởng cho mỗi đặt phòng và xuất hóa đơn miễn VAT khi lưu mã số thuế.`
                : `Earn ${premiumRewardPct}% reward credit on bookings and enable VAT-free invoicing with your Tax ID.`}
            </p>
          </div>
          <Link
            href="/membership"
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#A67C2E] hover:underline"
          >
            {isVi ? 'Xem quyền lợi hội viên' : 'View membership'}{' '}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-[#E5DFD3] bg-white p-7">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#FAEDE5] px-3 py-1 text-xs font-semibold text-[#C25E28]">
              <Coffee className="h-3.5 w-3.5" />{' '}
              {isVi ? 'Cộng đồng & Tiện ích' : 'Community & Extras'}
            </span>
            <h3 className="text-xl font-semibold text-[#17221E]">
              {isVi
                ? 'Sự kiện bản địa, thuê thiết bị và eSIM 5G'
                : 'Local meetups, eSIMs, and equipment rentals'}
            </h3>
            <p className="text-sm leading-relaxed text-[#53635D]">
              {isVi
                ? 'Tham gia các buổi gặp gỡ tại Đà Nẵng, TP.HCM, Hà Nội hoặc đặt trước eSIM 5G và thiết bị giao tận phòng.'
                : 'Join local gatherings in Da Nang, Ho Chi Minh City, and Hanoi, or reserve 5G eSIMs and rental gear.'}
            </p>
          </div>
          <Link
            href="/community"
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#C25E28] hover:underline"
          >
            {isVi ? 'Khám phá cộng đồng' : 'Explore community & extras'}{' '}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="flex flex-col justify-between rounded-2xl bg-[#164E3F] p-7 text-white">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-[#E6B87A]">
              <Building2 className="h-3.5 w-3.5" /> {isVi ? 'Dành cho chủ nhà' : 'For hosts'}
            </span>
            <h3 className="text-xl font-semibold">
              {isVi
                ? `Giữ trọn 100% tiền thuê (${hostCommissionPct}% hoa hồng)`
                : `Keep 100% of rent at check-in (${hostCommissionPct}% commission)`}
            </h3>
            <p className="text-sm leading-relaxed text-[#DCECE5]">
              {isVi
                ? 'Khách thanh toán online để giữ phòng, bạn nhận toàn bộ tiền thuê khi nhận phòng. Hỗ trợ đồng bộ lịch iCal.'
                : 'Guests reserve online; you collect the full rent at check-in. Sync calendars easily with iCal.'}
            </p>
          </div>
          <Link
            href="/list-your-stay"
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#E6B87A] hover:underline"
          >
            {isVi ? 'Đăng chỗ ở miễn phí' : 'List your property'}{' '}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* CMS Guides & Local Stories */}
      {cmsGuides.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <h2 className="text-[26px] font-semibold tracking-tight text-[#17221E]">
                {isVi
                  ? 'Cẩm nang lưu trú & Khám phá Việt Nam'
                  : 'Guides & local stories across Vietnam'}
              </h2>
            </div>
            <Link
              href="/guides"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#164E3F] hover:underline"
            >
              {isVi ? 'Xem tất cả cẩm nang' : 'Explore all guides'}{' '}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {cmsGuides.map((g) => (
              <Link
                key={g.id}
                href={`/guides/${g.slug}`}
                className="group flex flex-col justify-between rounded-2xl border border-[#E5DFD3] bg-white p-6 transition hover:border-[#164E3F]"
              >
                <div>
                  <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold">
                    <span className="rounded-full bg-[#E7F1EC] px-2.5 py-0.5 text-[#164E3F]">
                      {formatCmsTypeLabel(g.contentType, prefs.locale)}
                    </span>
                    {g.destinationNameEn && (
                      <span className="text-[#C25E28]">
                        {isVi
                          ? g.destinationNameVi || g.destinationNameEn
                          : g.destinationNameEn}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-[#17221E] group-hover:text-[#164E3F]">
                    {isVi ? g.titleVi : g.titleEn}
                  </h3>
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[#53635D]">
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
          <h2 className="text-[26px] font-semibold tracking-tight text-[#17221E]">
            {isVi
              ? 'Câu hỏi thường gặp trước khi đặt phòng'
              : 'Common questions before you book'}
          </h2>
        </div>

        <div className="divide-y divide-[#E5DFD3] border-y border-[#E5DFD3]">
          {faqs.map((item) => (
            <details key={item.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-[#17221E]">
                <span>{item.q}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-[#53635D] transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-[#53635D]">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
