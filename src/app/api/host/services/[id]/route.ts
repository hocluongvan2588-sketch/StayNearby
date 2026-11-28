import { requireUser } from '@/lib/auth/session';
import { errJson, okJson } from '@/lib/http';
import { deleteStayService } from '@/modules/stay-extras';

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const result = await deleteStayService(user, id);
    return okJson(result);
  } catch (err) {
    return errJson(err);
  }
}
