import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { SessionUser } from '@/lib/auth/session';
import { closeDb, dbQuery, ensureDbReady } from '@/lib/db';
import { resetRateLimits } from '@/lib/rate-limit';
import { SEED_IDS } from '@/lib/db/seed-data';
import {
  getCommunityEventBySlug,
  getRelatedCommunityEvents,
  getUpcomingEventsForDestination,
  listPublishedEvents,
} from '@/modules/catalog';
import { getEventTaxonomy } from '@/modules/platform-settings';
import {
  createAdminCommunityEvent,
  listAdminCommunityEvents,
  listEventModerationLog,
  transitionAdminCommunityEvent,
} from '@/modules/admin-bos/community';

vi.mock('@/lib/auth/session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/session')>();
  return { ...actual, requireUser: vi.fn() };
});

import { requireUser } from '@/lib/auth/session';
import { POST as rsvpPost, DELETE as rsvpDelete } from '@/app/api/events/rsvp/route';
import { POST as submitPost } from '@/app/api/events/submissions/route';

let tempDir: string;

function jsonRequest(url: string, method: string, body: unknown, ip?: string): Request {
  return new Request(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(ip ? { 'x-forwarded-for': ip } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function makeUser(email: string): Promise<SessionUser> {
  await dbQuery(
    `INSERT INTO users (id, email, password_hash, full_name, role, nationality, phone)
     VALUES ($1, $2, 'test-hash', $3, 'nomad', 'VN', NULL)
     ON CONFLICT (email) DO NOTHING`,
    [crypto.randomUUID(), email, 'Community Test']
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

const BRUNCH_SLUG = 'da-nang-an-thuong-brunch';

beforeAll(async () => {
  tempDir = mkdtempSync(join(tmpdir(), 'vietnomad-community-events-'));
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

beforeEach(() => resetRateLimits());

describe('event taxonomy & public listing', () => {
  it('loads the central taxonomy from platform_settings (10 categories,3 languages)', async () => {
    const taxonomy = await getEventTaxonomy();
    expect(taxonomy.categories).toHaveLength(10);
    expect(taxonomy.categories.map((c) => c.slug)).toContain('workshop');
    expect(taxonomy.languages.map((l) => l.slug)).toEqual(['en', 'vi', 'mixed']);
  });

  it('lists only published upcoming events with safe filters', async () => {
    const all = await listPublishedEvents();
    expect(all.length).toBeGreaterThanOrEqual(3);

    const byDest = await listPublishedEvents({ destinationId: SEED_IDS.destinations.daNang });
    expect(byDest).toHaveLength(1);
    expect(byDest[0]!.slug).toBe(BRUNCH_SLUG);

    const byCategory = await listPublishedEvents({ category: 'food' });
    expect(byCategory.map((e) => e.slug)).toContain(BRUNCH_SLUG);

    const paid = await listPublishedEvents({ price: 'paid' });
    expect(paid).toHaveLength(0);

    const today = await listPublishedEvents({ when: 'today' });
    expect(today).toHaveLength(0); // seeds are days away

    // public mapper never leaks submitter/contact columns
    expect(all[0]).not.toHaveProperty('organizerContact');
    expect(all[0]).not.toHaveProperty('submitterEmail');
  });

  it('keeps pending/draft events invisible to public reads', async () => {
    const created = await createAdminCommunityEvent(
      {
        titleEn: 'Hidden Draft Meetup',
        cityEn: 'Da Nang',
        venueEn: 'Test Venue',
        destinationId: SEED_IDS.destinations.daNang,
        startAt: new Date(Date.now() + 86_400_000).toISOString(),
        status: 'draft',
      },
      'admin@test.local',
      SEED_IDS.users.admin
    );
    expect(await getCommunityEventBySlug(created.slug)).toBeNull();

    await transitionAdminCommunityEvent(created.id, 'publish', 'admin@test.local');
    const visible = await getCommunityEventBySlug(created.slug);
    expect(visible).not.toBeNull();

    // cleanup: end it so it leaves the upcoming list
    await transitionAdminCommunityEvent(created.id, 'end', 'admin@test.local');
    const upcoming = await listPublishedEvents();
    expect(upcoming.map((e) => e.id)).not.toContain(created.id);
  });

  it('finds related and destination events', async () => {
    const event = await getCommunityEventBySlug(BRUNCH_SLUG);
    expect(event).not.toBeNull();
    const related = await getRelatedCommunityEvents(event!, 3);
    expect(related.every((e) => e.id !== event!.id)).toBe(true);

    const forDest = await getUpcomingEventsForDestination(SEED_IDS.destinations.daNang, 4);
    expect(forDest.map((e) => e.slug)).toContain(BRUNCH_SLUG);
  });
});

describe('internal RSVP lifecycle', () => {
  it('registers, blocks duplicates, enforces capacity, and cancels', async () => {
    const guest = await makeUser('rsvp-guest@test.local');
    (requireUser as Mock).mockResolvedValue(guest);

    const open = await dbQuery<{ id: string }>(
      `SELECT id FROM nomad_events WHERE slug = $1`,
      [BRUNCH_SLUG]
    );
    const eventId = String(open.rows[0]!.id);

    // start clean for this user
    await dbQuery('DELETE FROM event_rsvps WHERE event_id = $1 AND user_id = $2', [
      eventId,
      guest.id,
    ]);
    await dbQuery(
      `UPDATE nomad_events
          SET spots_taken = (SELECT COUNT(*) FROM event_rsvps WHERE event_id = $1),
              spots_total = NULL
        WHERE id = $1`,
      [eventId]
    );

    const first = await rsvpPost(
      jsonRequest('http://test/api/events/rsvp', 'POST', { eventId })
    );
    expect(first.status).toBe(200);
    const firstJson = await first.json();
    expect(firstJson.ok).toBe(true);
    expect(firstJson.alreadyJoined).toBe(false);

    const dup = await rsvpPost(
      jsonRequest('http://test/api/events/rsvp', 'POST', { eventId })
    );
    const dupJson = await dup.json();
    expect(dupJson.ok).toBe(true);
    expect(dupJson.alreadyJoined).toBe(true);

    // capacity: freeze limit to current count -> next user is blocked
    const taken = await dbQuery<{ spots_taken: number }>(
      'SELECT spots_taken FROM nomad_events WHERE id = $1',
      [eventId]
    );
    await dbQuery('UPDATE nomad_events SET spots_total = $1 WHERE id = $2', [
      Number(taken.rows[0]!.spots_taken),
      eventId,
    ]);
    const other = await makeUser('rsvp-guest-2@test.local');
    (requireUser as Mock).mockResolvedValue(other);
    const full = await rsvpPost(
      jsonRequest('http://test/api/events/rsvp', 'POST', { eventId })
    );
    expect(full.status).toBe(409);

    // cancel restores capacity for the original user
    (requireUser as Mock).mockResolvedValue(guest);
    const cancel = await rsvpDelete(
      jsonRequest('http://test/api/events/rsvp', 'DELETE', { eventId })
    );
    expect(cancel.status).toBe(200);
    const after = await dbQuery<{ n: string; spots_taken: number }>(
      `SELECT (SELECT COUNT(*) FROM event_rsvps WHERE event_id = $1 AND user_id = $2) AS n,
              (SELECT spots_taken FROM nomad_events WHERE id = $1) AS spots_taken`,
      [eventId, guest.id]
    );
    expect(Number(after.rows[0]!.n)).toBe(0);

    // restore honest state for later tests
    await dbQuery(
      `UPDATE nomad_events
          SET spots_total = NULL,
              spots_taken = (SELECT COUNT(*) FROM event_rsvps WHERE event_id = $1)
        WHERE id = $1`,
      [eventId]
    );
    await dbQuery('DELETE FROM event_rsvps WHERE event_id = $1', [eventId]);
    await dbQuery(
      `UPDATE nomad_events SET spots_taken = 0 WHERE id = $1`,
      [eventId]
    );
  });

  it('refuses RSVP for external or unpublished events', async () => {
    const guest = await makeUser('rsvp-guest-3@test.local');
    (requireUser as Mock).mockResolvedValue(guest);

    const external = await createAdminCommunityEvent(
      {
        titleEn: 'External Link Meetup',
        cityEn: 'Hanoi',
        venueEn: 'Cafe',
        registrationMode: 'external',
        sourceUrl: 'https://example.com/register',
        startAt: new Date(Date.now() + 86_400_000).toISOString(),
        status: 'published',
      },
      'admin@test.local',
      SEED_IDS.users.admin
    );
    const res = await rsvpPost(
      jsonRequest('http://test/api/events/rsvp', 'POST', { eventId: external.id })
    );
    expect(res.status).toBe(404);

    await transitionAdminCommunityEvent(external.id, 'unpublish', 'admin@test.local');
  });
});

describe('public event submission', () => {
  const validPayload = () => ({
    title: 'Community Potluck Da Nang',
    organizerName: 'Potluck Crew',
    contactName: 'Lan Nguyen',
    contactEmail: 'lan@example.com',
    category: 'food',
    destinationId: SEED_IDS.destinations.daNang,
    venue: 'Riverside Park',
    mapsUrl: '',
    startAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    endAt: '',
    language: 'en',
    imageUrl: '',
    description: 'A friendly community potluck for remote workers staying in Da Nang.',
    priceType: 'free',
    maxAttendees: null,
    sourceUrl: '',
    conditions: '',
    rightsConfirmed: true,
    company: '',
  });

  it('accepts a valid submission as pending with a review-log entry', async () => {
    const res = await submitPost(
      jsonRequest(
        'http://test/api/events/submissions',
        'POST',
        validPayload(),
        '203.0.113.10'
      )
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);

    const row = await dbQuery<{ status: string; submitter_email: string; source: string }>(
      `SELECT status, submitter_email, source FROM nomad_events
        WHERE title_en = 'Community Potluck Da Nang'
        ORDER BY created_at DESC LIMIT 1`
    );
    expect(row.rows[0]!.status).toBe('pending');
    expect(row.rows[0]!.submitter_email).toBe('lan@example.com');
    expect(row.rows[0]!.source).toBe('partner');

    const log = await dbQuery(
      `SELECT l.action FROM event_moderation_log l
        JOIN nomad_events e ON e.id = l.event_id
        WHERE e.title_en = 'Community Potluck Da Nang'
        ORDER BY l.created_at DESC LIMIT 1`
    );
    expect(String(log.rows[0]!.action)).toBe('submitted');

    // cleanup submitted row + log cascade
    await dbQuery(`DELETE FROM nomad_events WHERE title_en = 'Community Potluck Da Nang'`);
  });

  it('rejects honeypot and invalid payloads', async () => {
    const honeypot = await submitPost(
      jsonRequest(
        'http://test/api/events/submissions',
        'POST',
        { ...validPayload(), company: 'spam corp' },
        '203.0.113.11'
      )
    );
    expect(honeypot.status).toBe(400);

    const badEmail = await submitPost(
      jsonRequest(
        'http://test/api/events/submissions',
        'POST',
        { ...validPayload(), contactEmail: 'not-an-email' },
        '203.0.113.12'
      )
    );
    expect(badEmail.status).toBe(400);
  });

  it('rate-limits repeated submissions from one IP', async () => {
    const ip = '203.0.113.99';
    let lastStatus = 0;
    for (let i = 0; i < 6; i += 1) {
      const res = await submitPost(
        jsonRequest(
          'http://test/api/events/submissions',
          'POST',
          { ...validPayload(), title: `Rate limit try ${i}` },
          ip
        )
      );
      lastStatus = res.status;
      if (res.status === 429) break;
    }
    expect(lastStatus).toBe(429);
    await dbQuery(`DELETE FROM nomad_events WHERE title_en LIKE 'Rate limit try %'`);
  });
});

describe('admin moderation flow', () => {
  it('moves a submitted event pending -> published -> visible -> ended', async () => {
    const created = await createAdminCommunityEvent(
      {
        titleEn: 'Moderation Flow Workshop',
        cityEn: 'Hanoi',
        venueEn: 'Studio',
        destinationId: SEED_IDS.destinations.hanoi,
        category: 'workshop',
        language: 'en',
        startAt: new Date(Date.now() + 5 * 86_400_000).toISOString(),
        status: 'draft',
      },
      'admin@test.local',
      SEED_IDS.users.admin
    );

    // force into pending as if a public submission
    await dbQuery(`UPDATE nomad_events SET status = 'pending' WHERE id = $1`, [created.id]);

    const pendingList = await listAdminCommunityEvents({ tab: 'pending' });
    expect(pendingList.map((e) => e.id)).toContain(created.id);

    await transitionAdminCommunityEvent(
      created.id,
      'approve',
      'admin@test.local',
      'Looks good'
    );
    const published = await getCommunityEventBySlug(created.slug);
    expect(published).not.toBeNull();

    const log = await listEventModerationLog(created.id);
    expect(log.map((l) => l.action)).toContain('approve');
    expect(log[0]!.actorLabel).toBe('admin@test.local');

    // need_more keeps it pending
    await transitionAdminCommunityEvent(created.id, 'unpublish', 'admin@test.local');
    await dbQuery(`UPDATE nomad_events SET status = 'pending' WHERE id = $1`, [created.id]);
    await transitionAdminCommunityEvent(created.id, 'need_more', 'admin@test.local', 'Add a map link');
    const stillPending = await dbQuery<{ status: string }>(
      'SELECT status FROM nomad_events WHERE id = $1',
      [created.id]
    );
    expect(stillPending.rows[0]!.status).toBe('pending');

    // reject -> rejected tab
    await transitionAdminCommunityEvent(created.id, 'reject', 'admin@test.local');
    const rejectedList = await listAdminCommunityEvents({ tab: 'rejected' });
    expect(rejectedList.map((e) => e.id)).toContain(created.id);
    expect(await getCommunityEventBySlug(created.slug)).toBeNull();

    await dbQuery('DELETE FROM nomad_events WHERE id = $1', [created.id]);
  });

  it('rejects invalid transitions with a conflict', async () => {
    const created = await createAdminCommunityEvent(
      {
        titleEn: 'Bad Transition Draft',
        cityEn: 'Hanoi',
        venueEn: 'Hall',
        startAt: new Date(Date.now() + 86_400_000).toISOString(),
        status: 'draft',
      },
      'admin@test.local',
      SEED_IDS.users.admin
    );
    // draft cannot be approved (approve only from pending/rejected/draft? -> from draft allowed? no: approve allowed from draft per ALLOWED_TRANSITIONS)
    // cancel a draft is allowed; unpublish a draft is not:
    await expect(
      transitionAdminCommunityEvent(created.id, 'unpublish', 'admin@test.local')
    ).rejects.toThrow();
    await dbQuery('DELETE FROM nomad_events WHERE id = $1', [created.id]);
  });
});
