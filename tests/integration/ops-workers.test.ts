import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDb, dbQuery } from '@/lib/db';
import { runMigrations } from '@/lib/db/migrate';
import { runSeed, SEED_IDS } from '@/lib/db/seed-data';
import { loadSessionUserById } from '@/lib/auth/session';
import { addDaysIso, getTodayIsoInTimezone } from '@/lib/format';
import { confirmBookingRequest, createBookingRequest, getBookingDetail } from '@/modules/bookings';
import {
  completeElapsedBookings,
  dispatchOutboxNotifications,
  expireOverdueBookings,
  getAdminOpsSnapshot,
  retryFailedOutboxEvent,
  runOperationalMaintenance,
} from '@/modules/ops';

describe('Phase 3 operational workers: expiry, completion, outbox retries & dead-letter recovery', () => {
  const todayVn = getTodayIsoInTimezone('Asia/Ho_Chi_Minh');

  beforeAll(async () => {
    process.env.DATABASE_URL = '';
    process.env.PGLITE_DATA_DIR = 'memory://';
    await runMigrations();
    await runSeed();
  });

  afterAll(async () => {
    await closeDb();
  });

  it('expires overdue pending bookings ONLY and never touches confirmed bookings', async () => {
    const guest = await loadSessionUserById(SEED_IDS.users.guest);
    const host1 = await loadSessionUserById(SEED_IDS.users.host1);

    const checkInA = addDaysIso(todayVn, 60);
    const checkOutA = addDaysIso(todayVn, 62);
    const checkInB = addDaysIso(todayVn, 65);
    const checkOutB = addDaysIso(todayVn, 67);

    const reqPending = await createBookingRequest(guest, {
      listingId: SEED_IDS.listings.tayHoStudio,
      checkIn: checkInA,
      checkOut: checkOutA,
      guestsCount: 1,
      idempotencyKey: 'ops-exp-pending-1',
    });

    const reqConfirmed = await createBookingRequest(guest, {
      listingId: SEED_IDS.listings.tayHoStudio,
      checkIn: checkInB,
      checkOut: checkOutB,
      guestsCount: 1,
      idempotencyKey: 'ops-exp-confirmed-1',
    });
    await confirmBookingRequest(host1, reqConfirmed.booking.id);

    // Move expires_at into the past for BOTH rows to prove confirmed is immune to expiry job
    const pastIso = new Date(Date.now() - 60_000).toISOString();
    await dbQuery(
      `UPDATE bookings SET expires_at = $1::timestamptz WHERE id IN ($2, $3)`,
      [pastIso, reqPending.booking.id, reqConfirmed.booking.id]
    );

    const res = await expireOverdueBookings();
    expect(res.bookingIds).toContain(reqPending.booking.id);
    expect(res.bookingIds).not.toContain(reqConfirmed.booking.id);

    const pendingAfter = await getBookingDetail(guest, reqPending.booking.id);
    expect(pendingAfter.status).toBe('expired');
    expect(
      pendingAfter.events.some(
        (e) => e.actorRole === 'system' && e.fromStatus === 'pending' && e.toStatus === 'expired'
      )
    ).toBe(true);

    const confirmedAfter = await getBookingDetail(guest, reqConfirmed.booking.id);
    expect(confirmedAfter.status).toBe('confirmed');

    const outboxRes = await dbQuery<{ event_type: string }>(
      `SELECT event_type FROM outbox WHERE aggregate_id = $1`,
      [reqPending.booking.id]
    );
    expect(outboxRes.rows.some((r) => r.event_type === 'booking.expired')).toBe(true);
  });

  it('completes confirmed stays strictly AFTER local check-out date (never on check-out day itself)', async () => {
    const guest = await loadSessionUserById(SEED_IDS.users.guest);
    const host1 = await loadSessionUserById(SEED_IDS.users.host1);

    const checkIn = addDaysIso(todayVn, 75);
    const checkOut = addDaysIso(todayVn, 78);

    const created = await createBookingRequest(guest, {
      listingId: SEED_IDS.listings.tayHoStudio,
      checkIn,
      checkOut,
      guestsCount: 1,
      idempotencyKey: 'ops-complete-1',
    });
    await confirmBookingRequest(host1, created.booking.id);

    // Simulate midday on check-out date in Asia/Ho_Chi_Minh -> MUST NOT mark completed yet
    const sameDayAsCheckout = new Date(`${checkOut}T05:00:00.000Z`); // 12:00 ICT
    const onDayRes = await completeElapsedBookings(sameDayAsCheckout);
    expect(onDayRes.bookingIds).not.toContain(created.booking.id);

    const detailOnDay = await getBookingDetail(guest, created.booking.id);
    expect(detailOnDay.status).toBe('confirmed');

    // Simulate the day AFTER check-out -> MUST transition to completed
    const dayAfterCheckout = new Date(`${addDaysIso(checkOut, 1)}T02:00:00.000Z`);
    const afterRes = await completeElapsedBookings(dayAfterCheckout);
    expect(afterRes.bookingIds).toContain(created.booking.id);

    const detailAfter = await getBookingDetail(guest, created.booking.id);
    expect(detailAfter.status).toBe('completed');
    expect(
      detailAfter.events.some(
        (e) => e.actorRole === 'system' && e.fromStatus === 'confirmed' && e.toStatus === 'completed'
      )
    ).toBe(true);
  });

  it('handles outbox exponential backoff retries, dead-letter marking, and admin manual retry', async () => {
    const admin = await loadSessionUserById(SEED_IDS.users.admin);

    // Clear existing pending outbox first so test isolates cleanly
    await dispatchOutboxNotifications({ limit: 100 });

    const outboxId = '99999999-9999-4999-8999-999999999901';
    const bookingId = SEED_IDS.bookings.confirmedSample;
    const t0 = new Date('2026-12-01T10:00:00.000Z');

    await dbQuery(
      `INSERT INTO outbox (id, event_type, aggregate_type, aggregate_id, payload, status, attempts, max_attempts, next_retry_at)
       VALUES ($1, 'booking.confirmed', 'booking', $2, '{"test":true}'::jsonb, 'pending', 0, 2, $3::timestamptz)
       ON CONFLICT (id) DO NOTHING`,
      [outboxId, bookingId, t0.toISOString()]
    );

    const failingTransport = async () => {
      throw new Error('Simulated SMTP outage');
    };

    // Attempt 1 fails -> stays pending with 30s backoff
    const r1 = await dispatchOutboxNotifications({
      nowUtc: t0,
      onlyOutboxId: outboxId,
      transport: failingTransport,
    });
    expect(r1.retriedCount).toBe(1);
    expect(r1.failedCount).toBe(0);

    const row1 = await dbQuery<{
      status: string;
      attempts: number;
      next_retry_at: string;
      last_error: string;
    }>(
      `SELECT status, attempts, next_retry_at::text AS next_retry_at, last_error
       FROM outbox WHERE id = $1`,
      [outboxId]
    );
    expect(row1.rows[0].status).toBe('pending');
    expect(Number(row1.rows[0].attempts)).toBe(1);
    expect(row1.rows[0].last_error).toContain('Simulated SMTP outage');
    expect(new Date(row1.rows[0].next_retry_at).getTime()).toBe(t0.getTime() + 30_000);

    // Before backoff expires (+10s), dispatcher skips it
    const skipped = await dispatchOutboxNotifications({
      nowUtc: new Date(t0.getTime() + 10_000),
      onlyOutboxId: outboxId,
      transport: failingTransport,
    });
    expect(skipped.processedCount).toBe(0);

    // After backoff expires (+35s), attempt 2 fails and hits max_attempts=2 -> marked 'failed' (dead letter)
    const r2 = await dispatchOutboxNotifications({
      nowUtc: new Date(t0.getTime() + 35_000),
      onlyOutboxId: outboxId,
      transport: failingTransport,
    });
    expect(r2.failedCount).toBe(1);

    const row2 = await dbQuery<{ status: string; attempts: number }>(
      `SELECT status, attempts FROM outbox WHERE id = $1`,
      [outboxId]
    );
    expect(row2.rows[0].status).toBe('failed');
    expect(Number(row2.rows[0].attempts)).toBe(2);

    // Admin retries dead-letter event with healthy transport -> transitions to 'sent'
    const retried = await retryFailedOutboxEvent(admin, outboxId, {
      nowUtc: new Date(t0.getTime() + 60_000),
    });
    expect(retried.status).toBe('sent');
    expect(retried.sentAt).not.toBeNull();
    expect(retried.lastError).toBeNull();

    // Full maintenance cycle writes ops_job_runs & feeds AdminOpsSnapshot
    const run = await runOperationalMaintenance({ triggeredBy: 'test' });
    expect(run.runId).toBeTruthy();

    const snapshot = await getAdminOpsSnapshot(admin);
    expect(snapshot.jobRuns.some((j) => j.id === run.runId && j.status === 'completed')).toBe(
      true
    );
  });
});
