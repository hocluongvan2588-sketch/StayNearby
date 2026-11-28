import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/session';
import { dbQuery } from '@/lib/db';
import { getServerPreferences } from '@/lib/preferences';
import {
  getDestinations,
  getLifestyles,
  searchStays,
} from '@/modules/catalog';
import { getPublishedCmsContents } from '@/modules/cms';
import { HomeSearchBar } from '@/components/HomeSearchBar';
import { SectionHeader } from '@/components/SectionHeader';
import { StayRow } from '@/components/StayRow';

export const dynamic = 'force-dynamic';

// Technical how-to articles belong in the help center, not the travel
// guides rail on the homepage.
const TECHNICAL_GUIDE_SLUGS = new Set(['wifi-speed-test-guide']);

// Vietnamese category names read naturally in sentence case; lifestyle
// names come from the database in title case.
function sentenceCaseVi(value: string): string {
  const lower = value.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export default async function HomePage() {
  const [prefs, user, destinations, lifestyles, stays, cmsItems] =
    await Promise.all([
      getServerPreferences(),
      getCurrentUser(),
      getDestinations(),
      getLifestyles(),
      searchStays({ sort: 'featured' }),
      getPublishedCmsContents({
        contentTypes: [
          'hero_banner',
          'article',
          'destination_guide',
          'neighborhood_guide',
          'community_story',
          'landing_page',
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

  const dealsStays = [...stays]
    .filter((s) => s.dealSavingsPct > 0)
    .sort((a, b) => b.dealSavingsPct - a.dealSavingsPct)
    .slice(0, 3);

  const heroBanner = cmsItems.find((c) => c.contentType === 'hero_banner');
  const cmsGuides = cmsItems
    .filter(
      (c) =>
        [
          'article',
          'destination_guide',
          'neighborhood_guide',
          'community_story',
          'landing_page',
        ].includes(c.contentType) && !TECHNICAL_GUIDE_SLUGS.has(c.slug)
    )
    .slice(0, 3);

  return (
    <div className="space-y-20 pb-12">
      {/* Hero + Search */}
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
                  : 'Find your ideal place to live in Vietnam, from week-long stays to months of exploring and working in a new destination.'}
            </p>
          </div>

          <div className="mt-8">
            <HomeSearchBar destinations={destinations} lifestyles={lifestyles} />
          </div>

          {/* Quick destination shortcuts */}
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
        </div>
      </section>

      {/* Featured stays */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          title={isVi ? 'Chỗ ở nổi bật' : 'Featured stays'}
          linkHref="/stays"
          linkLabel={isVi ? 'Xem tất cả chỗ ở' : 'Browse all stays'}
        />
        <StayRow
          stays={stays}
          savedIds={Array.from(savedIds)}
          isAuthenticated={Boolean(user)}
        />
      </section>

      {/* Long-stay deals — same StayCard as the featured grid */}
      {dealsStays.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeader
            title={isVi ? 'Ưu đãi lưu trú dài ngày' : 'Long-stay deals'}
            linkHref="/deals"
            linkLabel={isVi ? 'Xem tất cả ưu đãi' : 'See all deals'}
          />
          <StayRow
            stays={dealsStays}
            savedIds={Array.from(savedIds)}
            isAuthenticated={Boolean(user)}
          />
        </section>
      )}

      {/* Popular destinations */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader title={isVi ? 'Điểm đến phổ biến' : 'Popular destinations'} />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {destinations.map((d) => (
            <Link key={d.id} href={`/destinations/${d.slug}`} className="group block">
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-[#F2EDE3]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={d.heroImage}
                  alt={isVi ? d.nameVi : d.nameEn}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                />
              </div>
              <div className="mt-3 flex items-baseline justify-between gap-2">
                <h3 className="text-[16px] font-semibold text-[#17221E] group-hover:text-[#164E3F]">
                  {isVi ? d.nameVi : d.nameEn}
                </h3>
                {d.liveStaysCount > 0 && (
                  <span className="shrink-0 text-[13px] text-[#53635D]">
                    {d.liveStaysCount}{' '}
                {isVi ? 'chỗ ở' : d.liveStaysCount === 1 ? 'stay' : 'stays'}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Stays by style */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          title={isVi ? 'Tìm chỗ ở theo sở thích' : 'Find stays by style'}
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {lifestyles.map((l) => (
            <Link key={l.id} href={`/lifestyles/${l.slug}`} className="group block">
              <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-[#F2EDE3]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={l.heroImage}
                  alt={isVi ? l.nameVi : l.nameEn}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                />
              </div>
              <h3 className="mt-3 text-[15px] font-semibold text-[#17221E] group-hover:text-[#164E3F]">
                {isVi ? sentenceCaseVi(l.nameVi) : l.nameEn}
              </h3>
            </Link>
          ))}
        </div>
      </section>

      {/* Guides — editorial, text-led (cover image renders when CMS provides one) */}
      {cmsGuides.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeader
            title={
              isVi ? 'Cẩm nang lưu trú & Khám phá Việt Nam' : 'Guides & local stories across Vietnam'
            }
            linkHref="/guides"
            linkLabel={isVi ? 'Xem tất cả cẩm nang' : 'Explore all guides'}
          />
          <div className="grid gap-x-8 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
            {cmsGuides.map((g) => (
              <Link key={g.id} href={`/guides/${g.slug}`} className="group block">
                {g.featuredImageUrl ? (
                  <div className="mb-4 aspect-[16/10] overflow-hidden rounded-2xl bg-[#F2EDE3]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={g.featuredImageUrl}
                      alt={isVi ? g.titleVi : g.titleEn}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                  </div>
                ) : null}
                {(g.destinationNameEn || g.categoryNameEn) && (
                  <p className="mb-2 text-[13px] font-medium text-[#C25E28]">
                    {g.destinationNameEn
                      ? isVi
                        ? g.destinationNameVi || g.destinationNameEn
                        : g.destinationNameEn
                      : isVi
                        ? g.categoryNameVi || g.categoryNameEn
                        : g.categoryNameEn}
                  </p>
                )}
                <h3 className="font-serif-display text-xl font-semibold leading-snug text-[#17221E] group-hover:text-[#164E3F]">
                  {isVi ? g.titleVi : g.titleEn}
                </h3>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[#53635D]">
                  {(isVi && g.bodyVi ? g.bodyVi : g.bodyEn).slice(0, 160)}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
