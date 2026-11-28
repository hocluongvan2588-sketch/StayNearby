import { requireRole } from '@/lib/auth/session';
import { errJson, okJson } from '@/lib/http';
import { searchExistingPlaces } from '@/modules/host-local-places';

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(['host', 'admin']);
    const { id } = await context.params;
    const q = new URL(req.url).searchParams.get('q') ?? '';
    const places = await searchExistingPlaces(user, id, q);
    return okJson({ places });
  } catch (err) {
    return errJson(err);
  }
}
