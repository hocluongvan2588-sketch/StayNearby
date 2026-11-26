import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { errJson, okJson } from '@/lib/http';
import { publishHostDraft } from '@/modules/host-console';

const schema = z.object({
  payload: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    const result = await publishHostDraft(
      user,
      id,
      parsed.success ? parsed.data.payload : undefined
    );
    return okJson(result, 201);
  } catch (err) {
    return errJson(err);
  }
}
