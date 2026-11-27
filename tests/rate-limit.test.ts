import { beforeEach, describe, expect, it } from 'vitest';
import {
  consumeRateLimit,
  DEFAULT_API_RULE,
  matchRateLimitRule,
  resetRateLimits,
} from '@/lib/rate-limit';

beforeEach(() => resetRateLimits());

describe('matchRateLimitRule', () => {
  it('picks stricter overrides before the default', () => {
    expect(matchRateLimitRule('/api/auth/login')?.max).toBe(10);
    expect(matchRateLimitRule('/api/auth/register')?.max).toBe(5);
    expect(matchRateLimitRule('/api/concierge')?.max).toBe(12);
    expect(matchRateLimitRule('/api/bookings')?.max).toBe(30);
  });

  it('falls back to the default rule for other api paths', () => {
    expect(matchRateLimitRule('/api/stays')).toEqual(DEFAULT_API_RULE);
    expect(matchRateLimitRule('/api/saved')).toEqual(DEFAULT_API_RULE);
  });

  it('exempts server-to-server endpoints', () => {
    expect(matchRateLimitRule('/api/webhooks/stripe')).toBeNull();
    expect(matchRateLimitRule('/api/cron/sync')).toBeNull();
    expect(matchRateLimitRule('/api/health')).toBeNull();
  });

  it('ignores non-api paths', () => {
    expect(matchRateLimitRule('/stays/hanoi-loft')).toBeNull();
    expect(matchRateLimitRule('/dashboard')).toBeNull();
  });
});

describe('consumeRateLimit', () => {
  it('allows up to max requests inside one window', () => {
    const rule = { prefix: '/api/test', windowSec: 60, max: 3 };
    const now = 1_000_000;
    expect(consumeRateLimit('k', rule, now).ok).toBe(true);
    expect(consumeRateLimit('k', rule, now + 1).ok).toBe(true);
    expect(consumeRateLimit('k', rule, now + 2).ok).toBe(true);
    const blocked = consumeRateLimit('k', rule, now + 3);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(blocked.retryAfterSec).toBeLessThanOrEqual(60);
  });

  it('resets after the window expires', () => {
    const rule = { prefix: '/api/test', windowSec: 60, max: 1 };
    const now = 2_000_000;
    expect(consumeRateLimit('k', rule, now).ok).toBe(true);
    expect(consumeRateLimit('k', rule, now + 1000).ok).toBe(false);
    expect(consumeRateLimit('k', rule, now + 60_000).ok).toBe(true);
  });

  it('keeps keys independent', () => {
    const rule = { prefix: '/api/test', windowSec: 60, max: 1 };
    const now = 3_000_000;
    expect(consumeRateLimit('ip-a', rule, now).ok).toBe(true);
    expect(consumeRateLimit('ip-a', rule, now).ok).toBe(false);
    expect(consumeRateLimit('ip-b', rule, now).ok).toBe(true);
  });
});
