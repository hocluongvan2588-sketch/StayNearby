import { errJson, okJson } from '@/lib/http';
import { requireAdminPermission } from '@/modules/admin-rbac';
import { listPendingStayRevisions } from '@/modules/listing-revisions';

/** Queue of pending price/policy revisions awaiting review. */
export async function GET() {
  try {
    await requireAdminPermission('listings', 'view');
    const revisions = await listPendingStayRevisions();
    return okJson({ revisions });
  } catch (err) {
    return errJson(err);
  }
}
