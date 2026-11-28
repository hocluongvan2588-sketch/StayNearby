import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, KeyRound, MapPin, Star, Utensils } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/session';
import { getConfig } from '@/lib/config';
import { dbQuery } from '@/lib/db';
import {
  formatCountNoun,
  formatKitchenTypeLabel,
  formatLaundryTypeLabel,
  formatPropertyTypeLabel,
  formatStayLocationLabel,
} from '@/lib/i18n';
import { getServerPreferences } from '@/lib/preferences';
import { getStayDetailBySlug, getUpcomingEventsForDestination } from '@/modules/catalog';
import { getPublishedCmsBySlug } from '@/modules/cms';
import { getStayServicesForPublic } from '@/modules/stay-extras';
import { EventCard } from '@/components/events/EventCard';
import { StayAmenitiesSection } from '@/components/StayAmenitiesSection';
import { StayBookingWidget } from '@/components/StayBookingWidget';
import { StayDescriptionToggle } from '@/components/StayDescriptionToggle';
import { StayGuestReviewsSection } from '@/components/StayGuestReviewsSection';
import { StayExtraServicesSection } from '@/components/StayExtraServicesSection';
import { StayHeaderActions } from '@/components/StayHeaderActions';
import { StayHostSection } from '@/components/StayHostSection';
import StayMobileBookingBar from '@/components/StayMobileBookingBar';
import { StayNeighborhoodExplore } from '@/components/StayNeighborhoodExplore';
import { StayPhotoGallery } from '@/components/StayPhotoGallery';
import { StayWorkspaceSection } from '@/components/StayWorkspaceSection';

export const dynamic = 'force-dynamic';

export default async function StayDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [stay, prefs, user] = await Promise.all([
    getStayDetailBySlug(slug),
    getServerPreferences(),
    getCurrentUser(),
  ]);

  if (!stay) notFound();

  let initialSaved = false;
  if (user) {
    const savedRes = await dbQuery<{ stay_id: string }>(
      'SELECT stay_id FROM saved_stays WHERE user_id = $1 AND stay_id = $2 LIMIT 1',
      [user.id, stay.id]
    );
    initialSaved = Boolean(savedRes.rows[0]);
  }

  // Upcoming events at this stay's destination (Community spec §8 — area
  // events only; no distance or availability claims).
  let destinationEvents: Awaited<ReturnType<typeof getUpcomingEventsForDestination>> = [];
  let destinationIdForFilter: string | null = null;
  {
    const destRes = await dbQuery<{ id: string }>(
      'SELECT id FROM destinations WHERE slug = $1',
      [stay.destinationSlug]
    );
    if (destRes.rows[0]) {
      destinationIdForFilter = String(destRes.rows[0].id);
      destinationEvents = await getUpcomingEventsForDestination(
        destinationIdForFilter,
        3
      );
    }
  }

  const isVi = prefs.locale === 'vi';
  const title = isVi ? stay.titleVi : stay.titleEn;
  const destinationName = isVi ? stay.destinationNameVi : stay.destinationNameEn;
  const neighborhoodName = isVi ? stay.neighborhoodVi : stay.neighborhoodEn;
  const description = isVi ? stay.descriptionVi : stay.descriptionEn;
  const hostBio = isVi ? stay.hostBioVi || stay.hostBioEn : stay.hostBioEn || stay.hostBioVi;
  const workspaceSummary = isVi ? stay.workspaceSummaryVi : stay.workspaceSummaryEn;
  const destinationTagline = isVi
    ? stay.destination.taglineVi
    : stay.destination.taglineEn;

  // Stay Extras (spec §5): host-declared services, shown only when enabled.
  const extrasGuideSlug = isVi
    ? 'dat-dich-vu-bo-sung-cho-ky-luu-tru'
    : 'book-extra-services-for-your-stay';
  const [extraServicesRaw, extrasGuide] = await Promise.all([
    getStayServicesForPublic(stay.id),
    getPublishedCmsBySlug(extrasGuideSlug),
  ]);
  const extraServices = extraServicesRaw.map((s) => ({
    id: s.id,
    nameVi: s.nameVi,
    nameEn: s.nameEn,
    priceVnd: s.priceVnd,
    priceUnit: s.priceUnit,
    isIncluded: s.isIncluded,
    descriptionVi: s.descriptionVi,
    descriptionEn: s.descriptionEn,
  }));

  // Property overview stats (only render facts that actually exist)
  const overviewStats: string[] = [];
  if (stay.maxGuests > 0) {
    overviewStats.push(
      formatCountNoun(stay.maxGuests, 'guest', 'guests', 'khách', prefs.locale)
    );
  }
  if (stay.bedrooms !== null && stay.bedrooms > 0) {
    overviewStats.push(
      formatCountNoun(stay.bedrooms, 'bedroom', 'bedrooms', 'phòng ngủ', prefs.locale)
    );
  }
  if (stay.bedsCount > 0) {
    overviewStats.push(
      formatCountNoun(stay.bedsCount, 'bed', 'beds', 'giường', prefs.locale)
    );
  }
  if (stay.bathrooms !== null && stay.bathrooms > 0) {
    overviewStats.push(
      formatCountNoun(stay.bathrooms, 'bathroom', 'bathrooms', 'phòng tắm', prefs.locale)
    );
  }
  if (stay.areaSqm !== null && stay.areaSqm > 0) {
    overviewStats.push(`${stay.areaSqm} m²`);
  }

  const propertyLabel = formatPropertyTypeLabel(stay.propertyType, prefs.locale);
  const areaLabel = formatStayLocationLabel([neighborhoodName, destinationName]);
  // Property type (what the building is) stays separate from the space the
  // guest actually rents: a private room inside a co-living is never billed
  // as "entire coliving".
  const overviewTitle = stay.isEntirePlace
    ? isVi
      ? `Toàn bộ ${propertyLabel.toLowerCase()} tại ${areaLabel}`
      : `Entire ${propertyLabel.toLowerCase()} in ${areaLabel}`
    : isVi
      ? `Phòng riêng trong ${propertyLabel.toLowerCase()} tại ${areaLabel}`
      : `Private room in ${propertyLabel.toLowerCase()} in ${areaLabel}`;

  const roomPhotos = stay.rooms
    .filter((rm) => Boolean(rm.roomImage))
    .map((rm) => ({
      url: rm.roomImage,
      label: isVi ? rm.nameVi : rm.nameEn,
    }));

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-7xl px-4 py-8 pb-28 sm:px-6 lg:px-8 lg:pb-8">
        {/* Clean Minimal Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-[#53635D]"
        >
          <Link href="/stays" className="font-medium text-[#164E3F] hover:underline">
            {isVi ? 'Chỗ ở' : 'Stays'}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-[#A5A095]" />
          <Link href={`/destinations/${stay.destinationSlug}`} className="hover:underline">
            {destinationName}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-[#A5A095]" />
          <span className="truncate text-[#17221E]">{title}</span>
        </nav>

        {/* Section 1: Property Header */}
        <header className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="space-y-2">
            <h1 className="text-[28px] font-semibold leading-[1.15] tracking-tight text-[#17221E] sm:text-[34px]">
              {title}
            </h1>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#53635D]">
              {stay.reviewsAvg !== null && stay.reviewsCount > 0 ? (
                <span className="inline-flex items-center gap-1 font-medium text-[#17221E]">
                  <Star className="h-4 w-4 text-[#17221E]" fill="#17221E" />
                  <span>{stay.reviewsAvg.toFixed(1)}</span>
                  <span className="text-[#53635D]">
                    ({formatCountNoun(stay.reviewsCount, 'review', 'reviews', 'đánh giá', prefs.locale)})
                  </span>
                </span>
              ) : stay.googleReviewCount !== null &&
                  stay.googleReviewCount > 0 &&
                  stay.googleRating !== null ? (
                <span className="inline-flex items-center gap-1 font-medium text-[#17221E]">
                  <Star className="h-4 w-4 text-[#A67C2E]" fill="#A67C2E" />
                  <span>{stay.googleRating.toFixed(1)}</span>
                  <span className="text-[#53635D]">
                    ({stay.googleReviewCount} {isVi ? 'đánh giá Google' : 'Google reviews'})
                  </span>
                </span>
              ) : null}

              <Link
                href={`/destinations/${stay.destinationSlug}`}
                className="inline-flex items-center gap-1 font-medium text-[#17221E] underline-offset-4 hover:underline"
              >
                <MapPin className="h-4 w-4 text-[#C25E28]" />
                <span>{areaLabel}</span>
              </Link>
            </div>
          </div>

          <StayHeaderActions
            stayId={stay.id}
            staySlug={stay.slug}
            stayTitle={title}
            locale={prefs.locale}
            initialSaved={initialSaved}
            isAuthenticated={Boolean(user)}
          />
        </header>

        {/* Section 2: Photo Gallery */}
        <StayPhotoGallery
          title={title}
          heroImage={stay.heroImage}
          workspacePhotoUrl={stay.workspacePhotoUrl}
          hasWorkspace={stay.hasWorkspace}
          galleryImages={stay.galleryImages}
          roomPhotos={roomPhotos}
          locale={prefs.locale}
        />

        {/* Main 2-Column Content + Sticky Booking Sidebar */}
        <div className="grid gap-12 lg:grid-cols-12">
          {/* Left Column: Open Sections */}
          <div className="divide-y divide-[#E5DFD3] lg:col-span-7">
            {/* Section 3: Property Overview */}
            <section className="pb-8">
              <h2 className="text-[22px] font-semibold tracking-tight text-[#17221E] sm:text-[24px]">
                {overviewTitle}
              </h2>
              {overviewStats.length > 0 && (
                <p className="mt-1.5 text-[15px] text-[#53635D]">
                  {overviewStats.join(' · ')}
                </p>
              )}

              <ul className="mt-6 space-y-4">
                {(stay.kitchenType !== 'none' || stay.laundryType !== 'none') && (
                  <li className="flex items-start gap-3.5">
                    <Utensils className="mt-0.5 h-5 w-5 shrink-0 text-[#17221E] stroke-[1.6]" />
                    <div>
                      <div className="text-[15px] font-medium text-[#17221E]">
                        {isVi ? 'Tiện nghi sinh hoạt đầy đủ' : 'Equipped for comfortable living'}
                      </div>
                      <p className="text-sm text-[#53635D]">
                        {[
                          stay.kitchenType !== 'none'
                            ? formatKitchenTypeLabel(stay.kitchenType, prefs.locale)
                            : null,
                          stay.laundryType !== 'none'
                            ? formatLaundryTypeLabel(stay.laundryType, prefs.locale)
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                  </li>
                )}

                <li className="flex items-start gap-3.5">
                  <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-[#17221E] stroke-[1.6]" />
                  <div>
                    <div className="text-[15px] font-medium text-[#17221E]">
                      {stay.isInstantBook
                        ? isVi
                          ? 'Đặt phòng xác nhận ngay'
                          : 'Instant booking confirmation'
                        : isVi
                          ? 'Nhận phòng thuận tiện'
                          : 'Smooth arrival experience'}
                    </div>
                    <p className="text-sm text-[#53635D]">
                      {isVi
                        ? `Nhận phòng từ ${stay.checkinFrom} · Trả phòng trước ${stay.checkoutBefore}`
                        : `Check-in from ${stay.checkinFrom} · Check-out before ${stay.checkoutBefore}`}
                    </p>
                  </div>
                </li>

              </ul>
            </section>

            {/* Section 4: Host Information */}
            <StayHostSection
              staySlug={stay.slug}
              stayTitle={title}
              hostId={stay.hostId}
              hostName={stay.hostName}
              hostNationality={stay.hostNationality}
              hostBio={hostBio}
              hostAvatarUrl={stay.hostAvatarUrl}
              hostVerified={stay.hostVerified}
              user={user}
              locale={prefs.locale}
            />

            {/* Section 5: About This Stay */}
            <StayDescriptionToggle description={description} locale={prefs.locale} />

            {/* Section 6: Amenities */}
            <StayAmenitiesSection
              amenities={stay.amenities}
              kitchenType={stay.kitchenType}
              laundryType={stay.laundryType}
              petFriendly={stay.petFriendly}
              wheelchairFriendly={stay.wheelchairFriendly}
              hasWorkspace={stay.hasWorkspace}
              hasErgonomicChair={stay.hasErgonomicChair}
              hasExternalMonitor={stay.hasExternalMonitor}
              wifiHasService={stay.wifiHasService}
              wifiDownloadMbps={stay.wifiDownloadMbps}
              locale={prefs.locale}
            />

            {/* Section 7: Workspace & Internet (Supplemental, rendered only when data exists) */}
            <StayWorkspaceSection
              hasWorkspace={stay.hasWorkspace}
              hasErgonomicChair={stay.hasErgonomicChair}
              hasExternalMonitor={stay.hasExternalMonitor}
              hasCallBooth={stay.hasCallBooth}
              wifiHasService={stay.wifiHasService}
              wifiDownloadMbps={stay.wifiDownloadMbps}
              wifiUploadMbps={stay.wifiUploadMbps}
              wifiPingMs={stay.wifiPingMs}
              wifiJitterMs={stay.wifiJitterMs}
              wifiTestedAt={stay.wifiTestedAt}
              wifiTesterNote={stay.wifiTesterNote}
              wifiStatus={stay.wifiStatus}
              isWifiVerified={stay.isWifiVerified}
              isWorkReady={stay.isWorkReady}
              verifiedAt={stay.verifiedAt}
              speedtestProofUrl={stay.speedtestProofUrl}
              workspaceVideoUrl={stay.workspaceVideoUrl}
              workspaceSummary={workspaceSummary}
              workspacePhotoUrl={stay.workspacePhotoUrl}
              wifiGuestAvgRating={stay.wifiGuestAvgRating}
              wifiGuestReviewCount={stay.wifiGuestReviewCount}
              wifiGuestRecentBookingCount={stay.wifiGuestRecentBookingCount}
              wifiVerifiedByGuests={stay.wifiVerifiedByGuests}
              locale={prefs.locale}
            />

            {/* Stay Extras: host-declared additional services (spec §5) */}
            <StayExtraServicesSection
              services={extraServices}
              guideSlug={extrasGuide ? extrasGuide.slug : null}
              locale={prefs.locale}
            />
          </div>

          {/* Right Column: Section 9 Booking Widget */}
          <div className="lg:col-span-5" id="booking-widget">
            <StayBookingWidget
              stay={stay}
              user={user}
              conciergeWhatsapp={getConfig().conciergeWhatsapp}
            />
          </div>
        </div>

        {/* Mobile: compact sticky booking bar (scrolls to the full widget) */}
        <StayMobileBookingBar
          locale={prefs.locale}
          stayTitle={title}
          weekTotalVnd={stay.weekDisplayVnd ?? 0}
          isInstantBook={stay.isInstantBook}
        />

        {/* Full-width Bottom Open Sections (Sections 8, 10, 11) */}
        <div className="mt-4 divide-y divide-[#E5DFD3] border-t border-[#E5DFD3]">
          {/* Section 8: Explore the Neighborhood */}
          <StayNeighborhoodExplore
            destinationSlug={stay.destinationSlug}
            destinationName={destinationName}
            neighborhoodName={neighborhoodName}
            localPlaces={stay.localPlaces}
            nearbyCoworking={stay.nearbyCoworking}
            locale={prefs.locale}
          />

          {/* Community: upcoming events in this destination */}
          {destinationEvents.length > 0 && (
            <section className="py-10">
              <div className="mb-6 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
                <h2 className="text-[22px] font-semibold tracking-tight text-[#17221E] sm:text-[24px]">
                  {isVi
                    ? `Sự kiện sắp tới tại ${destinationName}`
                    : `Upcoming events in ${destinationName}`}
                </h2>
                <Link
                  href={
                    destinationIdForFilter
                      ? `/community?destination=${destinationIdForFilter}`
                      : '/community'
                  }
                  className="text-sm font-semibold text-[#164E3F] hover:underline"
                >
                  {isVi ? 'Xem tất cả sự kiện' : 'See all events'}
                </Link>
              </div>
              <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
                {destinationEvents.map((ev) => (
                  <EventCard key={ev.id} event={ev} locale={prefs.locale} />
                ))}
              </div>
            </section>
          )}

          {/* Section 10 & 11: Policies, House Rules, Guest Reviews & Neighborhood Location */}
          <StayGuestReviewsSection
            slug={stay.slug}
            stayTitle={title}
            user={user}
            locale={prefs.locale}
            checkinFrom={stay.checkinFrom}
            checkoutBefore={stay.checkoutBefore}
            defaultMinNights={stay.defaultMinNights}
            cancellationPolicy={stay.cancellationPolicy}
            houseRules={stay.houseRules}
            rooms={stay.rooms}
            initialReviews={stay.reviews}
            initialAvg={stay.reviewsAvg}
            googleRating={stay.googleRating}
            googleReviewCount={stay.googleReviewCount}
            destinationSlug={stay.destinationSlug}
            destinationName={destinationName}
            neighborhoodName={neighborhoodName}
            destinationTagline={destinationTagline}
          />
        </div>
      </div>
    </div>
  );
}
