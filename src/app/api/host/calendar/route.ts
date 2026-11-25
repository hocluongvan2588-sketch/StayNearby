import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { toggleHostRoomBlock } from '@/modules/host';

const schema = z.object({
  roomId: z.string().uuid(),
  stayDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  block: z.boolean(),
});

export async function POST(req: Request) {
  try {
    const user = await requireRole(['host', 'admin']);
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid date block payload.');
    const out = await toggleHostRoomBlock(user, parsed.data.roomId, parsed.data.stayDate, parsed.data.block);
    return okJson(out);
  } catch (err) {
    return errJson(err);
  }
}
