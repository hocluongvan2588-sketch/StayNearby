import { requireUser } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { getTransactionStatusForUser } from '@/modules/payments';

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const transactionId = url.searchParams.get('transactionId') ?? '';
    if (!transactionId) {
      throw new AppError('VALIDATION_ERROR', 'transactionId query param is required.');
    }
    const transaction = await getTransactionStatusForUser(user, transactionId);
    return okJson({ transaction });
  } catch (err) {
    return errJson(err);
  }
}
