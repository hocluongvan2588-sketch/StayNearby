import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { dbQuery, dbTransaction } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';

const schema = z.object({
  eventId: z.string().uuid(),
});

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
      const evRes = await tx.query<{ spots_total: number; spots_taken: number }>(
        'SELECT spots_total, spots_taken FROM nomad_events WHERE id = $1 FOR UPDATE',
        [parsed.data.eventId]
      );
      const ev = evRes.rows[0];
      if (!ev) throw new AppError('NOT_FOUND', 'Meetup event not found.');
      if (Number(ev.spots_taken) >= Number(ev.spots_total)) {
        throw new AppError('CONFLICT', 'This meetup is currently full.');
      }
      await tx.query(
        'INSERT INTO event_rsvps (event_id, user_id) VALUES ($1, $2)',
        [parsed.data.eventId, user.id]
      );
      await tx.query(
        'UPDATE nomad_events SET spots_taken = spots_taken + 1 WHERE id = $1',
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
