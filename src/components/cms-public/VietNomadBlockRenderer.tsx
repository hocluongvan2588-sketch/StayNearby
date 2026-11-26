import React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BadgePercent,
  CheckCircle2,
  Compass,
  Handshake,
  MapPin,
  Search,
  Sparkles,
  Wifi,
} from 'lucide-react';
import {
  formatCmsTypeLabel,
  formatMoneyFromVnd,
  formatPlaceCategoryLabel,
  type CurrencyCode,
  type Locale,
} from '@/lib/i18n';
import type { TiptapNode } from '@/lib/cms-core/schema';
import {
  buildRecommendedKey,
  buildRelatedGuidesKey,
  type HydratedDynamicBlocksContext,
  type HydratedStayCard,
} from '@/modules/cms-vietnomad/hydrator';

function StayInlineCard({
  stay,
  locale,
  currency,
  sourceContentId,
  layout = 'card',
}: {
  stay: HydratedStayCard;
  locale: Locale;
  currency: CurrencyCode;
  sourceContentId?: string;
  layout?: string;
}) {
  const isVi = locale === 'vi';
  const title = isVi ? stay.titleVi : stay.titleEn;
  const destName = isVi ? stay.destinationNameVi : stay.destinationNameEn;
  const nb = isVi ? stay.neighborhoodVi : stay.neighborhoodEn;
  const href = sourceContentId
    ? `/stays/${stay.slug}?utm_source=vietnomad_guide&utm_medium=editorial&utm_content=${encodeURIComponent(sourceContentId)}`
    : `/stays/${stay.slug}`;

  const isHorizontal = layout === 'highlight';

  return (
    <Link
      href={href}
      className={`group my-6 block overflow-hidden rounded-2xl border border-[#E5DFD3] bg-white transition hover:border-[#164E3F] lacquer-shadow ${
        isHorizontal ? 'sm:grid sm:grid-cols-12' : ''
      }`}
    >
      <div className={isHorizontal ? 'sm:col-span-5' : ''}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={stay.heroImage}
          alt={title}
          loading="lazy"
          className={`w-full object-cover ${isHorizontal ? 'h-full min-h-[190px]' : 'h-48'}`}
        />
      </div>
      <div className={`p-5 ${isHorizontal ? 'sm:col-span-7 flex flex-col justify-between' : ''}`}>
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#FAF8F3] px-2.5 py-0.5 text-[#53635D]">
              <MapPin className="h-3 w-3 text-[#C25E28]" />
              {nb ? `${nb}, ${destName}` : destName}
            </span>
            {stay.wifiDownloadMbps > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#E7F1EC] px-2.5 py-0.5 text-[#164E3F]">
                <Wifi className="h-3 w-3" />
                {stay.wifiDownloadMbps} Mbps
              </span>
            )}
            {stay.isWorkReady && (
              <span className="rounded-full bg-[#FAEDE5] px-2.5 py-0.5 text-[#C25E28]">
                Work-Ready
              </span>
            )}
          </div>
          <h4 className="font-serif-display text-lg font-semibold text-[#17221E] group-hover:text-[#164E3F]">
            {title}
          </h4>
          <p className="mt-1 line-clamp-2 text-xs text-[#53635D]">
            {isVi ? stay.subtitleVi : stay.subtitleEn}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#E5DFD3] pt-3">
          <div className="text-xs text-[#53635D]">
            {stay.monthDisplayVnd ? (
              <span>
                <strong className="text-sm font-bold text-[#17221E]">
                  {formatMoneyFromVnd(stay.monthDisplayVnd, currency)}
                </strong>{' '}
                / 30 {isVi ? 'đêm' : 'nights'}
              </span>
            ) : stay.weekDisplayVnd ? (
              <span>
                <strong className="text-sm font-bold text-[#17221E]">
                  {formatMoneyFromVnd(stay.weekDisplayVnd, currency)}
                </strong>{' '}
                / 7 {isVi ? 'đêm' : 'nights'}
              </span>
            ) : null}
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#164E3F]">
            {isVi ? 'Xem chỗ ở' : 'View stay'}
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

export function renderVietNomadDynamicBlock(params: {
  node: TiptapNode;
  key: string;
  ctx: HydratedDynamicBlocksContext;
  locale: Locale;
  currency: CurrencyCode;
  isPreview?: boolean;
  sourceContentId?: string;
}): React.ReactNode | null {
  const { node, key, ctx, locale, currency, isPreview, sourceContentId } = params;
  const isVi = locale === 'vi';
  const attrs = node.attrs ?? {};

  switch (node.type) {
    case 'vnStayListing': {
      const stayId = typeof attrs.stayId === 'string' ? attrs.stayId : '';
      const stay = ctx.staysById.get(stayId);
      if (!stay || stay.status !== 'live') {
        if (!isPreview) return null;
        return (
          <div
            key={key}
            className="my-5 rounded-xl border border-dashed border-[#E6B87A] bg-[#FEF7EC] p-4 text-xs text-[#5C3D12]"
          >
            <strong>Preview notice:</strong> Referenced stay ({stayId || 'unset'}) is not currently live (status: {stay?.status ?? 'missing'}) and will be hidden on the published article.
          </div>
        );
      }
      return (
        <StayInlineCard
          key={key}
          stay={stay}
          locale={locale}
          currency={currency}
          sourceContentId={sourceContentId}
          layout={String(attrs.layout ?? 'highlight')}
        />
      );
    }

    case 'vnDestinationCard': {
      const destId = typeof attrs.destinationId === 'string' ? attrs.destinationId : '';
      const dest = ctx.destinationsById.get(destId);
      if (!dest) return null;
      const name = isVi ? dest.nameVi : dest.nameEn;
      return (
        <Link
          key={key}
          href={`/destinations/${dest.slug}`}
          className="group my-6 grid overflow-hidden rounded-2xl border border-[#E5DFD3] bg-white transition hover:border-[#164E3F] sm:grid-cols-12 lacquer-shadow"
        >
          <div className="sm:col-span-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={dest.heroImage}
              alt={name}
              loading="lazy"
              className="h-full min-h-[180px] w-full object-cover"
            />
          </div>
          <div className="flex flex-col justify-between p-5 sm:col-span-7">
            <div>
              <div className="mb-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#164E3F]">
                <Compass className="h-3.5 w-3.5" />
                {isVi ? 'Khám phá thành phố' : 'Destination Hub'}
              </div>
              <h4 className="font-serif-display text-xl font-semibold text-[#17221E] group-hover:text-[#164E3F]">
                {name}
              </h4>
              <p className="mt-1.5 text-xs leading-relaxed text-[#53635D]">
                {isVi ? dest.taglineVi : dest.taglineEn}
              </p>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#E5DFD3] pt-3 text-xs">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-[#E7F1EC] px-2.5 py-0.5 font-semibold text-[#164E3F]">
                  ~{dest.avgWifiMbps} Mbps
                </span>
                <span className="rounded-full bg-[#FAEDE5] px-2.5 py-0.5 font-semibold text-[#C25E28]">
                  ~${dest.monthlyCostUsd}/{isVi ? 'tháng' : 'mo'}
                </span>
                <span className="rounded-full bg-[#FAF8F3] px-2.5 py-0.5 font-medium text-[#53635D]">
                  {dest.liveStaysCount} {isVi ? 'chỗ ở' : 'live stays'}
                </span>
              </div>
              <span className="inline-flex items-center gap-1 font-semibold text-[#164E3F]">
                {isVi ? 'Khám phá' : 'Explore hub'}
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </div>
        </Link>
      );
    }

    case 'vnNeighborhoodCard': {
      const nbId = typeof attrs.neighborhoodId === 'string' ? attrs.neighborhoodId : '';
      const nb = ctx.neighborhoodsById.get(nbId);
      if (!nb) return null;
      return (
        <div
          key={key}
          className="my-6 rounded-2xl border border-[#E5DFD3] bg-[#FAF8F3] p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#C25E28]">
                {isVi ? nb.destinationNameVi : nb.destinationNameEn} ·{' '}
                {isVi ? 'Khu vực gợi ý' : 'Neighborhood Spotlight'}
              </span>
              <h4 className="font-serif-display mt-0.5 text-xl font-semibold text-[#17221E]">
                {isVi ? nb.nameVi : nb.nameEn}
              </h4>
            </div>
            <Link
              href={`/stays?destination=${nb.destinationSlug}`}
              className="inline-flex items-center gap-1 rounded-lg bg-[#164E3F] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0F392E]"
            >
              {isVi ? 'Tìm chỗ ở gần đây' : 'Find stays nearby'}
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-[#53635D]">
            {isVi ? nb.summaryVi : nb.summaryEn}
          </p>
        </div>
      );
    }

    case 'vnLocalPlaceCard': {
      const placeId = typeof attrs.placeId === 'string' ? attrs.placeId : '';
      const place = ctx.placesById.get(placeId);
      if (!place || place.verificationStatus === 'outdated') {
        if (!isPreview) return null;
        return (
          <div
            key={key}
            className="my-4 rounded-xl border border-dashed border-[#E6B87A] bg-[#FEF7EC] p-3 text-xs text-[#5C3D12]"
          >
            Preview notice: Local place ({placeId || 'unset'}) is outdated or missing.
          </div>
        );
      }
      return (
        <div
          key={key}
          className="my-6 flex flex-col gap-4 rounded-2xl border border-[#E5DFD3] bg-white p-5 sm:flex-row sm:items-center"
        >
          {place.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={place.imageUrl}
              alt={place.name}
              loading="lazy"
              className="h-24 w-full shrink-0 rounded-xl object-cover sm:w-32"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] font-semibold">
              <span className="rounded-full bg-[#E7F1EC] px-2.5 py-0.5 text-[#164E3F]">
                {formatPlaceCategoryLabel(place.category, locale)}
              </span>
              {place.verificationStatus === 'verified' && (
                <span className="inline-flex items-center gap-1 text-[#164E3F]">
                  <CheckCircle2 className="h-3 w-3" />
                  {isVi ? 'Đã xác minh' : 'Verified place'}
                </span>
              )}
              <span className="text-[#53635D]">{place.priceRange}</span>
              {place.openingHours && <span className="text-[#53635D]">· {place.openingHours}</span>}
            </div>
            <h4 className="font-serif-display text-lg font-semibold text-[#17221E]">
              {place.name}
            </h4>
            <p className="mt-1 text-xs leading-relaxed text-[#53635D]">
              {isVi ? place.descriptionVi : place.descriptionEn}
            </p>
            {place.address && (
              <div className="mt-1.5 flex items-center gap-1 text-[11px] text-[#53635D]">
                <MapPin className="h-3 w-3 text-[#C25E28]" />
                <span>{place.address}</span>
              </div>
            )}
          </div>
        </div>
      );
    }

    case 'vnDestinationMap': {
      const destId = typeof attrs.destinationId === 'string' ? attrs.destinationId : '';
      const dest = ctx.destinationsById.get(destId);
      const mapData = ctx.mapDetailsByDestId.get(destId);
      if (!dest || !mapData) return null;

      return (
        <div
          key={key}
          className="my-7 overflow-hidden rounded-2xl border border-[#E5DFD3] bg-white p-5"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#164E3F]">
                {isVi ? 'Bản đồ khu vực & chỗ ở' : 'Neighborhood & Stay Map'}
              </span>
              <h4 className="font-serif-display text-lg font-semibold text-[#17221E]">
                {isVi ? dest.nameVi : dest.nameEn}
              </h4>
            </div>
            <Link
              href={`/destinations/${dest.slug}`}
              className="text-xs font-semibold text-[#164E3F] hover:underline"
            >
              {isVi ? 'Mở trang điểm đến' : 'Open destination hub'} →
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-12">
            <div className="relative h-56 overflow-hidden rounded-xl border border-[#E5DFD3] bg-[#E7F1EC] md:col-span-7">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,#FAF8F3_0%,#E7F1EC_55%,#DCECE5_100%)]" />
              {mapData.neighborhoods.map((n) => (
                <div
                  key={n.id}
                  style={{ left: `${Math.min(88, Math.max(10, n.mapX))}%`, top: `${Math.min(85, Math.max(12, n.mapY))}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                >
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#164E3F]/30 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-[#164E3F] shadow-sm">
                    <MapPin className="h-3 w-3 text-[#C25E28]" />
                    {isVi ? n.nameVi : n.nameEn}
                  </span>
                </div>
              ))}
            </div>
            <div className="space-y-2 md:col-span-5">
              <div className="text-xs font-semibold text-[#17221E]">
                {isVi ? 'Chỗ ở & địa điểm nổi bật' : 'Verified stays & local spots'}
              </div>
              {mapData.stays.slice(0, 3).map((st) => (
                <Link
                  key={st.id}
                  href={`/stays/${st.slug}`}
                  className="block rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-xs hover:border-[#164E3F]"
                >
                  <div className="font-semibold text-[#17221E]">
                    {isVi ? st.titleVi : st.titleEn}
                  </div>
                  <div className="text-[11px] text-[#53635D]">
                    {st.wifiDownloadMbps} Mbps · {isVi ? st.neighborhoodVi : st.neighborhoodEn}
                  </div>
                </Link>
              ))}
              {mapData.places.slice(0, 2).map((pl) => (
                <div
                  key={pl.id}
                  className="rounded-lg border border-[#E5DFD3] bg-white px-3 py-2 text-xs"
                >
                  <div className="font-medium text-[#17221E]">{pl.name}</div>
                  <div className="text-[11px] text-[#53635D]">
                    {formatPlaceCategoryLabel(pl.category, locale)} · {pl.openingHours}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    case 'vnLocalPartnerOffer': {
      const partnerId = typeof attrs.partnerId === 'string' ? attrs.partnerId : '';
      const partner = ctx.partnersById.get(partnerId);
      if (!partner || partner.partnershipStatus !== 'active') {
        if (!isPreview) return null;
        return (
          <div
            key={key}
            className="my-4 rounded-xl border border-dashed border-[#E6B87A] bg-[#FEF7EC] p-3 text-xs text-[#5C3D12]"
          >
            Preview notice: Partner ({partnerId || 'unset'}) is not active ({partner?.partnershipStatus ?? 'missing'}).
          </div>
        );
      }
      return (
        <div
          key={key}
          className="my-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#C25E28]/30 bg-[#FAEDE5] p-5"
        >
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#C25E28]">
              <Handshake className="h-3.5 w-3.5" />
              {isVi ? 'Ưu đãi đối tác địa phương' : 'Local Partner Perk'}
            </div>
            <h4 className="font-serif-display text-lg font-semibold text-[#17221E]">
              {partner.businessName}
            </h4>
            <p className="text-sm font-medium text-[#164E3F]">{partner.perkOffer}</p>
          </div>
          {partner.destinationSlug && (
            <Link
              href={`/destinations/${partner.destinationSlug}`}
              className="rounded-xl bg-[#164E3F] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0F392E]"
            >
              {isVi ? 'Xem chi tiết' : 'See city perks'}
            </Link>
          )}
        </div>
      );
    }

    case 'vnStaySearchWidget': {
      const defaultDest =
        typeof attrs.defaultDestinationSlug === 'string' ? attrs.defaultDestinationSlug : '';
      const defaultNights = Number(attrs.defaultMinNights ?? 30);
      const heading =
        typeof attrs.heading === 'string' && attrs.heading
          ? attrs.heading
          : isVi
            ? 'Tìm chỗ ở dài ngày phù hợp'
            : 'Find verified weekly & monthly stays';
      return (
        <form
          key={key}
          action="/stays"
          method="GET"
          className="my-7 rounded-2xl border border-[#164E3F]/20 bg-[#0F392E] p-6 text-white"
        >
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#E6B87A]">
            <Search className="h-3.5 w-3.5" />
            VietNomad Search
          </div>
          <h4 className="font-serif-display mb-4 text-xl font-semibold">{heading}</h4>
          <input type="hidden" name="utm_source" value="vietnomad_guide" />
          {sourceContentId && (
            <input type="hidden" name="utm_content" value={sourceContentId} />
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <select
              name="destination"
              defaultValue={defaultDest}
              className="h-10 rounded-xl bg-white px-3 text-sm font-medium text-[#17221E]"
            >
              <option value="">{isVi ? 'Tất cả thành phố' : 'All Vietnam hubs'}</option>
              {ctx.destinationsList.map((d) => (
                <option key={d.id} value={d.slug}>
                  {isVi ? d.nameVi : d.nameEn}
                </option>
              ))}
            </select>
            <select
              name="nights"
              defaultValue={String(defaultNights)}
              className="h-10 rounded-xl bg-white px-3 text-sm font-medium text-[#17221E]"
            >
              <option value="7">7+ {isVi ? 'đêm' : 'nights'}</option>
              <option value="14">14+ {isVi ? 'đêm' : 'nights'}</option>
              <option value="21">21+ {isVi ? 'đêm' : 'nights'}</option>
              <option value="30">30+ {isVi ? 'đêm' : 'nights'}</option>
            </select>
            <button
              type="submit"
              className="h-10 rounded-xl bg-[#E6B87A] px-4 text-sm font-bold text-[#0F392E] hover:bg-[#dfb06d]"
            >
              {isVi ? 'Tìm chỗ ở' : 'Search stays'}
            </button>
          </div>
        </form>
      );
    }

    case 'vnRecommendedStays': {
      const cacheKey = buildRecommendedKey(attrs);
      const stays = ctx.recommendedStaysByKey.get(cacheKey) ?? [];
      if (stays.length === 0) return null;
      const heading =
        typeof attrs.title === 'string' && attrs.title
          ? attrs.title
          : isVi
            ? 'Chỗ ở đề xuất cho bạn'
            : 'Recommended Long-Stay Homes';
      return (
        <section key={key} className="my-8 space-y-4">
          <h3 className="font-serif-display text-2xl font-semibold text-[#17221E]">{heading}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {stays.map((st) => (
              <StayInlineCard
                key={`${key}-${st.id}`}
                stay={st}
                locale={locale}
                currency={currency}
                sourceContentId={sourceContentId}
                layout="card"
              />
            ))}
          </div>
        </section>
      );
    }

    case 'vnRelatedGuides': {
      const cacheKey = buildRelatedGuidesKey(attrs);
      const guides = ctx.relatedGuidesByKey.get(cacheKey) ?? [];
      if (guides.length === 0) return null;
      const heading =
        typeof attrs.title === 'string' && attrs.title
          ? attrs.title
          : isVi
            ? 'Cẩm nang liên quan'
            : 'Related Guides';
      return (
        <section key={key} className="my-8 rounded-2xl border border-[#E5DFD3] bg-[#FAF8F3] p-6">
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#164E3F]">
            <Sparkles className="h-3.5 w-3.5" />
            {heading}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {guides.map((g) => (
              <Link
                key={`${key}-${g.id}`}
                href={`/guides/${g.slug}`}
                className="group rounded-xl border border-[#E5DFD3] bg-white p-4 transition hover:border-[#164E3F]"
              >
                <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold text-[#164E3F]">
                  <span>{formatCmsTypeLabel(g.contentType, locale)}</span>
                  <span>·</span>
                  <span className="text-[#53635D]">
                    {g.readingTimeMinutes} {isVi ? 'phút đọc' : 'min read'}
                  </span>
                </div>
                <div className="font-serif-display text-base font-semibold text-[#17221E] group-hover:text-[#164E3F]">
                  {isVi ? g.titleVi : g.titleEn}
                </div>
                {(g.excerptEn || g.excerptVi) && (
                  <p className="mt-1 line-clamp-2 text-xs text-[#53635D]">
                    {isVi ? g.excerptVi : g.excerptEn}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </section>
      );
    }

    case 'vnPromotionBlock': {
      const promoId = typeof attrs.promotionId === 'string' ? attrs.promotionId : '';
      const promo = ctx.promotionsById.get(promoId);
      if (!promo || !promo.isActive) {
        if (!isPreview) return null;
        return (
          <div
            key={key}
            className="my-4 rounded-xl border border-dashed border-[#E6B87A] bg-[#FEF7EC] p-3 text-xs text-[#5C3D12]"
          >
            Preview notice: Promotion ({promoId || 'unset'}) is inactive or expired and will be hidden on live articles.
          </div>
        );
      }
      const benefit =
        promo.discountType === 'percent'
          ? `${promo.discountValue}% ${isVi ? 'giảm phí dịch vụ' : 'off service fee'}`
          : `${formatMoneyFromVnd(promo.discountValue, currency)} ${isVi ? 'ưu đãi' : 'credit'}`;
      return (
        <div
          key={key}
          className="my-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#164E3F]/25 bg-[#E7F1EC] p-5"
        >
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#164E3F]">
              <BadgePercent className="h-3.5 w-3.5" />
              {isVi ? 'Ưu đãi đang áp dụng' : 'Active Stay Offer'} · {promo.minNights}+{' '}
              {isVi ? 'đêm' : 'nights'}
            </div>
            <h4 className="font-serif-display text-lg font-semibold text-[#17221E]">
              {promo.name} — <span className="text-[#C25E28]">{benefit}</span>
            </h4>
            {(promo.descriptionEn || promo.descriptionVi) && (
              <p className="text-xs text-[#53635D]">
                {isVi ? promo.descriptionVi : promo.descriptionEn}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <code className="rounded-lg border border-[#164E3F]/30 bg-white px-3 py-1.5 font-mono text-sm font-bold text-[#164E3F]">
              {promo.code}
            </code>
            <Link
              href="/deals"
              className="rounded-lg bg-[#164E3F] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0F392E]"
            >
              {isVi ? 'Xem ưu đãi' : 'Browse deals'}
            </Link>
          </div>
        </div>
      );
    }

    default:
      return null;
  }
}
