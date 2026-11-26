import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { createGatewayCheckoutSession } from '@/modules/payments';

const schema = z.object({
  purpose: z.enum(['booking_fee', 'membership_pass']),
  provider: z.enum(['vietqr', 'stripe']),
  bookingId: z.string().uuid().optional(),
  vatTaxId: z.string().max(50).optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const raw = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid payment checkout parameters.');
    }

    const origin = req.headers.get('origin') || undefined;
    const transaction = await createGatewayCheckoutSession(user, {
      ...parsed.data,
      origin,
    });

    return okJson({ transaction }, 201);
  } catch (err) {
    return errJson(err);
  }
}
