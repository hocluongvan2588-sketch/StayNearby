import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { deleteHostDraft, saveHostDraft } from '@/modules/host-console';

const schema = z.object({
  currentStep: z.number().int().min(1).max(6).default(1),
  payload: z.record(z.string(), z.unknown()),
});

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid draft update payload.');
    }
    const draft = await saveHostDraft(user, { draftId: id, ...parsed.data });
    return okJson({ draft });
  } catch (err) {
    return errJson(err);
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const result = await deleteHostDraft(user, id);
    return okJson(result);
  } catch (err) {
    return errJson(err);
  }
}
