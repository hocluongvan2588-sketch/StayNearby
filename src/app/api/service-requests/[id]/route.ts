import { requireUser } from '@/lib/auth/session';
import { errJson, okJson } from '@/lib/http';
import { listServiceRequestEvents } from '@/modules/stay-extras';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const events = await listServiceRequestEvents(user, id);
    return okJson({ events });
  } catch (err) {
    return errJson(err);
  }
}
