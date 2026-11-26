import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { deleteHostStayRoom, updateHostStayRoom } from '@/modules/host';

const updateRoomSchema = z.object({
  nameEn: z.string().min(2).max(120).optional(),
  nameVi: z.string().min(2).max(120).optional(),
  descriptionEn: z.string().min(4).max(1500).optional(),
  descriptionVi: z.string().min(4).max(1500).optional(),
  maxGuests: z.number().int().min(1).max(12).optional(),
  bedsCount: z.number().int().min(1).max(10).optional(),
  unitsTotal: z.number().int().min(1).max(50).optional(),
  roomImage: z.string().min(1).max(600).optional(),
  roomFeatures: z.array(z.string().min(1).max(60)).max(12).optional(),
  wholesale7Vnd: z.number().positive().optional(),
  wholesale14Vnd: z.number().positive().optional(),
  wholesale21Vnd: z.number().positive().optional(),
  wholesale30Vnd: z.number().positive().optional(),
  extraNightVnd: z.number().positive().optional(),
});

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string; roomId: string }> }
) {
  try {
    const user = await requireRole(['host', 'admin']);
    const { id: stayId, roomId } = await context.params;
    const body = await req.json();
    const parsed = updateRoomSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid room update data.');
    }
    const out = await updateHostStayRoom(user, stayId, roomId, parsed.data);
    return okJson(out);
  } catch (err) {
    return errJson(err);
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string; roomId: string }> }
) {
  try {
    const user = await requireRole(['host', 'admin']);
    const { id: stayId, roomId } = await context.params;
    const out = await deleteHostStayRoom(user, stayId, roomId);
    return okJson(out);
  } catch (err) {
    return errJson(err);
  }
}
