import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { updateHostStayConfiguration } from '@/modules/host';

const schema = z.object({
  businessModel: z.enum(['booking_flow', 'stay_direct']),
  directBookingUrl: z.string().optional(),
  wholesale7Vnd: z.number().positive(),
  wholesale14Vnd: z.number().positive(),
  wholesale21Vnd: z.number().positive(),
  wholesale30Vnd: z.number().positive(),
  extraNightVnd: z.number().positive(),
  isDealFeatured: z.boolean(),
});

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole(['host', 'admin']);
    const { id } = await context.params;
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid package configuration.');
    const out = await updateHostStayConfiguration(user, id, parsed.data);
    return okJson(out);
  } catch (err) {
    return errJson(err);
  }
}
