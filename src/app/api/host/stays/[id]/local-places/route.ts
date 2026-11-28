import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import {
  createStayLocalSuggestion,
  listStayLocalPlaces,
  PLACE_CATEGORIES,
} from '@/modules/host-local-places';

const createSchema = z.union([
  z.object({
    placeId: z.string().uuid(),
    reason: z.string().max(500).optional(),
    distanceLabel: z.string().max(80).optional(),
  }),
  z.object({
    name: z.string().min(2).max(160),
    category: z.enum(PLACE_CATEGORIES),
    address: z.string().max(300).optional(),
    googleMapsUrl: z.string().max(500).optional(),
    reason: z.string().max(500).optional(),
    distanceLabel: z.string().max(80).optional(),
    imageUrl: z.string().max(600).optional(),
  }),
]);

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(['host', 'admin']);
    const { id } = await context.params;
    const data = await listStayLocalPlaces(user, id);
    return okJson(data);
  } catch (err) {
    return errJson(err);
  }
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(['host', 'admin']);
    const { id } = await context.params;
    const body = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid suggestion payload.');
    const out = await createStayLocalSuggestion(user, id, parsed.data);
    return okJson(out, 201);
  } catch (err) {
    return errJson(err);
  }
}
