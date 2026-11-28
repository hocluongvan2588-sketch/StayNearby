/**
 * Edge-safe fixed-window rate limiter (in-memory, per server instance).
 *
 * Used by proxy.ts to throttle mutating API traffic (brute-force login,
 * booking spam, AI concierge abuse). Pure JS — no Node-only APIs, so it runs
 * in the proxy runtime. Buckets are keyed per client IP + path; entries
 * expire with their window and the map is pruned opportunistically.
 */

export interface RateLimitRule {
  /** Pathname prefix this rule applies to, e.g. '/api/auth/login'. */
  prefix: string;
  /** Window length in seconds. */
  windowSec: number;
  /** Maximum requests per window per key. */
  max: number;
}

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the current window resets (for Retry-After). */
  retryAfterSec: number;
}

/** Stricter overrides, matched before the default rule (longest prefix wins by order). */
const RULES: RateLimitRule[] = [
  { prefix: '/api/auth/register', windowSec: 60, max: 5 },
  { prefix: '/api/auth/login', windowSec: 60, max: 10 },
  { prefix: '/api/concierge', windowSec: 60, max: 12 },
  { prefix: '/api/payments/checkout', windowSec: 60, max: 20 },
  { prefix: '/api/promotions/validate', windowSec: 60, max: 30 },
  { prefix: '/api/support', windowSec: 60, max: 20 },
  { prefix: '/api/events/submissions', windowSec: 3600, max: 5 },
  { prefix: '/api/uploads', windowSec: 60, max: 30 },
  { prefix: '/api/bookings', windowSec: 60, max: 30 },
];

/** Generous fallback for every other POST/PUT/PATCH/DELETE under /api/. */
export const DEFAULT_API_RULE: RateLimitRule = { prefix: '/api/', windowSec: 60, max: 60 };

/** Server-to-server endpoints that must never be throttled. */
const EXEMPT_PREFIXES = ['/api/webhooks/', '/api/cron/', '/api/health'];

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Resolve the rule for a pathname, or null when the path is exempt/unmatched. */
export function matchRateLimitRule(pathname: string): RateLimitRule | null {
  for (const exempt of EXEMPT_PREFIXES) {
    if (pathname.startsWith(exempt)) return null;
  }
  for (const rule of RULES) {
    if (pathname.startsWith(rule.prefix)) return rule;
  }
  if (pathname.startsWith(DEFAULT_API_RULE.prefix)) return DEFAULT_API_RULE;
  return null;
}

function pruneExpired(now: number): void {
  if (buckets.size < 2000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Record one request against `key` under `rule`.
 * `now` is injectable for tests; defaults to the wall clock.
 */
export function consumeRateLimit(
  key: string,
  rule: RateLimitRule,
  now: number = Date.now()
): RateLimitResult {
  pruneExpired(now);
  const windowMs = rule.windowSec * 1000;
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: rule.windowSec };
  }
  if (existing.count >= rule.max) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
  }
  existing.count += 1;
  return { ok: true, retryAfterSec: Math.ceil((existing.resetAt - now) / 1000) };
}

/** Test hook: drop all state between cases. */
export function resetRateLimits(): void {
  buckets.clear();
}
