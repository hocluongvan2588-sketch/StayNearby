import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { errJson } from '@/lib/http';
import { generateRoomIcalExport } from '@/modules/host-console';

export async function GET(
  _req: Request,
  context: { params: Promise<{ roomId: string }> }
) {
  try {
    const user = await requireRole(['host', 'admin']);
    const { roomId } = await context.params;
    const ics = await generateRoomIcalExport(user, roomId);
    return new NextResponse(ics, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="vietnomad-${roomId.slice(0, 8)}.ics"`,
      },
    });
  } catch (err) {
    return errJson(err);
  }
}
