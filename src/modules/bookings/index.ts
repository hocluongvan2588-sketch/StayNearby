import crypto from 'crypto';
import { getAppConfig, type CancellationPolicySpec } from '@/lib/config';
import {
  requireAuth,
  assertBookingParticipant,
  assertListingOwnership,
  canViewCheckinDetails,
  requireRole,
} from '@/lib/auth/rbac';
import type { SessionUser } from '@/lib/auth/session';
import { dbQuery, withTransaction } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { logEvent } from '@/lib/logger';
import { assertUuid } from '@/lib/validation';
import {
  computeBookingExpiryUtc,
  countNights,
  enumerateNights,
  getTodayIsoInTimezone,
} from '@/lib/format';
import { calculateStayQuote, type NightlyBreakdownItem } from '@/modules/pricing';

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'declined'
  | 'withdrawn'
  | 'expired'
  | 'cancelled'
  | 'completed';

export const ALLOWED_BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending: ['confirmed', 'declined', 'withdrawn', 'expired'],
  confirmed: ['cancelled', 'completed'],
  declined: [],
  withdrawn: [],
  expired: [],
  cancelled: [],
  completed: [],
};

export function canTransitionBooking(
  from: BookingStatus,
  to: BookingStatus
): boolean {
  return ALLOWED_BOOKING_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isPgUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const anyErr = err as { code?: string; message?: string };
  if (anyErr.code === '23505') return true;
  if (
    typeof anyErr.message === 'string' &&
    (anyErr.message.includes('duplicate key value violates unique constraint') ||
      anyErr.message.includes('UNIQUE constraint failed'))
  ) {
    return true;
  }
  return false;
}

export interface GuestTripSummary {
  id: string;
  bookingCode: string;
  listingId: string;
  listingSlug: string;
  listingTitle: string;
  listingTitleVi: string;
  areaNameEn: string;
  areaNameVi: string;
  cityEn: string;
  cityVi: string;
  checkIn: string;
  checkOut: string;
  nightsCount: number;
  guestsCount: number;
  status: BookingStatus;
  totalVnd: number;
  paymentTerms: string;
  expiresAt: string;
  isExpired: boolean;
  exactAddress: string | null;
  checkinInstructionsEn: string | null;
  checkinInstructionsVi: string | null;
  coverPhotoUrl: string | null;
  createdAt: string;
}

export interface BookingEventItem {
  id: string;
  actorRole: string;
  actorName: string | null;
  fromStatus: string | null;
  toStatus: string;
  reason: string | null;
  createdAt: string;
}

export interface BookingDetail {
  id: string;
  bookingCode: string;
  listingId: string;
  listingSlug: string;
  listingTitle: string;
  listingTitleVi: string;
  hostId: string;
  hostName: string;
  guestId: string;
  guestName: string;
  guestEmail: string;
  areaSlug: string;
  areaNameEn: string;
  areaNameVi: string;
  cityEn: string;
  cityVi: string;
  timezone: string;
  checkIn: string;
  checkOut: string;
  nightsCount: number;
  guestsCount: number;
  status: BookingStatus;
  expiresAt: string;
  isExpired: boolean;
  nightlyBreakdown: NightlyBreakdownItem[];
  accommodationSubtotalVnd: number;
  cleaningFeeVnd: number;
  totalVnd: number;
  currency: 'VND';
  paymentTerms: string;
  paymentTermsDetailsEn: string;
  paymentTermsDetailsVi: string;
  cancellationPolicy: CancellationPolicySpec;
  guestNote: string | null;
  hostResponseNote: string | null;
  cancellationReason: string | null;
  exactAddress: string | null;
  checkinInstructionsEn: string | null;
  checkinInstructionsVi: string | null;
  coverPhotoUrl: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  events: BookingEventItem[];
}

export interface HostBookingItem {
  id: string;
  bookingCode: string;
  listingId: string;
  listingSlug: string;
  listingTitle: string;
  guestId: string;
  guestName: string;
  guestEmail: string;
  timezone: string;
  checkIn: string;
  checkOut: string;
  nightsCount: number;
  guestsCount: number;
  status: BookingStatus;
  totalVnd: number;
  cleaningFeeVnd: number;
  accommodationSubtotalVnd: number;
  paymentTerms: string;
  expiresAt: string;
  isExpired: boolean;
  guestNote: string | null;
  hostResponseNote: string | null;
  createdAt: string;
}

export interface AdminBookingItem extends HostBookingItem {
  hostId: string;
  hostName: string;
  areaNameVi: string;
  cityVi: string;
  cancellationReason: string | null;
}

function generateBookingCode(): string {
  const bytes = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `WH-${bytes}`;
}

function computePayloadHash(payload: {
  listingId: string;
  checkIn: string;
  checkOut: string;
  guestsCount: number;
  guestNote: string;
}): string {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export async function getGuestTrips(
  actor: SessionUser | null
): Promise<GuestTripSummary[]> {
  const user = requireAuth(actor);

  const res = await dbQuery<{
    id: string;
    booking_code: string;
    listing_id: string;
    listing_slug: string;
    listing_title: string;
    listing_title_vi: string | null;
    host_id: string;
    area_name_en: string;
    area_name_vi: string;
    city_en: string;
    city_vi: string;
    check_in: string;
    check_out: string;
    guests_count: number;
    status: BookingStatus;
    total_vnd: number;
    payment_terms: string;
    expires_at: string;
    exact_address: string;
    checkin_instructions_en: string;
    checkin_instructions_vi: string;
    cover_url: string | null;
    created_at: string;
  }>(
    `SELECT b.id, b.booking_code, b.listing_id,
            l.slug AS listing_slug,
            COALESCE(l.published_title_en, 'WorkingHome Residence') AS listing_title,
            l.published_title_vi AS listing_title_vi,
            l.host_id,
            a.name_en AS area_name_en, a.name_vi AS area_name_vi,
            a.city_en, a.city_vi,
            b.check_in::text AS check_in,
            b.check_out::text AS check_out,
            b.guests_count, b.status, b.total_vnd, b.payment_terms,
            b.expires_at::text AS expires_at,
            l.exact_address, l.checkin_instructions_en, l.checkin_instructions_vi,
            cp.url AS cover_url,
            b.created_at::text AS created_at
     FROM bookings b
     JOIN listings l ON l.id = b.listing_id
     JOIN areas a ON a.id = l.area_id
     LEFT JOIN LATERAL (
       SELECT COALESCE(p.public_url, p.storage_path) AS url
       FROM listing_photos p
       WHERE p.listing_id = l.id AND p.is_draft = FALSE
       ORDER BY p.is_cover DESC, p.sort_order ASC
       LIMIT 1
     ) cp ON TRUE
     WHERE b.guest_id = $1
     ORDER BY b.created_at DESC`,
    [user.id]
  );

  const nowMs = Date.now();
  return res.rows.map((r) => {
    const showPrivate = canViewCheckinDetails({
      user,
      listingHostId: r.host_id,
      bookingGuestId: user.id,
      bookingStatus: r.status,
    });

    return {
      id: r.id,
      bookingCode: r.booking_code,
      listingId: r.listing_id,
      listingSlug: r.listing_slug,
      listingTitle: r.listing_title,
      listingTitleVi: r.listing_title_vi || r.listing_title,
      areaNameEn: r.area_name_en,
      areaNameVi: r.area_name_vi,
      cityEn: r.city_en,
      cityVi: r.city_vi,
      checkIn: r.check_in,
      checkOut: r.check_out,
      nightsCount: countNights(r.check_in, r.check_out),
      guestsCount: Number(r.guests_count),
      status: r.status,
      totalVnd: Number(r.total_vnd),
      paymentTerms: r.payment_terms,
      expiresAt: r.expires_at,
      isExpired: r.status === 'pending' && new Date(r.expires_at).getTime() <= nowMs,
      exactAddress: showPrivate ? r.exact_address : null,
      checkinInstructionsEn: showPrivate ? r.checkin_instructions_en : null,
      checkinInstructionsVi: showPrivate
        ? (r.checkin_instructions_vi || r.checkin_instructions_en)
        : null,
      coverPhotoUrl: r.cover_url,
      createdAt: r.created_at,
    };
  });
}

export async function getBookingDetail(
  actor: SessionUser | null,
  bookingId: string
): Promise<BookingDetail> {
  requireAuth(actor);
  const validBookingId = assertUuid(bookingId, 'booking ID');

  const res = await dbQuery<{
    id: string;
    booking_code: string;
    listing_id: string;
    listing_slug: string;
    listing_title: string;
    listing_title_vi: string | null;
    host_id: string;
    host_name: string;
    guest_id: string;
    guest_name: string;
    guest_email: string;
    area_slug: string;
    area_name_en: string;
    area_name_vi: string;
    city_en: string;
    city_vi: string;
    host_timezone: string;
    check_in: string;
    check_out: string;
    guests_count: number;
    status: BookingStatus;
    expires_at: string;
    nightly_breakdown: NightlyBreakdownItem[];
    accommodation_subtotal_vnd: number;
    cleaning_fee_vnd: number;
    total_vnd: number;
    currency: 'VND';
    payment_terms: string;
    payment_terms_details_en: string;
    payment_terms_details_vi: string;
    cancellation_policy_snapshot: CancellationPolicySpec;
    guest_note: string | null;
    host_response_note: string | null;
    cancellation_reason: string | null;
    exact_address: string;
    checkin_instructions_en: string;
    checkin_instructions_vi: string;
    cover_url: string | null;
    confirmed_at: string | null;
    cancelled_at: string | null;
    created_at: string;
  }>(
    `SELECT b.id, b.booking_code, b.listing_id,
            l.slug AS listing_slug,
            COALESCE(l.published_title_en, 'WorkingHome Residence') AS listing_title,
            l.published_title_vi AS listing_title_vi,
            l.host_id, hp.display_name AS host_name,
            b.guest_id, gp.display_name AS guest_name, gp.email AS guest_email,
            a.slug AS area_slug, a.name_en AS area_name_en, a.name_vi AS area_name_vi,
            a.city_en, a.city_vi,
            b.host_timezone,
            b.check_in::text AS check_in, b.check_out::text AS check_out,
            b.guests_count, b.status, b.expires_at::text AS expires_at,
            b.nightly_breakdown, b.accommodation_subtotal_vnd,
            b.cleaning_fee_vnd, b.total_vnd, b.currency,
            b.payment_terms, b.payment_terms_details_en,
            l.payment_terms_details_vi,
            b.cancellation_policy_snapshot,
            b.guest_note, b.host_response_note, b.cancellation_reason,
            l.exact_address, l.checkin_instructions_en, l.checkin_instructions_vi,
            b.confirmed_at::text AS confirmed_at,
            b.cancelled_at::text AS cancelled_at,
            b.created_at::text AS created_at,
            (
              SELECT COALESCE(p.public_url, p.storage_path)
              FROM listing_photos p
              WHERE p.listing_id = l.id AND p.is_draft = FALSE
              ORDER BY p.is_cover DESC, p.sort_order ASC
              LIMIT 1
            ) AS cover_url
     FROM bookings b
     JOIN listings l ON l.id = b.listing_id
     JOIN areas a ON a.id = l.area_id
     JOIN profiles hp ON hp.id = l.host_id
     JOIN profiles gp ON gp.id = b.guest_id
     WHERE b.id = $1`,
    [validBookingId]
  );

  const row = res.rows[0];
  if (!row) {
    throw new AppError('NOT_FOUND', 'Booking not found.');
  }

  assertBookingParticipant(actor, { guestId: row.guest_id, hostId: row.host_id });

  const eventsRes = await dbQuery<{
    id: string;
    actor_role: string;
    actor_name: string | null;
    from_status: string | null;
    to_status: string;
    reason: string | null;
    created_at: string;
  }>(
    `SELECT be.id, be.actor_role, p.display_name AS actor_name,
            be.from_status, be.to_status, be.reason,
            be.created_at::text AS created_at
     FROM booking_events be
     LEFT JOIN profiles p ON p.id = be.actor_id
     WHERE be.booking_id = $1
     ORDER BY be.created_at ASC`,
    [validBookingId]
  );

  const showPrivate = canViewCheckinDetails({
    user: actor,
    listingHostId: row.host_id,
    bookingGuestId: row.guest_id,
    bookingStatus: row.status,
  });

  const isExpired =
    row.status === 'pending' && new Date(row.expires_at).getTime() <= Date.now();

  return {
    id: row.id,
    bookingCode: row.booking_code,
    listingId: row.listing_id,
    listingSlug: row.listing_slug,
    listingTitle: row.listing_title,
    listingTitleVi: row.listing_title_vi || row.listing_title,
    hostId: row.host_id,
    hostName: row.host_name,
    guestId: row.guest_id,
    guestName: row.guest_name,
    guestEmail: row.guest_email,
    areaSlug: row.area_slug,
    areaNameEn: row.area_name_en,
    areaNameVi: row.area_name_vi,
    cityEn: row.city_en,
    cityVi: row.city_vi,
    timezone: row.host_timezone,
    checkIn: row.check_in,
    checkOut: row.check_out,
    nightsCount: countNights(row.check_in, row.check_out),
    guestsCount: Number(row.guests_count),
    status: row.status,
    expiresAt: row.expires_at,
    isExpired,
    nightlyBreakdown: row.nightly_breakdown,
    accommodationSubtotalVnd: Number(row.accommodation_subtotal_vnd),
    cleaningFeeVnd: Number(row.cleaning_fee_vnd),
    totalVnd: Number(row.total_vnd),
    currency: row.currency,
    paymentTerms: row.payment_terms,
    paymentTermsDetailsEn: row.payment_terms_details_en,
    paymentTermsDetailsVi: row.payment_terms_details_vi || row.payment_terms_details_en,
    cancellationPolicy: row.cancellation_policy_snapshot,
    guestNote: row.guest_note,
    hostResponseNote: row.host_response_note,
    cancellationReason: row.cancellation_reason,
    exactAddress: showPrivate ? row.exact_address : null,
    checkinInstructionsEn: showPrivate ? row.checkin_instructions_en : null,
    checkinInstructionsVi: showPrivate
      ? (row.checkin_instructions_vi || row.checkin_instructions_en)
      : null,
    coverPhotoUrl: row.cover_url,
    confirmedAt: row.confirmed_at,
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
    events: eventsRes.rows.map((e) => ({
      id: e.id,
      actorRole: e.actor_role,
      actorName: e.actor_name,
      fromStatus: e.from_status,
      toStatus: e.to_status,
      reason: e.reason,
      createdAt: e.created_at,
    })),
  };
}

export async function createBookingRequest(
  actor: SessionUser | null,
  input: {
    listingId?: string;
    listingSlug?: string;
    checkIn: string;
    checkOut: string;
    guestsCount: number;
    idempotencyKey: string;
    expectedQuoteHash?: string;
    guestNote?: string;
  }
): Promise<{ booking: BookingDetail; deduplicated: boolean }> {
  const guest = requireAuth(actor);

  const idempotencyKey = input.idempotencyKey.trim();
  if (!idempotencyKey || idempotencyKey.length > 128) {
    throw new AppError(
      'VALIDATION_ERROR',
      'A valid idempotency key (1–128 characters) is required.'
    );
  }
  if (!input.listingId && !input.listingSlug) {
    throw new AppError('VALIDATION_ERROR', 'Listing identifier is required.');
  }
  if (input.listingId) {
    assertUuid(input.listingId, 'listing ID');
  }

  const listingRes = await dbQuery<{
    id: string;
    host_id: string;
    status: string;
  }>(
    `SELECT id, host_id, status
     FROM listings
     WHERE ${input.listingId ? 'id = $1' : 'slug = $1'}`,
    [input.listingId ?? input.listingSlug]
  );

  const listing = listingRes.rows[0];
  if (!listing) {
    throw new AppError('NOT_FOUND', 'Stay not found.');
  }

  const normalizedNote = (input.guestNote ?? '').trim();
  const payloadHash = computePayloadHash({
    listingId: listing.id,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    guestsCount: input.guestsCount,
    guestNote: normalizedNote,
  });

  // Check existing booking for this (guest, idempotency_key) first
  const existingRes = await dbQuery<{
    id: string;
    request_payload_hash: string;
  }>(
    `SELECT id, request_payload_hash
     FROM bookings
     WHERE guest_id = $1 AND idempotency_key = $2`,
    [guest.id, idempotencyKey]
  );

  if (existingRes.rows[0]) {
    if (existingRes.rows[0].request_payload_hash !== payloadHash) {
      throw new AppError(
        'VALIDATION_ERROR',
        'This idempotency key has already been used with different booking parameters.'
      );
    }
    const existingDetail = await getBookingDetail(guest, existingRes.rows[0].id);
    return { booking: existingDetail, deduplicated: true };
  }

  if (listing.status !== 'published') {
    throw new AppError('NOT_FOUND', 'This stay is not currently published for booking.');
  }

  if (listing.host_id === guest.id) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Hosts cannot submit a booking request for their own listing.'
    );
  }

  const quote = await calculateStayQuote({
    listingId: listing.id,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    guestsCount: input.guestsCount,
  });

  if (!quote.available) {
    throw new AppError(
      'DATES_UNAVAILABLE',
      `Dates no longer available: ${quote.blockedDates.join(', ')}.`,
      { blockedDates: quote.blockedDates }
    );
  }

  if (input.expectedQuoteHash && quote.quoteHash !== input.expectedQuoteHash) {
    throw new AppError(
      'PRICE_CHANGED',
      'Pricing changed since you reviewed the stay. Please confirm the updated breakdown before submitting.',
      { updatedQuote: quote }
    );
  }

  const config = getAppConfig();
  const nowUtc = new Date();
  const expiresAt = computeBookingExpiryUtc(
    nowUtc,
    input.checkIn,
    quote.timezone,
    config.bookingResponseTimeoutHours
  );

  if (expiresAt.getTime() <= nowUtc.getTime()) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Check-in time has already passed or is too close to submit a new request.'
    );
  }

  let createdBookingId: string | null = null;
  let deduplicated = false;

  try {
    createdBookingId = await withTransaction(
      async (tx) => {
        const bookingId = crypto.randomUUID();
        const bookingCode = generateBookingCode();

        await tx.query(
          `INSERT INTO bookings (
             id, booking_code, listing_id, guest_id, check_in, check_out,
             guests_count, status, expires_at, idempotency_key,
             request_payload_hash, quote_hash, currency, nightly_breakdown,
             accommodation_subtotal_vnd, cleaning_fee_vnd, total_vnd,
             payment_terms, payment_terms_details_en,
             cancellation_policy_version, cancellation_policy_snapshot,
             host_timezone, guest_note
           ) VALUES (
             $1, $2, $3, $4, $5::date, $6::date,
             $7, 'pending', $8::timestamptz, $9,
             $10, $11, 'VND', $12::jsonb,
             $13, $14, $15,
             $16, $17,
             $18, $19::jsonb,
             $20, $21
           )`,
          [
            bookingId,
            bookingCode,
            listing.id,
            guest.id,
            input.checkIn,
            input.checkOut,
            input.guestsCount,
            expiresAt.toISOString(),
            idempotencyKey,
            payloadHash,
            quote.quoteHash,
            JSON.stringify(quote.nightlyBreakdown),
            quote.accommodationSubtotalVnd,
            quote.cleaningFeeVnd,
            quote.totalVnd,
            quote.paymentTerms,
            quote.paymentTermsDetailsEn,
            quote.cancellationPolicy.version,
            JSON.stringify(quote.cancellationPolicy),
            quote.timezone,
            normalizedNote || null,
          ]
        );

        await tx.query(
          `INSERT INTO booking_events (
             booking_id, actor_id, actor_role, from_status, to_status, reason, metadata
           ) VALUES ($1, $2, 'guest', NULL, 'pending', NULL, $3::jsonb)`,
          [
            bookingId,
            guest.id,
            JSON.stringify({ totalVnd: quote.totalVnd, quoteHash: quote.quoteHash }),
          ]
        );

        await tx.query(
          `INSERT INTO outbox (event_type, aggregate_type, aggregate_id, payload)
           VALUES ('booking.requested', 'booking', $1, $2::jsonb)`,
          [
            bookingId,
            JSON.stringify({
              bookingId,
              bookingCode,
              listingId: listing.id,
              guestId: guest.id,
              hostId: listing.host_id,
              checkIn: input.checkIn,
              checkOut: input.checkOut,
              totalVnd: quote.totalVnd,
            }),
          ]
        );

        return bookingId;
      },
      { actorId: guest.id }
    );
  } catch (err) {
    if (isPgUniqueViolation(err)) {
      const retryExisting = await dbQuery<{
        id: string;
        request_payload_hash: string;
      }>(
        `SELECT id, request_payload_hash
         FROM bookings
         WHERE guest_id = $1 AND idempotency_key = $2`,
        [guest.id, idempotencyKey]
      );
      const found = retryExisting.rows[0];
      if (found) {
        if (found.request_payload_hash !== payloadHash) {
          throw new AppError(
            'VALIDATION_ERROR',
            'This idempotency key has already been used with different booking parameters.'
          );
        }
        createdBookingId = found.id;
        deduplicated = true;
      } else {
        throw err;
      }
    } else {
      throw err;
    }
  }

  const detail = await getBookingDetail(guest, createdBookingId!);
  logEvent('info', 'booking.requested', {
    bookingId: detail.id,
    bookingCode: detail.bookingCode,
    listingId: detail.listingId,
    guestId: guest.id,
    totalVnd: detail.totalVnd,
    deduplicated,
  });
  return { booking: detail, deduplicated };
}

export async function confirmBookingRequest(
  actor: SessionUser | null,
  bookingId: string,
  responseNote?: string
): Promise<BookingDetail> {
  const authed = requireAuth(actor);
  const validBookingId = assertUuid(bookingId, 'booking ID');

  await withTransaction(
    async (tx) => {
      const res = await tx.query<{
        id: string;
        booking_code: string;
        listing_id: string;
        guest_id: string;
        host_id: string;
        listing_status: string;
        check_in: string;
        check_out: string;
        status: BookingStatus;
        expires_at: string;
        total_vnd: number;
      }>(
        `SELECT b.id, b.booking_code, b.listing_id, b.guest_id,
                l.host_id, l.status AS listing_status,
                b.check_in::text AS check_in,
                b.check_out::text AS check_out,
                b.status, b.expires_at::text AS expires_at,
                b.total_vnd
         FROM bookings b
         JOIN listings l ON l.id = b.listing_id
         WHERE b.id = $1
         FOR UPDATE`,
        [validBookingId]
      );

      const booking = res.rows[0];
      if (!booking) {
        throw new AppError('NOT_FOUND', 'Booking request not found.');
      }

      assertListingOwnership(authed, booking.host_id);

      if (booking.status === 'expired') {
        throw new AppError(
          'REQUEST_EXPIRED',
          'This booking request has expired and cannot be confirmed.'
        );
      }

      if (!canTransitionBooking(booking.status, 'confirmed')) {
        throw new AppError(
          'INVALID_TRANSITION',
          `Booking cannot transition from ${booking.status} to confirmed.`
        );
      }

      if (new Date(booking.expires_at).getTime() <= Date.now()) {
        throw new AppError(
          'REQUEST_EXPIRED',
          'This booking request has passed its response deadline and cannot be confirmed.'
        );
      }

      if (booking.listing_status !== 'published') {
        throw new AppError(
          'INVALID_TRANSITION',
          'Cannot confirm booking requests while the listing is suspended or unpublished.'
        );
      }

      const nights = enumerateNights(booking.check_in, booking.check_out);

      for (const nightDate of nights) {
        try {
          await tx.query(
            `INSERT INTO occupancy_nights (
               listing_id, night_date, source_type, booking_id, created_by
             ) VALUES ($1, $2::date, 'booking', $3, $4)`,
            [booking.listing_id, nightDate, booking.id, authed.id]
          );
        } catch (err) {
          if (isPgUniqueViolation(err)) {
            throw new AppError(
              'DATES_UNAVAILABLE',
              `Night ${nightDate} is already blocked or booked. No nights were locked.`
            );
          }
          throw err;
        }
      }

      const cleanNote = responseNote?.trim() || null;
      await tx.query(
        `UPDATE bookings
         SET status = 'confirmed',
             confirmed_at = NOW(),
             host_response_note = COALESCE($2, host_response_note),
             updated_at = NOW()
         WHERE id = $1`,
        [booking.id, cleanNote]
      );

      const actorRole = authed.roles.includes('admin') && authed.id !== booking.host_id
        ? 'admin'
        : 'host';

      await tx.query(
        `INSERT INTO booking_events (
           booking_id, actor_id, actor_role, from_status, to_status, reason, metadata
         ) VALUES ($1, $2, $3, 'pending', 'confirmed', $4, $5::jsonb)`,
        [
          booking.id,
          authed.id,
          actorRole,
          cleanNote,
          JSON.stringify({ nightsLocked: nights.length, totalVnd: Number(booking.total_vnd) }),
        ]
      );

      await tx.query(
        `INSERT INTO outbox (event_type, aggregate_type, aggregate_id, payload)
         VALUES ('booking.confirmed', 'booking', $1, $2::jsonb)`,
        [
          booking.id,
          JSON.stringify({
            bookingId: booking.id,
            bookingCode: booking.booking_code,
            listingId: booking.listing_id,
            guestId: booking.guest_id,
            hostId: booking.host_id,
            checkIn: booking.check_in,
            checkOut: booking.check_out,
            totalVnd: Number(booking.total_vnd),
          }),
        ]
      );
    },
    { actorId: authed.id }
  );

  logEvent('info', 'booking.confirmed', {
    bookingId: validBookingId,
    actorId: authed.id,
  });
  return getBookingDetail(authed, validBookingId);
}

export async function declineBookingRequest(
  actor: SessionUser | null,
  bookingId: string,
  reason?: string
): Promise<BookingDetail> {
  const authed = requireAuth(actor);
  const validBookingId = assertUuid(bookingId, 'booking ID');

  await withTransaction(
    async (tx) => {
      const res = await tx.query<{
        id: string;
        booking_code: string;
        listing_id: string;
        guest_id: string;
        host_id: string;
        status: BookingStatus;
      }>(
        `SELECT b.id, b.booking_code, b.listing_id, b.guest_id, l.host_id, b.status
         FROM bookings b
         JOIN listings l ON l.id = b.listing_id
         WHERE b.id = $1
         FOR UPDATE`,
        [validBookingId]
      );

      const booking = res.rows[0];
      if (!booking) {
        throw new AppError('NOT_FOUND', 'Booking request not found.');
      }

      assertListingOwnership(authed, booking.host_id);

      if (!canTransitionBooking(booking.status, 'declined')) {
        throw new AppError(
          'INVALID_TRANSITION',
          `Booking cannot transition from ${booking.status} to declined.`
        );
      }

      const cleanReason = reason?.trim() || null;
      await tx.query(
        `UPDATE bookings
         SET status = 'declined',
             host_response_note = COALESCE($2, host_response_note),
             updated_at = NOW()
         WHERE id = $1`,
        [booking.id, cleanReason]
      );

      const actorRole = authed.roles.includes('admin') && authed.id !== booking.host_id
        ? 'admin'
        : 'host';

      await tx.query(
        `INSERT INTO booking_events (
           booking_id, actor_id, actor_role, from_status, to_status, reason
         ) VALUES ($1, $2, $3, 'pending', 'declined', $4)`,
        [booking.id, authed.id, actorRole, cleanReason]
      );

      await tx.query(
        `INSERT INTO outbox (event_type, aggregate_type, aggregate_id, payload)
         VALUES ('booking.declined', 'booking', $1, $2::jsonb)`,
        [
          booking.id,
          JSON.stringify({
            bookingId: booking.id,
            bookingCode: booking.booking_code,
            guestId: booking.guest_id,
            reason: cleanReason,
          }),
        ]
      );
    },
    { actorId: authed.id }
  );

  logEvent('info', 'booking.declined', {
    bookingId: validBookingId,
    actorId: authed.id,
  });
  return getBookingDetail(authed, validBookingId);
}

export async function withdrawBookingRequest(
  actor: SessionUser | null,
  bookingId: string,
  reason?: string
): Promise<BookingDetail> {
  const authed = requireAuth(actor);
  const validBookingId = assertUuid(bookingId, 'booking ID');

  await withTransaction(
    async (tx) => {
      const res = await tx.query<{
        id: string;
        booking_code: string;
        guest_id: string;
        host_id: string;
        status: BookingStatus;
      }>(
        `SELECT b.id, b.booking_code, b.guest_id, l.host_id, b.status
         FROM bookings b
         JOIN listings l ON l.id = b.listing_id
         WHERE b.id = $1
         FOR UPDATE`,
        [validBookingId]
      );

      const booking = res.rows[0];
      if (!booking) {
        throw new AppError('NOT_FOUND', 'Booking request not found.');
      }

      if (booking.guest_id !== authed.id) {
        throw new AppError(
          'FORBIDDEN',
          'Only the guest who submitted this request can withdraw it.'
        );
      }

      if (!canTransitionBooking(booking.status, 'withdrawn')) {
        throw new AppError(
          'INVALID_TRANSITION',
          `Booking cannot transition from ${booking.status} to withdrawn.`
        );
      }

      const cleanReason = reason?.trim() || null;
      await tx.query(
        `UPDATE bookings
         SET status = 'withdrawn',
             cancelled_at = NOW(),
             cancellation_reason = $2,
             updated_at = NOW()
         WHERE id = $1`,
        [booking.id, cleanReason]
      );

      await tx.query(
        `INSERT INTO booking_events (
           booking_id, actor_id, actor_role, from_status, to_status, reason
         ) VALUES ($1, $2, 'guest', 'pending', 'withdrawn', $3)`,
        [booking.id, authed.id, cleanReason]
      );

      await tx.query(
        `INSERT INTO outbox (event_type, aggregate_type, aggregate_id, payload)
         VALUES ('booking.withdrawn', 'booking', $1, $2::jsonb)`,
        [
          booking.id,
          JSON.stringify({
            bookingId: booking.id,
            bookingCode: booking.booking_code,
            hostId: booking.host_id,
          }),
        ]
      );
    },
    { actorId: authed.id }
  );

  logEvent('info', 'booking.withdrawn', {
    bookingId: validBookingId,
    actorId: authed.id,
  });
  return getBookingDetail(authed, validBookingId);
}

export async function cancelConfirmedBooking(
  actor: SessionUser | null,
  bookingId: string,
  reason?: string
): Promise<BookingDetail> {
  const authed = requireAuth(actor);
  const validBookingId = assertUuid(bookingId, 'booking ID');
  const cleanReason = reason?.trim() || null;

  await withTransaction(
    async (tx) => {
      const res = await tx.query<{
        id: string;
        booking_code: string;
        listing_id: string;
        guest_id: string;
        host_id: string;
        check_out: string;
        host_timezone: string;
        status: BookingStatus;
      }>(
        `SELECT b.id, b.booking_code, b.listing_id, b.guest_id, l.host_id,
                b.check_out::text AS check_out, b.host_timezone, b.status
         FROM bookings b
         JOIN listings l ON l.id = b.listing_id
         WHERE b.id = $1
         FOR UPDATE`,
        [validBookingId]
      );

      const booking = res.rows[0];
      if (!booking) {
        throw new AppError('NOT_FOUND', 'Booking not found.');
      }

      const isAdmin = authed.roles.includes('admin');
      const isGuest = booking.guest_id === authed.id;
      if (!isGuest && !isAdmin) {
        throw new AppError(
          'FORBIDDEN',
          'Only the booking guest or platform admin can cancel a confirmed booking.'
        );
      }

      if (isAdmin && !isGuest && !cleanReason) {
        throw new AppError(
          'VALIDATION_ERROR',
          'Admin cancellation support requires a documented reason.'
        );
      }

      if (!canTransitionBooking(booking.status, 'cancelled')) {
        throw new AppError(
          'INVALID_TRANSITION',
          `Booking cannot transition from ${booking.status} to cancelled.`
        );
      }

      const todayLocal = getTodayIsoInTimezone(booking.host_timezone);
      if (todayLocal >= booking.check_out) {
        throw new AppError(
          'INVALID_TRANSITION',
          'Cannot cancel a stay after its check-out date.'
        );
      }

      await tx.query(
        `UPDATE bookings
         SET status = 'cancelled',
             cancelled_at = NOW(),
             cancellation_reason = $2,
             updated_at = NOW()
         WHERE id = $1`,
        [booking.id, cleanReason]
      );

      // Release ONLY occupancy nights tied to this specific booking inside the same transaction
      await tx.query(
        `DELETE FROM occupancy_nights
         WHERE booking_id = $1 AND source_type = 'booking'`,
        [booking.id]
      );

      const actorRole = isAdmin && !isGuest ? 'admin' : 'guest';
      await tx.query(
        `INSERT INTO booking_events (
           booking_id, actor_id, actor_role, from_status, to_status, reason
         ) VALUES ($1, $2, $3, 'confirmed', 'cancelled', $4)`,
        [booking.id, authed.id, actorRole, cleanReason]
      );

      await tx.query(
        `INSERT INTO outbox (event_type, aggregate_type, aggregate_id, payload)
         VALUES ('booking.cancelled', 'booking', $1, $2::jsonb)`,
        [
          booking.id,
          JSON.stringify({
            bookingId: booking.id,
            bookingCode: booking.booking_code,
            listingId: booking.listing_id,
            guestId: booking.guest_id,
            hostId: booking.host_id,
            actorRole,
            reason: cleanReason,
          }),
        ]
      );
    },
    { actorId: authed.id }
  );

  logEvent('info', 'booking.cancelled', {
    bookingId: validBookingId,
    actorId: authed.id,
    reason: cleanReason,
  });
  return getBookingDetail(authed, validBookingId);
}

export async function getHostBookingRequests(
  actor: SessionUser | null
): Promise<HostBookingItem[]> {
  const host = requireRole(actor, 'host');

  const res = await dbQuery<{
    id: string;
    booking_code: string;
    listing_id: string;
    listing_slug: string;
    listing_title: string;
    guest_id: string;
    guest_name: string;
    guest_email: string;
    host_timezone: string;
    check_in: string;
    check_out: string;
    guests_count: number;
    status: BookingStatus;
    total_vnd: number;
    cleaning_fee_vnd: number;
    accommodation_subtotal_vnd: number;
    payment_terms: string;
    expires_at: string;
    guest_note: string | null;
    host_response_note: string | null;
    created_at: string;
  }>(
    `SELECT b.id, b.booking_code, b.listing_id,
            l.slug AS listing_slug,
            COALESCE(l.published_title_en, 'WorkingHome Residence') AS listing_title,
            b.guest_id, gp.display_name AS guest_name, gp.email AS guest_email,
            b.host_timezone,
            b.check_in::text AS check_in,
            b.check_out::text AS check_out,
            b.guests_count, b.status,
            b.total_vnd, b.cleaning_fee_vnd, b.accommodation_subtotal_vnd,
            b.payment_terms, b.expires_at::text AS expires_at,
            b.guest_note, b.host_response_note,
            b.created_at::text AS created_at
     FROM bookings b
     JOIN listings l ON l.id = b.listing_id
     JOIN profiles gp ON gp.id = b.guest_id
     WHERE l.host_id = $1
     ORDER BY
       CASE b.status WHEN 'pending' THEN 1 WHEN 'confirmed' THEN 2 ELSE 3 END,
       b.created_at DESC`,
    [host.id]
  );

  const nowMs = Date.now();
  return res.rows.map((r) => ({
    id: r.id,
    bookingCode: r.booking_code,
    listingId: r.listing_id,
    listingSlug: r.listing_slug,
    listingTitle: r.listing_title,
    guestId: r.guest_id,
    guestName: r.guest_name,
    guestEmail: r.guest_email,
    timezone: r.host_timezone,
    checkIn: r.check_in,
    checkOut: r.check_out,
    nightsCount: countNights(r.check_in, r.check_out),
    guestsCount: Number(r.guests_count),
    status: r.status,
    totalVnd: Number(r.total_vnd),
    cleaningFeeVnd: Number(r.cleaning_fee_vnd),
    accommodationSubtotalVnd: Number(r.accommodation_subtotal_vnd),
    paymentTerms: r.payment_terms,
    expiresAt: r.expires_at,
    isExpired: r.status === 'pending' && new Date(r.expires_at).getTime() <= nowMs,
    guestNote: r.guest_note,
    hostResponseNote: r.host_response_note,
    createdAt: r.created_at,
  }));
}

export async function getAllAdminBookings(
  actor: SessionUser | null,
  statusFilter?: string
): Promise<AdminBookingItem[]> {
  requireRole(actor, 'admin');

  const params: unknown[] = [];
  const where =
    statusFilter && statusFilter !== 'all'
      ? (params.push(statusFilter), 'WHERE b.status = $1')
      : '';

  const res = await dbQuery<{
    id: string;
    booking_code: string;
    listing_id: string;
    listing_slug: string;
    listing_title: string;
    host_id: string;
    host_name: string;
    area_name_vi: string;
    city_vi: string;
    guest_id: string;
    guest_name: string;
    guest_email: string;
    host_timezone: string;
    check_in: string;
    check_out: string;
    guests_count: number;
    status: BookingStatus;
    total_vnd: number;
    cleaning_fee_vnd: number;
    accommodation_subtotal_vnd: number;
    payment_terms: string;
    expires_at: string;
    guest_note: string | null;
    host_response_note: string | null;
    cancellation_reason: string | null;
    created_at: string;
  }>(
    `SELECT b.id, b.booking_code, b.listing_id,
            l.slug AS listing_slug,
            COALESCE(l.published_title_en, 'Chỗ ở chưa đặt tên') AS listing_title,
            l.host_id, hp.display_name AS host_name,
            a.name_vi AS area_name_vi, a.city_vi,
            b.guest_id, gp.display_name AS guest_name, gp.email AS guest_email,
            b.host_timezone,
            b.check_in::text AS check_in,
            b.check_out::text AS check_out,
            b.guests_count, b.status,
            b.total_vnd, b.cleaning_fee_vnd, b.accommodation_subtotal_vnd,
            b.payment_terms, b.expires_at::text AS expires_at,
            b.guest_note, b.host_response_note, b.cancellation_reason,
            b.created_at::text AS created_at
     FROM bookings b
     JOIN listings l ON l.id = b.listing_id
     JOIN areas a ON a.id = l.area_id
     JOIN profiles hp ON hp.id = l.host_id
     JOIN profiles gp ON gp.id = b.guest_id
     ${where}
     ORDER BY b.created_at DESC`,
    params
  );

  const nowMs = Date.now();
  return res.rows.map((r) => ({
    id: r.id,
    bookingCode: r.booking_code,
    listingId: r.listing_id,
    listingSlug: r.listing_slug,
    listingTitle: r.listing_title,
    hostId: r.host_id,
    hostName: r.host_name,
    areaNameVi: r.area_name_vi,
    cityVi: r.city_vi,
    guestId: r.guest_id,
    guestName: r.guest_name,
    guestEmail: r.guest_email,
    timezone: r.host_timezone,
    checkIn: r.check_in,
    checkOut: r.check_out,
    nightsCount: countNights(r.check_in, r.check_out),
    guestsCount: Number(r.guests_count),
    status: r.status,
    totalVnd: Number(r.total_vnd),
    cleaningFeeVnd: Number(r.cleaning_fee_vnd),
    accommodationSubtotalVnd: Number(r.accommodation_subtotal_vnd),
    paymentTerms: r.payment_terms,
    expiresAt: r.expires_at,
    isExpired: r.status === 'pending' && new Date(r.expires_at).getTime() <= nowMs,
    guestNote: r.guest_note,
    hostResponseNote: r.host_response_note,
    cancellationReason: r.cancellation_reason,
    createdAt: r.created_at,
  }));
}
