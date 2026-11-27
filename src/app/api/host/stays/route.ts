import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { createDraftStay } from '@/modules/host';

const schema = z.object({
  destinationSlug: z.string().min(1).max(80).optional(),
  propertyType: z
    .enum(['apartment', 'coliving', 'boutique_hotel', 'villa', 'eco_lodge'])
    .optional(),
  titleEn: z.string().min(2).max(140).optional(),
  titleVi: z.string().min(2).max(140).optional(),
});

/** Create a new listing as a `draft` stay (Listing ID assigned immediately). */
export async function POST(req: Request) {
  try {
    const user = await requireRole(['host', 'admin']);
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid draft listing payload.');
    }
    const stay = await createDraftStay(user, parsed.data);
    return okJson({ stay }, 201);
  } catch (err) {
    return errJson(err);
  }
}
