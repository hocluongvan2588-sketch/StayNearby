import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/session';
import { MAX_NIGHTS, MIN_NIGHTS_TECHNICAL } from '@/lib/business-rules';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { previewBookingQuoteWithPromotion } from '@/modules/promotions';

const schema = z.object({
  stayId: z.string().uuid(),
  roomId: z.string().uuid(),
  packageId: z.string().uuid(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  nights: z.number().int().min(MIN_NIGHTS_TECHNICAL).max(MAX_NIGHTS),
  promotionCode: z.string().max(40).optional(),
  applyVatFree: z.boolean().optional(),
  useRewardCredit: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser().catch(() => null);
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid promotion validation parameters.');
    }
    const result = await previewBookingQuoteWithPromotion({
      ...parsed.data,
      user: user
        ? {
            id: user.id,
            membershipTier: user.membershipTier,
            vatTaxId: user.vatTaxId,
            rewardCreditVnd: user.rewardCreditVnd,
          }
        : null,
    });
    return okJson(result);
  } catch (err) {
    return errJson(err);
  }
}
