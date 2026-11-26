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
  measuredDownloadMbps: z.number().int().min(0).max(5000).optional(),
  hasKitchen: z.boolean().optional(),
  hasLaundry: z.boolean().optional(),
  hasWorkspace: z.boolean().optional(),
  hasErgonomicChair: z.boolean().optional(),
  hasExternalMonitor: z.boolean().optional(),
  kitchenType: z.enum(['full', 'kitchenette', 'shared', 'none']).optional(),
  laundryType: z.enum(['in_unit', 'building', 'service', 'none']).optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Please fill out your business name, stay name, destination, and property type.');
    }
    const result = await submitHostApplication(user, parsed.data);
    return okJson(result, 201);
  } catch (err) {
    return errJson(err);
  }
}
