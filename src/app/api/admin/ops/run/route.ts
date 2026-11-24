import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/rbac';
import { getCurrentUser } from '@/lib/auth/session';
import { getClientIp, handleApiError } from '@/lib/http';
import { assertRateLimit } from '@/lib/rate-limit';
import { runOperationalMaintenance } from '@/modules/ops';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const admin = requireRole(user, 'admin');
    assertRateLimit({
      bucket: 'admin_ops_run',
      key: `${getClientIp(req)}:${admin.id}`,
      limit: 20,
      windowMs: 60_000,
    });

    const result = await runOperationalMaintenance({
      triggeredBy: `admin:${admin.id}`,
    });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return handleApiError(err);
  }
}
