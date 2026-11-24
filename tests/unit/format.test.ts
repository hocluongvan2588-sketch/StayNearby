import { describe, expect, it } from 'vitest';
import {
  addDaysIso,
  computeBookingExpiryUtc,
  countNights,
  enumerateNights,
  formatVnd,
  isValidIsoDate,
} from '@/lib/format';

describe('format helpers and date boundaries', () => {
  it('formats integer VND cleanly for EN and VI', () => {
    expect(formatVnd(1450000, 'en')).toBe('1,450,000 VND');
    expect(formatVnd(1450000, 'vi')).toBe('1.450.000 VND');
  });

  it('uses half-open [checkIn, checkOut) so same-day turnover shares no nights', () => {
    const firstStay = enumerateNights('2026-12-08', '2026-12-10');
    const secondStay = enumerateNights('2026-12-10', '2026-12-12');

    expect(firstStay).toEqual(['2026-12-08', '2026-12-09']);
    expect(secondStay).toEqual(['2026-12-10', '2026-12-11']);

    const intersection = firstStay.filter((d) => secondStay.includes(d));
    expect(intersection).toEqual([]);
    expect(countNights('2026-12-08', '2026-12-10')).toBe(2);
  });

  it('validates calendar dates strictly without rollover', () => {
    expect(isValidIsoDate('2026-02-28')).toBe(true);
    expect(isValidIsoDate('2026-02-29')).toBe(false);
    expect(addDaysIso('2026-12-30', 3)).toBe('2027-01-02');
  });

  it('caps booking expiry before local check-in moment in Asia/Ho_Chi_Minh', () => {
    // Check-in 2026-12-10 14:00 ICT == 2026-12-10 07:00 UTC
    const nearCheckInNow = new Date('2026-12-10T01:00:00Z');
    const expiry = computeBookingExpiryUtc(
      nearCheckInNow,
      '2026-12-10',
      'Asia/Ho_Chi_Minh',
      24
    );
    expect(expiry.toISOString()).toBe('2026-12-10T07:00:00.000Z');

    // Far from check-in -> full 24h timeout
    const farNow = new Date('2026-12-05T10:00:00Z');
    const farExpiry = computeBookingExpiryUtc(
      farNow,
      '2026-12-10',
      'Asia/Ho_Chi_Minh',
      24
    );
    expect(farExpiry.toISOString()).toBe('2026-12-06T10:00:00.000Z');
  });
});
