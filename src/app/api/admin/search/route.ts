import { NextRequest } from 'next/server';
import { errJson, okJson } from '@/lib/http';
import { requireAdminPermission } from '@/modules/admin-rbac';
import { globalAdminSearch } from '@/modules/admin-bos';

export async function GET(req: NextRequest) {
  try {
    const actor = await requireAdminPermission('overview', 'view');
    const q = req.nextUrl.searchParams.get('q') ?? '';
    const data = await globalAdminSearch(actor, q);
    return okJson(data);
  } catch (err) {
    return errJson(err);
  }
}
