import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { cancelServiceRequestByGuest } from '@/modules/stay-extras';

const schema = z.object({
  reason: z.string().max(500).optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const raw = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid cancel payload.');
    }
    const result = await cancelServiceRequestByGuest(user, id, parsed.data.reason);
    return okJson(result);
  } catch (err) {
    return errJson(err);
  }
}
