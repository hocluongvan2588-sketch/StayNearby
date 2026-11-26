import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { getHostDrafts, saveHostDraft } from '@/modules/host-console';

export async function GET() {
  try {
    const user = await requireUser();
    const drafts = await getHostDrafts(user);
    return okJson({ drafts });
  } catch (err) {
    return errJson(err);
  }
}

const schema = z.object({
  draftId: z.string().uuid().optional(),
  currentStep: z.number().int().min(1).max(6).default(1),
  payload: z.record(z.string(), z.unknown()),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid draft payload.');
    }
    const draft = await saveHostDraft(user, parsed.data);
    return okJson({ draft }, 201);
  } catch (err) {
    return errJson(err);
  }
}
