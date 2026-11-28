import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { respondToServiceQuote } from '@/modules/stay-extras';

const schema = z.object({
  accept: z.boolean(),
  quoteVersion: z.number().int().min(0),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const raw = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid quote response.');
    }
    const result = await respondToServiceQuote(user, id, parsed.data);
    return okJson(result);
  } catch (err) {
    return errJson(err);
  }
}
