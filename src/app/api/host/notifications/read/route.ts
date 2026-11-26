import { requireRole } from '@/lib/auth/session';
import { errJson, okJson } from '@/lib/http';
import { markHostNotificationsRead } from '@/modules/host-console';

export async function POST() {
  try {
    const user = await requireRole(['host', 'admin']);
    const out = await markHostNotificationsRead(user);
    return okJson(out);
  } catch (err) {
    return errJson(err);
  }
}
