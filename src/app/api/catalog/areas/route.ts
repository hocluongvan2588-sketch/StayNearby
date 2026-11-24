import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/http';
import { listPublishedAreas } from '@/modules/catalog';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const areas = await listPublishedAreas();
    return NextResponse.json({ ok: true, areas });
  } catch (err) {
    return handleApiError(err);
  }
}
