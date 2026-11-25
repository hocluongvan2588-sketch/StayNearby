import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { dbQuery } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';

const schema = z.object({
  stayId: z.string().uuid(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid stay ID.');

    const exists = await dbQuery(
      'SELECT 1 FROM saved_stays WHERE user_id = $1 AND stay_id = $2',
      [user.id, parsed.data.stayId]
    );
    if (exists.rows[0]) {
      await dbQuery('DELETE FROM saved_stays WHERE user_id = $1 AND stay_id = $2', [
        user.id,
        parsed.data.stayId,
      ]);
      return okJson({ saved: false });
    }
    await dbQuery(
      'INSERT INTO saved_stays (user_id, stay_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [user.id, parsed.data.stayId]
    );
    return okJson({ saved: true });
  } catch (err) {
    return errJson(err);
  }
}
