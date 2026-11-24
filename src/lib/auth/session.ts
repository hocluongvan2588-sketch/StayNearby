import crypto from 'crypto';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getAppConfig } from '../config';
import { dbQuery } from '../db';
import { AppError } from '../errors';
import { verifyPassword } from './password';

export type RoleCode = 'guest' | 'host' | 'admin';

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  preferredLocale: 'en' | 'vi';
  roles: RoleCode[];
  isDemo: boolean;
}

export const SESSION_COOKIE_NAME = 'staynearby_session';
const SESSION_TTL_SEC = 60 * 60 * 24 * 7; // 7 days

interface TokenPayload {
  uid: string;
  exp: number;
}

function signToken(payload: TokenPayload, secret: string): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', secret)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyToken(token: string, secret: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, providedSig] = parts;
  if (!encoded || !providedSig) return null;

  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(encoded)
    .digest('base64url');

  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as TokenPayload;
    if (!parsed.uid || typeof parsed.exp !== 'number') return null;
    if (parsed.exp <= Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function loadSessionUserById(userId: string): Promise<SessionUser | null> {
  const profileRes = await dbQuery<{
    id: string;
    email: string;
    display_name: string;
    preferred_locale: 'en' | 'vi';
    is_demo: boolean;
  }>(
    `SELECT id, email, display_name, preferred_locale, is_demo
     FROM profiles
     WHERE id = $1`,
    [userId]
  );

  const profile = profileRes.rows[0];
  if (!profile) return null;

  const rolesRes = await dbQuery<{ role_code: RoleCode }>(
    `SELECT role_code FROM user_roles WHERE user_id = $1 ORDER BY role_code ASC`,
    [profile.id]
  );

  return {
    id: profile.id,
    email: profile.email,
    displayName: profile.display_name,
    preferredLocale: profile.preferred_locale,
    roles: rolesRes.rows.map((r) => r.role_code),
    isDemo: profile.is_demo,
  };
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const config = getAppConfig();
  const cookieStore = await cookies();

  if (config.supabase.isConfigured) {
    const hasSupabaseCookie = cookieStore
      .getAll()
      .some((c) => c.name.startsWith('sb-'));
    if (hasSupabaseCookie) {
      try {
        const supabase = createServerClient(
          config.supabase.url,
          config.supabase.anonKey,
          {
            cookies: {
              getAll() {
                return cookieStore.getAll();
              },
              setAll() {
                // Read-only inside Server Components
              },
            },
          }
        );
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user?.id) {
          return await loadSessionUserById(user.id);
        }
      } catch {
        return null;
      }
    }
  }

  const rawCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!rawCookie) return null;

  const verified = verifyToken(rawCookie, config.authSecret);
  if (!verified) return null;

  return loadSessionUserById(verified.uid);
}

export async function authenticateWithPassword(
  email: string,
  password: string
): Promise<SessionUser> {
  const normalizedEmail = email.trim().toLowerCase();
  const res = await dbQuery<{
    id: string;
    password_hash: string | null;
  }>(
    `SELECT id, password_hash FROM profiles WHERE LOWER(email) = $1`,
    [normalizedEmail]
  );

  const row = res.rows[0];
  if (!row || !verifyPassword(password, row.password_hash)) {
    throw new AppError('UNAUTHORIZED', 'Invalid email or password.');
  }

  const user = await loadSessionUserById(row.id);
  if (!user) {
    throw new AppError('UNAUTHORIZED', 'Account profile not found.');
  }
  return user;
}

export function createSessionCookieValue(userId: string): {
  name: string;
  value: string;
  maxAge: number;
} {
  const config = getAppConfig();
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SEC;
  return {
    name: SESSION_COOKIE_NAME,
    value: signToken({ uid: userId, exp }, config.authSecret),
    maxAge: SESSION_TTL_SEC,
  };
}
