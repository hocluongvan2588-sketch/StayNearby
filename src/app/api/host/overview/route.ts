import { requireRole } from '@/lib/auth/session';
import { errJson, okJson } from '@/lib/http';
import { getHostOverviewData } from '@/modules/host-console';

export async function GET(req: Request) {
  try {
    const user = await requireRole(['host', 'admin']);
    const url = new URL(req.url);
    const stayId = url.searchParams.get('stayId') ?? undefined;
    const rangeParam = url.searchParams.get('range');
    const range =
      rangeParam === '7d' || rangeParam === '30d' || rangeParam === '90d' || rangeParam === 'all'
        ? rangeParam
        : '30d';
    const data = await getHostOverviewData(user, { stayId, range });
    return okJson(data);
  } catch (err) {
    return errJson(err);
  }
}
