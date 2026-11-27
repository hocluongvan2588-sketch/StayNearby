import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { HOST_MAX_NIGHTS, HOST_MIN_NIGHTS } from '@/lib/business-rules';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { updateHostCalendarRange } from '@/modules/host-console';

const schema = z.object({
  roomId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  block: z.boolean().optional(),
  customNightlyVnd: z.number().min(0).max(500_000_000).nullable().optional(),
  minNights: z.number().int().min(HOST_MIN_NIGHTS).max(HOST_MAX_NIGHTS).nullable().optional(),
  note: z.string().max(120).optional(),
});

export async function PATCH(req: Request) {
  try {
    const user = await requireRole(['host', 'admin']);
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid calendar range update payload.');
    }
    const out = await updateHostCalendarRange(user, parsed.data);
    return okJson(out);
  } catch (err) {
    return errJson(err);
  }
}
