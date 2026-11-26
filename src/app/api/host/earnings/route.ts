import { requireRole } from '@/lib/auth/session';
import { errJson, okJson } from '@/lib/http';
import { getHostEarningsData } from '@/modules/host-console';

export async function GET(req: Request) {
  try {
    const user = await requireRole(['host', 'admin']);
    const url = new URL(req.url);
    const data = await getHostEarningsData(user, {
      stayId: url.searchParams.get('stayId') ?? undefined,
      from: url.searchParams.get('from') ?? undefined,
      to: url.searchParams.get('to') ?? undefined,
    });
    return okJson(data);
  } catch (err) {
    return errJson(err);
  }
}
