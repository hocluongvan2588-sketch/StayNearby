import { dbQuery } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { enumerateNights, getTodayIsoInTimezone } from '@/lib/format';

export interface AvailabilityCheckInput {
  listingId: string;
  checkIn: string;
  checkOut: string;
  guestsCount: number;
}

export interface AvailabilityCheckResult {
  available: boolean;
  nights: string[];
  nightsCount: number;
  blockedDates: string[];
  reason?: string;
}

export async function checkListingAvailability(
  input: AvailabilityCheckInput
): Promise<AvailabilityCheckResult> {
  const nights = enumerateNights(input.checkIn, input.checkOut);
  const nightsCount = nights.length;

  const listingRes = await dbQuery<{
    id: string;
    status: string;
    max_guests: number;
    min_nights: number;
    max_nights: number;
    timezone: string;
  }>(
    `SELECT l.id, l.status, l.max_guests, l.min_nights, l.max_nights, a.timezone
     FROM listings l
     JOIN areas a ON a.id = l.area_id
     WHERE l.id = $1`,
    [input.listingId]
  );

  const listing = listingRes.rows[0];
  if (!listing || listing.status !== 'published') {
    throw new AppError('NOT_FOUND', 'Listing is not available for booking.');
  }

  const todayLocal = getTodayIsoInTimezone(listing.timezone);
  if (input.checkIn < todayLocal) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Check-in date cannot be in the past for the stay timezone.'
    );
  }

  if (input.guestsCount < 1 || input.guestsCount > listing.max_guests) {
    throw new AppError(
      'VALIDATION_ERROR',
      `This stay accommodates up to ${listing.max_guests} guests.`
    );
  }

  if (nightsCount < listing.min_nights || nightsCount > listing.max_nights) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Stay length must be between ${listing.min_nights} and ${listing.max_nights} nights.`
    );
  }

  const blockedRes = await dbQuery<{ night_date: string }>(
    `SELECT night_date::text AS night_date
     FROM occupancy_nights
     WHERE listing_id = $1
       AND night_date >= $2::date
       AND night_date < $3::date
     ORDER BY night_date ASC`,
    [input.listingId, input.checkIn, input.checkOut]
  );

  const blockedDates = blockedRes.rows.map((r) => r.night_date);
  return {
    available: blockedDates.length === 0,
    nights,
    nightsCount,
    blockedDates,
    ...(blockedDates.length > 0
      ? { reason: 'DATES_UNAVAILABLE' }
      : {}),
  };
}

export async function getBlockedDatesForListing(
  listingId: string,
  fromDate: string,
  toDate: string
): Promise<string[]> {
  const res = await dbQuery<{ night_date: string }>(
    `SELECT night_date::text AS night_date
     FROM occupancy_nights
     WHERE listing_id = $1
       AND night_date >= $2::date
       AND night_date < $3::date
     ORDER BY night_date ASC`,
    [listingId, fromDate, toDate]
  );
  return res.rows.map((r) => r.night_date);
}
