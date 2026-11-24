import { beforeEach, describe, expect, it } from 'vitest';
import { assertRateLimit, resetRateLimitsForTests } from '@/lib/rate-limit';

describe('sliding window rate limiting', () => {
  beforeEach(() => {
    resetRateLimitsForTests();
  });

  it('allows up to configured limit then rejects with RATE_LIMITED', () => {
    for (let i = 0; i < 3; i++) {
      assertRateLimit({
        bucket: 'auth_login',
        key: '127.0.0.1:guest@workinghome.demo',
        limit: 3,
        windowMs: 60_000,
      });
    }

    expect(() =>
      assertRateLimit({
        bucket: 'auth_login',
        key: '127.0.0.1:guest@workinghome.demo',
        limit: 3,
        windowMs: 60_000,
      })
    ).toThrow(/Too many requests/i);
  });
});
