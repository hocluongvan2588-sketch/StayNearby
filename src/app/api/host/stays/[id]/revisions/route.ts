import { requireRole } from '@/lib/auth/session';
import { errJson, okJson } from '@/lib/http';
import { listStayRevisions } from '@/modules/listing-revisions';

/** Revision history for one stay (owner host or admin). */
export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole(['host', 'admin']);
    const { id } = await context.params;
    const revisions = await listStayRevisions(user, id);
    return okJson({ revisions });
  } catch (err) {
    return errJson(err);
  }
}
