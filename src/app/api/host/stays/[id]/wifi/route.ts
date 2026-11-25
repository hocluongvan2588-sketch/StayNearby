import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { recordWifiSpeedTest } from '@/modules/host';

const schema = z.object({
  downloadMbps: z.number().int().min(10).max(5000),
  uploadMbps: z.number().int().min(5).max(5000),
  jitterMs: z.number().int().min(0).max(200),
  note: z.string().max(180).optional(),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole(['host', 'admin']);
    const { id } = await context.params;
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid speed test metrics.');
    const out = await recordWifiSpeedTest(user, id, parsed.data);
    return okJson(out);
  } catch (err) {
    return errJson(err);
  }
}
