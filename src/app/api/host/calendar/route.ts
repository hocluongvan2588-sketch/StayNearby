import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { toggleHostRoomBlock } from '@/modules/host';
import { getHostCalendarData } from '@/modules/host-console';

export async function GET(req: Request) {
  try {
    const user = await requireRole(['host', 'admin']);
    const url = new URL(req.url);
    const startDate = url.searchParams.get('startDate') ?? undefined;
    const daysRaw = Number(url.searchParams.get('days') ?? 35);
    const stayId = url.searchParams.get('stayId') ?? undefined;
    const roomId = url.searchParams.get('roomId') ?? undefined;
    const data = await getHostCalendarData(user, {
      startDate,
      days: Number.isFinite(daysRaw) ? daysRaw : 35,
      stayId,
      roomId,
    });
    return okJson(data);
  } catch (err) {
    return errJson(err);
  }
}

const schema = z.object({
  roomId: z.string().uuid(),
  stayDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  block: z.boolean(),
});

export async function POST(req: Request) {
  try {
    const user = await requireRole(['host', 'admin']);
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid date block payload.');
    const out = await toggleHostRoomBlock(user, parsed.data.roomId, parsed.data.stayDate, parsed.data.block);
    return okJson(out);
  } catch (err) {
    return errJson(err);
  }
}
