import { describe, expect, it } from 'vitest';
import { addDaysIso, enumerateStayNights, isValidIsoDate } from '@/lib/dates';
import {
  SUPPORTED_CURRENCIES,
  formatBookingStatusLabel,
  formatBusinessModelLabel,
  formatCmsTypeLabel,
  formatCountNoun,
  formatMoneyFromVnd,
  formatNightsLabel,
  formatPlaceCategoryLabel,
  parseCurrency,
  parseLocale,
  pickText,
} from '@/lib/i18n';

describe('Bilingual EN/VI, 9-Currency Conversion & Vietnam Date Helpers', () => {
  it('supports all 9 currencies and formats consistently', () => {
    expect(SUPPORTED_CURRENCIES.map((c) => c.code)).toEqual([
      'USD',
      'EUR',
      'VND',
      'GBP',
      'AUD',
      'SGD',
      'JPY',
      'KRW',
      'THB',
    ]);
    expect(parseCurrency('eur')).toBe('EUR');
    expect(parseCurrency('unknown')).toBe('USD');
    expect(formatMoneyFromVnd(25_400_000, 'USD')).toBe('$1,000');
    expect(formatMoneyFromVnd(25_400_000, 'VND')).toContain('₫');
  });

  it('normalizes EN/VI locales and picks localized text', () => {
    expect(parseLocale('vi')).toBe('vi');
    expect(parseLocale('fr')).toBe('en');
    expect(pickText('en', 'English Stay', 'Chỗ ở Tiếng Việt')).toBe('English Stay');
    expect(pickText('vi', 'English Stay', 'Chỗ ở Tiếng Việt')).toBe('Chỗ ở Tiếng Việt');
  });

  it('generates exact stay night sequence for calendar locking', () => {
    expect(addDaysIso('2026-12-01', 7)).toBe('2026-12-08');
    const nights = enumerateStayNights('2026-12-01', '2026-12-08');
    expect(nights).toHaveLength(7);
    expect(nights[0]).toBe('2026-12-01');
    expect(nights[6]).toBe('2026-12-07');
    expect(isValidIsoDate('2026-12-01')).toBe(true);
    expect(isValidIsoDate('2026-02-31')).toBe(false);
  });

  it('formats plural nouns, booking statuses, CMS types, and place categories per Content Design System', () => {
    expect(formatNightsLabel(1, 'en')).toBe('1 night');
    expect(formatNightsLabel(7, 'en')).toBe('7 nights');
    expect(formatNightsLabel(7, 'vi')).toBe('7 đêm');

    expect(formatCountNoun(1, 'stay', 'stays', 'chỗ ở', 'en')).toBe('1 stay');
    expect(formatCountNoun(5, 'stay', 'stays', 'chỗ ở', 'en')).toBe('5 stays');
    expect(formatCountNoun(5, 'stay', 'stays', 'chỗ ở', 'vi')).toBe('5 chỗ ở');

    expect(formatBookingStatusLabel('RESERVED_LOCKED', 'en')).toBe('Confirmed');
    expect(formatBookingStatusLabel('RESERVED_LOCKED', 'vi')).toBe('Đã xác nhận');
    expect(formatBusinessModelLabel('booking_flow', 'en')).toBe('Book on VietNomad');
    expect(formatBusinessModelLabel('booking_flow', 'en')).not.toContain('BookingFlow');

    expect(formatCmsTypeLabel('destination_guide', 'vi')).toBe('Cẩm nang thành phố');
    expect(formatPlaceCategoryLabel('cafe_roastery', 'vi')).toBe('Quán cà phê');
  });
});
