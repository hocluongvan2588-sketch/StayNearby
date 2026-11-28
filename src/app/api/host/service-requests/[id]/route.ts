import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { hostServiceRequestAction } from '@/modules/stay-extras';

const schema = z.object({
  action: z.enum(['confirm', 'quote', 'request_info', 'decline', 'prepare', 'complete']),
  quotePriceVnd: z.number().int().min(0).max(100_000_000).nullable().optional(),
  quoteNote: z.string().max(1000).optional(),
  reason: z.string().max(500).optional(),
  hostNote: z.string().max(1000).optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const raw = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid service request action.');
    }
    const { action, ...payload } = parsed.data;
    const result = await hostServiceRequestAction(user, id, action, payload);
    return okJson(result);
  } catch (err) {
    return errJson(err);
  }
}
