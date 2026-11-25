import { z } from 'zod';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { getServerPreferences } from '@/lib/preferences';
import { runAiStayConcierge } from '@/modules/concierge';

const schema = z.object({
  prompt: z.string().min(3).max(400),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Describe your desired Vietnam base in a short sentence.');
    }
    const prefs = await getServerPreferences();
    const result = await runAiStayConcierge({
      prompt: parsed.data.prompt,
      locale: prefs.locale,
      currency: prefs.currency,
    });
    return okJson({ result });
  } catch (err) {
    return errJson(err);
  }
}
