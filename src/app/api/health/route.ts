import { NextResponse } from 'next/server';
import { getAppConfig } from '@/lib/config';
import { dbQuery, getDbMode } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const config = getAppConfig();
    const res = await dbQuery<{ ok: number }>('SELECT 1 AS ok');
    return NextResponse.json({
      ok: res.rows[0]?.ok === 1,
      brandName: config.brandName,
      dbMode: getDbMode(),
      supabaseConfigured: config.supabase.isConfigured,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Health check failed' },
      { status: 500 }
    );
  }
}
