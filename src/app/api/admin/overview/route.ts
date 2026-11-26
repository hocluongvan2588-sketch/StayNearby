import { NextRequest } from 'next/server';
import { errJson, okJson } from '@/lib/http';
import { requireAdminPermission } from '@/modules/admin-rbac';
import { getOverviewDashboardData } from '@/modules/admin-bos';

export async function GET(req: NextRequest) {
  try {
    const actor = await requireAdminPermission('overview', 'view');
    const days = Number(req.nextUrl.searchParams.get('days') ?? '90') || 90;
    const data = await getOverviewDashboardData(actor, days);
    return okJson(data);
  } catch (err) {
    return errJson(err);
  }
}
