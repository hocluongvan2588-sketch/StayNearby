import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { getConversationMessages, sendConversationMessage } from '@/modules/host-inbox';

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const messages = await getConversationMessages(user, id);
    return okJson({ messages });
  } catch (err) {
    return errJson(err);
  }
}

const sendSchema = z.object({
  body: z.string().max(4000).optional(),
  imageUrl: z.string().max(600).optional(),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const payload = await req.json();
    const parsed = sendSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid message payload.');
    }
    const message = await sendConversationMessage(user, id, parsed.data);
    return okJson({ message }, 201);
  } catch (err) {
    return errJson(err);
  }
}
