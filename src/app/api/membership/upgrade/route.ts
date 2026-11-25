import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { dbQuery } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';

const schema = z.object({
  vatTaxId: z.string().max(50).optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid VAT Tax ID.');

    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString();
    const cleanVat = parsed.data.vatTaxId?.trim() || user.vatTaxId || null;

    await dbQuery(
      `UPDATE users
       SET membership_tier = 'premium',
           membership_expires_at = $1,
           vat_tax_id = $2
       WHERE id = $3`,
      [expiresAt, cleanVat, user.id]
    );

    return okJson({ membershipTier: 'premium', vatTaxId: cleanVat, expiresAt });
  } catch (err) {
    return errJson(err);
  }
}
