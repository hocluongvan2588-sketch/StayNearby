import { requireRole } from '@/lib/auth/session';
import { errJson, okJson } from '@/lib/http';
import { getHostReviewsData } from '@/modules/host-console';

export async function GET(req: Request) {
  try {
    const user = await requireRole(['host', 'admin']);
    const url = new URL(req.url);
    const minRatingRaw = Number(url.searchParams.get('minRating') ?? 0);
    const replyParam = url.searchParams.get('replyFilter');
    const replyFilter =
      replyParam === 'unreplied' || replyParam === 'replied' ? replyParam : 'all';
    const data = await getHostReviewsData(user, {
      stayId: url.searchParams.get('stayId') ?? undefined,
      minRating: Number.isFinite(minRatingRaw) && minRatingRaw > 0 ? minRatingRaw : undefined,
      replyFilter,
    });
    return okJson(data);
  } catch (err) {
    return errJson(err);
  }
}
