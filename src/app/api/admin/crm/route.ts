import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { handleApiError } from '@/lib/http';
import {
  getAdminCrmDashboard,
  VALID_CRM_STAGES,
  type CrmStage,
} from '@/modules/crm';
import type { RoleCode } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const q = req.nextUrl.searchParams.get('q') || undefined;
    const rawRole = req.nextUrl.searchParams.get('role');
    const rawStage = req.nextUrl.searchParams.get('stage');

    const role: 'all' | RoleCode =
      rawRole === 'guest' || rawRole === 'host' || rawRole === 'admin'
        ? rawRole
        : 'all';

    const stage: 'all' | CrmStage =
      rawStage && (VALID_CRM_STAGES as readonly string[]).includes(rawStage)
        ? (rawStage as CrmStage)
        : 'all';

    const dashboard = await getAdminCrmDashboard(user, { q, role, stage });
    return NextResponse.json({ ok: true, ...dashboard });
  } catch (err) {
    return handleApiError(err);
  }
}
