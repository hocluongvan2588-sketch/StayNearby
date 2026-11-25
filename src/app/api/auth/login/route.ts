import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyPassword } from '@/lib/auth/password';
import { createSessionCookieValue, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { dbQuery } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { errJson } from '@/lib/http';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Please enter a valid email and password.');
    }

    const email = parsed.data.email.trim().toLowerCase();
    const userRes = await dbQuery<{
      id: string;
      email: string;
      password_hash: string;
      full_name: string;
      role: string;
    }>('SELECT id, email, password_hash, full_name, role FROM users WHERE LOWER(email) = $1', [
      email,
    ]);

    const user = userRes.rows[0];
    if (!user || !verifyPassword(parsed.data.password, user.password_hash)) {
      throw new AppError('UNAUTHORIZED', 'Invalid email or password.');
    }

    const token = createSessionCookieValue(user.id);
    const res = NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
      },
    });
    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 14,
    });
    return res;
  } catch (err) {
    return errJson(err);
  }
}
