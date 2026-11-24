import { describe, expect, it } from 'vitest';
import { AppError, localizeError } from '@/lib/errors';

describe('standardized errors', () => {
  it('serializes AppError with expected HTTP status and code', () => {
    const err = new AppError('PRICE_CHANGED', 'Rate updated', {
      previousTotal: 1000000,
      newTotal: 1200000,
    });

    expect(err.status).toBe(409);
    expect(err.toJSON()).toEqual({
      ok: false,
      error: {
        code: 'PRICE_CHANGED',
        message: 'Rate updated',
        details: { previousTotal: 1000000, newTotal: 1200000 },
      },
    });
  });

  it('provides clear localized EN and VI guidance for core error codes', () => {
    expect(localizeError('DATES_UNAVAILABLE', 'en')).toContain('no longer available');
    expect(localizeError('DATES_UNAVAILABLE', 'vi')).toContain('không còn trống');
    expect(localizeError('FORBIDDEN', 'vi')).toContain('không có quyền');
    expect(localizeError('REQUEST_EXPIRED', 'en')).toContain('deadline');
  });
});
