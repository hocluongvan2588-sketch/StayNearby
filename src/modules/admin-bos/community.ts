import { randomBytes } from 'node:crypto';
import { dbQuery, dbTransaction } from '@/lib/db';
import { AppError } from '@/lib/errors';

/**
 * Admin BOS · Community & Events (Community spec §7). One module over the
 * existing nomad_events / event_rsvps tables — no parallel event system.
 * Every status change appends to event_moderation_log (review trail).
 */

export type AdminEventTab = 'pending' | 'published' | 'draft' | 'ended' | 'rejected';

const TAB_STATUSES: Record<AdminEventTab, string[]> = {
  pending: ['pending'],
  published: ['published'],
  draft: ['draft'],
  ended: ['ended', 'cancelled', 'postponed'],
  rejected: ['rejected'],
};

export interface AdminCommunityEvent {
  id: string;
  slug: string;
  status: string;
  titleEn: string;
  titleVi: string;
  cityEn: string;
  cityVi: string;
  startAt: string | null;
  endAt: string | null;
  venueEn: string;
  venueVi: string;
  category: string | null;
  language: string | null;
  priceType: string;
  priceAmount: number | null;
  priceCurrency: string;
  organizerName: string | null;
  organizerContact: string | null;
  source: string;
  sourceUrl: string | null;
  sourceNote: string | null;
  sourceUpdatedAt: string | null;
  registrationMode: string;
  spotsTotal: number | null;
  spotsTaken: number;
  imageUrl: string | null;
  destinationId: string | null;
  destinationSlug: string | null;
  descriptionEn: string | null;
  descriptionVi: string | null;
  programEn: string | null;
  programVi: string | null;
  conditionsEn: string | null;
  conditionsVi: string | null;
  mapsUrl: string | null;
  submitterName: string | null;
  submitterEmail: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

function mapAdminEvent(e: Record<string, unknown>): AdminCommunityEvent {
  const s = (v: unknown): string | null => (v == null ? null : String(v));
  return {
    id: String(e.id),
    slug: String(e.slug),
    status: String(e.status),
    titleEn: String(e.title_en),
    titleVi: String(e.title_vi),
    cityEn: String(e.city_en),
    cityVi: String(e.city_vi),
    startAt: s(e.start_at),
    endAt: s(e.end_at),
    venueEn: String(e.venue_en),
    venueVi: String(e.venue_vi),
    category: s(e.category),
    language: s(e.language),
    priceType: String(e.price_type || 'free'),
    priceAmount: e.price_amount == null ? null : Number(e.price_amount),
    priceCurrency: String(e.price_currency || 'USD'),
    organizerName: s(e.organizer_name),
    organizerContact: s(e.organizer_contact),
    source: String(e.source || 'internal'),
    sourceUrl: s(e.source_url),
    sourceNote: s(e.source_note),
    sourceUpdatedAt: s(e.source_updated_at),
    registrationMode: String(e.registration_mode || 'internal'),
    spotsTotal: e.spots_total == null ? null : Number(e.spots_total),
    spotsTaken: Number(e.spots_taken ?? 0),
    imageUrl: s(e.image_url),
    destinationId: s(e.destination_id),
    destinationSlug: s(e.destination_slug),
    descriptionEn: s(e.description_en),
    descriptionVi: s(e.description_vi),
    programEn: s(e.program_en),
    programVi: s(e.program_vi),
    conditionsEn: s(e.conditions_en),
    conditionsVi: s(e.conditions_vi),
    mapsUrl: s(e.maps_url),
    submitterName: s(e.submitter_name),
    submitterEmail: s(e.submitter_email),
    reviewNote: s(e.review_note),
    createdAt: String(e.created_at),
    updatedAt: String(e.updated_at),
    publishedAt: s(e.published_at),
  };
}

const ADMIN_SELECT = `
  SELECT e.*, d.slug AS destination_slug
  FROM nomad_events e
  LEFT JOIN destinations d ON d.id = e.destination_id
`;

export async function listAdminCommunityEvents(opts: {
  tab: AdminEventTab;
  q?: string;
  destinationId?: string;
  source?: string;
  limit?: number;
}): Promise<AdminCommunityEvent[]> {
  const statuses = TAB_STATUSES[opts.tab] ?? TAB_STATUSES.published;
  const clauses: string[] = [`e.status = ANY($1)`];
  const params: unknown[] = [statuses];
  if (opts.q) {
    params.push(`%${opts.q}%`);
    clauses.push(`(
      e.title_en ILIKE $${params.length}
      OR e.title_vi ILIKE $${params.length}
      OR e.organizer_name ILIKE $${params.length}
      OR e.slug ILIKE $${params.length}
    )`);
  }
  if (opts.destinationId) {
    params.push(opts.destinationId);
    clauses.push(`e.destination_id = $${params.length}`);
  }
  if (opts.source) {
    params.push(opts.source);
    clauses.push(`e.source = $${params.length}`);
  }
  params.push(opts.limit ?? 100);
  const res = await dbQuery<Record<string, unknown>>(
    `${ADMIN_SELECT} WHERE ${clauses.join(' AND ')}
     ORDER BY e.start_at DESC NULLS LAST, e.created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return res.rows.map(mapAdminEvent);
}

export async function getAdminCommunityEvent(id: string): Promise<AdminCommunityEvent> {
  const res = await dbQuery<Record<string, unknown>>(
    `${ADMIN_SELECT} WHERE e.id = $1 LIMIT 1`,
    [id]
  );
  const row = res.rows[0];
  if (!row) throw new AppError('NOT_FOUND', 'Event not found.');
  return mapAdminEvent(row);
}

export interface AdminEventPatch {
  titleEn?: string;
  titleVi?: string;
  cityEn?: string;
  cityVi?: string;
  venueEn?: string;
  venueVi?: string;
  startAt?: string | null;
  endAt?: string | null;
  category?: string | null;
  language?: string | null;
  priceType?: 'free' | 'paid';
  priceAmount?: number | null;
  priceCurrency?: string;
  organizerName?: string | null;
  organizerContact?: string | null;
  source?: 'internal' | 'partner' | 'external';
  sourceUrl?: string | null;
  sourceNote?: string | null;
  registrationMode?: 'internal' | 'external';
  spotsTotal?: number | null;
  imageUrl?: string | null;
  destinationId?: string | null;
  descriptionEn?: string | null;
  descriptionVi?: string | null;
  programEn?: string | null;
  programVi?: string | null;
  conditionsEn?: string | null;
  conditionsVi?: string | null;
  mapsUrl?: string | null;
}

const PATCH_COLUMNS: Record<keyof AdminEventPatch, string> = {
  titleEn: 'title_en',
  titleVi: 'title_vi',
  cityEn: 'city_en',
  cityVi: 'city_vi',
  venueEn: 'venue_en',
  venueVi: 'venue_vi',
  startAt: 'start_at',
  endAt: 'end_at',
  category: 'category',
  language: 'language',
  priceType: 'price_type',
  priceAmount: 'price_amount',
  priceCurrency: 'price_currency',
  organizerName: 'organizer_name',
  organizerContact: 'organizer_contact',
  source: 'source',
  sourceUrl: 'source_url',
  sourceNote: 'source_note',
  registrationMode: 'registration_mode',
  spotsTotal: 'spots_total',
  imageUrl: 'image_url',
  destinationId: 'destination_id',
  descriptionEn: 'description_en',
  descriptionVi: 'description_vi',
  programEn: 'program_en',
  programVi: 'program_vi',
  conditionsEn: 'conditions_en',
  conditionsVi: 'conditions_vi',
  mapsUrl: 'maps_url',
};

async function appendLog(
  eventId: string,
  action: string,
  actorLabel: string,
  note?: string | null
): Promise<void> {
  await dbQuery(
    `INSERT INTO event_moderation_log (id, event_id, action, actor_label, note, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [randomUUIDLike(), eventId, action, actorLabel, note ?? null]
  );
}

/** RFC4122 v4 UUID (random bytes with version/variant bits set). */
function randomUUIDLike(): string {
  const b = randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = b.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function updateAdminCommunityEvent(
  id: string,
  patch: AdminEventPatch,
  actorLabel: string
): Promise<AdminCommunityEvent> {
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [key, column] of Object.entries(PATCH_COLUMNS)) {
    if (key in patch) {
      params.push((patch as Record<string, unknown>)[key] ?? null);
      sets.push(`${column} = $${params.length}`);
    }
  }
  if (sets.length > 0) {
    params.push(id);
    await dbQuery(
      `UPDATE nomad_events SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`,
      params
    );
    await appendLog(id, 'edited', actorLabel, 'Fields updated');
  }
  return getAdminCommunityEvent(id);
}

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  approve: ['pending', 'rejected', 'draft'],
  reject: ['pending'],
  need_more: ['pending'],
  publish: ['draft', 'ended', 'cancelled', 'postponed'],
  unpublish: ['published'],
  cancel: ['published', 'pending', 'draft'],
  postpone: ['published'],
  end: ['published'],
  restore_draft: ['rejected', 'cancelled', 'postponed', 'ended'],
};

const TRANSITION_STATUS: Record<string, string> = {
  approve: 'published',
  reject: 'rejected',
  need_more: 'pending',
  publish: 'published',
  unpublish: 'draft',
  cancel: 'cancelled',
  postpone: 'postponed',
  end: 'ended',
  restore_draft: 'draft',
};

/**
 * Status transition with review trail. `approve`/`publish` set published_at;
 * all actions record actor + optional note (e.g. "need more info" feedback).
 */
export async function transitionAdminCommunityEvent(
  id: string,
  action: keyof typeof ALLOWED_TRANSITIONS,
  actorLabel: string,
  note?: string
): Promise<AdminCommunityEvent> {
  const current = await getAdminCommunityEvent(id);
  const allowedFrom = ALLOWED_TRANSITIONS[action];
  if (!allowedFrom.includes(current.status)) {
    throw new AppError(
      'CONFLICT',
      `Cannot ${action} an event in status '${current.status}'.`
    );
  }
  const nextStatus = TRANSITION_STATUS[action];
  await dbQuery(
    `UPDATE nomad_events
        SET status = $1,
            published_at = CASE WHEN $1 = 'published' THEN COALESCE(published_at, NOW()) ELSE published_at END,
            updated_at = NOW()
      WHERE id = $2`,
    [nextStatus, id]
  );
  await appendLog(
    id,
    action,
    actorLabel,
    note ?? (action === 'need_more' ? 'More information requested' : null)
  );
  return getAdminCommunityEvent(id);
}

export interface AdminEventAttendee {
  userId: string;
  displayName: string;
  registeredAt: string;
}

/** Internal-event registrations (display name only — no contact PII). */
export async function listEventAttendees(
  eventId: string
): Promise<AdminEventAttendee[]> {
  const res = await dbQuery<{
    user_id: string;
    full_name: string;
    email: string;
    created_at: string;
  }>(
    `SELECT r.user_id, u.full_name, u.email, r.created_at
       FROM event_rsvps r
       JOIN users u ON u.id = r.user_id
      WHERE r.event_id = $1
      ORDER BY r.created_at ASC`,
    [eventId]
  );
  return res.rows.map((r) => ({
    userId: String(r.user_id),
    displayName: String(r.full_name || r.email),
    registeredAt: String(r.created_at),
  }));
}

export async function removeEventAttendee(
  eventId: string,
  userId: string,
  actorLabel: string
): Promise<void> {
  await dbTransaction(async (tx) => {
    const deleted = await tx.query(
      'DELETE FROM event_rsvps WHERE event_id = $1 AND user_id = $2',
      [eventId, userId]
    );
    if (!deleted.rowCount) throw new AppError('NOT_FOUND', 'Registration not found.');
    await tx.query(
      `UPDATE nomad_events
          SET spots_taken = GREATEST(spots_taken - 1, 0), updated_at = NOW()
        WHERE id = $1`,
      [eventId]
    );
    await tx.query(
      `INSERT INTO event_moderation_log (id, event_id, action, actor_label, note, created_at)
       VALUES ($1, $2, 'attendee_removed', $3, NULL, NOW())`,
      [randomUUIDLike(), eventId, actorLabel]
    );
  });
}

export interface ModerationLogEntry {
  id: string;
  action: string;
  actorLabel: string;
  note: string | null;
  createdAt: string;
}

export async function listEventModerationLog(
  eventId: string
): Promise<ModerationLogEntry[]> {
  const res = await dbQuery<{
    id: string;
    action: string;
    actor_label: string;
    note: string | null;
    created_at: string;
  }>(
    `SELECT id, action, actor_label, note, created_at
       FROM event_moderation_log
      WHERE event_id = $1
      ORDER BY created_at DESC
      LIMIT 100`,
    [eventId]
  );
  return res.rows.map((r) => ({
    id: String(r.id),
    action: String(r.action),
    actorLabel: String(r.actor_label),
    note: r.note == null ? null : String(r.note),
    createdAt: String(r.created_at),
  }));
}

export interface CreateAdminEventInput {
  titleEn: string;
  titleVi?: string;
  cityEn: string;
  cityVi?: string;
  venueEn: string;
  venueVi?: string;
  startAt?: string | null;
  endAt?: string | null;
  category?: string | null;
  language?: string | null;
  priceType?: 'free' | 'paid';
  priceAmount?: number | null;
  priceCurrency?: string;
  organizerName?: string | null;
  organizerContact?: string | null;
  source?: 'internal' | 'partner' | 'external';
  sourceUrl?: string | null;
  sourceNote?: string | null;
  registrationMode?: 'internal' | 'external';
  spotsTotal?: number | null;
  imageUrl?: string | null;
  destinationId?: string | null;
  descriptionEn?: string | null;
  descriptionVi?: string | null;
  mapsUrl?: string | null;
  status?: 'draft' | 'published';
}

function slugifyBase(text: string): string {
  const base = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return base || 'event';
}

/** Admin creates an event directly (draft or published). */
export async function createAdminCommunityEvent(
  input: CreateAdminEventInput,
  actorLabel: string,
  createdBy: string
): Promise<AdminCommunityEvent> {
  const id = randomUUIDLike();
  const slug = `${slugifyBase(input.titleEn)}-${id.slice(0, 8)}`;
  const status = input.status === 'published' ? 'published' : 'draft';
  const startAt = input.startAt ? new Date(input.startAt) : null;
  if (startAt && Number.isNaN(startAt.getTime())) {
    throw new AppError('VALIDATION_ERROR', 'Invalid start time.');
  }
  const legacyDate = startAt
    ? `${startAt.toISOString().slice(0, 10)}, ${startAt.toISOString().slice(11, 16)}`
    : new Date().toISOString().slice(0, 10);

  await dbQuery(
    `INSERT INTO nomad_events (
       id, slug, city_en, city_vi, title_en, title_vi, event_date,
       venue_en, venue_vi, spots_total, spots_taken, image_url,
       status, category, language, start_at, end_at,
       price_type, price_amount, price_currency,
       organizer_name, organizer_contact,
       source, source_url, source_note, registration_mode,
       description_en, description_vi,
       maps_url, destination_id, created_by, created_at, updated_at, published_at
     ) VALUES (
       $1, $2, $3, $4, $5, COALESCE($6, $5), $7,
       $8, $9, $10, 0, $11,
       $12, $13, $14, $15, $16,
       $17, $18, $19,
       $20, $21,
       $22, $23, $24, $25,
       $26, $27,
       $28, $29, $30, NOW(), NOW(),
       CASE WHEN $12 = 'published' THEN NOW() ELSE NULL END
     )`,
    [
      id,
      slug,
      input.cityEn,
      input.cityVi ?? input.cityEn,
      input.titleEn,
      input.titleVi ?? null,
      legacyDate,
      input.venueEn,
      input.venueVi ?? input.venueEn,
      input.spotsTotal ?? null,
      input.imageUrl ?? null,
      status,
      input.category ?? null,
      input.language ?? null,
      startAt,
      input.endAt ?? null,
      input.priceType ?? 'free',
      input.priceType === 'paid' ? input.priceAmount ?? null : null,
      input.priceType === 'paid' ? input.priceCurrency ?? 'USD' : 'USD',
      input.organizerName ?? null,
      input.organizerContact ?? null,
      input.source ?? 'internal',
      input.sourceUrl ?? null,
      input.sourceNote ?? null,
      input.registrationMode ?? 'internal',
      input.descriptionEn ?? null,
      input.descriptionVi ?? input.descriptionEn ?? null,
      input.mapsUrl ?? null,
      input.destinationId ?? null,
      createdBy,
    ]
  );
  await appendLog(id, status === 'published' ? 'published' : 'created', actorLabel, 'Created in Admin BOS');
  return getAdminCommunityEvent(id);
}
