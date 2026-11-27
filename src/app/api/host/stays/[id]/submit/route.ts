import { requireRole } from '@/lib/auth/session';
import { errJson, okJson } from '@/lib/http';
import { submitHostStayForReview } from '@/modules/host';

/** Host submits their draft listing for review: draft → pending_review. */
export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole(['host', 'admin']);
    const { id } = await context.params;
    const result = await submitHostStayForReview(user, id);
    return okJson(result);
  } catch (err) {
    return errJson(err);
  }
}
