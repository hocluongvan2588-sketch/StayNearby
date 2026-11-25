import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { submitHostApplication } from '@/modules/host';

const schema = z.object({
  businessName: z.string().min(2).max(120),
  stayName: z.string().min(3).max(120),
  destinationSlug: z.string().min(2),
  propertyType: z.enum(['apartment', 'coliving', 'boutique_hotel', 'villa', 'eco_lodge']),
  businessModel: z.enum(['booking_flow', 'stay_direct']),
  measuredDownloadMbps: z.number().int().min(10).max(5000),
  hasKitchen: z.boolean(),
  hasLaundry: z.boolean(),
  hasWorkspace: z.boolean(),
  directBookingUrl: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Please fill out all required stay application fields.');
    }
    const result = await submitHostApplication(user, parsed.data);
    return okJson(result, 201);
  } catch (err) {
    return errJson(err);
  }
}
