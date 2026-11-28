import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { createGuestServiceRequest, listGuestServiceRequests } from '@/modules/stay-extras';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const requests = await listGuestServiceRequests(user, id);
    return okJson({ requests });
  } catch (err) {
    return errJson(err);
  }
}

const createSchema = z.object({
  serviceId: z.string().uuid(),
  quantity: z.number().int().min(1).max(50).optional(),
  desiredAt: z.string().datetime().optional().nullable(),
  note: z.string().max(1000).optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const raw = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid service request parameters.');
    }
    const request = await createGuestServiceRequest(user, id, parsed.data);
    return okJson({ request }, 201);
  } catch (err) {
    return errJson(err);
  }
}
