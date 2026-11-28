import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { submitGuestServiceDetails } from '@/modules/stay-extras';

const schema = z.object({
  details: z.record(z.string(), z.unknown()),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const raw = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid details payload.');
    }
    const result = await submitGuestServiceDetails(user, id, parsed.data.details);
    return okJson(result);
  } catch (err) {
    return errJson(err);
  }
}
