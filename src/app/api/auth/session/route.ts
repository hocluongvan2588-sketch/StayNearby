import { getCurrentUser } from '@/lib/auth/session';
import { errJson, okJson } from '@/lib/http';

export async function GET() {
  try {
    const user = await getCurrentUser();
    return okJson({ user });
  } catch (err) {
    return errJson(err);
  }
}
