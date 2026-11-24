import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getAppConfig } from '@/lib/config';
import { AppError } from '@/lib/errors';
import { getClientIp, handleApiError } from '@/lib/http';
import { assertRateLimit } from '@/lib/rate-limit';
import { runOperationalMaintenance } from '@/modules/ops';

export const dynamic = 'force-dynamic';

function timingSafeMatch(expected: string, actual: string): boolean {
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(actual, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  try {
    assertRateLimit({
      bucket: 'internal_jobs_run',
      key: getClientIp(req),
      limit: 30,
      windowMs: 60_000,
    });

    const config = getAppConfig();
    if (!config.opsSecret) {
      throw new AppError(
        'UNAUTHORIZED',
        'Internal jobs endpoint requires OPS_SECRET configuration.'
      );
    }

    const authHeader = req.headers.get('authorization')?.trim() || '';
    const bearerToken = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : '';
    const headerSecret = req.headers.get('x-ops-secret')?.trim() || bearerToken;

    if (!headerSecret || !timingSafeMatch(config.opsSecret, headerSecret)) {
      throw new AppError('UNAUTHORIZED', 'Invalid operational secret.');
    }

    const result = await runOperationalMaintenance({ triggeredBy: 'internal_cron' });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return handleApiError(err);
  }
}
