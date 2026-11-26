import { requireRole } from '@/lib/auth/session';
import { errJson, okJson } from '@/lib/http';
import { getHostInsightsData } from '@/modules/host-console';

export async function GET(req: Request) {
  try {
    const user = await requireRole(['host', 'admin']);
    const url = new URL(req.url);
    const r = url.searchParams.get('range');
    const range = r === '7d' || r === '30d' || r === '90d' || r === 'all' ? r : '30d';
    const data = await getHostInsightsData(user, {
      stayId: url.searchParams.get('stayId') ?? undefined,
      range,
    });
    return okJson(data);
  } catch (err) {
    return errJson(err);
  }
}
