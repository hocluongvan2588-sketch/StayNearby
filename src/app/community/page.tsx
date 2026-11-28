import Link from 'next/link';
import { getServerPreferences } from '@/lib/preferences';
import { dbQuery, toNum } from '@/lib/db';
import { getDestinations, listPublishedEvents } from '@/modules/catalog';
import { getEventTaxonomy } from '@/modules/platform-settings';
import { CommunityFilters } from '@/components/events/CommunityFilters';
import { EventCard } from '@/components/events/EventCard';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Cộng đồng | VietNomad Stays',
  description:
    'Khám phá sự kiện, workshop và hoạt động địa phương tại Việt Nam theo thành phố, thời gian và sở thích.',
};

interface SearchParams {
  destination?: string;
  when?: string;
  price?: string;
  language?: string;
  category?: string;
}

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const [prefs, taxonomy, destinations] = await Promise.all([
    getServerPreferences(),
    getEventTaxonomy(),
    getDestinations(),
  ]);
  const locale = prefs.locale;
  const isVi = locale === 'vi';

  const filters = {
    destinationId: sp.destination || undefined,
    when: sp.when || undefined,
    price: sp.price || undefined,
    language: sp.language || undefined,
    category: sp.category || undefined,
  };
  const hasFilters = Object.values(filters).some(Boolean);
  const events = await listPublishedEvents(filters);

  // Category counts + city counts (published upcoming events only) so the
  // discovery rows never advertise an empty destination/category.
  const [categoryCountsRes, cityCountsRes] = await Promise.all([
    dbQuery<{ category: string; n: string }>(
      `SELECT category, COUNT(*) AS n FROM nomad_events
       WHERE status = 'published' AND start_at IS NOT NULL AND start_at >= NOW()
         AND category IS NOT NULL
       GROUP BY category`
    ),
    dbQuery<{ destination_id: string; n: string }>(
      `SELECT destination_id, COUNT(*) AS n FROM nomad_events
       WHERE status = 'published' AND start_at IS NOT NULL AND start_at >= NOW()
         AND destination_id IS NOT NULL
       GROUP BY destination_id`
    ),
  ]);
  const categoryCounts = new Map(
    categoryCountsRes.rows.map((r) => [String(r.category), toNum(r.n, 0)])
  );
  const cityCounts = new Map(
    cityCountsRes.rows.map((r) => [String(r.destination_id), toNum(r.n, 0)])
  );
  const activeCategory = sp.category || '';
  const activeDestination = sp.destination || '';

  const categoryLabel = (slug: string) => {
    const found = taxonomy.categories.find((c) => c.slug === slug);
    if (!found) return slug;
    return isVi ? found.nameVi : found.nameEn;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-tight text-[#17221E] sm:text-4xl">
        {isVi ? 'Cộng đồng' : 'Community'}
      </h1>

      <div className="mt-6">
        <CommunityFilters
          cities={destinations.map((d) => ({
            id: d.id,
            nameEn: d.nameEn,
            nameVi: d.nameVi,
          }))}
          taxonomy={taxonomy}
          locale={locale}
        />
      </div>

      <section className="mt-10" aria-label={isVi ? 'Sự kiện sắp tới' : 'Upcoming events'}>
        {events.length > 0 ? (
          <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((ev) => (
              <EventCard key={ev.id} event={ev} locale={locale} />
            ))}
          </div>
        ) : (
          <div className="max-w-xl space-y-3">
            <p className="text-sm text-[#53635D]">
              {hasFilters
                ? isVi
                  ? 'Không có sự kiện khớp với bộ lọc này.'
                  : 'No events match these filters.'
                : isVi
                  ? 'Chưa có sự kiện sắp tới. quay lại sau hoặc gửi sự kiện của bạn.'
                  : 'No upcoming events yet. Check back later or submit your own.'}
            </p>
            {hasFilters ? (
              <Link
                href="/community"
                className="text-sm font-semibold text-[#164E3F] hover:underline"
              >
                {isVi ? 'Xóa bộ lọc' : 'Clear filters'}
              </Link>
            ) : (
              <Link
                href="/community/submit"
                className="text-sm font-semibold text-[#164E3F] hover:underline"
              >
                {isVi ? 'Đăng sự kiện' : 'Submit an event'}
              </Link>
            )}
          </div>
        )}
      </section>

      {taxonomy.categories.some((c) => (categoryCounts.get(c.slug) ?? 0) > 0) && (
        <section className="mt-14">
          <h2 className="text-xl font-semibold tracking-tight text-[#17221E] sm:text-2xl">
            {isVi ? 'Khám phá theo danh mục' : 'Explore by category'}
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {taxonomy.categories
              .filter((c) => (categoryCounts.get(c.slug) ?? 0) > 0)
              .map((c) => {
                const active = activeCategory === c.slug;
                const next = new URLSearchParams();
                if (activeDestination) next.set('destination', activeDestination);
                if (!active) next.set('category', c.slug);
                const qs = next.toString();
                return (
                  <Link
                    key={c.slug}
                    href={qs ? `/community?${qs}` : '/community'}
                    className={
                      active
                        ? 'rounded-full bg-[#164E3F] px-4 py-2 text-sm font-semibold text-white'
                        : 'rounded-full border border-[#E5DFD3] bg-white px-4 py-2 text-sm font-medium text-[#17221E] hover:border-[#164E3F]'
                    }
                  >
                    {isVi ? c.nameVi : c.nameEn}
                  </Link>
                );
              })}
          </div>
        </section>
      )}

      {destinations.some((d) => (cityCounts.get(d.id) ?? 0) > 0) && (
        <section className="mt-14">
          <h2 className="text-xl font-semibold tracking-tight text-[#17221E] sm:text-2xl">
            {isVi ? 'Khám phá theo thành phố' : 'Explore by city'}
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {destinations
              .filter((d) => (cityCounts.get(d.id) ?? 0) > 0)
              .map((d) => {
                const n = cityCounts.get(d.id) ?? 0;
                const active = activeDestination === d.id;
                const next = new URLSearchParams();
                if (activeCategory) next.set('category', activeCategory);
                if (!active) next.set('destination', d.id);
                const qs = next.toString();
                return (
                  <Link
                    key={d.id}
                    href={qs ? `/community?${qs}` : '/community'}
                    className="group"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={d.heroImage}
                      alt={isVi ? d.nameVi : d.nameEn}
                      loading="lazy"
                      className="aspect-[4/3] w-full rounded-2xl object-cover transition duration-300 group-hover:scale-[1.03]"
                    />
                    <div className="mt-2 flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold text-[#17221E] group-hover:text-[#164E3F]">
                        {isVi ? d.nameVi : d.nameEn}
                      </span>
                      <span className="text-xs text-[#53635D]">
                        {isVi
                          ? `${n} sự kiện`
                          : n === 1
                            ? '1 event'
                            : `${n} events`}
                      </span>
                    </div>
                  </Link>
                );
              })}
          </div>
        </section>
      )}

      <p className="mt-14 border-t border-[#E5DFD3] pt-6 text-sm text-[#53635D]">
        {isVi ? 'Tổ chức sự kiện?' : 'Hosting an event?'}{' '}
        <Link
          href="/community/submit"
          className="font-semibold text-[#164E3F] hover:underline"
        >
          {isVi ? 'Đăng sự kiện lên VietNomad' : 'Submit it to VietNomad'}
        </Link>
      </p>
    </div>
  );
}
