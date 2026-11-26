import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { replyToStayReview } from '@/modules/host-console';

const schema = z.object({
  reply: z.string().min(2).max(2000),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole(['host', 'admin']);
    const { id } = await context.params;
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Please enter a reply of at least 2 characters.');
    }
    const out = await replyToStayReview(user, id, parsed.data.reply);
    return okJson(out);
  } catch (err) {
    return errJson(err);
  }
}
