import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { getClientIp, handleApiError } from '@/lib/http';
import { assertRateLimit } from '@/lib/rate-limit';
import { retryFailedOutboxEvent } from '@/modules/ops';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser();
    assertRateLimit({
      bucket: 'admin_outbox_retry',
      key: `${getClientIp(req)}:${user?.id || 'anon'}`,
      limit: 30,
      windowMs: 60_000,
    });

    const item = await retryFailedOutboxEvent(user, id);
    return NextResponse.json({ ok: true, item });
  } catch (err) {
    return handleApiError(err);
  }
}
