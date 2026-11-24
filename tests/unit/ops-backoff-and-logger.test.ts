import { describe, expect, it } from 'vitest';
import { getTodayIsoInTimezone } from '@/lib/format';
import { formatLogRecord, redactSensitiveData } from '@/lib/logger';
import { assertUuid, isValidUuid } from '@/lib/validation';
import { computeOutboxBackoffSeconds } from '@/modules/ops';

describe('Operational backoff, structured log redaction, UUID validation, and timezone clock', () => {
  it('computes exponential backoff schedule capped at 3600 seconds', () => {
    expect(computeOutboxBackoffSeconds(1)).toBe(30);
    expect(computeOutboxBackoffSeconds(2)).toBe(120);
    expect(computeOutboxBackoffSeconds(3)).toBe(600);
    expect(computeOutboxBackoffSeconds(4)).toBe(1800);
    expect(computeOutboxBackoffSeconds(5)).toBe(3600);
    expect(computeOutboxBackoffSeconds(9)).toBe(3600);
  });

  it('redacts passwords, tokens, exact addresses, and check-in instructions from structured logs', () => {
    const redacted = redactSensitiveData({
      bookingId: '11111111-1111-4111-8111-111111111101',
      password: 'SecretPassword!',
      authSecret: 'my-secret',
      exactAddress: '48 Quảng Khánh, Tây Hồ',
      checkin_instructions_en: 'Door code #9999',
      nested: {
        token: 'jwt-123',
        host_contact_phone: '+84 900 111 222',
        safeField: 'visible',
      },
    }) as Record<string, unknown>;

    expect(redacted.bookingId).toBe('11111111-1111-4111-8111-111111111101');
    expect(redacted.password).toBe('[REDACTED]');
    expect(redacted.authSecret).toBe('[REDACTED]');
    expect(redacted.exactAddress).toBe('[REDACTED]');
    expect(redacted.checkin_instructions_en).toBe('[REDACTED]');

    const nested = redacted.nested as Record<string, unknown>;
    expect(nested.token).toBe('[REDACTED]');
    expect(nested.host_contact_phone).toBe('[REDACTED]');
    expect(nested.safeField).toBe('visible');

    const log = formatLogRecord('info', 'audit.test', { cookie: 'abc', count: 3 });
    expect(log.level).toBe('info');
    expect(log.event).toBe('audit.test');
    expect(log.data?.cookie).toBe('[REDACTED]');
    expect(log.data?.count).toBe(3);
  });

  it('validates UUID formats strictly without throwing raw errors', () => {
    expect(isValidUuid('11111111-1111-4111-8111-111111111101')).toBe(true);
    expect(isValidUuid('not-a-uuid')).toBe(false);
    expect(assertUuid(' 11111111-1111-4111-8111-111111111101 ', 'test ID')).toBe(
      '11111111-1111-4111-8111-111111111101'
    );
    expect(() => assertUuid('../etc/passwd', 'booking ID')).toThrow(/Invalid booking ID/);
  });

  it('evaluates local calendar date using stay timezone at custom UTC instants', () => {
    // 2026-12-01 20:00 UTC is already 2026-12-02 03:00 in Asia/Ho_Chi_Minh (+07:00)
    const lateUtc = new Date('2026-12-01T20:00:00.000Z');
    expect(getTodayIsoInTimezone('Asia/Ho_Chi_Minh', lateUtc)).toBe('2026-12-02');
    expect(getTodayIsoInTimezone('UTC', lateUtc)).toBe('2026-12-01');
  });
});
