import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { confirmSandboxTransaction } from '@/modules/payments';

const schema = z.object({
  transactionId: z.string().uuid(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const raw = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Valid transactionId is required.');
    }

    const result = await confirmSandboxTransaction(user, parsed.data.transactionId);
    return okJson({ payment: result });
  } catch (err) {
    return errJson(err);
  }
}
