import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError } from '@/lib/http';
import { SUPPORTED_CURRENCIES, normalizeCurrency } from '@/lib/i18n/currency';
import { resolveUserPreferencesFromInput } from '@/lib/i18n/geo';
import {
  PREFERENCE_COOKIE_MAX_AGE,
  USER_CURRENCY_COOKIE,
  USER_LOCALE_COOKIE,
} from '@/lib/i18n/preferences';

export const dynamic = 'force-dynamic';

const updatePreferencesSchema = z.object({
  locale: z.enum(['en', 'vi', 'auto']).optional(),
  currency: z
    .string()
    .refine(
      (val) =>
        val === 'auto' || normalizeCurrency(val) !== null,
      { message: 'Unsupported currency code.' }
    )
    .optional(),
});

export async function GET(req: NextRequest) {
  try {
    const cookieLocale = req.cookies.get(USER_LOCALE_COOKIE)?.value ?? null;
    const cookieCurrency = req.cookies.get(USER_CURRENCY_COOKIE)?.value ?? null;

    const preferences = resolveUserPreferencesFromInput({
      headers: req.headers,
      cookieLocale,
      cookieCurrency,
    });

    return NextResponse.json({
      ok: true,
      preferences,
      supportedCurrencies: SUPPORTED_CURRENCIES,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = updatePreferencesSchema.parse(await req.json());

    let nextLocale = req.cookies.get(USER_LOCALE_COOKIE)?.value ?? null;
    if (body.locale === 'auto') {
      nextLocale = null;
    } else if (body.locale) {
      nextLocale = body.locale;
    }

    let nextCurrency = req.cookies.get(USER_CURRENCY_COOKIE)?.value ?? null;
    if (body.currency === 'auto') {
      nextCurrency = null;
    } else if (body.currency) {
      nextCurrency = normalizeCurrency(body.currency);
    }

    const preferences = resolveUserPreferencesFromInput({
      headers: req.headers,
      cookieLocale: nextLocale,
      cookieCurrency: nextCurrency,
    });

    const isHttps =
      req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() === 'https' ||
      req.nextUrl.protocol === 'https:';

    const res = NextResponse.json({ ok: true, preferences });

    if (nextLocale === null) {
      res.cookies.delete(USER_LOCALE_COOKIE);
    } else {
      res.cookies.set(USER_LOCALE_COOKIE, nextLocale, {
        httpOnly: false,
        sameSite: 'lax',
        path: '/',
        maxAge: PREFERENCE_COOKIE_MAX_AGE,
        secure: isHttps,
      });
    }

    if (nextCurrency === null) {
      res.cookies.delete(USER_CURRENCY_COOKIE);
    } else {
      res.cookies.set(USER_CURRENCY_COOKIE, nextCurrency, {
        httpOnly: false,
        sameSite: 'lax',
        path: '/',
        maxAge: PREFERENCE_COOKIE_MAX_AGE,
        secure: isHttps,
      });
    }

    return res;
  } catch (err) {
    return handleApiError(err);
  }
}
