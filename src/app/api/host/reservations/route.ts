import { requireRole } from '@/lib/auth/session';
import { errJson, okJson } from '@/lib/http';
import { getHostReservationsData } from '@/modules/host-console';

export async function GET(req: Request) {
  try {
    const user = await requireRole(['host', 'admin']);
    const url = new URL(req.url);
    const data = await getHostReservationsData(user, {
      status: url.searchParams.get('status') ?? 'all',
      stayId: url.searchParams.get('stayId') ?? undefined,
      q: url.searchParams.get('q') ?? undefined,
    });
    return okJson(data);
  } catch (err) {
    return errJson(err);
  }
}
