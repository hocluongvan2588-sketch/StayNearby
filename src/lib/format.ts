import { AppError } from './errors';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Format integer VND consistently across EN and VI views.
 */
export function formatVnd(amount: number, locale: 'en' | 'vi' = 'en'): string {
  const safeInt = Math.round(amount);
  const formatted = new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    maximumFractionDigits: 0,
  }).format(safeInt);
  return `${formatted} VND`;
}

export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

export function parseIsoDateToUtcMidnight(value: string): Date {
  if (!isValidIsoDate(value)) {
    throw new AppError('VALIDATION_ERROR', `Invalid date format: ${value}`);
  }
  const [y, m, d] = value.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatUtcDateToIso(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysIso(isoDate: string, days: number): string {
  const dt = parseIsoDateToUtcMidnight(isoDate);
  dt.setUTCDate(dt.getUTCDate() + days);
  return formatUtcDateToIso(dt);
}

/**
 * Half-open stay interval [checkIn, checkOut).
 * Example: checkIn='2026-12-10', checkOut='2026-12-12' => ['2026-12-10', '2026-12-11'] (2 nights).
 * A checkout on 2026-12-12 does not lock 2026-12-12, allowing same-day turnover.
 */
export function enumerateNights(checkIn: string, checkOut: string): string[] {
  const start = parseIsoDateToUtcMidnight(checkIn);
  const end = parseIsoDateToUtcMidnight(checkOut);
  if (end.getTime() <= start.getTime()) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Check-out date must be after check-in date.'
    );
  }
  const diffDays = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays > 180) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Maximum booking window is 180 nights per request.'
    );
  }
  const nights: string[] = [];
  for (let i = 0; i < diffDays; i++) {
    nights.push(addDaysIso(checkIn, i));
  }
  return nights;
}

export function countNights(checkIn: string, checkOut: string): number {
  return enumerateNights(checkIn, checkOut).length;
}

/**
 * Current local calendar date (YYYY-MM-DD) in the stay's IANA timezone.
 */
export function getTodayIsoInTimezone(
  timezone = 'Asia/Ho_Chi_Minh',
  now: Date = new Date()
): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * Computes the UTC instant corresponding to 00:00:00 of an ISO date in an IANA timezone.
 * Used so host response deadlines always end before check-in day in the property's timezone.
 */
export function localDateStartToUtc(isoDate: string, timezone = 'Asia/Ho_Chi_Minh'): Date {
  if (!isValidIsoDate(isoDate)) {
    throw new AppError('VALIDATION_ERROR', `Invalid date: ${isoDate}`);
  }
  const [y, m, d] = isoDate.split('-').map(Number);
  // Estimate UTC midnight, then compute offset in target timezone using Intl.
  const utcGuess = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(utcGuess);

  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const tzAsUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour === '24' ? '0' : map.hour),
    Number(map.minute),
    Number(map.second)
  );
  const offsetMs = tzAsUtc - utcGuess.getTime();
  return new Date(utcGuess.getTime() - offsetMs);
}

export function computeBookingExpiryUtc(
  nowUtc: Date,
  checkInIso: string,
  timezone = 'Asia/Ho_Chi_Minh',
  timeoutHours = 24
): Date {
  const timeoutDeadline = new Date(nowUtc.getTime() + timeoutHours * 60 * 60 * 1000);
  // Check-in window starts at 14:00 local time on checkIn day, or 00:00 if stricter.
  // Spec: "kết thúc trước thời điểm nhận phòng" (14:00 local time on check-in date).
  const checkInLocalMidnightUtc = localDateStartToUtc(checkInIso, timezone);
  const checkInMomentUtc = new Date(checkInLocalMidnightUtc.getTime() + 14 * 60 * 60 * 1000);
  return timeoutDeadline.getTime() < checkInMomentUtc.getTime()
    ? timeoutDeadline
    : checkInMomentUtc;
}

export function formatShortDate(isoDate: string, locale: 'en' | 'vi' = 'en'): string {
  const dt = parseIsoDateToUtcMidnight(isoDate);
  return new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(dt);
}
