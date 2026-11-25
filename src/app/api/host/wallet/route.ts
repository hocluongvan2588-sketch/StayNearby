import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { topUpHostAdWallet } from '@/modules/host';

const schema = z.object({
  amountUsd: z.union([z.literal(50), z.literal(100), z.literal(200)]),
});

export async function POST(req: Request) {
  try {
    const user = await requireRole(['host', 'admin']);
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Select $50, $100, or $200.');
    const out = await topUpHostAdWallet(user, parsed.data.amountUsd);
    return okJson(out);
  } catch (err) {
    return errJson(err);
  }
}
