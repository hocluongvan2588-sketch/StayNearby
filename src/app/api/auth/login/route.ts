import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  authenticateWithPassword,
  createSessionCookieValue,
} from '@/lib/auth/session';
import { getClientIp, handleApiError } from '@/lib/http';
import { assertRateLimit } from '@/lib/rate-limit';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = loginSchema.parse(await req.json());
    const ip = getClientIp(req);

    assertRateLimit({
      bucket: 'auth_login',
      key: `${ip}:${body.email.toLowerCase()}`,
      limit: 10,
      windowMs: 60_000,
    });

    const user = await authenticateWithPassword(body.email, body.password);
    const cookie = createSessionCookieValue(user.id);

    const isHttps =
      req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() === 'https' ||
      req.nextUrl.protocol === 'https:';

    const res = NextResponse.json({ ok: true, user });
    res.cookies.set(cookie.name, cookie.value, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: cookie.maxAge,
      secure: isHttps,
    });
    return res;
  } catch (err) {
    return handleApiError(err);
  }
}
