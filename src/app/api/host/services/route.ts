import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { getStayServicesForHost, upsertStayService } from '@/modules/stay-extras';

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const stayId = new URL(req.url).searchParams.get('stayId');
    if (!stayId) throw new AppError('VALIDATION_ERROR', 'stayId is required.');
    const services = await getStayServicesForHost(user, stayId);
    return okJson({ services });
  } catch (err) {
    return errJson(err);
  }
}

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  stayId: z.string().uuid(),
  catalogId: z.string().uuid(),
  enabled: z.boolean().optional(),
  priceVnd: z.number().int().min(0).max(100_000_000).nullable().optional(),
  priceUnit: z.enum(['day', 'week', 'month', 'trip', 'visit', 'quote']).optional(),
  isIncluded: z.boolean().optional(),
  descriptionEn: z.string().max(1000).optional(),
  descriptionVi: z.string().max(1000).optional(),
  conditionsEn: z.string().max(1000).optional(),
  conditionsVi: z.string().max(1000).optional(),
  depositVnd: z.number().int().min(0).max(100_000_000).nullable().optional(),
  leadTimeHours: z.number().int().min(0).max(24 * 30).nullable().optional(),
  providerType: z.enum(['host', 'third_party']).optional(),
  changeCancelEn: z.string().max(1000).optional(),
  changeCancelVi: z.string().max(1000).optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const raw = await req.json().catch(() => ({}));
    const parsed = upsertSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid service parameters.');
    }
    const service = await upsertStayService(user, parsed.data);
    return okJson({ service }, 201);
  } catch (err) {
    return errJson(err);
  }
}
