import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { PLACE_CATEGORIES, updateStayLocalSuggestion } from '@/modules/host-local-places';

const patchSchema = z.object({
  name: z.string().min(2).max(160).optional(),
  category: z.enum(PLACE_CATEGORIES).optional(),
  address: z.string().max(300).optional(),
  googleMapsUrl: z.string().max(500).optional(),
  reason: z.string().max(500).optional(),
  distanceLabel: z.string().max(80).optional(),
  imageUrl: z.string().max(600).optional(),
});

export async function PATCH(req: Request, context: { params: Promise<{ id: string; sid: string }> }) {
  try {
    const user = await requireRole(['host', 'admin']);
    const { id, sid } = await context.params;
    const body = await req.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid suggestion payload.');
    const out = await updateStayLocalSuggestion(user, id, sid, parsed.data);
    return okJson(out);
  } catch (err) {
    return errJson(err);
  }
}
