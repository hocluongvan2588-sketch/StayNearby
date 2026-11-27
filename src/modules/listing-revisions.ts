import crypto from 'node:crypto';
import type { SessionUser } from '@/lib/auth/session';
import { isValidUuid } from '@/lib/dates';
import { dbQuery, toNum, type DbClient } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { clampHostMinNights, POLICY_MIN_NIGHTS } from '@/lib/business-rules';
import { safeRevalidateAll } from '@/lib/revalidate-safe';
import type { AdminActorContext } from '@/modules/admin-rbac';

/**
 * Listing Revision Management (Phase 4).
 *
 * On a LIVE listing, price & policy edits are NOT applied immediately: they are
 * staged as a `pending` stay_revisions row (one per stay — newer edits
 * supersede older ones) until an admin approves or rejects them. Non-protected
 * edits and non-live listings keep applying directly (single data path).
 *
 * Lifecycle rows (create / publish / unpublish / moderate) are captured as
 * `applied` history in the same append-only table (0010).
 *
 * NOTE: this module must not statically import `@/modules/host` (host.ts
 * imports the split/stage helpers above). approve/reject load the apply
 * functions via dynamic import instead.
 */

/** Stay-level PATCH fields that require re-approval when the stay is live. */
export const PROTECTED_STAY_PATCH_FIELDS = [
  'wholesale7Vnd',
  'wholesale14Vnd',
  'wholesale21Vnd',
  'wholesale30Vnd',
  'extraNightVnd',
  'isDealFeatured',
  'dealMonthLabel',
  'cancellationPolicy',
  'defaultMinNights',
  'isInstantBook',
] as const;

/** Room-level PATCH price fields that require re-approval when the stay is live. */
export const PROTECTED_ROOM_PRICE_FIELDS = [
  'wholesale7Vnd',
  'wholesale14Vnd',
  'wholesale21Vnd',
  'wholesale30Vnd',
  'extraNightVnd',
] as const;

const STAY_PROTECTED = new Set<string>(PROTECTED_STAY_PATCH_FIELDS);
const ROOM_PROTECTED = new Set<string>(PROTECTED_ROOM_PRICE_FIELDS);

/** Partition a stay PATCH into directly-appliable vs re-approval-required fields. */
export function splitProtectedStayPatch<T extends Record<string, unknown>>(
  input: T
): { applied: T; proposed: T } {
  const applied: Record<string, unknown> = {};
  const proposed: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (STAY_PROTECTED.has(k) && v !== undefined) proposed[k] = v;
    else applied[k] = v;
  }
  return { applied: applied as T, proposed: proposed as T };
}

/** Partition a room PATCH into directly-appliable vs price fields. */
export function splitProtectedRoomPatch<T extends Record<string, unknown>>(
  input: T
): { applied: T; proposed: T } {
  const applied: Record<string, unknown> = {};
  const proposed: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (ROOM_PROTECTED.has(k) && v !== undefined) proposed[k] = v;
    else applied[k] = v;
  }
  return { applied: applied as T, proposed: proposed as T };
}

interface StayPackageRow {
  [key: string]: unknown;
  wholesale_7_vnd: unknown;
  wholesale_14_vnd: unknown;
  wholesale_21_vnd: unknown;
  wholesale_30_vnd: unknown;
  extra_night_vnd: unknown;
  is_deal_featured: unknown;
  deal_month_label: unknown;
}

const PRICE_COL: Record<string, keyof StayPackageRow> = {
  wholesale7Vnd: 'wholesale_7_vnd',
  wholesale14Vnd: 'wholesale_14_vnd',
  wholesale21Vnd: 'wholesale_21_vnd',
  wholesale30Vnd: 'wholesale_30_vnd',
  extraNightVnd: 'extra_night_vnd',
};

/**
 * Keep only protected fields whose value actually differs from the stored
 * listing — an unchanged full-save on a live listing must NOT stage a
 * revision (the editor always sends the complete payload).
 */
export async function pickChangedStayProposals(
  tx: DbClient,
  stayId: string,
  proposed: Record<string, unknown>,
  current: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const keys = Object.keys(proposed);
  if (keys.length === 0) return {};
  const out: Record<string, unknown> = {};

  const needsPkg = keys.some((k) => k in PRICE_COL || k === 'isDealFeatured' || k === 'dealMonthLabel');
  let pkg: StayPackageRow | null = null;
  if (needsPkg) {
    const res = await tx.query<StayPackageRow>(
      `SELECT wholesale_7_vnd, wholesale_14_vnd, wholesale_21_vnd, wholesale_30_vnd,
              extra_night_vnd, is_deal_featured, deal_month_label
       FROM stay_packages WHERE stay_id = $1
       ORDER BY is_listed DESC, wholesale_30_vnd ASC LIMIT 1`,
      [stayId]
    );
    pkg = res.rows[0] ?? null;
  }

  for (const k of keys) {
    const v = proposed[k];
    if (k in PRICE_COL) {
      const col = PRICE_COL[k];
      const stored = pkg ? toNum(pkg[col], -1) : -1;
      if (pkg === null || Math.round(Number(v)) !== stored) out[k] = v;
    } else if (k === 'isDealFeatured') {
      if (pkg && Boolean(v) !== Boolean(pkg.is_deal_featured)) out[k] = v;
      else if (!pkg) out[k] = v;
    } else if (k === 'dealMonthLabel') {
      if (pkg && String(v).trim() !== String(pkg.deal_month_label ?? '')) out[k] = v;
      else if (!pkg) out[k] = v;
    } else if (k === 'cancellationPolicy') {
      if (String(v) !== String(current.cancellation_policy)) out[k] = v;
    } else if (k === 'defaultMinNights') {
      const stored = clampHostMinNights(toNum(current.default_min_nights, POLICY_MIN_NIGHTS));
      if (clampHostMinNights(Number(v)) !== stored) out[k] = v;
    } else if (k === 'isInstantBook') {
      if (Boolean(v) !== Boolean(current.is_instant_book)) out[k] = v;
    }
  }
  return out;
}

/** Same diff for room-level price proposals (package scoped to the room). */
export async function pickChangedRoomProposals(
  tx: DbClient,
  stayId: string,
  roomId: string,
  proposed: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const keys = Object.keys(proposed);
  if (keys.length === 0) return {};
  const res = await tx.query<StayPackageRow>(
    `SELECT wholesale_7_vnd, wholesale_14_vnd, wholesale_21_vnd, wholesale_30_vnd, extra_night_vnd
     FROM stay_packages WHERE room_id = $1 AND stay_id = $2 LIMIT 1`,
    [roomId, stayId]
  );
  const pkg = res.rows[0] ?? null;
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (k in PRICE_COL) {
      const stored = pkg ? toNum(pkg[PRICE_COL[k]], -1) : -1;
      if (pkg === null || Math.round(Number(proposed[k])) !== stored) out[k] = proposed[k];
    }
  }
  return out;
}

export interface CaptureRevisionInput {
  stayId: string;
  actorUserId: string | null;
  action: 'create' | 'update' | 'publish' | 'unpublish' | 'moderate' | 'restore';
  snapshot: Record<string, unknown>;
  changedFields?: string[];
  changeSummary?: string;
  status?: 'applied' | 'pending' | 'approved' | 'rejected';
}

/** Append-only insert into stay_revisions (0010 schema + 0011 workflow cols). */
export async function captureStayRevision(tx: DbClient, input: CaptureRevisionInput): Promise<void> {
  await tx.query(
    `INSERT INTO stay_revisions
       (id, stay_id, actor_user_id, action, snapshot, changed_fields, change_summary, status)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)`,
    [
      crypto.randomUUID(),
      input.stayId,
      input.actorUserId,
      input.action,
      JSON.stringify(input.snapshot ?? {}),
      input.changedFields ?? [],
      input.changeSummary ?? null,
      input.status ?? 'applied',
    ]
  );
}

/**
 * Stage a pending revision for a live listing. Any previous pending revision
 * for the same stay is superseded (marked rejected) — the partial unique index
 * `uq_stay_revisions_one_pending` backstops this invariant.
 */
export async function stagePendingRevision(
  tx: DbClient,
  input: {
    stayId: string;
    actorUserId: string | null;
    snapshot: Record<string, unknown>;
    changedFields: string[];
    changeSummary: string;
  }
): Promise<void> {
  await tx.query(
    `UPDATE stay_revisions
        SET status = 'rejected',
            review_note = 'Superseded by a newer host edit.',
            reviewed_at = NOW()
      WHERE stay_id = $1 AND status = 'pending'`,
    [input.stayId]
  );
  await captureStayRevision(tx, {
    stayId: input.stayId,
    actorUserId: input.actorUserId,
    action: 'update',
    snapshot: input.snapshot,
    changedFields: input.changedFields,
    changeSummary: input.changeSummary,
    status: 'pending',
  });
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                       */
/* -------------------------------------------------------------------------- */

export interface StayRevisionRow {
  id: string;
  stayId: string;
  action: string;
  status: string;
  snapshot: Record<string, unknown>;
  changedFields: string[];
  changeSummary: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
}

function mapRevisionRow(r: Record<string, unknown>): StayRevisionRow {
  let snapshot: Record<string, unknown> = {};
  if (r.snapshot && typeof r.snapshot === 'object') {
    snapshot = r.snapshot as Record<string, unknown>;
  } else if (typeof r.snapshot === 'string') {
    try {
      snapshot = JSON.parse(r.snapshot) as Record<string, unknown>;
    } catch {
      snapshot = {};
    }
  }
  return {
    id: String(r.id),
    stayId: r.stay_id ? String(r.stay_id) : '',
    action: String(r.action),
    status: String(r.status),
    snapshot,
    changedFields: Array.isArray(r.changed_fields) ? r.changed_fields.map(String) : [],
    changeSummary: r.change_summary ? String(r.change_summary) : null,
    createdAt: new Date(String(r.created_at)).toISOString(),
    reviewedAt: r.reviewed_at ? new Date(String(r.reviewed_at)).toISOString() : null,
    reviewNote: r.review_note ? String(r.review_note) : null,
  };
}

/** Host-facing revision history for one stay (owner or admin only). */
export async function listStayRevisions(user: SessionUser, stayId: string): Promise<StayRevisionRow[]> {
  if (!isValidUuid(stayId)) throw new AppError('VALIDATION_ERROR', 'Invalid stay ID.');
  const stayRes = await dbQuery<{ host_id: string }>(
    'SELECT host_id FROM stays WHERE id = $1',
    [stayId]
  );
  const stay = stayRes.rows[0];
  if (!stay) throw new AppError('NOT_FOUND', 'Stay not found.');
  if (String(stay.host_id) !== user.id && user.role !== 'admin') {
    throw new AppError('FORBIDDEN', 'You do not own this property.');
  }
  const res = await dbQuery(
    `SELECT id, stay_id, action, status, snapshot, changed_fields, change_summary,
            created_at, reviewed_at, review_note
     FROM stay_revisions
     WHERE stay_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [stayId]
  );
  return res.rows.map(mapRevisionRow);
}

export interface PendingRevisionSummary extends StayRevisionRow {
  titleEn: string;
  titleVi: string;
  slug: string;
  stayStatus: string;
  hostName: string;
}

/** Admin-facing queue of pending price/policy revisions (oldest first). */
export async function listPendingStayRevisions(): Promise<PendingRevisionSummary[]> {
  const res = await dbQuery(
    `SELECT r.id, r.stay_id, r.action, r.status, r.snapshot, r.changed_fields,
            r.change_summary, r.created_at, r.reviewed_at, r.review_note,
            s.title_en, s.title_vi, s.slug, s.status AS stay_status,
            COALESCE(u.full_name, 'Unknown host') AS host_name
     FROM stay_revisions r
     JOIN stays s ON s.id = r.stay_id
     LEFT JOIN users u ON u.id = s.host_id
     WHERE r.status = 'pending'
     ORDER BY r.created_at ASC`,
    []
  );
  return res.rows.map((r) => {
    const base = mapRevisionRow(r);
    return {
      ...base,
      titleEn: String((r as Record<string, unknown>).title_en ?? ''),
      titleVi: String((r as Record<string, unknown>).title_vi ?? ''),
      slug: String((r as Record<string, unknown>).slug ?? ''),
      stayStatus: String((r as Record<string, unknown>).stay_status ?? ''),
      hostName: String((r as Record<string, unknown>).host_name ?? ''),
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Review actions                                                              */
/* -------------------------------------------------------------------------- */

/** Distinguish "not found" from "already reviewed" when a claim/reject misses. */
async function assertRevisionExists(revisionId: string): Promise<void> {
  const exists = await dbQuery<{ status: string }>(
    'SELECT status FROM stay_revisions WHERE id = $1',
    [revisionId]
  );
  if (!exists.rows[0]) throw new AppError('NOT_FOUND', 'Revision not found.');
  throw new AppError('VALIDATION_ERROR', 'Revision is no longer pending.');
}

/**
 * Approve a pending revision: atomically claim it (pending → approved), apply
 * the staged patch to the live listing, and audit. If applying fails the claim
 * is reverted to pending so the queue never loses the change.
 */
export async function approveStayRevision(
  actor: AdminActorContext,
  revisionId: string,
  note?: string
): Promise<{ ok: true; stayId: string }> {
  if (!isValidUuid(revisionId)) {
    throw new AppError('VALIDATION_ERROR', 'Invalid revision ID.');
  }
  const claimed = await dbQuery<{ stay_id: string; snapshot: unknown }>(
    `UPDATE stay_revisions
        SET status = 'approved', reviewed_by = $1, reviewed_at = NOW(), review_note = $2
      WHERE id = $3 AND status = 'pending'
      RETURNING stay_id, snapshot`,
    [actor.user.id, note?.trim() || null, revisionId]
  );
  if (claimed.rowCount === 0) await assertRevisionExists(revisionId);

  const row = claimed.rows[0]!;
  const stayId = String(row.stay_id);
  let snapshot: Record<string, unknown> = {};
  if (row.snapshot && typeof row.snapshot === 'object') {
    snapshot = row.snapshot as Record<string, unknown>;
  } else if (typeof row.snapshot === 'string') {
    try {
      snapshot = JSON.parse(row.snapshot) as Record<string, unknown>;
    } catch {
      snapshot = {};
    }
  }

  try {
    // Dynamic import: host.ts statically imports this module (split/stage).
    const host = await import('@/modules/host');
    if (snapshot.kind === 'stay_patch' && snapshot.patch) {
      await host.updateHostStayConfiguration(
        actor.user,
        stayId,
        snapshot.patch as Parameters<typeof host.updateHostStayConfiguration>[2],
        { applyAsRevision: true }
      );
    } else if (snapshot.kind === 'room_patch' && snapshot.roomId && snapshot.patch) {
      await host.updateHostStayRoom(
        actor.user,
        stayId,
        String(snapshot.roomId),
        snapshot.patch as Parameters<typeof host.updateHostStayRoom>[3],
        { applyAsRevision: true }
      );
    } else {
      throw new AppError('VALIDATION_ERROR', 'Unknown revision payload.');
    }
  } catch (err) {
    // Revert the claim — the change stays pending for a retry.
    await dbQuery(
      `UPDATE stay_revisions
          SET status = 'pending', reviewed_by = NULL, reviewed_at = NULL, review_note = NULL
        WHERE id = $1`,
      [revisionId]
    );
    throw err;
  }

  await dbQuery(
    `INSERT INTO admin_audit_logs
       (id, actor_user_id, actor_email, module, action, entity_type, entity_id, after_json)
     VALUES ($1, $2, $3, 'listings', 'approve_revision', 'stay', $4, $5::jsonb)`,
    [
      crypto.randomUUID(),
      actor.user.id,
      actor.user.email,
      stayId,
      JSON.stringify({ revisionId, patch: snapshot.patch ?? snapshot }),
    ]
  );
  safeRevalidateAll(['/', '/stays', '/deals']);
  return { ok: true, stayId };
}

/** Reject a pending revision (no data changes). */
export async function rejectStayRevision(
  actor: AdminActorContext,
  revisionId: string,
  note?: string
): Promise<{ ok: true; stayId: string }> {
  if (!isValidUuid(revisionId)) {
    throw new AppError('VALIDATION_ERROR', 'Invalid revision ID.');
  }
  const res = await dbQuery<{ stay_id: string }>(
    `UPDATE stay_revisions
        SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(), review_note = $2
      WHERE id = $3 AND status = 'pending'
      RETURNING stay_id`,
    [actor.user.id, note?.trim() || null, revisionId]
  );
  if (res.rowCount === 0) await assertRevisionExists(revisionId);

  const stayId = String(res.rows[0]!.stay_id);
  await dbQuery(
    `INSERT INTO admin_audit_logs
       (id, actor_user_id, actor_email, module, action, entity_type, entity_id, after_json)
     VALUES ($1, $2, $3, 'listings', 'reject_revision', 'stay', $4, $5::jsonb)`,
    [
      crypto.randomUUID(),
      actor.user.id,
      actor.user.email,
      stayId,
      JSON.stringify({ revisionId, note: note?.trim() || null }),
    ]
  );
  return { ok: true, stayId };
}

/** Adapter so non-transactional callers can reuse captureStayRevision. */
export function dbExecutor(): DbClient {
  return { query: (sql, params) => dbQuery(sql, params) };
}
