import { requireUser } from '@/lib/auth/session';
import { errJson, okJson } from '@/lib/http';
import {
  getAdminServiceRequestStats,
  listAdminServiceRequests,
  type ServiceRequestStatus,
} from '@/modules/stay-extras';

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== 'admin') {
      return okJson({ requests: [], forbidden: true }, 403);
    }
    const sp = new URL(req.url).searchParams;
    if (sp.get('view') === 'stats') {
      const stats = await getAdminServiceRequestStats(user);
      return okJson(stats);
    }
    const requests = await listAdminServiceRequests(user, {
      status: (sp.get('status') as ServiceRequestStatus | null) ?? undefined,
      catalogKey: sp.get('catalogKey') ?? undefined,
      hostId: sp.get('hostId') ?? undefined,
      destinationSlug: sp.get('destinationSlug') ?? undefined,
    });
    return okJson({ requests });
  } catch (err) {
    return errJson(err);
  }
}
