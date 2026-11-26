import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { getHostSettings } from '@/modules/host-console';
import { createHostQuickReply, deleteHostQuickReply } from '@/modules/host-inbox';

export async function GET() {
  try {
    const user = await requireRole(['host', 'admin']);
    const { quickReplies } = await getHostSettings(user);
    return okJson({ quickReplies });
  } catch (err) {
    return errJson(err);
  }
}

const createSchema = z.object({
  title: z.string().min(2).max(80),
  body: z.string().min(4).max(1500),
});

export async function POST(req: Request) {
  try {
    const user = await requireRole(['host', 'admin']);
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Quick reply title and body are required.');
    }
    const quickReply = await createHostQuickReply(user, parsed.data);
    return okJson({ quickReply }, 201);
  } catch (err) {
    return errJson(err);
  }
}

const deleteSchema = z.object({
  id: z.string().uuid(),
});

export async function DELETE(req: Request) {
  try {
    const user = await requireRole(['host', 'admin']);
    const body = await req.json();
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Valid quick reply ID required.');
    }
    const out = await deleteHostQuickReply(user, parsed.data.id);
    return okJson(out);
  } catch (err) {
    return errJson(err);
  }
}
