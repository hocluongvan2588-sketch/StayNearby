import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { getConfig } from '@/lib/config';
import { dbQuery, toNum } from '@/lib/db';
import { AppError } from '@/lib/errors';
import type { CurrencyCode, Locale } from '@/lib/i18n';
import { parseCurrency, parseLocale } from '@/lib/i18n';

export const SESSION_COOKIE_NAME = 'vietnomad_session';

export type UserRole = 'nomad' | 'host' | 'admin';

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  nationality: string;
  preferredLocale: Locale;
  preferredCurrency: CurrencyCode;
  membershipTier: 'free' | 'premium';
  membershipExpiresAt: string | null;
  rewardCreditVnd: number;
  vatTaxId: string | null;
  phone: string | null;
}

interface TokenPayload {
  uid: string;
  exp: number;
}

function signToken(payload: TokenPayload): string {
  const { authSecret } = getConfig();
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', authSecret)
    .update(data)
    .digest('base64url');
  return `${data}.${sig}`;
}

function verifyToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const { authSecret } = getConfig();
  const expectedSig = crypto
    .createHmac('sha256', authSecret)
    .update(data)
    .digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8')) as TokenPayload;
    if (!parsed.uid || typeof parsed.exp !== 'number' || parsed.exp < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function createSessionCookieValue(userId: string): string {
  return signToken({
    uid: userId,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 14,
  });
}

export async function loadUserById(userId: string): Promise<SessionUser | null> {
  const res = await dbQuery<{
    id: string;
    email: string;
    full_name: string;
    role: UserRole;
    nationality: string;
    preferred_locale: string;
    preferred_currency: string;
    membership_tier: 'free' | 'premium';
    membership_expires_at: string | Date | null;
    reward_credit_vnd: string | number;
    vat_tax_id: string | null;
    phone: string | null;
  }>(
    `SELECT id, email, full_name, role, nationality, preferred_locale, preferred_currency,
            membership_tier, membership_expires_at, reward_credit_vnd, vat_tax_id, phone
     FROM users
     WHERE id = $1`,
    [userId]
  );

  const row = res.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    nationality: row.nationality,
    preferredLocale: parseLocale(row.preferred_locale),
    preferredCurrency: parseCurrency(row.preferred_currency),
    membershipTier: row.membership_tier,
    membershipExpiresAt: row.membership_expires_at
      ? new Date(row.membership_expires_at).toISOString()
      : null,
    rewardCreditVnd: toNum(row.reward_credit_vnd, 0),
    vatTaxId: row.vat_tax_id,
    phone: row.phone,
  };
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) return null;
  const payload = verifyToken(raw);
  if (!payload) return null;
  return loadUserById(payload.uid);
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError('UNAUTHORIZED', 'Please sign in to continue.');
  }
  return user;
}

export async function requireRole(roles: UserRole | UserRole[]): Promise<SessionUser> {
  const user = await requireUser();
  const allowed = Array.isArray(roles) ? roles : [roles];
  if (!allowed.includes(user.role)) {
    throw new AppError('FORBIDDEN', 'Your account role cannot access this workspace.');
  }
  return user;
}
