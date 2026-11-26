import { z } from 'zod';
import { requireRole, requireUser } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { ensureConversationForBooking, getHostInboxData } from '@/modules/host-inbox';

export async function GET(req: Request) {
  try {
    const user = await requireRole(['host', 'admin']);
    const url = new URL(req.url);
    const f = url.searchParams.get('filter');
    const filter =
      f === 'unread' || f === 'in_house' || f === 'upcoming' ? f : 'all';
    const q = url.searchParams.get('q') ?? undefined;
    const data = await getHostInboxData(user, { filter, q });
    return okJson(data);
  } catch (err) {
    return errJson(err);
  }
}

const createSchema = z.object({
  bookingId: z.string().uuid(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Valid bookingId required.');
    }
    const out = await ensureConversationForBooking(user, parsed.data.bookingId);
    return okJson(out, 201);
  } catch (err) {
    return errJson(err);
  }
}
