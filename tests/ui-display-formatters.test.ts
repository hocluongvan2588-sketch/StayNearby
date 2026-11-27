import { describe, expect, it } from 'vitest';
import {
  formatCountryLabel,
  formatDistanceLabel,
  formatHostDisplayName,
  formatShortDateLabel,
  formatStayLocationLabel,
} from '@/lib/i18n';

describe('Guest UI display formatters', () => {
  it('dedupes repeated address segments (area, city, city)', () => {
    expect(
      formatStayLocationLabel(['Bán đảo Sơn Trà, Đà Nẵng', 'Đà Nẵng'])
    ).toBe('Bán đảo Sơn Trà, Đà Nẵng');
    expect(formatStayLocationLabel(['Sơn Trà', 'Đà Nẵng'])).toBe(
      'Sơn Trà, Đà Nẵng'
    );
    expect(formatStayLocationLabel(['Thảo Điền', null, undefined, ''])).toBe(
      'Thảo Điền'
    );
    // Case-insensitive dedupe across parts
    expect(formatStayLocationLabel(['Hai Bà Trưng, Hà Nội', 'hà nội'])).toBe(
      'Hai Bà Trưng, Hà Nội'
    );
  });

  it('localizes country names without touching unknown values', () => {
    expect(formatCountryLabel('Vietnam', 'vi')).toBe('Việt Nam');
    expect(formatCountryLabel('Vietnam', 'en')).toBe('Vietnam');
    expect(formatCountryLabel('Thailand', 'vi')).toBe('Thái Lan');
    expect(formatCountryLabel('Iceland', 'vi')).toBe('Iceland');
    expect(formatCountryLabel(null, 'vi')).toBe('');
  });

  it('localizes distance labels from data and never invents walk times', () => {
    expect(formatDistanceLabel('4 min walk', 'vi')).toBe('4 phút đi bộ');
    expect(formatDistanceLabel('4 min walk', 'en')).toBe('4 min walk');
    expect(formatDistanceLabel('1.2 km', 'vi')).toBe('1,2 km');
    expect(formatDistanceLabel('1.2 km', 'en')).toBe('1.2 km');
    expect(formatDistanceLabel('400 m', 'vi')).toBe('400 m');
    expect(formatDistanceLabel('0 km', 'vi')).toBe('Ngay tại chỗ ở');
    expect(formatDistanceLabel('0 km', 'en')).toBe('On-site');
    // Unknown formats pass through — nothing is fabricated
    expect(formatDistanceLabel('Near the beach', 'vi')).toBe('Near the beach');
    expect(formatDistanceLabel(null, 'vi')).toBe('');
  });

  it('strips internal admin handles from host display names only', () => {
    expect(formatHostDisplayName('Admin (hocluongvan2588)')).toBe('Admin');
    expect(formatHostDisplayName('Nguyen Van A (host)')).toBe(
      'Nguyen Van A (host)'
    );
    expect(formatHostDisplayName('Trần Thị B')).toBe('Trần Thị B');
    expect(formatHostDisplayName('')).toBe('');
  });

  it('formats short dates by locale without falling back to "today"', () => {
    expect(formatShortDateLabel('2026-11-25T00:00:00.000Z', 'vi')).toBe(
      '25/11/2026'
    );
    expect(formatShortDateLabel(null, 'vi')).toBe('');
    expect(formatShortDateLabel('not-a-date', 'en')).toBe('');
  });
});
