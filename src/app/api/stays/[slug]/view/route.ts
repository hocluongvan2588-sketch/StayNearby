import { cookies } from 'next/headers';
import { getCurrentUser } from '@/lib/auth/session';
import { errJson, okJson } from '@/lib/http';
import { recordStayView } from '@/modules/host-console';

export async function POST(
  _req: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const [user, cookieStore] = await Promise.all([getCurrentUser(), cookies()]);
    const sessionKey =
      user?.id ??
      cookieStore.get('vietnomad_locale')?.value ??
      'guest-browser';
    const result = await recordStayView(slug, sessionKey, user?.id);
    return okJson(result);
  } catch (err) {
    return errJson(err);
  }
}
