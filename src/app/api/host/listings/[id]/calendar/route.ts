import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { handleApiError } from '@/lib/http';
import { getHostCalendarData } from '@/modules/host';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser();
    const sp = req.nextUrl.searchParams;
    const calendar = await getHostCalendarData(
      user,
      id,
      sp.get('from') || undefined,
      sp.get('to') || undefined
    );
    return NextResponse.json({ ok: true, calendar });
  } catch (err) {
    return handleApiError(err);
  }
}
