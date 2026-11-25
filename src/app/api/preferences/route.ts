import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/session';
import { dbQuery } from '@/lib/db';
import { parseCurrency, parseLocale } from '@/lib/i18n';
import { CURRENCY_COOKIE, LOCALE_COOKIE } from '@/lib/preferences';
import { errJson } from '@/lib/http';

const schema = z.object({
  locale: z.enum(['en', 'vi']).optional(),
  currency: z.string().min(3).max(4).optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: { message: 'Invalid preferences.' } }, { status: 400 });
    }

    const res = NextResponse.json({ ok: true });
    const user = await getCurrentUser();

    if (parsed.data.locale) {
      const loc = parseLocale(parsed.data.locale);
      res.cookies.set(LOCALE_COOKIE, loc, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
      if (user) {
        await dbQuery('UPDATE users SET preferred_locale = $1 WHERE id = $2', [loc, user.id]);
      }
    }

    if (parsed.data.currency) {
      const cur = parseCurrency(parsed.data.currency);
      res.cookies.set(CURRENCY_COOKIE, cur, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
      if (user) {
        await dbQuery('UPDATE users SET preferred_currency = $1 WHERE id = $2', [cur, user.id]);
      }
    }

    return res;
  } catch (err) {
    return errJson(err);
  }
}
