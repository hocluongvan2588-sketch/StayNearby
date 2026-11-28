import crypto from 'node:crypto';
import type { SessionUser } from '@/lib/auth/session';
import { isValidUuid } from '@/lib/dates';
import { dbQuery, dbTransaction, toNum, type DbClient } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { formatVndExact } from '@/lib/i18n';
import { maybeSendResendEmail } from '@/modules/notifications';

/**
 * Stay Extras — host-provided additional services for a stay.
 *
 * Business rules (product spec §2): hosts provide/arrange services, guests
 * pay providers directly. VietNomad never collects service money and never
 * applies platform commission to extras — nothing in this module touches
 * pricing, payments, or booking fees. Requests are informational flows
 * (display, request, notify, track) built on the existing booking state.
 */

export type ServicePriceUnit = 'day' | 'week' | 'month' | 'trip' | 'visit' | 'quote';
export type ServiceRequestStatus =
  | 'pending'
  | 'awaiting_guest'
  | 'confirmed'
  | 'preparing'
  | 'completed'
  | 'declined'
  | 'cancelled';

export interface ServiceCatalogItem {
  id: string;
  key: string;
  nameEn: string;
  nameVi: string;
  allowedUnits: string[];
  enabled: boolean;
  sortOrder: number;
}

export interface StayServiceInput {
  id?: string;
  stayId: string;
  catalogId: string;
  enabled?: boolean;
  priceVnd?: number | null;
  priceUnit?: ServicePriceUnit;
  isIncluded?: boolean;
  descriptionEn?: string;
  descriptionVi?: string;
  conditionsEn?: string;
  conditionsVi?: string;
  depositVnd?: number | null;
  leadTimeHours?: number | null;
  providerType?: 'host' | 'third_party';
  changeCancelEn?: string;
  changeCancelVi?: string;
}

export interface StayServiceView {
  id: string;
  stayId: string;
  catalogId: string;
  catalogKey: string;
  nameEn: string;
  nameVi: string;
  allowedUnits: string[];
  enabled: boolean;
  priceVnd: number | null;
  priceUnit: ServicePriceUnit;
  isIncluded: boolean;
  descriptionEn: string;
  descriptionVi: string;
  conditionsEn: string;
  conditionsVi: string;
  depositVnd: number | null;
  leadTimeHours: number | null;
  providerType: 'host' | 'third_party';
  changeCancelEn: string;
  changeCancelVi: string;
  activeRequestCount: number;
}

export interface ServiceRequestView {
  id: string;
  bookingId: string;
  bookingCode: string;
  stayId: string;
  stayTitle: string;
  staySlug: string;
  guestId: string;
  guestName: string;
  guestEmail: string;
  hostId: string;
  hostName: string;
  hostEmail: string;
  checkIn: string;
  checkOut: string;
  stayServiceId: string;
  catalogKey: string;
  source: 'checkout' | 'post_booking';
  status: ServiceRequestStatus;
  snapshot: Record<string, unknown>;
  guestDetails: Record<string, unknown>;
  quantity: number;
  desiredAt: string | null;
  guestNote: string;
  quotePriceVnd: number | null;
  quoteNote: string;
  quoteVersion: number;
  quotedAt: string | null;
  guestRespondedVersion: number | null;
  hostNote: string;
  declinedReason: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

const ACTIVE_STATUSES: ServiceRequestStatus[] = [
  'pending',
  'awaiting_guest',
  'confirmed',
  'preparing',
];

const ALLOWED_TRANSITIONS: Record<ServiceRequestStatus, ServiceRequestStatus[]> = {
  pending: ['confirmed', 'awaiting_guest', 'declined', 'cancelled'],
  awaiting_guest: ['confirmed', 'cancelled', 'declined'],
  confirmed: ['awaiting_guest', 'preparing', 'cancelled', 'completed'],
  preparing: ['completed', 'cancelled'],
  completed: [],
  declined: [],
  cancelled: [],
};

function assertTransition(from: ServiceRequestStatus, to: ServiceRequestStatus) {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new AppError('CONFLICT', `Service request cannot move from ${from} to ${to}.`);
  }
}

function toIso(v: string | Date | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export async function getServiceCatalog(opts?: { includeDisabled?: boolean }): Promise<ServiceCatalogItem[]> {
  const res = await dbQuery<{
    id: string;
    key: string;
    name_en: string;
    name_vi: string;
    allowed_units: string[];
    enabled: boolean;
    sort_order: number;
  }>(
    `SELECT id, key, name_en, name_vi, allowed_units, enabled, sort_order
     FROM service_catalog
     ${opts?.includeDisabled ? '' : 'WHERE enabled = TRUE'}
     ORDER BY sort_order ASC, name_en ASC`
  );
  return res.rows.map((r) => ({
    id: String(r.id),
    key: String(r.key),
    nameEn: String(r.name_en),
    nameVi: String(r.name_vi),
    allowedUnits: r.allowed_units ?? [],
    enabled: Boolean(r.enabled),
    sortOrder: toNum(r.sort_order, 0),
  }));
}

export async function setCatalogItemEnabled(actor: SessionUser, catalogId: string, enabled: boolean) {
  if (actor.role !== 'admin') throw new AppError('FORBIDDEN', 'Admin access required.');
  if (!isValidUuid(catalogId)) throw new AppError('VALIDATION_ERROR', 'Invalid catalog id.');
  await dbQuery('UPDATE service_catalog SET enabled = $1, updated_at = NOW() WHERE id = $2', [
    enabled,
    catalogId,
  ]);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Stay services (host declarations)
// ---------------------------------------------------------------------------

const STAY_SERVICE_SELECT = `
  SELECT ss.*, sc.key AS catalog_key, sc.name_en, sc.name_vi, sc.allowed_units,
         (SELECT COUNT(*) FROM service_requests sr
           WHERE sr.stay_service_id = ss.id
             AND sr.status IN ('pending','awaiting_guest','confirmed','preparing')) AS active_request_count
  FROM stay_services ss
  JOIN service_catalog sc ON sc.id = ss.catalog_id
`;

function mapStayService(r: Record<string, any>): StayServiceView { // eslint-disable-line @typescript-eslint/no-explicit-any
  return {
    id: String(r.id),
    stayId: String(r.stay_id),
    catalogId: String(r.catalog_id),
    catalogKey: String(r.catalog_key),
    nameEn: String(r.name_en),
    nameVi: String(r.name_vi),
    allowedUnits: r.allowed_units ?? [],
    enabled: Boolean(r.enabled),
    priceVnd: r.price_vnd === null ? null : toNum(r.price_vnd),
    priceUnit: r.price_unit as ServicePriceUnit,
    isIncluded: Boolean(r.is_included),
    descriptionEn: String(r.description_en ?? ''),
    descriptionVi: String(r.description_vi ?? ''),
    conditionsEn: String(r.conditions_en ?? ''),
    conditionsVi: String(r.conditions_vi ?? ''),
    depositVnd: r.deposit_vnd === null ? null : toNum(r.deposit_vnd),
    leadTimeHours: r.lead_time_hours === null ? null : toNum(r.lead_time_hours),
    providerType: r.provider_type as 'host' | 'third_party',
    changeCancelEn: String(r.change_cancel_en ?? ''),
    changeCancelVi: String(r.change_cancel_vi ?? ''),
    activeRequestCount: toNum(r.active_request_count, 0),
  };
}

async function assertStayOwnership(tx: DbClient, stayId: string, user: SessionUser) {
  if (!isValidUuid(stayId)) throw new AppError('VALIDATION_ERROR', 'Invalid stay id.');
  const res = await tx.query<{ host_id: string }>('SELECT host_id FROM stays WHERE id = $1', [stayId]);
  const stay = res.rows[0];
  if (!stay) throw new AppError('NOT_FOUND', 'Stay not found.');
  if (user.role !== 'admin' && stay.host_id !== user.id) {
    throw new AppError('FORBIDDEN', 'You can only manage services for your own listings.');
  }
}

export async function getStayServicesForHost(user: SessionUser, stayId: string): Promise<StayServiceView[]> {
  await assertStayOwnership(dbQueryAdapter(), stayId, user);
  const res = await dbQuery(STAY_SERVICE_SELECT + ' WHERE ss.stay_id = $1 ORDER BY sc.sort_order ASC', [
    stayId,
  ]);
  return res.rows.map(mapStayService);
}

// Small adapter so assertStayOwnership can run outside a transaction too.
function dbQueryAdapter(): DbClient {
  return { query: (text: string, params?: unknown[]) => dbQuery(text, params) } as DbClient;
}

export async function upsertStayService(user: SessionUser, input: StayServiceInput): Promise<StayServiceView> {
  if (!isValidUuid(input.stayId) || !isValidUuid(input.catalogId)) {
    throw new AppError('VALIDATION_ERROR', 'Invalid stay or catalog identifier.');
  }
  return dbTransaction(async (tx) => {
    await assertStayOwnership(tx, input.stayId, user);
    const cat = await tx.query<{ id: string; enabled: boolean }>(
      'SELECT id, enabled FROM service_catalog WHERE id = $1',
      [input.catalogId]
    );
    if (!cat.rows[0]) throw new AppError('NOT_FOUND', 'Service category not found.');
    if (!cat.rows[0].enabled) {
      throw new AppError('CONFLICT', 'This service category is disabled on the platform.');
    }

    const priceUnit = input.priceUnit ?? 'quote';
    const isIncluded = Boolean(input.isIncluded);
    const priceVnd = isIncluded ? null : (input.priceVnd ?? null);
    if (!isIncluded && priceVnd !== null && priceVnd < 0) {
      throw new AppError('VALIDATION_ERROR', 'Price cannot be negative.');
    }
    if (input.leadTimeHours !== null && input.leadTimeHours !== undefined && input.leadTimeHours < 0) {
      throw new AppError('VALIDATION_ERROR', 'Lead time cannot be negative.');
    }

    const existing = input.id
      ? await tx.query<{ id: string; stay_id: string }>(
          'SELECT id, stay_id FROM stay_services WHERE id = $1',
          [input.id]
        )
      : { rows: [] as Array<{ id: string; stay_id: string }> };
    if (input.id) {
      if (!existing.rows[0]) throw new AppError('NOT_FOUND', 'Service not found.');
      if (existing.rows[0].stay_id !== input.stayId) {
        throw new AppError('FORBIDDEN', 'Service belongs to another stay.');
      }
    }

    const res = await tx.query<{ id: string }>(
      `INSERT INTO stay_services (
         stay_id, catalog_id, enabled, price_vnd, price_unit, is_included,
         description_en, description_vi, conditions_en, conditions_vi,
         deposit_vnd, lead_time_hours, provider_type, change_cancel_en, change_cancel_vi,
         updated_by, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW())
       ON CONFLICT (stay_id, catalog_id) DO UPDATE SET
         enabled = EXCLUDED.enabled,
         price_vnd = EXCLUDED.price_vnd,
         price_unit = EXCLUDED.price_unit,
         is_included = EXCLUDED.is_included,
         description_en = EXCLUDED.description_en,
         description_vi = EXCLUDED.description_vi,
         conditions_en = EXCLUDED.conditions_en,
         conditions_vi = EXCLUDED.conditions_vi,
         deposit_vnd = EXCLUDED.deposit_vnd,
         lead_time_hours = EXCLUDED.lead_time_hours,
         provider_type = EXCLUDED.provider_type,
         change_cancel_en = EXCLUDED.change_cancel_en,
         change_cancel_vi = EXCLUDED.change_cancel_vi,
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()
       RETURNING id`,
      [
        input.stayId,
        input.catalogId,
        input.enabled ?? true,
        priceVnd,
        priceUnit,
        isIncluded,
        (input.descriptionEn ?? '').trim(),
        (input.descriptionVi ?? '').trim(),
        (input.conditionsEn ?? '').trim(),
        (input.conditionsVi ?? '').trim(),
        input.depositVnd ?? null,
        input.leadTimeHours ?? null,
        input.providerType ?? 'host',
        (input.changeCancelEn ?? '').trim(),
        (input.changeCancelVi ?? '').trim(),
        user.id,
      ]
    );
    const row = (
      await tx.query(STAY_SERVICE_SELECT + ' WHERE ss.id = $1', [res.rows[0].id])
    ).rows[0];
    return mapStayService(row);
  });
}

export async function deleteStayService(user: SessionUser, serviceId: string) {
  if (!isValidUuid(serviceId)) throw new AppError('VALIDATION_ERROR', 'Invalid service id.');
  return dbTransaction(async (tx) => {
    const res = await tx.query<{ stay_id: string }>(
      'SELECT stay_id FROM stay_services WHERE id = $1',
      [serviceId]
    );
    const svc = res.rows[0];
    if (!svc) throw new AppError('NOT_FOUND', 'Service not found.');
    await assertStayOwnership(tx, svc.stay_id, user);
    const active = await tx.query<{ c: string }>(
      `SELECT COUNT(*) AS c FROM service_requests
       WHERE stay_service_id = $1 AND status IN ('pending','awaiting_guest','confirmed','preparing')`,
      [serviceId]
    );
    if (toNum(active.rows[0]?.c, 0) > 0) {
      throw new AppError(
        'CONFLICT',
        'This service has active requests. Disable it instead of deleting.'
      );
    }
    await tx.query('DELETE FROM stay_services WHERE id = $1', [serviceId]);
    return { ok: true };
  });
}

/** Public list for the Stay Detail page (enabled services only). */
export async function getStayServicesForPublic(stayId: string): Promise<StayServiceView[]> {
  const res = await dbQuery(
    STAY_SERVICE_SELECT + ' WHERE ss.stay_id = $1 AND ss.enabled = TRUE ORDER BY sc.sort_order ASC',
    [stayId]
  );
  return res.rows.map(mapStayService);
}

// ---------------------------------------------------------------------------
// Snapshots & request creation (called inside booking confirmation tx)
// ---------------------------------------------------------------------------

function buildSnapshot(service: StayServiceView): Record<string, unknown> {
  return {
    catalogKey: service.catalogKey,
    nameEn: service.nameEn,
    nameVi: service.nameVi,
    priceVnd: service.priceVnd,
    priceUnit: service.priceUnit,
    isIncluded: service.isIncluded,
    descriptionEn: service.descriptionEn,
    descriptionVi: service.descriptionVi,
    conditionsEn: service.conditionsEn,
    conditionsVi: service.conditionsVi,
    depositVnd: service.depositVnd,
    leadTimeHours: service.leadTimeHours,
    providerType: service.providerType,
    changeCancelEn: service.changeCancelEn,
    changeCancelVi: service.changeCancelVi,
  };
}

async function insertRequestEventTx(
  tx: DbClient,
  requestId: string,
  event: {
    actorUserId?: string | null;
    actorRole?: 'guest' | 'host' | 'admin' | 'system';
    eventType: string;
    fromStatus?: ServiceRequestStatus | null;
    toStatus?: ServiceRequestStatus | null;
    payload?: Record<string, unknown>;
  }
) {
  await tx.query(
    `INSERT INTO service_request_events
       (id, request_id, actor_user_id, actor_role, event_type, from_status, to_status, payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      crypto.randomUUID(),
      requestId,
      event.actorUserId ?? null,
      event.actorRole ?? 'system',
      event.eventType,
      event.fromStatus ?? null,
      event.toStatus ?? null,
      JSON.stringify(event.payload ?? {}),
    ]
  );
}

interface RequestNotifyContext {
  requestId: string;
  bookingCode: string;
  stayTitle: string;
  serviceNameVi: string;
  serviceNameEn: string;
  status: ServiceRequestStatus;
  priceVnd: number | null;
  priceUnit: string;
  isIncluded: boolean;
  quoteVersion: number;
  desiredAt: string | null;
  guestName: string;
  guestEmail: string;
  hostName: string;
  hostEmail: string;
}

async function loadNotifyContext(tx: DbClient, requestId: string): Promise<RequestNotifyContext | null> {
  const res = await tx.query<{
    id: string;
    booking_code: string;
    stay_title: string;
    status: string;
    quote_price_vnd: string | number | null;
    quote_version: number;
    desired_at: string | Date | null;
    snapshot: Record<string, unknown>;
    guest_name: string;
    guest_email: string;
    host_name: string;
    host_email: string;
  }>(
    `SELECT sr.id, b.booking_code, st.title_en AS stay_title, sr.status,
            sr.quote_price_vnd, sr.quote_version, sr.desired_at, sr.snapshot,
            gu.full_name AS guest_name, gu.email AS guest_email,
            hu.full_name AS host_name, hu.email AS host_email
     FROM service_requests sr
     JOIN bookings b ON b.id = sr.booking_id
     JOIN stays st ON st.id = b.stay_id
     JOIN users gu ON gu.id = b.guest_id
     JOIN users hu ON hu.id = st.host_id
     WHERE sr.id = $1`,
    [requestId]
  );
  const r = res.rows[0];
  if (!r) return null;
  const snap = r.snapshot ?? {};
  return {
    requestId: String(r.id),
    bookingCode: String(r.booking_code),
    stayTitle: String(r.stay_title),
    serviceNameVi: String(snap.nameVi ?? snap.nameEn ?? 'Service'),
    serviceNameEn: String(snap.nameEn ?? snap.nameVi ?? 'Service'),
    status: r.status as ServiceRequestStatus,
    priceVnd: r.quote_price_vnd === null ? null : toNum(r.quote_price_vnd),
    priceUnit: String(snap.priceUnit ?? 'quote'),
    isIncluded: Boolean(snap.isIncluded),
    quoteVersion: toNum(r.quote_version, 0),
    desiredAt: toIso(r.desired_at),
    guestName: String(r.guest_name ?? ''),
    guestEmail: String(r.guest_email ?? ''),
    hostName: String(r.host_name ?? ''),
    hostEmail: String(r.host_email ?? ''),
  };
}

type NotifyKind =
  | 'requested'
  | 'host_confirmed'
  | 'quote_sent'
  | 'quote_accepted'
  | 'quote_rejected'
  | 'declined'
  | 'details_submitted'
  | 'info_requested'
  | 'preparing'
  | 'completed'
  | 'guest_cancelled'
  | 'booking_cancelled'
  | 'reminder_upcoming'
  | 'reminder_final';

const NOTIFY_RECIPIENTS: Record<NotifyKind, Array<'guest' | 'host'>> = {
  requested: ['host', 'guest'],
  host_confirmed: ['guest'],
  quote_sent: ['guest'],
  quote_accepted: ['host'],
  quote_rejected: ['host'],
  declined: ['guest'],
  details_submitted: ['host'],
  info_requested: ['guest'],
  preparing: ['guest'],
  completed: ['guest'],
  guest_cancelled: ['host'],
  booking_cancelled: ['guest', 'host'],
  reminder_upcoming: ['guest', 'host'],
  reminder_final: ['guest', 'host'],
};

function servicePriceLine(ctx: RequestNotifyContext, locale: 'en' | 'vi'): string {
  if (ctx.isIncluded) return locale === 'vi' ? 'Đã bao gồm trong giá phòng' : 'Included in the room price';
  if (ctx.priceVnd === null) return locale === 'vi' ? 'Theo báo giá' : 'By quote';
  const unit =
    ctx.priceUnit === 'trip'
      ? locale === 'vi'
        ? 'chuyến'
        : 'trip'
      : ctx.priceUnit === 'visit'
        ? locale === 'vi'
          ? 'lần'
          : 'visit'
        : ctx.priceUnit === 'day'
          ? locale === 'vi'
            ? 'ngày'
            : 'day'
          : ctx.priceUnit === 'week'
            ? locale === 'vi'
              ? 'tuần'
              : 'week'
            : ctx.priceUnit === 'month'
              ? locale === 'vi'
                ? 'tháng'
                : 'month'
              : '';
  const amount = `${formatVndExact(ctx.priceVnd)}${unit ? `/${unit}` : ''}`;
  return amount;
}

async function notifyServiceEvent(tx: DbClient, kind: NotifyKind, requestId: string) {
  const ctx = await loadNotifyContext(tx, requestId);
  if (!ctx) return;
  const recipients = NOTIFY_RECIPIENTS[kind];
  const subjectByKind: Record<NotifyKind, string> = {
    requested: `[Service Request ${ctx.bookingCode}] ${ctx.serviceNameEn} — awaiting host response`,
    host_confirmed: `[${ctx.bookingCode}] Service confirmed: ${ctx.serviceNameEn}`,
    quote_sent: `[${ctx.bookingCode}] New quote for ${ctx.serviceNameEn}: ${servicePriceLine(ctx, 'en')}`,
    quote_accepted: `[Service Request ${ctx.bookingCode}] Guest accepted the quote: ${ctx.serviceNameEn}`,
    quote_rejected: `[Service Request ${ctx.bookingCode}] Guest declined the quote: ${ctx.serviceNameEn}`,
    declined: `[${ctx.bookingCode}] Service request declined: ${ctx.serviceNameEn}`,
    details_submitted: `[Service Request ${ctx.bookingCode}] Guest provided trip details: ${ctx.serviceNameEn}`,
    info_requested: `[${ctx.bookingCode}] Host needs more information: ${ctx.serviceNameEn}`,
    preparing: `[${ctx.bookingCode}] Service is being prepared: ${ctx.serviceNameEn}`,
    completed: `[${ctx.bookingCode}] Service completed: ${ctx.serviceNameEn}`,
    guest_cancelled: `[Service Request ${ctx.bookingCode}] Guest cancelled: ${ctx.serviceNameEn}`,
    booking_cancelled: `[${ctx.bookingCode}] Booking cancelled — related service requests were handled`,
    reminder_upcoming: `[${ctx.bookingCode}] Upcoming service: ${ctx.serviceNameEn}${ctx.desiredAt ? ` on ${ctx.desiredAt.slice(0, 10)}` : ''}`,
    reminder_final: `[${ctx.bookingCode}] Tomorrow: ${ctx.serviceNameEn}${ctx.desiredAt ? ` (${ctx.desiredAt.slice(11, 16) || ctx.desiredAt.slice(0, 10)} UTC)` : ''}`,
  };
  const subject = subjectByKind[kind];
  const html = `<h2>${subject}</h2>
     <p>Booking: <strong>${ctx.bookingCode}</strong> — ${ctx.stayTitle}</p>
     <p>Service: <strong>${ctx.serviceNameEn} / ${ctx.serviceNameVi}</strong> — ${servicePriceLine(ctx, 'en')}</p>
     <p>Status: ${ctx.status}</p>
     <p>Pay the provider directly. VietNomad does not collect payment for this service.</p>`;

  for (const role of recipients) {
    const contact = role === 'guest' ? ctx.guestEmail : ctx.hostEmail;
    const status = (await maybeSendResendEmail(contact, subject, html)) as string;
    await tx.query(
      `INSERT INTO booking_notifications
         (id, booking_id, recipient_role, channel, recipient_contact, subject, payload_json, status)
       SELECT $1, b.id, $2, 'email', $3, $4, $5, $6
       FROM bookings b
       JOIN service_requests sr ON sr.booking_id = b.id
       WHERE sr.id = $7`,
      [
        crypto.randomUUID(),
        role,
        contact,
        subject,
        JSON.stringify({
          kind,
          requestId: ctx.requestId,
          bookingCode: ctx.bookingCode,
          stayTitle: ctx.stayTitle,
          serviceName: ctx.serviceNameEn,
          status: ctx.status,
          quoteVersion: ctx.quoteVersion,
          desiredAt: ctx.desiredAt,
        }),
        status,
        requestId,
      ]
    );
  }
}

/**
 * Materialize checkout selections into service requests once the booking is
 * confirmed. Idempotent: safe to call from payment callbacks, webhooks, and
 * host approval paths multiple times (partial unique index on active rows).
 * Services disabled between checkout and confirmation are skipped with a
 * guest notification — no request is created for them.
 */
export async function ensureServiceRequestsForBookingTx(tx: DbClient, bookingId: string) {
  const bk = await tx.query<{
    id: string;
    booking_code: string;
    status: string;
    stay_id: string;
    extras_selection: unknown;
  }>(
    'SELECT id, booking_code, status, stay_id, extras_selection FROM bookings WHERE id = $1',
    [bookingId]
  );
  const booking = bk.rows[0];
  if (!booking) return { created: 0 };
  if (booking.status !== 'RESERVED_LOCKED' && booking.status !== 'CHECKED_IN_COMPLETED') {
    return { created: 0 }; // not confirmed yet (payment pending / host approval)
  }
  const selection = Array.isArray(booking.extras_selection) ? booking.extras_selection : [];
  if (selection.length === 0) return { created: 0 };

  let created = 0;
  const seen = new Set<string>();
  for (const raw of selection) {
    const item = (raw ?? {}) as { serviceId?: unknown; quantity?: unknown; desiredAt?: unknown; note?: unknown };
    const serviceId = typeof item.serviceId === 'string' ? item.serviceId : '';
    if (!isValidUuid(serviceId) || seen.has(serviceId)) continue;
    seen.add(serviceId);

    const svcRes = await tx.query<{ id: string }>(
      `SELECT ss.id FROM stay_services ss
       WHERE ss.id = $1 AND ss.stay_id = $2 AND ss.enabled = TRUE`,
      [serviceId, booking.stay_id]
    );
    if (!svcRes.rows[0]) {
      // Host turned the service off before confirmation — skip + tell guest.
      await tx.query(
        `INSERT INTO service_request_events
           (id, request_id, actor_user_id, actor_role, event_type, payload)
         SELECT $1, sr.id, NULL, 'system', 'skipped_unavailable', $2
         FROM service_requests sr WHERE FALSE`,
        [crypto.randomUUID(), JSON.stringify({ serviceId })]
      );
      continue;
    }

    const full = (await tx.query(STAY_SERVICE_SELECT + ' WHERE ss.id = $1', [serviceId])).rows[0];
    const service = mapStayService(full);
    const quantity = Math.max(1, Math.min(50, Number(item.quantity) || 1));
    const desiredAt =
      typeof item.desiredAt === 'string' && !Number.isNaN(Date.parse(item.desiredAt))
        ? new Date(item.desiredAt).toISOString()
        : null;
    const note = typeof item.note === 'string' ? item.note.slice(0, 1000) : '';

    const inserted = await tx.query<{ id: string }>(
      `INSERT INTO service_requests
         (id, booking_id, stay_service_id, source, status, snapshot, quantity, desired_at, guest_note)
       VALUES ($1,$2,$3,'checkout','pending',$4,$5,$6,$7)
       ON CONFLICT (booking_id, stay_service_id)
         WHERE status IN ('pending','awaiting_guest','confirmed','preparing')
       DO NOTHING
       RETURNING id`,
      [
        crypto.randomUUID(),
        booking.id,
        serviceId,
        JSON.stringify(buildSnapshot(service)),
        quantity,
        desiredAt,
        note,
      ]
    );
    if (!inserted.rows[0]) continue; // duplicate callback — already created
    created += 1;
    const requestId = inserted.rows[0].id;
    await insertRequestEventTx(tx, requestId, {
      actorRole: 'system',
      eventType: 'requested',
      toStatus: 'pending',
      payload: { source: 'checkout', serviceId },
    });
    await notifyServiceEvent(tx, 'requested', requestId);
  }
  return { created };
}

/**
 * Booking cancelled (§12): unconfirmed requests are cancelled with it;
 * confirmed/preparing ones stay but both sides are notified to handle them
 * per the agreed terms — no automatic service refunds through VietNomad.
 */
export async function handleBookingCancelledForExtrasTx(
  tx: DbClient,
  bookingId: string
): Promise<{ handled: number }> {
  const res = await tx.query<{ id: string; status: string }>(
    `SELECT id, status FROM service_requests
     WHERE booking_id = $1 AND status IN ('pending','awaiting_guest','confirmed','preparing')`,
    [bookingId]
  );
  for (const row of res.rows) {
    const status = row.status as ServiceRequestStatus;
    if (status === 'pending' || status === 'awaiting_guest') {
      assertTransition(status, 'cancelled');
      await tx.query(
        `UPDATE service_requests SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [row.id]
      );
      await insertRequestEventTx(tx, row.id, {
        eventType: 'cancelled_by_booking',
        fromStatus: status,
        toStatus: 'cancelled',
        payload: { bookingId },
      });
    } else {
      await insertRequestEventTx(tx, row.id, {
        eventType: 'booking_cancelled_notice',
        fromStatus: status,
        toStatus: status,
        payload: { bookingId, notice: 'Booking cancelled; confirmed service requires manual handling.' },
      });
      await notifyServiceEvent(tx, 'booking_cancelled', row.id);
    }
  }
  return { handled: res.rows.length };
}

// ---------------------------------------------------------------------------
// Guest actions
// ---------------------------------------------------------------------------

async function loadRequestForGuest(tx: DbClient, requestId: string, user: SessionUser) {
  const res = await tx.query<{ guest_id: string; status: string; booking_id: string }>(
    `SELECT b.guest_id, sr.status, sr.booking_id
     FROM service_requests sr
     JOIN bookings b ON b.id = sr.booking_id
     WHERE sr.id = $1`,
    [requestId]
  );
  const row = res.rows[0];
  if (!row) throw new AppError('NOT_FOUND', 'Service request not found.');
  if (row.guest_id !== user.id && user.role !== 'admin') {
    throw new AppError('FORBIDDEN', 'You can only view your own service requests.');
  }
  return row;
}

function mapRequestRow(r: Record<string, unknown>): ServiceRequestView {
  return {
    id: String(r.id),
    bookingId: String(r.booking_id),
    bookingCode: String(r.booking_code),
    stayId: String(r.stay_id),
    stayTitle: String(r.stay_title),
    staySlug: String(r.stay_slug),
    guestId: String(r.guest_id),
    guestName: String(r.guest_name),
    guestEmail: String(r.guest_email),
    hostId: String(r.host_id),
    hostName: String(r.host_name),
    hostEmail: String(r.host_email),
    checkIn: String(r.check_in).slice(0, 10),
    checkOut: String(r.check_out).slice(0, 10),
    stayServiceId: String(r.stay_service_id),
    catalogKey: String(r.catalog_key ?? ''),
    source: r.source as 'checkout' | 'post_booking',
    status: r.status as ServiceRequestStatus,
    snapshot: (r.snapshot as Record<string, unknown>) ?? {},
    guestDetails: (r.guest_details as Record<string, unknown>) ?? {},
    quantity: toNum(r.quantity, 1),
    desiredAt: toIso(r.desired_at as string | Date | null),
    guestNote: String(r.guest_note ?? ''),
    quotePriceVnd: r.quote_price_vnd === null || r.quote_price_vnd === undefined
      ? null
      : toNum(r.quote_price_vnd),
    quoteNote: String(r.quote_note ?? ''),
    quoteVersion: toNum(r.quote_version, 0),
    quotedAt: toIso(r.quoted_at as string | Date | null),
    guestRespondedVersion:
      r.guest_responded_version === null || r.guest_responded_version === undefined
        ? null
        : toNum(r.guest_responded_version),
    hostNote: String(r.host_note ?? ''),
    declinedReason: String(r.declined_reason ?? ''),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
    completedAt: toIso(r.completed_at as string | Date | null),
  };
}

const REQUEST_SELECT = `
  SELECT sr.*, b.booking_code, b.guest_id, b.check_in, b.check_out,
         s.id AS stay_id, s.title_en AS stay_title, s.slug AS stay_slug, s.host_id,
         gu.full_name AS guest_name, gu.email AS guest_email,
         hu.full_name AS host_name, hu.email AS host_email,
         sc.key AS catalog_key
  FROM service_requests sr
  JOIN bookings b ON b.id = sr.booking_id
  JOIN stays s ON s.id = b.stay_id
  JOIN users gu ON gu.id = b.guest_id
  JOIN users hu ON hu.id = s.host_id
  JOIN stay_services ss ON ss.id = sr.stay_service_id
  JOIN service_catalog sc ON sc.id = ss.catalog_id
`;

export async function listGuestServiceRequests(
  user: SessionUser,
  bookingId: string
): Promise<ServiceRequestView[]> {
  if (!isValidUuid(bookingId)) throw new AppError('VALIDATION_ERROR', 'Invalid booking id.');
  const bk = await dbQuery<{ guest_id: string }>('SELECT guest_id FROM bookings WHERE id = $1', [
    bookingId,
  ]);
  if (!bk.rows[0]) throw new AppError('NOT_FOUND', 'Booking not found.');
  if (bk.rows[0].guest_id !== user.id && user.role !== 'admin') {
    throw new AppError('FORBIDDEN', 'You can only view your own bookings.');
  }
  const res = await dbQuery(
    REQUEST_SELECT + ' WHERE sr.booking_id = $1 ORDER BY sr.created_at ASC',
    [bookingId]
  );
  return res.rows.map(mapRequestRow);
}

export async function createGuestServiceRequest(
  user: SessionUser,
  bookingId: string,
  input: { serviceId: string; quantity?: number; desiredAt?: string | null; note?: string; details?: Record<string, unknown> }
): Promise<ServiceRequestView> {
  if (!isValidUuid(bookingId) || !isValidUuid(input.serviceId)) {
    throw new AppError('VALIDATION_ERROR', 'Invalid booking or service id.');
  }
  return dbTransaction(async (tx) => {
    const bk = await tx.query<{
      guest_id: string;
      status: string;
      stay_id: string;
      booking_status: string;
    }>('SELECT guest_id, status, stay_id, booking_status FROM bookings WHERE id = $1 FOR UPDATE', [
      bookingId,
    ]);
    const booking = bk.rows[0];
    if (!booking) throw new AppError('NOT_FOUND', 'Booking not found.');
    if (booking.guest_id !== user.id) {
      throw new AppError('FORBIDDEN', 'You can only add services to your own booking.');
    }
    if (booking.status !== 'RESERVED_LOCKED' && booking.status !== 'CHECKED_IN_COMPLETED') {
      throw new AppError(
        'CONFLICT',
        'Service requests can only be added once the booking is confirmed.'
      );
    }
    const full = (
      await tx.query(
        STAY_SERVICE_SELECT + ' WHERE ss.id = $1 AND ss.stay_id = $2 AND ss.enabled = TRUE',
        [input.serviceId, booking.stay_id]
      )
    ).rows[0];
    if (!full) throw new AppError('NOT_FOUND', 'Service not available for this stay.');
    const service = mapStayService(full);

    const quantity = Math.max(1, Math.min(50, Number(input.quantity) || 1));
    const desiredAt =
      input.desiredAt && !Number.isNaN(Date.parse(input.desiredAt))
        ? new Date(input.desiredAt).toISOString()
        : null;
    const inserted = await tx.query<{ id: string }>(
      `INSERT INTO service_requests
         (id, booking_id, stay_service_id, source, status, snapshot, quantity, desired_at, guest_note, guest_details)
       VALUES ($1,$2,$3,'post_booking','pending',$4,$5,$6,$7,$8)
       ON CONFLICT (booking_id, stay_service_id)
         WHERE status IN ('pending','awaiting_guest','confirmed','preparing')
       DO NOTHING
       RETURNING id`,
      [
        crypto.randomUUID(),
        bookingId,
        input.serviceId,
        JSON.stringify(buildSnapshot(service)),
        quantity,
        desiredAt,
        (input.note ?? '').trim().slice(0, 1000),
        JSON.stringify(sanitizeGuestDetails(input.details)),
      ]
    );
    if (!inserted.rows[0]) {
      throw new AppError('CONFLICT', 'An active request for this service already exists.');
    }
    const requestId = inserted.rows[0].id;
    await insertRequestEventTx(tx, requestId, {
      actorUserId: user.id,
      actorRole: 'guest',
      eventType: 'requested',
      toStatus: 'pending',
      payload: { source: 'post_booking' },
    });
    await notifyServiceEvent(tx, 'requested', requestId);
    const row = (await tx.query(REQUEST_SELECT + ' WHERE sr.id = $1', [requestId])).rows[0];
    return mapRequestRow(row);
  });
}

/** Only harmless trip details — never identity documents (spec §9). */
function sanitizeGuestDetails(details?: Record<string, unknown>): Record<string, unknown> {
  if (!details || typeof details !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(details)) {
    if (!/^[a-zA-Z0-9_]{1,40}$/.test(k)) continue;
    if (typeof v === 'string') out[k] = v.slice(0, 300);
    else if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    else if (typeof v === 'boolean') out[k] = v;
  }
  return out;
}

export async function submitGuestServiceDetails(
  user: SessionUser,
  requestId: string,
  details: Record<string, unknown>
) {
  if (!isValidUuid(requestId)) throw new AppError('VALIDATION_ERROR', 'Invalid request id.');
  return dbTransaction(async (tx) => {
    const row = await loadRequestForGuest(tx, requestId, user);
    if (!ACTIVE_STATUSES.includes(row.status as ServiceRequestStatus)) {
      throw new AppError('CONFLICT', 'This request is no longer active.');
    }
    const merged: Record<string, unknown> = {};
    const cur = await tx.query<{ guest_details: Record<string, unknown> }>(
      'SELECT guest_details FROM service_requests WHERE id = $1',
      [requestId]
    );
    Object.assign(merged, cur.rows[0]?.guest_details ?? {}, sanitizeGuestDetails(details));
    await tx.query(
      'UPDATE service_requests SET guest_details = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(merged), requestId]
    );
    await insertRequestEventTx(tx, requestId, {
      actorUserId: user.id,
      actorRole: 'guest',
      eventType: 'details_submitted',
      payload: { keys: Object.keys(sanitizeGuestDetails(details)) },
    });
    await notifyServiceEvent(tx, 'details_submitted', requestId);
    return { ok: true };
  });
}

export async function respondToServiceQuote(
  user: SessionUser,
  requestId: string,
  input: { accept: boolean; quoteVersion: number }
) {
  if (!isValidUuid(requestId)) throw new AppError('VALIDATION_ERROR', 'Invalid request id.');
  return dbTransaction(async (tx) => {
    const row = await loadRequestForGuest(tx, requestId, user);
    const status = row.status as ServiceRequestStatus;
    if (status !== 'awaiting_guest') {
      throw new AppError('CONFLICT', 'There is no quote awaiting your response.');
    }
    const cur = await tx.query<{ quote_version: number }>(
      'SELECT quote_version FROM service_requests WHERE id = $1 FOR UPDATE',
      [requestId]
    );
    const currentVersion = toNum(cur.rows[0]?.quote_version, 0);
    if (toNum(input.quoteVersion, -1) !== currentVersion) {
      throw new AppError(
        'CONFLICT',
        'The quote has changed. Review the latest offer before responding.'
      );
    }
    if (input.accept) {
      assertTransition('awaiting_guest', 'confirmed');
      await tx.query(
        `UPDATE service_requests
         SET status = 'confirmed', guest_responded_version = $2, guest_responded_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [requestId, currentVersion]
      );
      await insertRequestEventTx(tx, requestId, {
        actorUserId: user.id,
        actorRole: 'guest',
        eventType: 'quote_accepted',
        fromStatus: 'awaiting_guest',
        toStatus: 'confirmed',
        payload: { quoteVersion: currentVersion },
      });
      await notifyServiceEvent(tx, 'quote_accepted', requestId);
    } else {
      assertTransition('awaiting_guest', 'cancelled');
      await tx.query(
        `UPDATE service_requests
         SET status = 'cancelled', cancelled_at = NOW(), guest_responded_version = $2,
             guest_responded_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [requestId, currentVersion]
      );
      await insertRequestEventTx(tx, requestId, {
        actorUserId: user.id,
        actorRole: 'guest',
        eventType: 'quote_rejected',
        fromStatus: 'awaiting_guest',
        toStatus: 'cancelled',
        payload: { quoteVersion: currentVersion },
      });
      await notifyServiceEvent(tx, 'quote_rejected', requestId);
    }
    return { ok: true, status: input.accept ? 'confirmed' : 'cancelled' };
  });
}

export async function cancelServiceRequestByGuest(
  user: SessionUser,
  requestId: string,
  reason?: string
) {
  if (!isValidUuid(requestId)) throw new AppError('VALIDATION_ERROR', 'Invalid request id.');
  return dbTransaction(async (tx) => {
    const row = await loadRequestForGuest(tx, requestId, user);
    const status = row.status as ServiceRequestStatus;
    if (!ACTIVE_STATUSES.includes(status)) {
      throw new AppError('CONFLICT', 'This request is no longer active.');
    }
    assertTransition(status, 'cancelled');
    await tx.query(
      `UPDATE service_requests SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [requestId]
    );
    await insertRequestEventTx(tx, requestId, {
      actorUserId: user.id,
      actorRole: 'guest',
      eventType: 'guest_cancelled',
      fromStatus: status,
      toStatus: 'cancelled',
      payload: { reason: (reason ?? '').slice(0, 500) },
    });
    await notifyServiceEvent(tx, 'guest_cancelled', requestId);
    return { ok: true };
  });
}

// ---------------------------------------------------------------------------
// Host actions
// ---------------------------------------------------------------------------

async function loadRequestForHost(tx: DbClient, requestId: string, user: SessionUser) {
  const res = await tx.query<{ host_id: string; status: string }>(
    `SELECT s.host_id, sr.status
     FROM service_requests sr
     JOIN bookings b ON b.id = sr.booking_id
     JOIN stays s ON s.id = b.stay_id
     WHERE sr.id = $1`,
    [requestId]
  );
  const row = res.rows[0];
  if (!row) throw new AppError('NOT_FOUND', 'Service request not found.');
  if (row.host_id !== user.id && user.role !== 'admin') {
    throw new AppError('FORBIDDEN', 'You can only manage requests for your own listings.');
  }
  return row;
}

export async function listHostServiceRequests(
  user: SessionUser,
  filter: { bookingId?: string; stayId?: string; status?: ServiceRequestStatus } = {}
): Promise<ServiceRequestView[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (user.role !== 'admin') {
    params.push(user.id);
    clauses.push(`s.host_id = $${params.length}`);
  }
  if (filter.bookingId) {
    if (!isValidUuid(filter.bookingId)) throw new AppError('VALIDATION_ERROR', 'Invalid booking id.');
    params.push(filter.bookingId);
    clauses.push(`sr.booking_id = $${params.length}`);
  }
  if (filter.stayId) {
    if (!isValidUuid(filter.stayId)) throw new AppError('VALIDATION_ERROR', 'Invalid stay id.');
    params.push(filter.stayId);
    clauses.push(`s.id = $${params.length}`);
  }
  if (filter.status) {
    params.push(filter.status);
    clauses.push(`sr.status = $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const res = await dbQuery(
    `${REQUEST_SELECT} ${where} ORDER BY sr.created_at DESC LIMIT 200`,
    params
  );
  return res.rows.map(mapRequestRow);
}

export type HostServiceAction =
  | 'confirm'
  | 'quote'
  | 'request_info'
  | 'decline'
  | 'prepare'
  | 'complete';

export async function hostServiceRequestAction(
  user: SessionUser,
  requestId: string,
  action: HostServiceAction,
  payload: { quotePriceVnd?: number | null; quoteNote?: string; reason?: string; hostNote?: string } = {}
) {
  if (!isValidUuid(requestId)) throw new AppError('VALIDATION_ERROR', 'Invalid request id.');
  return dbTransaction(async (tx) => {
    const row = await loadRequestForHost(tx, requestId, user);
    const from = row.status as ServiceRequestStatus;

    if (action === 'confirm') {
      assertTransition(from, 'confirmed');
      const price =
        payload.quotePriceVnd !== undefined && payload.quotePriceVnd !== null
          ? Math.max(0, Math.round(toNum(payload.quotePriceVnd, 0)))
          : null;
      await tx.query(
        `UPDATE service_requests
         SET status = 'confirmed',
             quote_price_vnd = COALESCE($2, quote_price_vnd),
             quote_note = CASE WHEN $3 <> '' THEN $3 ELSE quote_note END,
             host_note = CASE WHEN $4 <> '' THEN $4 ELSE host_note END,
             quoted_at = CASE WHEN $2 IS NOT NULL THEN NOW() ELSE quoted_at END,
             updated_at = NOW()
         WHERE id = $1`,
        [requestId, price, (payload.quoteNote ?? '').trim(), (payload.hostNote ?? '').trim()]
      );
      await insertRequestEventTx(tx, requestId, {
        actorUserId: user.id,
        actorRole: 'host',
        eventType: 'host_confirmed',
        fromStatus: from,
        toStatus: 'confirmed',
        payload: { priceVnd: price },
      });
      await notifyServiceEvent(tx, 'host_confirmed', requestId);
      return { ok: true, status: 'confirmed' };
    }

    if (action === 'quote') {
      if (payload.quotePriceVnd === null || payload.quotePriceVnd === undefined) {
        throw new AppError('VALIDATION_ERROR', 'A quote price is required.');
      }
      const price = Math.max(0, Math.round(toNum(payload.quotePriceVnd, 0)));
      assertTransition(from, 'awaiting_guest');
      await tx.query(
        `UPDATE service_requests
         SET status = 'awaiting_guest',
             quote_price_vnd = $2,
             quote_note = $3,
             host_note = CASE WHEN $4 <> '' THEN $4 ELSE host_note END,
             quote_version = quote_version + 1,
             quoted_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [requestId, price, (payload.quoteNote ?? '').trim().slice(0, 1000), (payload.hostNote ?? '').trim()]
      );
      await insertRequestEventTx(tx, requestId, {
        actorUserId: user.id,
        actorRole: 'host',
        eventType: 'quote_sent',
        fromStatus: from,
        toStatus: 'awaiting_guest',
        payload: { priceVnd: price, quoteVersion: 'bumped' },
      });
      await notifyServiceEvent(tx, 'quote_sent', requestId);
      return { ok: true, status: 'awaiting_guest' };
    }

    if (action === 'request_info') {
      if (!ACTIVE_STATUSES.includes(from) || from === 'awaiting_guest') {
        throw new AppError('CONFLICT', 'This request cannot request more information now.');
      }
      await tx.query(
        `UPDATE service_requests
         SET host_note = CASE WHEN $2 <> '' THEN $2 ELSE host_note END, updated_at = NOW()
         WHERE id = $1`,
        [requestId, (payload.hostNote ?? '').trim().slice(0, 1000)]
      );
      await insertRequestEventTx(tx, requestId, {
        actorUserId: user.id,
        actorRole: 'host',
        eventType: 'info_requested',
        fromStatus: from,
        toStatus: from,
        payload: {},
      });
      await notifyServiceEvent(tx, 'info_requested', requestId);
      return { ok: true, status: from };
    }

    if (action === 'decline') {
      assertTransition(from, 'declined');
      await tx.query(
        `UPDATE service_requests
         SET status = 'declined', declined_reason = $2, updated_at = NOW()
         WHERE id = $1`,
        [requestId, (payload.reason ?? 'Not available').slice(0, 500)]
      );
      await insertRequestEventTx(tx, requestId, {
        actorUserId: user.id,
        actorRole: 'host',
        eventType: 'declined',
        fromStatus: from,
        toStatus: 'declined',
        payload: { reason: (payload.reason ?? '').slice(0, 500) },
      });
      await notifyServiceEvent(tx, 'declined', requestId);
      return { ok: true, status: 'declined' };
    }

    if (action === 'prepare') {
      assertTransition(from, 'preparing');
      await tx.query(
        `UPDATE service_requests SET status = 'preparing', updated_at = NOW() WHERE id = $1`,
        [requestId]
      );
      await insertRequestEventTx(tx, requestId, {
        actorUserId: user.id,
        actorRole: 'host',
        eventType: 'status_change',
        fromStatus: from,
        toStatus: 'preparing',
      });
      await notifyServiceEvent(tx, 'preparing', requestId);
      return { ok: true, status: 'preparing' };
    }

    if (action === 'complete') {
      assertTransition(from, 'completed');
      await tx.query(
        `UPDATE service_requests SET status = 'completed', completed_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [requestId]
      );
      await insertRequestEventTx(tx, requestId, {
        actorUserId: user.id,
        actorRole: 'host',
        eventType: 'status_change',
        fromStatus: from,
        toStatus: 'completed',
      });
      await notifyServiceEvent(tx, 'completed', requestId);
      return { ok: true, status: 'completed' };
    }

    throw new AppError('VALIDATION_ERROR', 'Unknown action.');
  });
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export async function listAdminServiceRequests(actor: SessionUser, filter: {
  status?: ServiceRequestStatus;
  catalogKey?: string;
  hostId?: string;
  destinationSlug?: string;
} = {}): Promise<ServiceRequestView[]> {
  if (actor.role !== 'admin') throw new AppError('FORBIDDEN', 'Admin access required.');
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter.status) {
    params.push(filter.status);
    clauses.push(`sr.status = $${params.length}`);
  }
  if (filter.catalogKey) {
    params.push(filter.catalogKey);
    clauses.push(`sc.key = $${params.length}`);
  }
  if (filter.hostId && isValidUuid(filter.hostId)) {
    params.push(filter.hostId);
    clauses.push(`s.host_id = $${params.length}`);
  }
  if (filter.destinationSlug) {
    params.push(filter.destinationSlug);
    clauses.push(`d.slug = $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const res = await dbQuery(
    `${REQUEST_SELECT}
     JOIN destinations d ON d.id = s.destination_id
     ${where}
     ORDER BY sr.created_at DESC LIMIT 500`,
    params
  );
  return res.rows.map(mapRequestRow);
}

export async function getAdminServiceRequestStats(actor: SessionUser) {
  if (actor.role !== 'admin') throw new AppError('FORBIDDEN', 'Admin access required.');
  const [byStatus, byCatalog] = await Promise.all([
    dbQuery<{ status: string; c: string }>(
      `SELECT status, COUNT(*) AS c FROM service_requests GROUP BY status`
    ),
    dbQuery<{ key: string; total: string; confirmed_c: string; completed_c: string; closed_c: string }>(
      `SELECT sc.key,
              COUNT(*) AS total,
              COUNT(*) FILTER (WHERE sr.status = 'confirmed' OR sr.status = 'preparing') AS confirmed_c,
              COUNT(*) FILTER (WHERE sr.status = 'completed') AS completed_c,
              COUNT(*) FILTER (WHERE sr.status IN ('declined','cancelled')) AS closed_c
       FROM service_requests sr
       JOIN stay_services ss ON ss.id = sr.stay_service_id
       JOIN service_catalog sc ON sc.id = ss.catalog_id
       GROUP BY sc.key`
    ),
  ]);
  return {
    byStatus: byStatus.rows.map((r) => ({ status: r.status, count: toNum(r.c, 0) })),
    byCatalog: byCatalog.rows.map((r) => ({
      key: r.key,
      total: toNum(r.total, 0),
      confirmedOrPreparing: toNum(r.confirmed_c, 0),
      completed: toNum(r.completed_c, 0),
      declinedOrCancelled: toNum(r.closed_c, 0),
    })),
  };
}

export async function adminSetStayServiceEnabled(
  actor: SessionUser,
  serviceId: string,
  enabled: boolean
) {
  if (actor.role !== 'admin') throw new AppError('FORBIDDEN', 'Admin access required.');
  if (!isValidUuid(serviceId)) throw new AppError('VALIDATION_ERROR', 'Invalid service id.');
  await dbQuery('UPDATE stay_services SET enabled = $1, updated_at = NOW() WHERE id = $2', [
    enabled,
    serviceId,
  ]);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Reminders (cron, §11 — flexible windows, never for terminated requests)
// ---------------------------------------------------------------------------

export async function runServiceRequestReminders(): Promise<{ upcoming: number; final: number }> {
  return dbTransaction(async (tx) => {
    const upcoming = await tx.query<{ id: string }>(
      `UPDATE service_requests sr
       SET reminder_upcoming_sent = TRUE, updated_at = NOW()
       WHERE sr.status IN ('confirmed','preparing')
         AND sr.reminder_upcoming_sent = FALSE
         AND sr.desired_at IS NOT NULL
         AND sr.desired_at <= NOW() + INTERVAL '7 days'
         AND sr.desired_at > NOW()
       RETURNING sr.id`
    );
    for (const row of upcoming.rows) {
      await insertRequestEventTx(tx, row.id, {
        eventType: 'reminder',
        payload: { kind: 'upcoming' },
      });
      await notifyServiceEvent(tx, 'reminder_upcoming', row.id);
    }

    const final = await tx.query<{ id: string }>(
      `UPDATE service_requests sr
       SET reminder_final_sent = TRUE, updated_at = NOW()
       WHERE sr.status IN ('confirmed','preparing')
         AND sr.reminder_final_sent = FALSE
         AND sr.desired_at IS NOT NULL
         AND sr.desired_at <= NOW() + INTERVAL '24 hours'
         AND sr.desired_at > NOW()
       RETURNING sr.id`
    );
    for (const row of final.rows) {
      await insertRequestEventTx(tx, row.id, {
        eventType: 'reminder',
        payload: { kind: 'final_24h' },
      });
      await notifyServiceEvent(tx, 'reminder_final', row.id);
    }

    return { upcoming: upcoming.rows.length, final: final.rows.length };
  });
}

/** Events history for a request (host drawer / admin audit / guest view). */
export async function listServiceRequestEvents(
  user: SessionUser,
  requestId: string
): Promise<Array<{ id: string; eventType: string; actorRole: string; fromStatus: string | null; toStatus: string | null; payload: Record<string, unknown>; createdAt: string }>> {
  if (!isValidUuid(requestId)) throw new AppError('VALIDATION_ERROR', 'Invalid request id.');
  const requester = await dbQuery<{ guest_id: string; host_id: string }>(
    `SELECT b.guest_id, s.host_id
     FROM service_requests sr
     JOIN bookings b ON b.id = sr.booking_id
     JOIN stays s ON s.id = b.stay_id
     WHERE sr.id = $1`,
    [requestId]
  );
  const row = requester.rows[0];
  if (!row) throw new AppError('NOT_FOUND', 'Service request not found.');
  const allowed = user.role === 'admin' || row.guest_id === user.id || row.host_id === user.id;
  if (!allowed) throw new AppError('FORBIDDEN', 'Not allowed to view this history.');
  const res = await dbQuery(
    `SELECT id, event_type, actor_role, from_status, to_status, payload, created_at
     FROM service_request_events WHERE request_id = $1 ORDER BY created_at ASC`,
    [requestId]
  );
  return res.rows.map((r) => ({
    id: String(r.id),
    eventType: String(r.event_type),
    actorRole: String(r.actor_role),
    fromStatus: r.from_status ? String(r.from_status) : null,
    toStatus: r.to_status ? String(r.to_status) : null,
    payload: (r.payload as Record<string, unknown>) ?? {},
    createdAt: String(r.created_at),
  }));
}
