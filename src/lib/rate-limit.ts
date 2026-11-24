import { AppError } from './errors';

interface BucketEntry {
  timestamps: number[];
}

const buckets = new Map<string, BucketEntry>();

export interface RateLimitConfig {
  bucket: string;
  key: string;
  limit: number;
  windowMs: number;
}

export function checkRateLimit(config: RateLimitConfig): {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
} {
  const now = Date.now();
  const fullKey = `${config.bucket}:${config.key}`;
  const existing = buckets.get(fullKey) ?? { timestamps: [] };
  const cutoff = now - config.windowMs;
  const fresh = existing.timestamps.filter((ts) => ts > cutoff);

  if (fresh.length >= config.limit) {
    const oldest = fresh[0] ?? now;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + config.windowMs - now) / 1000));
    buckets.set(fullKey, { timestamps: fresh });
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec,
    };
  }

  fresh.push(now);
  buckets.set(fullKey, { timestamps: fresh });
  return {
    allowed: true,
    remaining: Math.max(0, config.limit - fresh.length),
    retryAfterSec: 0,
  };
}

export function assertRateLimit(config: RateLimitConfig): void {
  const result = checkRateLimit(config);
  if (!result.allowed) {
    throw new AppError(
      'RATE_LIMITED',
      `Too many requests. Retry after ${result.retryAfterSec} seconds.`,
      { retryAfterSec: result.retryAfterSec, bucket: config.bucket }
    );
  }
}

export function resetRateLimitsForTests(): void {
  buckets.clear();
}
