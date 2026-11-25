import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hashPassword } from '@/lib/auth/password';
import { createSessionCookieValue, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { dbQuery } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { errJson } from '@/lib/http';

const schema = z.object({
  fullName: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  nationality: z.string().min(2).max(60).optional(),
  role: z.enum(['nomad', 'host']).optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Name, email, and 8+ character password are required.');
    }

    const email = parsed.data.email.trim().toLowerCase();
    const existing = await dbQuery('SELECT id FROM users WHERE LOWER(email) = $1', [email]);
    if (existing.rows[0]) {
      throw new AppError('CONFLICT', 'An account with this email already exists.');
    }

    const id = crypto.randomUUID();
    const role = parsed.data.role ?? 'nomad';
    const passwordHash = hashPassword(parsed.data.password);

    await dbQuery(
      `INSERT INTO users (id, email, password_hash, full_name, role, nationality, crm_stage)
       VALUES ($1,$2,$3,$4,$5,$6,'lead')`,
      [id, email, passwordHash, parsed.data.fullName.trim(), role, parsed.data.nationality?.trim() || 'International']
    );

    if (role === 'host') {
      await dbQuery(
        'INSERT INTO host_wallets (host_id, balance_vnd) VALUES ($1, 0) ON CONFLICT DO NOTHING',
        [id]
      );
    }

    const res = NextResponse.json(
      { ok: true, user: { id, email, fullName: parsed.data.fullName.trim(), role } },
      { status: 201 }
    );
    res.cookies.set(SESSION_COOKIE_NAME, createSessionCookieValue(id), {
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
