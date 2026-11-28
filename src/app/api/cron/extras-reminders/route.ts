import { getConfig } from '@/lib/config';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { runServiceRequestReminders } from '@/modules/stay-extras';

async function handleCron(req: Request) {
  try {
    const secret = getConfig().cronSecret;
    if (secret) {
      const auth = req.headers.get('authorization');
      if (auth !== `Bearer ${secret}`) {
        throw new AppError('UNAUTHORIZED', 'Invalid cron authorization token.');
      }
    }
    const summary = await runServiceRequestReminders();
    return okJson({ ok: true, ...summary });
  } catch (err) {
    return errJson(err);
  }
}

export async function GET(req: Request) {
  return handleCron(req);
}

export async function POST(req: Request) {
  return handleCron(req);
}
