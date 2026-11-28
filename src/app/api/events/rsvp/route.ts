import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { dbQuery, dbTransaction } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';

const schema = z.object({
  eventId: z.string().uuid(),
});

/** Events accepting internal registrations: published, internal mode, future. */
const OPEN_EVENT_SQL = `
  SELECT spots_total, spots_taken, registration_mode, status, start_at
  FROM nomad_events
  WHERE id = $1
    AND registration_mode = 'internal'
    AND status = 'published'
    AND start_at IS NOT NULL
    AND start_at >= NOW()
  FOR UPDATE
`;

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid event ID.');

    const result = await dbTransaction(async (tx) => {
      const existing = await tx.query(
        'SELECT 1 FROM event_rsvps WHERE event_id = $1 AND user_id = $2',
        [parsed.data.eventId, user.id]
      );
      if (existing.rows[0]) {
        return { joined: true, alreadyJoined: true };
      }
      const evRes = await tx.query<{ spots_total: number | null; spots_taken: number }>(
        OPEN_EVENT_SQL,
        [parsed.data.eventId]
      );
      const ev = evRes.rows[0];
      if (!ev) throw new AppError('NOT_FOUND', 'Event not found or not open for registration.');
      const limit = ev.spots_total == null ? null : Number(ev.spots_total);
      if (limit != null && Number(ev.spots_taken) >= limit) {
        throw new AppError('CONFLICT', 'This event is currently full.');
      }
      await tx.query(
        'INSERT INTO event_rsvps (event_id, user_id) VALUES ($1, $2)',
        [parsed.data.eventId, user.id]
      );
      await tx.query(
        'UPDATE nomad_events SET spots_taken = spots_taken + 1, updated_at = NOW() WHERE id = $1',
        [parsed.data.eventId]
      );
      return { joined: true, alreadyJoined: false };
    });

    const refreshed = await dbQuery<{ spots_taken: number }>(
      'SELECT spots_taken FROM nomad_events WHERE id = $1',
      [parsed.data.eventId]
    );

    return okJson({ ...result, spotsTaken: Number(refreshed.rows[0]?.spots_taken ?? 0) });
  } catch (err) {
    return errJson(err);
  }
}

/** Cancel the caller's own registration (internal events only). */
export async function DELETE(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid event ID.');

    const result = await dbTransaction(async (tx) => {
      const deleted = await tx.query(
        'DELETE FROM event_rsvps WHERE event_id = $1 AND user_id = $2',
        [parsed.data.eventId, user.id]
      );
      if (!deleted.rowCount) {
        throw new AppError('NOT_FOUND', 'Registration not found.');
      }
      await tx.query(
        `UPDATE nomad_events
            SET spots_taken = GREATEST(spots_taken - 1, 0), updated_at = NOW()
          WHERE id = $1`,
        [parsed.data.eventId]
      );
      return { cancelled: true };
    });

    const refreshed = await dbQuery<{ spots_taken: number }>(
      'SELECT spots_taken FROM nomad_events WHERE id = $1',
      [parsed.data.eventId]
    );

    return okJson({ ...result, spotsTaken: Number(refreshed.rows[0]?.spots_taken ?? 0) });
  } catch (err) {
    return errJson(err);
  }
}
