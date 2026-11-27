import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SessionUser } from '@/lib/auth/session';
import { closeDb, dbQuery, ensureDbReady } from '@/lib/db';
import {
  createDraftStay,
  submitHostStayForReview,
  updateHostStayConfiguration,
  updateHostStayRoom,
} from '@/modules/host';
import { updateAdminStayStatus } from '@/modules/admin';
import { moderateListing } from '@/modules/admin-bos';
import { getAdminActorContext } from '@/modules/admin-rbac';
import {
  approveStayRevision,
  listPendingStayRevisions,
  listStayRevisions,
  rejectStayRevision,
} from '@/modules/listing-revisions';

let tempDir: string;
let emailSeq = 0;

async function createUser(role: 'host' | 'admin'): Promise<SessionUser> {
  emailSeq += 1;
  const email = `revision-${role}-${emailSeq}@test.local`;
  await dbQuery(
    `INSERT INTO users (id, email, password_hash, full_name, role, nationality, phone)
     VALUES ($1, $2, 'test-hash', $3, $4, 'VN', NULL)
     ON CONFLICT (email) DO NOTHING`,
    [crypto.randomUUID(), email, `Revision ${role}`, role]
  );
  const res = await dbQuery<{ id: string; email: string; full_name: string; role: string }>(
    'SELECT id, email, full_name, role FROM users WHERE email = $1',
    [email]
  );
  const u = res.rows[0]!;
  return {
    id: String(u.id),
    email: String(u.email),
    fullName: String(u.full_name),
    role: u.role as SessionUser['role'],
    nationality: 'VN',
    membershipTier: 'free',
    membershipExpiresAt: null,
    rewardCreditVnd: 0,
    vatTaxId: null,
    preferredLocale: 'en',
    preferredCurrency: 'USD',
    phone: null,
  };
}

async function makeLiveStay(host: SessionUser, admin: SessionUser, titleEn: string) {
  const stay = await createDraftStay(host, { titleEn });
  await submitHostStayForReview(host, stay.id);
  await updateAdminStayStatus(admin, stay.id, 'live');
  return stay;
}

async function pendingCount(stayId: string): Promise<number> {
  const res = await dbQuery(
    `SELECT id FROM stay_revisions WHERE stay_id = $1 AND status = 'pending'`,
    [stayId]
  );
  return res.rows.length;
}

async function getStayCol<T>(stayId: string, col: string): Promise<T> {
  const res = await dbQuery<Record<string, unknown>>(
    `SELECT ${col} FROM stays WHERE id = $1`,
    [stayId]
  );
  return res.rows[0]![col] as T;
}

beforeAll(async () => {
  tempDir = mkdtempSync(join(tmpdir(), 'vietnomad-revisions-'));
  process.env.PGLITE_DATA_DIR = tempDir;
  process.env.VIETNOMAD_DATA_DIR = tempDir;
  process.env.DATABASE_URL = '';
  await closeDb();
  await ensureDbReady();
});

afterAll(async () => {
  await closeDb();
  rmSync(tempDir, { recursive: true, force: true });
});

describe('Listing Revision Management (Phase 4)', () => {
  it('captures a create revision when a draft stay is born', async () => {
    const host = await createUser('host');
    const stay = await createDraftStay(host, { titleEn: 'Revision Origin Stay' });
    const res = await dbQuery<{ action: string; status: string; snapshot: unknown }>(
      'SELECT action, status, snapshot FROM stay_revisions WHERE stay_id = $1',
      [stay.id]
    );
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0]!.action).toBe('create');
    expect(res.rows[0]!.status).toBe('applied');
  });

  it('captures publish when the admin moves pending → live', async () => {
    const host = await createUser('host');
    const admin = await createUser('admin');
    const stay = await makeLiveStay(host, admin, 'Revision Publish Stay');
    const res = await dbQuery<{ action: string }>(
      `SELECT action FROM stay_revisions WHERE stay_id = $1 AND action = 'publish'`,
      [stay.id]
    );
    expect(res.rows).toHaveLength(1);
  });

  it('applies protected policy fields directly on a DRAFT listing (no staging)', async () => {
    const host = await createUser('host');
    const stay = await createDraftStay(host, { titleEn: 'Draft Direct Edit' });
    const out = await updateHostStayConfiguration(host, stay.id, {
      cancellationPolicy: 'strict',
      defaultMinNights: 14,
    });
    expect(out.pendingRevision).toBe(false);
    expect(await getStayCol<string>(stay.id, 'cancellation_policy')).toBe('strict');
    expect(Number(await getStayCol<number>(stay.id, 'default_min_nights'))).toBe(14);
    expect(await pendingCount(stay.id)).toBe(0);
  });

  it('stages price/policy changes on a LIVE listing while non-protected fields apply', async () => {
    const host = await createUser('host');
    const admin = await createUser('admin');
    const stay = await makeLiveStay(host, admin, 'Revision Live Split');

    const out = await updateHostStayConfiguration(host, stay.id, {
      titleEn: 'Revision Live Split Renamed',
      cancellationPolicy: 'strict',
    });
    expect(out.pendingRevision).toBe(true);
    expect(out.stagedFields).toEqual(['cancellationPolicy']);

    // Title applied immediately; policy unchanged until approval.
    expect(await getStayCol<string>(stay.id, 'title_en')).toBe('Revision Live Split Renamed');
    expect(await getStayCol<string>(stay.id, 'cancellation_policy')).toBe('flexible');
    expect(await pendingCount(stay.id)).toBe(1);

    const rev = await dbQuery<{ snapshot: unknown; changed_fields: string[] }>(
      `SELECT snapshot, changed_fields FROM stay_revisions
       WHERE stay_id = $1 AND status = 'pending'`,
      [stay.id]
    );
    expect(rev.rows[0]!.changed_fields).toContain('cancellationPolicy');
    const snap = rev.rows[0]!.snapshot as { kind: string; patch: Record<string, unknown> };
    expect(snap.kind).toBe('stay_patch');
    expect(snap.patch.cancellationPolicy).toBe('strict');
  });

  it('does NOT stage a full-save whose protected values are unchanged', async () => {
    const host = await createUser('host');
    const admin = await createUser('admin');
    const stay = await makeLiveStay(host, admin, 'Revision Unchanged Save');
    // Same values the listing already has (flexible / 7 nights / instant on).
    const out = await updateHostStayConfiguration(host, stay.id, {
      cancellationPolicy: 'flexible',
      defaultMinNights: 7,
      isInstantBook: true,
    });
    expect(out.pendingRevision).toBe(false);
    expect(await pendingCount(stay.id)).toBe(0);
  });

  it('supersedes an older pending revision when the host edits again', async () => {
    const host = await createUser('host');
    const admin = await createUser('admin');
    const stay = await makeLiveStay(host, admin, 'Revision Supersede');

    await updateHostStayConfiguration(host, stay.id, { cancellationPolicy: 'strict' });
    await updateHostStayConfiguration(host, stay.id, { cancellationPolicy: 'moderate' });

    const res = await dbQuery<{ status: string }>(
      'SELECT status FROM stay_revisions WHERE stay_id = $1',
      [stay.id]
    );
    const statuses = res.rows.map((r) => r.status);
    expect(statuses.filter((s) => s === 'pending')).toHaveLength(1);
    expect(statuses.filter((s) => s === 'rejected')).toHaveLength(1);
    expect(await getStayCol<string>(stay.id, 'cancellation_policy')).toBe('flexible');
  });

  it('approve applies the staged policy to the live stay and audits the review', async () => {
    const host = await createUser('host');
    const admin = await createUser('admin');
    const stay = await makeLiveStay(host, admin, 'Revision Approve');
    await updateHostStayConfiguration(host, stay.id, { cancellationPolicy: 'strict' });

    const actor = await getAdminActorContext(admin);
    const pending = await listPendingStayRevisions();
    const target = pending.find((r) => r.stayId === stay.id);
    expect(target).toBeDefined();

    const out = await approveStayRevision(actor, target!.id, 'Looks good');
    expect(out.ok).toBe(true);
    expect(await getStayCol<string>(stay.id, 'cancellation_policy')).toBe('strict');
    expect(await pendingCount(stay.id)).toBe(0);

    const row = await dbQuery<{ status: string; reviewed_by: string; review_note: string }>(
      'SELECT status, reviewed_by, review_note FROM stay_revisions WHERE id = $1',
      [target!.id]
    );
    expect(row.rows[0]!.status).toBe('approved');
    expect(row.rows[0]!.reviewed_by).toBe(admin.id);
    expect(row.rows[0]!.review_note).toBe('Looks good');
  });

  it('reject discards the staged change and keeps the listing untouched', async () => {
    const host = await createUser('host');
    const admin = await createUser('admin');
    const stay = await makeLiveStay(host, admin, 'Revision Reject');
    await updateHostStayConfiguration(host, stay.id, { defaultMinNights: 30 });

    const actor = await getAdminActorContext(admin);
    const pending = await listPendingStayRevisions();
    const target = pending.find((r) => r.stayId === stay.id);
    expect(target).toBeDefined();

    await rejectStayRevision(actor, target!.id, 'Not for high season yet');
    expect(await pendingCount(stay.id)).toBe(0);
    expect(Number(await getStayCol<number>(stay.id, 'default_min_nights'))).toBe(7);

    const row = await dbQuery<{ status: string; review_note: string }>(
      'SELECT status, review_note FROM stay_revisions WHERE id = $1',
      [target!.id]
    );
    expect(row.rows[0]!.status).toBe('rejected');
    expect(row.rows[0]!.review_note).toBe('Not for high season yet');
  });

  it('room price edits on a LIVE listing stage; approval applies to the package', async () => {
    const host = await createUser('host');
    const admin = await createUser('admin');
    const stay = await makeLiveStay(host, admin, 'Revision Room Price');
    const roomRes = await dbQuery<{ id: string }>(
      'SELECT id FROM stay_rooms WHERE stay_id = $1 LIMIT 1',
      [stay.id]
    );
    const roomId = String(roomRes.rows[0]!.id);

    const out = await updateHostStayRoom(host, stay.id, roomId, {
      nameEn: 'Renamed Room',
      wholesale30Vnd: 30_000_000,
    });
    expect(out.pendingRevision).toBe(true);
    expect(out.stagedFields).toContain('wholesale30Vnd');

    // Name applied directly; price untouched until approval.
    const roomRow = await dbQuery<{ name_en: string }>(
      'SELECT name_en FROM stay_rooms WHERE id = $1',
      [roomId]
    );
    expect(roomRow.rows[0]!.name_en).toBe('Renamed Room');
    const pkgBefore = await dbQuery<{ wholesale_30_vnd: number }>(
      'SELECT wholesale_30_vnd FROM stay_packages WHERE room_id = $1',
      [roomId]
    );
    expect(Number(pkgBefore.rows[0]!.wholesale_30_vnd)).toBe(19_500_000);

    const actor = await getAdminActorContext(admin);
    const pending = await listPendingStayRevisions();
    const target = pending.find((r) => r.stayId === stay.id);
    expect(target).toBeDefined();
    await approveStayRevision(actor, target!.id);

    const pkgAfter = await dbQuery<{ wholesale_30_vnd: number }>(
      'SELECT wholesale_30_vnd FROM stay_packages WHERE room_id = $1',
      [roomId]
    );
    expect(Number(pkgAfter.rows[0]!.wholesale_30_vnd)).toBe(30_000_000);
  });

  it('hosts can list their stay revisions but not someone else’s', async () => {
    const hostA = await createUser('host');
    const hostB = await createUser('host');
    const admin = await createUser('admin');
    const stay = await makeLiveStay(hostA, admin, 'Revision Ownership');
    await updateHostStayConfiguration(hostA, stay.id, { cancellationPolicy: 'strict' });

    const own = await listStayRevisions(hostA, stay.id);
    expect(own.length).toBeGreaterThanOrEqual(3); // create + publish + pending
    expect(own.some((r) => r.status === 'pending')).toBe(true);

    await expect(listStayRevisions(hostB, stay.id)).rejects.toThrow(/do not own/i);
  });

  it('captures unpublish when the admin pauses a live listing', async () => {
    const host = await createUser('host');
    const admin = await createUser('admin');
    const stay = await makeLiveStay(host, admin, 'Revision Unpublish');
    const actor = await getAdminActorContext(admin);
    await moderateListing(actor, stay.id, { status: 'paused' });

    const res = await dbQuery<{ action: string }>(
      `SELECT action FROM stay_revisions WHERE stay_id = $1 AND action = 'unpublish'`,
      [stay.id]
    );
    expect(res.rows).toHaveLength(1);
  });
});
