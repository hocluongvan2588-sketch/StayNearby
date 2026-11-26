import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { createHostStayRoom } from '@/modules/host';

const createRoomSchema = z.object({
  nameEn: z.string().min(2).max(120),
  nameVi: z.string().max(120).optional(),
  descriptionEn: z.string().min(4).max(1500),
  descriptionVi: z.string().max(1500).optional(),
  maxGuests: z.number().int().min(1).max(12),
  bedsCount: z.number().int().min(1).max(10),
  unitsTotal: z.number().int().min(1).max(50),
  roomImage: z.string().max(600).optional(),
  roomFeatures: z.array(z.string().min(1).max(60)).max(12).optional(),
  wholesale7Vnd: z.number().positive().optional(),
  wholesale14Vnd: z.number().positive().optional(),
  wholesale21Vnd: z.number().positive().optional(),
  wholesale30Vnd: z.number().positive().optional(),
  extraNightVnd: z.number().positive().optional(),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole(['host', 'admin']);
    const { id: stayId } = await context.params;
    const body = await req.json();
    const parsed = createRoomSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid room details.');
    }
    const out = await createHostStayRoom(user, stayId, parsed.data);
    return okJson(out, 201);
  } catch (err) {
    return errJson(err);
  }
}
