import { NextRequest } from 'next/server';
import { errJson, okJson } from '@/lib/http';
import { requireAdminPermission } from '@/modules/admin-rbac';
import { searchCmsEntityPicker } from '@/modules/cms-vietnomad';

export async function GET(req: NextRequest) {
  try {
    await requireAdminPermission('content', 'view');
    const typeRaw = req.nextUrl.searchParams.get('type') ?? 'all';
    const allowed = new Set([
      'stay',
      'destination',
      'neighborhood',
      'place',
      'partner',
      'promotion',
      'guide',
      'category',
      'all',
    ]);
    const type = (allowed.has(typeRaw) ? typeRaw : 'all') as
      | 'stay'
      | 'destination'
      | 'neighborhood'
      | 'place'
      | 'partner'
      | 'promotion'
      | 'guide'
      | 'category'
      | 'all';
    const q = req.nextUrl.searchParams.get('q') ?? '';
    const items = await searchCmsEntityPicker({ type, q });
    return okJson({ items });
  } catch (err) {
    return errJson(err);
  }
}
