import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { syncHostRoomIcal } from '@/modules/host';

const schema = z.object({
  roomId: z.string().uuid(),
  icalUrl: z.string().max(1000),
});

export async function POST(req: Request) {
  try {
    const user = await requireRole(['host', 'admin']);
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Please provide a valid room ID and iCal URL.');
    }
    const result = await syncHostRoomIcal(user, parsed.data.roomId, parsed.data.icalUrl);
    return okJson({ sync: result });
  } catch (err) {
    return errJson(err);
  }
}
