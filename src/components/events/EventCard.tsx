import Link from 'next/link';
import { formatEventDateTimeLabel, type Locale } from '@/lib/i18n';
import type { CommunityEvent } from '@/modules/catalog';

/**
 * Community Event Card (image-first, StayCard-aligned per Community spec §4).
 * The whole card — image and title — is one link to the event detail page.
 * No border box, no nested card, no badges/pills, no CTA button: date/time,
 * title, venue · city, price, and attendance (internal registrations only,
 * only when a real count exists).
 */
export function formatEventPriceLabel(event: CommunityEvent, locale: Locale): string {
  if (event.priceType !== 'paid') return locale === 'vi' ? 'Miễn phí' : 'Free';
  const amount = event.priceAmount;
  if (amount == null) return locale === 'vi' ? 'Có phí' : 'Paid';
  try {
    return new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
      style: 'currency',
      currency: event.priceCurrency || 'USD',
    }).format(amount);
  } catch {
    return `${amount} ${event.priceCurrency}`;
  }
}

export function EventCard({
  event,
  locale,
}: {
  event: CommunityEvent;
  locale: Locale;
}) {
  const isVi = locale === 'vi';
  const title = isVi ? event.titleVi || event.titleEn : event.titleEn || event.titleVi;
  const venue = isVi ? event.venueVi || event.venueEn : event.venueEn || event.venueVi;
  const city = isVi ? event.cityVi : event.cityEn;
  const when = event.startAt
    ? formatEventDateTimeLabel(event.startAt, locale)
    : event.eventDate;
  const showAttendance =
    event.registrationMode === 'internal' && event.rsvpCount > 0;

  return (
    <Link
      href={`/community/${event.slug}`}
      className="group block rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#164E3F]"
    >
      {event.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.imageUrl}
          alt={title}
          loading="lazy"
          className="aspect-[4/3] w-full rounded-2xl object-cover transition duration-300 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="flex aspect-[4/3] w-full items-end rounded-2xl bg-[#FAF8F3] p-4">
          <span className="text-xs font-semibold text-[#A67C2E]">
            {isVi ? 'Sự kiện' : 'Event'}
          </span>
        </div>
      )}
      <div className="mt-3 space-y-1">
        <p className="text-xs font-semibold text-[#C25E28]">{when}</p>
        <h3 className="line-clamp-2 text-base font-semibold leading-snug text-[#17221E] group-hover:text-[#164E3F]">
          {title}
        </h3>
        <p className="line-clamp-1 text-sm text-[#53635D]">
          {[venue, city].filter(Boolean).join(' · ')}
        </p>
        <p className="text-sm font-medium text-[#17221E]">
          {formatEventPriceLabel(event, locale)}
          {showAttendance ? (
            <span className="font-normal text-[#53635D]">
              {' · '}
              {isVi
                ? `${event.rsvpCount} người đã đăng ký`
                : `${event.rsvpCount} going`}
            </span>
          ) : null}
        </p>
      </div>
    </Link>
  );
}
