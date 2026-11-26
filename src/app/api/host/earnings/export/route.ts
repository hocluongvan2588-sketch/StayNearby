import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { getTodayIsoVietnam } from '@/lib/dates';
import { errJson } from '@/lib/http';
import { exportHostEarningsCsv } from '@/modules/host-console';

export async function GET(req: Request) {
  try {
    const user = await requireRole(['host', 'admin']);
    const url = new URL(req.url);
    const csv = await exportHostEarningsCsv(user, {
      stayId: url.searchParams.get('stayId') ?? undefined,
      from: url.searchParams.get('from') ?? undefined,
      to: url.searchParams.get('to') ?? undefined,
    });
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="vietnomad-host-earnings-${getTodayIsoVietnam()}.csv"`,
      },
    });
  } catch (err) {
    return errJson(err);
  }
}
