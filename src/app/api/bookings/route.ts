import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { createStayBooking } from '@/modules/bookings';

const schema = z.object({
  stayId: z.string().uuid(),
  roomId: z.string().uuid(),
  packageId: z.string().uuid(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  nights: z.number().int().min(7).max(180),
  guestsCount: z.number().int().min(1).max(10).default(1),
  applyVatFree: z.boolean().optional(),
  useRewardCredit: z.boolean().optional(),
  guestNote: z.string().max(500).optional(),
  checkoutMode: z.enum(['intent', 'instant']).optional(),
  promotionCode: z.string().max(40).optional(),
  attributionSessionKey: z.string().max(120).optional(),
  utmSource: z.string().max(80).optional(),
  utmMedium: z.string().max(80).optional(),
  utmCampaign: z.string().max(100).optional(),
  utmContent: z.string().max(100).optional(),
  utmTerm: z.string().max(100).optional(),
  landingPath: z.string().max(240).optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid booking details (7 nights minimum).');
    }
    const result = await createStayBooking(user, parsed.data);
    return okJson({ booking: result }, 201);
  } catch (err) {
    return errJson(err);
  }
}
