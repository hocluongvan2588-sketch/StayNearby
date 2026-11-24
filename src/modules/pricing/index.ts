import crypto from 'crypto';
import {
  CANCELLATION_POLICIES,
  type CancellationPolicySpec,
  type CancellationPolicyVersion,
} from '@/lib/config';
import { dbQuery } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { checkListingAvailability } from '@/modules/availability';

export interface NightlyBreakdownItem {
  date: string;
  rateVnd: number;
  isOverride: boolean;
}

export interface StayQuote {
  listingId: string;
  listingSlug: string;
  listingTitle: string;
  listingTitleVi: string;
  areaNameEn: string;
  areaNameVi: string;
  cityEn: string;
  cityVi: string;
  timezone: string;
  checkIn: string;
  checkOut: string;
  guestsCount: number;
  nightsCount: number;
  currency: 'VND';
  available: boolean;
  blockedDates: string[];
  nightlyBreakdown: NightlyBreakdownItem[];
  accommodationSubtotalVnd: number;
  cleaningFeeVnd: number;
  totalVnd: number;
  paymentTerms: string;
  paymentTermsDetailsEn: string;
  paymentTermsDetailsVi: string;
  cancellationPolicy: CancellationPolicySpec;
  quoteHash: string;
}

export function computeQuoteHash(payload: {
  listingId: string;
  checkIn: string;
  checkOut: string;
  nightlyBreakdown: NightlyBreakdownItem[];
  cleaningFeeVnd: number;
  totalVnd: number;
  cancellationPolicyVersion: string;
  paymentTerms: string;
}): string {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');
}

export async function calculateStayQuote(input: {
  listingId?: string;
  listingSlug?: string;
  checkIn: string;
  checkOut: string;
  guestsCount: number;
}): Promise<StayQuote> {
  if (!input.listingId && !input.listingSlug) {
    throw new AppError('VALIDATION_ERROR', 'Listing identifier is required.');
  }

  const listingRes = await dbQuery<{
    id: string;
    slug: string;
    status: string;
    published_title_en: string | null;
    published_title_vi: string | null;
    base_nightly_rate_vnd: number;
    cleaning_fee_vnd: number;
    cancellation_policy_version: string;
    payment_terms: string;
    payment_terms_details_en: string;
    payment_terms_details_vi: string;
    area_name_en: string;
    area_name_vi: string;
    city_en: string;
    city_vi: string;
    timezone: string;
  }>(
    `SELECT l.id, l.slug, l.status, l.published_title_en, l.published_title_vi,
            l.base_nightly_rate_vnd, l.cleaning_fee_vnd,
            l.cancellation_policy_version, l.payment_terms,
            l.payment_terms_details_en, l.payment_terms_details_vi,
            a.name_en AS area_name_en, a.name_vi AS area_name_vi,
            a.city_en, a.city_vi, a.timezone
     FROM listings l
     JOIN areas a ON a.id = l.area_id
     WHERE ${input.listingId ? 'l.id = $1' : 'l.slug = $1'}`,
    [input.listingId ?? input.listingSlug]
  );

  const listing = listingRes.rows[0];
  if (!listing || listing.status !== 'published') {
    throw new AppError('NOT_FOUND', 'Stay not found or not currently published.');
  }

  const availability = await checkListingAvailability({
    listingId: listing.id,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    guestsCount: input.guestsCount,
  });

  const ratesRes = await dbQuery<{
    night_date: string;
    nightly_rate_vnd: number;
  }>(
    `SELECT night_date::text AS night_date, nightly_rate_vnd
     FROM nightly_rates
     WHERE listing_id = $1
       AND night_date >= $2::date
       AND night_date < $3::date`,
    [listing.id, input.checkIn, input.checkOut]
  );

  const overrideMap = new Map(
    ratesRes.rows.map((r) => [r.night_date, Number(r.nightly_rate_vnd)])
  );

  const baseRate = Number(listing.base_nightly_rate_vnd);
  const nightlyBreakdown: NightlyBreakdownItem[] = availability.nights.map((date) => {
    const override = overrideMap.get(date);
    return {
      date,
      rateVnd: override ?? baseRate,
      isOverride: override !== undefined,
    };
  });

  const accommodationSubtotalVnd = nightlyBreakdown.reduce(
    (sum, item) => sum + item.rateVnd,
    0
  );
  const cleaningFeeVnd = Number(listing.cleaning_fee_vnd);
  const totalVnd = accommodationSubtotalVnd + cleaningFeeVnd;

  const policyKey = (listing.cancellation_policy_version in CANCELLATION_POLICIES
    ? listing.cancellation_policy_version
    : 'flexible_24h') as CancellationPolicyVersion;
  const cancellationPolicy = CANCELLATION_POLICIES[policyKey];

  const quoteHash = computeQuoteHash({
    listingId: listing.id,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    nightlyBreakdown,
    cleaningFeeVnd,
    totalVnd,
    cancellationPolicyVersion: cancellationPolicy.version,
    paymentTerms: listing.payment_terms,
  });

  const titleEn = listing.published_title_en ?? 'WorkingHome Residence';
  const titleVi = listing.published_title_vi || titleEn;

  return {
    listingId: listing.id,
    listingSlug: listing.slug,
    listingTitle: titleEn,
    listingTitleVi: titleVi,
    areaNameEn: listing.area_name_en,
    areaNameVi: listing.area_name_vi,
    cityEn: listing.city_en,
    cityVi: listing.city_vi,
    timezone: listing.timezone,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    guestsCount: input.guestsCount,
    nightsCount: availability.nightsCount,
    currency: 'VND',
    available: availability.available,
    blockedDates: availability.blockedDates,
    nightlyBreakdown,
    accommodationSubtotalVnd,
    cleaningFeeVnd,
    totalVnd,
    paymentTerms: listing.payment_terms,
    paymentTermsDetailsEn: listing.payment_terms_details_en,
    paymentTermsDetailsVi:
      listing.payment_terms_details_vi || listing.payment_terms_details_en,
    cancellationPolicy,
    quoteHash,
  };
}
