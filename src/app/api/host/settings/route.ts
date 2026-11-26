import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { getHostSettings, updateHostSettings } from '@/modules/host-console';

export async function GET() {
  try {
    const user = await requireRole(['host', 'admin']);
    const data = await getHostSettings(user);
    return okJson(data);
  } catch (err) {
    return errJson(err);
  }
}

const schema = z.object({
  displayName: z.string().max(120).optional(),
  contactPhone: z.string().max(40).optional(),
  whatsappNumber: z.string().max(40).optional(),
  zaloHandle: z.string().max(60).optional(),
  payoutMethod: z.string().max(60).optional(),
  bankName: z.string().max(100).optional(),
  bankAccountNumber: z.string().max(60).optional(),
  bankAccountName: z.string().max(120).optional(),
  notifyEmail: z.boolean().optional(),
  notifyInApp: z.boolean().optional(),
  autoIcalSync: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  try {
    const user = await requireRole(['host', 'admin']);
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid host settings payload.');
    }
    const out = await updateHostSettings(user, parsed.data);
    return okJson(out);
  } catch (err) {
    return errJson(err);
  }
}
