import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { replyToGuestSupportTicket } from '@/modules/support';

const replySchema = z.object({
  body: z.string().min(2).max(3000),
  attachments: z.array(z.string().max(600)).max(5).optional(),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const raw = await req.json().catch(() => null);
    const parsed = replySchema.safeParse(raw);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Message must be between 2 and 3000 characters.');
    }
    const result = await replyToGuestSupportTicket(user, id, parsed.data);
    return okJson({ reply: result }, 201);
  } catch (err) {
    return errJson(err);
  }
}
