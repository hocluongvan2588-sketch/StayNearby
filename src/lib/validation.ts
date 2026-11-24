import { AppError } from './errors';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

export function assertUuid(value: string, fieldName = 'ID'): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!isValidUuid(trimmed)) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Invalid ${fieldName} format.`
    );
  }
  return trimmed;
}
