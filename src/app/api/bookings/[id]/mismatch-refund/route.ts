import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { refundWifiMismatch } from '@/modules/bookings';

const schema = z.object({
  reason: z.string().min(5).max(500).default('Admin approved booking fee refund'),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireUser();
    const { id } = await context.params;
    const raw = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Please describe the reason for the fee refund.');
    }
    const result = await refundWifiMismatch(actor, id, parsed.data.reason);
    return okJson({ refund: result });
  } catch (err) {
    return errJson(err);
  }
}
