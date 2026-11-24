import crypto from 'crypto';
import { getAppConfig } from '@/lib/config';
import { requireRole } from '@/lib/auth/rbac';
import type { SessionUser } from '@/lib/auth/session';
import { dbQuery, withTransaction } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { getTodayIsoInTimezone } from '@/lib/format';
import { logEvent } from '@/lib/logger';
import { assertUuid } from '@/lib/validation';

export interface OutboxDispatchInput {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  attempt: number;
  createdAt: string;
}

export type OutboxTransport = (event: OutboxDispatchInput) => Promise<void>;

export interface ExpiryJobResult {
  expiredCount: number;
  bookingIds: string[];
}

export interface CompletionJobResult {
  completedCount: number;
  bookingIds: string[];
}

export interface OutboxDispatchResult {
  processedCount: number;
  sentCount: number;
  retriedCount: number;
  failedCount: number;
}

export interface MaintenanceRunResult {
  runId: string;
  expiry: ExpiryJobResult;
  completion: CompletionJobResult;
  outbox: OutboxDispatchResult;
}

export interface OutboxRecordItem {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'sent' | 'failed';
  attempts: number;
  maxAttempts: number;
  nextRetryAt: string;
  lastAttemptAt: string | null;
  lastError: string | null;
  createdAt: string;
  sentAt: string | null;
}

export interface OpsJobRunItem {
  id: string;
  jobName: string;
  status: 'running' | 'completed' | 'failed';
  processedCount: number;
  details: Record<string, unknown>;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface AdminOpsSnapshot {
  summary: {
    pendingOutboxCount: number;
    sentOutboxCount: number;
    failedOutboxCount: number;
    overduePendingBookingsCount: number;
    eligibleCompletionBookingsCount: number;
  };
  outboxItems: OutboxRecordItem[];
  jobRuns: OpsJobRunItem[];
  systemEvents: Array<{
    id: string;
    bookingId: string;
    bookingCode: string;
    fromStatus: string | null;
    toStatus: string;
    reason: string | null;
    createdAt: string;
  }>;
}

const BACKOFF_SECONDS = [30, 120, 600, 1800, 3600] as const;

export function computeOutboxBackoffSeconds(failedAttemptNumber: number): number {
  if (failedAttemptNumber <= 1) return BACKOFF_SECONDS[0];
  const idx = Math.min(failedAttemptNumber - 1, BACKOFF_SECONDS.length - 1);
  return BACKOFF_SECONDS[idx];
}

export const defaultOutboxTransport: OutboxTransport = async (event) => {
  const config = getAppConfig();
  if (!config.outboxWebhookUrl) {
    logEvent('info', 'outbox.notification_dispatched', {
      outboxId: event.id,
      eventType: event.eventType,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      attempt: event.attempt,
    });
    return;
  }

  const body = JSON.stringify({
    id: event.id,
    eventType: event.eventType,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    payload: event.payload,
    attempt: event.attempt,
    createdAt: event.createdAt,
  });

  const signature = crypto
    .createHmac('sha256', config.authSecret)
    .update(body)
    .digest('hex');

  const res = await fetch(config.outboxWebhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-WorkingHome-Event': event.eventType,
      'X-WorkingHome-Delivery-Id': event.id,
      'X-WorkingHome-Signature': signature,
    },
    body,
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    throw new Error(`Webhook delivery returned HTTP ${res.status}`);
  }
};

/**
 * Transitions overdue pending booking requests past response_deadline (`expires_at <= nowUtc`).
 * Never modifies confirmed bookings.
 */
export async function expireOverdueBookings(
  nowUtc: Date = new Date()
): Promise<ExpiryJobResult> {
  const candidatesRes = await dbQuery<{ id: string }>(
    `SELECT id
     FROM bookings
     WHERE status = 'pending'
       AND expires_at <= $1::timestamptz
     ORDER BY expires_at ASC
     LIMIT 200`,
    [nowUtc.toISOString()]
  );

  const expiredIds: string[] = [];

  for (const candidate of candidatesRes.rows) {
    const transitioned = await withTransaction(async (tx) => {
      const rowRes = await tx.query<{
        id: string;
        booking_code: string;
        listing_id: string;
        guest_id: string;
        status: string;
        expires_at: string;
      }>(
        `SELECT id, booking_code, listing_id, guest_id, status,
                expires_at::text AS expires_at
         FROM bookings
         WHERE id = $1
         FOR UPDATE`,
        [candidate.id]
      );
      const row = rowRes.rows[0];
      if (!row || row.status !== 'pending') {
        return false;
      }
      if (new Date(row.expires_at).getTime() > nowUtc.getTime()) {
        return false;
      }

      await tx.query(
        `UPDATE bookings
         SET status = 'expired',
             updated_at = NOW()
         WHERE id = $1`,
        [row.id]
      );

      await tx.query(
        `INSERT INTO booking_events (
           booking_id, actor_id, actor_role, from_status, to_status, reason, metadata
         ) VALUES ($1, NULL, 'system', 'pending', 'expired', $2, $3::jsonb)`,
        [
          row.id,
          'Response deadline elapsed',
          JSON.stringify({ expiresAt: row.expires_at, processedAt: nowUtc.toISOString() }),
        ]
      );

      await tx.query(
        `INSERT INTO outbox (event_type, aggregate_type, aggregate_id, payload)
         VALUES ('booking.expired', 'booking', $1, $2::jsonb)`,
        [
          row.id,
          JSON.stringify({
            bookingId: row.id,
            bookingCode: row.booking_code,
            listingId: row.listing_id,
            guestId: row.guest_id,
            expiredAt: nowUtc.toISOString(),
          }),
        ]
      );

      return true;
    });

    if (transitioned) {
      expiredIds.push(candidate.id);
    }
  }

  if (expiredIds.length > 0) {
    logEvent('info', 'ops.bookings_expired', {
      count: expiredIds.length,
      bookingIds: expiredIds,
    });
  }

  return { expiredCount: expiredIds.length, bookingIds: expiredIds };
}

/**
 * Transitions confirmed bookings to completed strictly AFTER their local check-out date
 * (`todayLocal(host_timezone) > check_out`).
 */
export async function completeElapsedBookings(
  nowUtc: Date = new Date()
): Promise<CompletionJobResult> {
  const candidatesRes = await dbQuery<{
    id: string;
    check_out: string;
    host_timezone: string;
  }>(
    `SELECT id, check_out::text AS check_out, host_timezone
     FROM bookings
     WHERE status = 'confirmed'
     ORDER BY check_out ASC
     LIMIT 300`
  );

  const eligible = candidatesRes.rows.filter(
    (r) => getTodayIsoInTimezone(r.host_timezone, nowUtc) > r.check_out
  );

  const completedIds: string[] = [];

  for (const candidate of eligible) {
    const transitioned = await withTransaction(async (tx) => {
      const rowRes = await tx.query<{
        id: string;
        booking_code: string;
        listing_id: string;
        guest_id: string;
        status: string;
        check_out: string;
        host_timezone: string;
      }>(
        `SELECT id, booking_code, listing_id, guest_id, status,
                check_out::text AS check_out, host_timezone
         FROM bookings
         WHERE id = $1
         FOR UPDATE`,
        [candidate.id]
      );
      const row = rowRes.rows[0];
      if (!row || row.status !== 'confirmed') {
        return false;
      }

      const todayLocal = getTodayIsoInTimezone(row.host_timezone, nowUtc);
      if (todayLocal <= row.check_out) {
        return false;
      }

      await tx.query(
        `UPDATE bookings
         SET status = 'completed',
             updated_at = NOW()
         WHERE id = $1`,
        [row.id]
      );

      await tx.query(
        `INSERT INTO booking_events (
           booking_id, actor_id, actor_role, from_status, to_status, reason, metadata
         ) VALUES ($1, NULL, 'system', 'confirmed', 'completed', $2, $3::jsonb)`,
        [
          row.id,
          'Stay check-out date elapsed',
          JSON.stringify({
            checkOut: row.check_out,
            localDate: todayLocal,
            processedAt: nowUtc.toISOString(),
          }),
        ]
      );

      await tx.query(
        `INSERT INTO outbox (event_type, aggregate_type, aggregate_id, payload)
         VALUES ('booking.completed', 'booking', $1, $2::jsonb)`,
        [
          row.id,
          JSON.stringify({
            bookingId: row.id,
            bookingCode: row.booking_code,
            listingId: row.listing_id,
            guestId: row.guest_id,
            checkOut: row.check_out,
          }),
        ]
      );

      return true;
    });

    if (transitioned) {
      completedIds.push(candidate.id);
    }
  }

  if (completedIds.length > 0) {
    logEvent('info', 'ops.bookings_completed', {
      count: completedIds.length,
      bookingIds: completedIds,
    });
  }

  return { completedCount: completedIds.length, bookingIds: completedIds };
}

/**
 * Processes due outbox records with exponential backoff retry and dead-letter marking (`failed`).
 */
export async function dispatchOutboxNotifications(options?: {
  limit?: number;
  nowUtc?: Date;
  transport?: OutboxTransport;
  onlyOutboxId?: string;
}): Promise<OutboxDispatchResult> {
  const config = getAppConfig();
  const limit = Math.max(1, Math.min(200, options?.limit ?? 50));
  const nowUtc = options?.nowUtc ?? new Date();
  const transport = options?.transport ?? defaultOutboxTransport;

  const params: unknown[] = [nowUtc.toISOString(), limit];
  const idFilter = options?.onlyOutboxId
    ? (params.push(assertUuid(options.onlyOutboxId, 'outbox ID')), 'AND id = $3')
    : '';

  const candidatesRes = await dbQuery<{ id: string }>(
    `SELECT id
     FROM outbox
     WHERE status = 'pending'
       AND next_retry_at <= $1::timestamptz
       ${idFilter}
     ORDER BY created_at ASC
     LIMIT $2`,
    params
  );

  let processedCount = 0;
  let sentCount = 0;
  let retriedCount = 0;
  let failedCount = 0;

  for (const candidate of candidatesRes.rows) {
    const outcome = await withTransaction<'skip' | 'sent' | 'retried' | 'failed'>(
      async (tx) => {
        const rowRes = await tx.query<{
          id: string;
          event_type: string;
          aggregate_type: string;
          aggregate_id: string;
          payload: Record<string, unknown>;
          status: string;
          attempts: number;
          max_attempts: number;
          next_retry_at: string;
          created_at: string;
        }>(
          `SELECT id, event_type, aggregate_type, aggregate_id, payload,
                  status, attempts, max_attempts,
                  next_retry_at::text AS next_retry_at,
                  created_at::text AS created_at
           FROM outbox
           WHERE id = $1
           FOR UPDATE`,
          [candidate.id]
        );

        const row = rowRes.rows[0];
        if (!row || row.status !== 'pending') {
          return 'skip';
        }
        if (new Date(row.next_retry_at).getTime() > nowUtc.getTime()) {
          return 'skip';
        }

        const attemptNumber = Number(row.attempts) + 1;
        const maxAttempts = Math.max(
          1,
          Number(row.max_attempts || config.outboxMaxAttempts)
        );

        try {
          await transport({
            id: row.id,
            eventType: row.event_type,
            aggregateType: row.aggregate_type,
            aggregateId: row.aggregate_id,
            payload: row.payload,
            attempt: attemptNumber,
            createdAt: row.created_at,
          });

          await tx.query(
            `UPDATE outbox
             SET status = 'sent',
                 attempts = $2,
                 last_attempt_at = $3::timestamptz,
                 sent_at = $3::timestamptz,
                 last_error = NULL,
                 updated_at = NOW()
             WHERE id = $1`,
            [row.id, attemptNumber, nowUtc.toISOString()]
          );

          return 'sent';
        } catch (err) {
          const message = (
            err instanceof Error ? err.message : String(err)
          ).slice(0, 500);

          if (attemptNumber >= maxAttempts) {
            await tx.query(
              `UPDATE outbox
               SET status = 'failed',
                   attempts = $2,
                   last_attempt_at = $3::timestamptz,
                   last_error = $4,
                   updated_at = NOW()
               WHERE id = $1`,
              [row.id, attemptNumber, nowUtc.toISOString(), message]
            );
            logEvent('error', 'outbox.delivery_dead_letter', {
              outboxId: row.id,
              eventType: row.event_type,
              attempts: attemptNumber,
              error: message,
            });
            return 'failed';
          }

          const delaySec = computeOutboxBackoffSeconds(attemptNumber);
          const nextRetry = new Date(nowUtc.getTime() + delaySec * 1000);

          await tx.query(
            `UPDATE outbox
             SET status = 'pending',
                 attempts = $2,
                 last_attempt_at = $3::timestamptz,
                 next_retry_at = $4::timestamptz,
                 last_error = $5,
                 updated_at = NOW()
             WHERE id = $1`,
            [
              row.id,
              attemptNumber,
              nowUtc.toISOString(),
              nextRetry.toISOString(),
              message,
            ]
          );

          logEvent('warn', 'outbox.delivery_retry_scheduled', {
            outboxId: row.id,
            eventType: row.event_type,
            attempt: attemptNumber,
            nextRetryAt: nextRetry.toISOString(),
            error: message,
          });

          return 'retried';
        }
      }
    );

    if (outcome === 'skip') continue;
    processedCount += 1;
    if (outcome === 'sent') sentCount += 1;
    if (outcome === 'retried') retriedCount += 1;
    if (outcome === 'failed') failedCount += 1;
  }

  return {
    processedCount,
    sentCount,
    retriedCount,
    failedCount,
  };
}

export async function runOperationalMaintenance(options?: {
  nowUtc?: Date;
  outboxLimit?: number;
  transport?: OutboxTransport;
  triggeredBy?: string;
}): Promise<MaintenanceRunResult> {
  const nowUtc = options?.nowUtc ?? new Date();
  const runId = crypto.randomUUID();

  await dbQuery(
    `INSERT INTO ops_job_runs (id, job_name, status, details, started_at)
     VALUES ($1, 'maintenance_cycle', 'running', $2::jsonb, $3::timestamptz)`,
    [
      runId,
      JSON.stringify({ triggeredBy: options?.triggeredBy ?? 'system' }),
      nowUtc.toISOString(),
    ]
  );

  try {
    const expiry = await expireOverdueBookings(nowUtc);
    const completion = await completeElapsedBookings(nowUtc);
    const outbox = await dispatchOutboxNotifications({
      limit: options?.outboxLimit,
      nowUtc,
      transport: options?.transport,
    });

    const totalProcessed =
      expiry.expiredCount + completion.completedCount + outbox.processedCount;

    await dbQuery(
      `UPDATE ops_job_runs
       SET status = 'completed',
           processed_count = $2,
           details = $3::jsonb,
           finished_at = NOW()
       WHERE id = $1`,
      [
        runId,
        totalProcessed,
        JSON.stringify({
          triggeredBy: options?.triggeredBy ?? 'system',
          expiry,
          completion,
          outbox,
        }),
      ]
    );

    return { runId, expiry, completion, outbox };
  } catch (err) {
    const errMsg = (err instanceof Error ? err.message : String(err)).slice(0, 500);
    await dbQuery(
      `UPDATE ops_job_runs
       SET status = 'failed',
           error_message = $2,
           finished_at = NOW()
       WHERE id = $1`,
      [runId, errMsg]
    );
    logEvent('error', 'ops.maintenance_failed', { runId, error: errMsg });
    throw err;
  }
}

export async function retryFailedOutboxEvent(
  actor: SessionUser | null,
  outboxId: string,
  options?: { transport?: OutboxTransport; nowUtc?: Date }
): Promise<OutboxRecordItem> {
  const admin = requireRole(actor, 'admin');
  const validId = assertUuid(outboxId, 'outbox ID');
  const nowUtc = options?.nowUtc ?? new Date();

  await withTransaction(
    async (tx) => {
      const existingRes = await tx.query<{ id: string; status: string }>(
        `SELECT id, status FROM outbox WHERE id = $1 FOR UPDATE`,
        [validId]
      );
      const existing = existingRes.rows[0];
      if (!existing) {
        throw new AppError('NOT_FOUND', 'Outbox event not found.');
      }
      if (existing.status === 'sent') {
        throw new AppError(
          'INVALID_TRANSITION',
          'Thông báo này đã được gửi thành công trước đó.'
        );
      }

      await tx.query(
        `UPDATE outbox
         SET status = 'pending',
             attempts = 0,
             next_retry_at = $2::timestamptz,
             last_error = NULL,
             updated_at = NOW()
         WHERE id = $1`,
        [validId, nowUtc.toISOString()]
      );
    },
    { actorId: admin.id }
  );

  await dispatchOutboxNotifications({
    limit: 1,
    nowUtc,
    transport: options?.transport,
    onlyOutboxId: validId,
  });

  const updatedRes = await dbQuery<{
    id: string;
    event_type: string;
    aggregate_type: string;
    aggregate_id: string;
    payload: Record<string, unknown>;
    status: 'pending' | 'sent' | 'failed';
    attempts: number;
    max_attempts: number;
    next_retry_at: string;
    last_attempt_at: string | null;
    last_error: string | null;
    created_at: string;
    sent_at: string | null;
  }>(
    `SELECT id, event_type, aggregate_type, aggregate_id, payload, status,
            attempts, max_attempts,
            next_retry_at::text AS next_retry_at,
            last_attempt_at::text AS last_attempt_at,
            last_error,
            created_at::text AS created_at,
            sent_at::text AS sent_at
     FROM outbox
     WHERE id = $1`,
    [validId]
  );

  const r = updatedRes.rows[0];
  return {
    id: r.id,
    eventType: r.event_type,
    aggregateType: r.aggregate_type,
    aggregateId: r.aggregate_id,
    payload: r.payload,
    status: r.status,
    attempts: Number(r.attempts),
    maxAttempts: Number(r.max_attempts),
    nextRetryAt: r.next_retry_at,
    lastAttemptAt: r.last_attempt_at,
    lastError: r.last_error,
    createdAt: r.created_at,
    sentAt: r.sent_at,
  };
}

export async function getAdminOpsSnapshot(
  actor: SessionUser | null,
  nowUtc: Date = new Date()
): Promise<AdminOpsSnapshot> {
  requireRole(actor, 'admin');

  const [
    outboxCountsRes,
    overduePendingRes,
    confirmedRes,
    outboxListRes,
    runsRes,
    systemEventsRes,
  ] = await Promise.all([
    dbQuery<{ status: string; count: string }>(
      `SELECT status, COUNT(*)::text AS count
       FROM outbox
       GROUP BY status`
    ),
    dbQuery<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM bookings
       WHERE status = 'pending' AND expires_at <= $1::timestamptz`,
      [nowUtc.toISOString()]
    ),
    dbQuery<{ check_out: string; host_timezone: string }>(
      `SELECT check_out::text AS check_out, host_timezone
       FROM bookings
       WHERE status = 'confirmed'`
    ),
    dbQuery<{
      id: string;
      event_type: string;
      aggregate_type: string;
      aggregate_id: string;
      payload: Record<string, unknown>;
      status: 'pending' | 'sent' | 'failed';
      attempts: number;
      max_attempts: number;
      next_retry_at: string;
      last_attempt_at: string | null;
      last_error: string | null;
      created_at: string;
      sent_at: string | null;
    }>(
      `SELECT id, event_type, aggregate_type, aggregate_id, payload, status,
              attempts, max_attempts,
              next_retry_at::text AS next_retry_at,
              last_attempt_at::text AS last_attempt_at,
              last_error,
              created_at::text AS created_at,
              sent_at::text AS sent_at
       FROM outbox
       ORDER BY created_at DESC
       LIMIT 40`
    ),
    dbQuery<{
      id: string;
      job_name: string;
      status: 'running' | 'completed' | 'failed';
      processed_count: number;
      details: Record<string, unknown>;
      error_message: string | null;
      started_at: string;
      finished_at: string | null;
    }>(
      `SELECT id, job_name, status, processed_count, details, error_message,
              started_at::text AS started_at,
              finished_at::text AS finished_at
       FROM ops_job_runs
       ORDER BY started_at DESC
       LIMIT 15`
    ),
    dbQuery<{
      id: string;
      booking_id: string;
      booking_code: string;
      from_status: string | null;
      to_status: string;
      reason: string | null;
      created_at: string;
    }>(
      `SELECT be.id, be.booking_id, b.booking_code,
              be.from_status, be.to_status, be.reason,
              be.created_at::text AS created_at
       FROM booking_events be
       JOIN bookings b ON b.id = be.booking_id
       WHERE be.actor_role IN ('system', 'admin')
       ORDER BY be.created_at DESC
       LIMIT 20`
    ),
  ]);

  const countsMap = new Map(outboxCountsRes.rows.map((r) => [r.status, Number(r.count)]));
  const eligibleCompletionBookingsCount = confirmedRes.rows.filter(
    (r) => getTodayIsoInTimezone(r.host_timezone, nowUtc) > r.check_out
  ).length;

  return {
    summary: {
      pendingOutboxCount: countsMap.get('pending') ?? 0,
      sentOutboxCount: countsMap.get('sent') ?? 0,
      failedOutboxCount: countsMap.get('failed') ?? 0,
      overduePendingBookingsCount: Number(overduePendingRes.rows[0]?.count ?? 0),
      eligibleCompletionBookingsCount,
    },
    outboxItems: outboxListRes.rows.map((r) => ({
      id: r.id,
      eventType: r.event_type,
      aggregateType: r.aggregate_type,
      aggregateId: r.aggregate_id,
      payload: r.payload,
      status: r.status,
      attempts: Number(r.attempts),
      maxAttempts: Number(r.max_attempts),
      nextRetryAt: r.next_retry_at,
      lastAttemptAt: r.last_attempt_at,
      lastError: r.last_error,
      createdAt: r.created_at,
      sentAt: r.sent_at,
    })),
    jobRuns: runsRes.rows.map((r) => ({
      id: r.id,
      jobName: r.job_name,
      status: r.status,
      processedCount: Number(r.processed_count),
      details: r.details,
      errorMessage: r.error_message,
      startedAt: r.started_at,
      finishedAt: r.finished_at,
    })),
    systemEvents: systemEventsRes.rows.map((r) => ({
      id: r.id,
      bookingId: r.booking_id,
      bookingCode: r.booking_code,
      fromStatus: r.from_status,
      toStatus: r.to_status,
      reason: r.reason,
      createdAt: r.created_at,
    })),
  };
}
