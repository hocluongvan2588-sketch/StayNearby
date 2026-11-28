import { requireUser } from '@/lib/auth/session';
import { errJson, okJson } from '@/lib/http';
import { listHostServiceRequests, type ServiceRequestStatus } from '@/modules/stay-extras';

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const sp = new URL(req.url).searchParams;
    const requests = await listHostServiceRequests(user, {
      bookingId: sp.get('bookingId') ?? undefined,
      stayId: sp.get('stayId') ?? undefined,
      status: (sp.get('status') as ServiceRequestStatus | null) ?? undefined,
    });
    return okJson({ requests });
  } catch (err) {
    return errJson(err);
  }
}
