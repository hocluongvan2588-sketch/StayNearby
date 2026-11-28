import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getCurrentUser } from '@/lib/auth/session';
import { getServerPreferences } from '@/lib/preferences';
import { dbQuery } from '@/lib/db';
import {
  formatEventDateTimeLabel,
  formatEventTimeLabel,
  type Locale,
} from '@/lib/i18n';
import {
  getCommunityEventBySlug,
  getRelatedCommunityEvents,
  searchStays,
  type CommunityEvent,
} from '@/modules/catalog';
import { getEventTaxonomy } from '@/modules/platform-settings';
import { EventCard, formatEventPriceLabel } from '@/components/events/EventCard';
import { EventRegistration } from '@/components/events/EventRegistration';
import { ShareButton } from '@/components/events/ShareButton';
import { StayCard } from '@/components/StayCard';

export const dynamic = 'force-dynamic';

async function buildMetadata(event: CommunityEvent): Promise<Metadata> {
  const title = event.titleEn || event.titleVi;
  const description = (event.descriptionEn || event.descriptionVi || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
  return {
    title: `${title} | VietNomad Community`,
    description: description || undefined,
    openGraph: {
      title,
      description: description || undefined,
      images: event.imageUrl ? [event.imageUrl] : undefined,
      type: 'article',
    },
  };
}

function directionsUrl(event: CommunityEvent): string {
  if (event.mapsUrl) return event.mapsUrl;
  const q = [event.venueEn || event.venueVi, event.cityEn]
    .filter(Boolean)
    .join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/** Module-scope helper keeps render itself free of direct clock calls. */
function hasEventStarted(startAt: string | null): boolean {
  if (!startAt) return false;
  const t = new Date(startAt).getTime();
  return Number.isNaN(t) ? false : t < Date.now();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await getCommunityEventBySlug(slug);
  if (!event) return { title: 'Sự kiện | VietNomad Stays' };
  return buildMetadata(event);
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await getCommunityEventBySlug(slug);
  if (!event) notFound();

  const [prefs, user, taxonomy] = await Promise.all([
    getServerPreferences(),
    getCurrentUser(),
    getEventTaxonomy(),
  ]);
  const locale: Locale = prefs.locale;
  const isVi = locale === 'vi';
  const title = isVi ? event.titleVi || event.titleEn : event.titleEn || event.titleVi;
  const venue = isVi ? event.venueVi || event.venueEn : event.venueEn || event.venueVi;
  const description = isVi
    ? event.descriptionVi || event.descriptionEn
    : event.descriptionEn || event.descriptionVi;
  const program = isVi ? event.programVi || event.programEn : event.programEn || event.programVi;
  const conditions = isVi
    ? event.conditionsVi || event.conditionsEn
    : event.conditionsEn || event.conditionsVi;

  let rsvpCount = event.rsvpCount;
  let isRsvped = false;
  if (user && event.registrationMode === 'internal') {
    const [mine, countRes] = await Promise.all([
      dbQuery('SELECT 1 FROM event_rsvps WHERE event_id = $1 AND user_id = $2', [
        event.id,
        user.id,
      ]),
      dbQuery<{ n: string }>('SELECT COUNT(*) AS n FROM event_rsvps WHERE event_id = $1', [
        event.id,
      ]),
    ]);
    isRsvped = mine.rows.length > 0;
    rsvpCount = Number(countRes.rows[0]?.n ?? 0);
  }

  const [related, nearbyStays] = await Promise.all([
    getRelatedCommunityEvents(event, 3),
    event.destinationSlug
      ? searchStays({ destination: event.destinationSlug })
      : Promise.resolve([]),
  ]);
  const stays = nearbyStays.slice(0, 3);

  const categoryEntry = taxonomy.categories.find((c) => c.slug === event.category);
  const languageEntry = taxonomy.languages.find((l) => l.slug === event.language);
  const cityName = isVi ? event.cityVi : event.cityEn;
  const startLabel = event.startAt ? formatEventDateTimeLabel(event.startAt, locale) : '';

  const facts: Array<{ term: string; value: string }> = [];
  if (languageEntry) {
    facts.push({
      term: isVi ? 'Ngôn ngữ tổ chức' : 'Organizing language',
      value: isVi ? languageEntry.nameVi : languageEntry.nameEn,
    });
  }
  facts.push({
    term: isVi ? 'Chi phí tham gia' : 'Participation fee',
    value: formatEventPriceLabel(event, locale),
  });
  if (categoryEntry) {
    facts.push({
      term: isVi ? 'Danh mục' : 'Category',
      value: isVi ? categoryEntry.nameVi : categoryEntry.nameEn,
    });
  }
  if (event.registrationMode === 'internal') {
    if (event.spotsTotal != null) {
      facts.push({
        term: isVi ? 'Người đăng ký' : 'Registered',
        value: `${rsvpCount} / ${event.spotsTotal}`,
      });
    } else if (rsvpCount > 0) {
      facts.push({
        term: isVi ? 'Người đăng ký' : 'Registered',
        value: isVi ? `${rsvpCount} người` : String(rsvpCount),
      });
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/community"
        className="text-sm font-semibold text-[#164E3F] hover:underline"
      >
        {isVi ? '← Cộng đồng' : '← Community'}
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-8">
          {event.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={event.imageUrl}
              alt={title}
              className="aspect-[16/9] w-full rounded-2xl object-cover"
            />
          ) : null}

          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-[#17221E] sm:text-4xl">
            {title}
          </h1>

          <div className="mt-4 space-y-2 text-sm text-[#53635D]">
            {startLabel ? (
              <p className="font-semibold text-[#C25E28]">
                {startLabel}
                {event.endAt
                  ? ` – ${
                      isVi ? formatEventTimeLabel(event.endAt, locale) : formatEventTimeLabel(event.endAt, locale)
                    }`
                  : ''}
              </p>
            ) : null}
            <p>
              {venue}
              {cityName ? ` · ${cityName}` : ''}
              {' · '}
              <a
                href={directionsUrl(event)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[#164E3F] hover:underline"
              >
                {isVi ? 'Chỉ đường' : 'Directions'}
              </a>
            </p>
            {event.organizerName ? (
              <p>
                {isVi ? 'Đơn vị tổ chức' : 'Organizer'}: {event.organizerName}
              </p>
            ) : null}
          </div>

          {description ? (
            <div className="mt-8 max-w-2xl space-y-4 text-[15px] leading-relaxed text-[#17221E]">
              {description.split('\n').map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          ) : null}

          {program ? (
            <section className="mt-8 max-w-2xl">
              <h2 className="text-lg font-semibold text-[#17221E]">
                {isVi ? 'Chương trình' : 'Programme'}
              </h2>
              <div className="mt-2 space-y-2 text-[15px] leading-relaxed text-[#53635D]">
                {program.split('\n').map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </section>
          ) : null}

          {conditions ? (
            <section className="mt-8 max-w-2xl">
              <h2 className="text-lg font-semibold text-[#17221E]">
                {isVi ? 'Điều kiện tham gia' : 'Conditions'}
              </h2>
              <div className="mt-2 space-y-2 text-[15px] leading-relaxed text-[#53635D]">
                {conditions.split('\n').map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-6 lg:col-span-4">
          <EventRegistration
            eventId={event.id}
            eventSlug={event.slug}
            registrationMode={event.registrationMode}
            status={event.status}
            hasStarted={hasEventStarted(event.startAt)}
            spotsTotal={event.spotsTotal}
            rsvpCount={rsvpCount}
            isLoggedIn={Boolean(user)}
            sourceUrl={event.sourceUrl}
            locale={locale}
          />
          {isRsvped && event.registrationMode === 'internal' ? (
            <p className="text-xs text-[#53635D]">
              {isVi
                ? 'Bạn đã đăng ký sự kiện này.'
                : 'You are registered for this event.'}
            </p>
          ) : null}

          {facts.length > 0 ? (
            <dl className="space-y-3 border-t border-[#E5DFD3] pt-5 text-sm">
              {facts.map((f) => (
                <div key={f.term} className="flex justify-between gap-4">
                  <dt className="text-[#53635D]">{f.term}</dt>
                  <dd className="text-right font-medium text-[#17221E]">{f.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          <div className="border-t border-[#E5DFD3] pt-5">
            <ShareButton title={title} locale={locale} />
          </div>
        </aside>
      </div>

      {stays.length > 0 ? (
        <section className="mt-16">
          <h2 className="text-xl font-semibold tracking-tight text-[#17221E] sm:text-2xl">
            {isVi
              ? `Chỗ ở tại ${cityName}`
              : `Places to stay in ${cityName || event.cityEn}`}
          </h2>
          <div className="mt-6 grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {stays.map((s) => (
              <StayCard
                key={s.id}
                stay={s}
                initialSaved={false}
                isAuthenticated={Boolean(user)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {related.length > 0 ? (
        <section className="mt-16">
          <h2 className="text-xl font-semibold tracking-tight text-[#17221E] sm:text-2xl">
            {isVi ? 'Sự kiện liên quan' : 'Related events'}
          </h2>
          <div className="mt-6 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((ev) => (
              <EventCard key={ev.id} event={ev} locale={locale} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
