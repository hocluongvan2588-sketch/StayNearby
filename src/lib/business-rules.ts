import { AppError } from './errors';

/**
 * Business Rules — single source of truth for stay-length policy.
 *
 * Launch policy (VietNomad):
 * - Database & pricing engine support stays from 1 night up (technical bounds only).
 * - Platform Settings default minimum stay is 7 nights; admins can raise the
 *   platform-wide limit from BOS without code changes or migrations.
 * - Hosts configure a per-listing minimum of 7–90 nights (clamped on write).
 * - Date-level room locks may raise the minimum further for specific nights.
 * - Stay packages stay 7/14/21/30 nights; stays do NOT have to be a multiple of 7.
 *
 * Never hardcode these numbers in components — Search, Pricing, Booking and
 * Checkout all resolve them from here (fed by platform config / DB rows).
 */

/** Technical floor: DB & pricing engine accept stays from 1 night up. */
export const MIN_NIGHTS_TECHNICAL = 1;
/** Technical ceiling: longest bookable stay (nights). */
export const MAX_NIGHTS = 180;

/** Platform-wide policy floor & Platform Settings `default_min_nights` default. */
export const POLICY_MIN_NIGHTS = 7;

/** Host clamp for listing defaults and room-lock minimums (7–90 nights). */
export const HOST_MIN_NIGHTS = 7;
export const HOST_MAX_NIGHTS = 90;

/** Quick-pick package tiers kept across Search & Booking UI (not a hard policy). */
export const STAY_PACKAGE_TIERS = [7, 14, 21, 30] as const;
export type StayPackageTier = (typeof STAY_PACKAGE_TIERS)[number];

function toInt(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? Math.round(n) : Number.NaN;
}

/** Platform Settings `default_min_nights` clamp: [policy floor, technical cap]. */
export function clampPlatformMinNights(value: unknown): number {
  const n = toInt(value);
  if (!Number.isFinite(n)) return POLICY_MIN_NIGHTS;
  return Math.min(MAX_NIGHTS, Math.max(POLICY_MIN_NIGHTS, n));
}

/** Host listing / room-lock minimum clamp: [7, 90] nights. */
export function clampHostMinNights(value: unknown): number {
  const n = toInt(value);
  if (!Number.isFinite(n)) return HOST_MIN_NIGHTS;
  return Math.min(HOST_MAX_NIGHTS, Math.max(HOST_MIN_NIGHTS, n));
}

/**
 * Clamp a stay-length input (search form, URL param) into [minNights, MAX_NIGHTS].
 * Non-numeric input falls back to `minNights`.
 */
export function clampStayNights(
  value: unknown,
  minNights: number = POLICY_MIN_NIGHTS
): number {
  const n = toInt(value);
  if (!Number.isFinite(n)) return clampPlatformMinNights(minNights);
  return Math.min(MAX_NIGHTS, Math.max(clampPlatformMinNights(minNights), n));
}

/**
 * Effective minimum nights for a booking = the strictest of:
 * platform-wide setting × per-listing default × date-level room locks.
 */
export function resolveEffectiveMinNights(params: {
  platformMinNights?: number | null;
  stayMinNights?: number | null;
  lockMinNights?: Array<number | null | undefined>;
}): number {
  const platform = clampPlatformMinNights(
    params.platformMinNights ?? POLICY_MIN_NIGHTS
  );
  const stay =
    params.stayMinNights === null || params.stayMinNights === undefined
      ? platform
      : clampHostMinNights(params.stayMinNights);
  let effective = Math.max(platform, stay);
  for (const lock of params.lockMinNights ?? []) {
    if (lock === null || lock === undefined) continue;
    const n = toInt(lock);
    if (Number.isFinite(n)) effective = Math.max(effective, clampHostMinNights(n));
  }
  return effective;
}

/** Technical bounds only (1–180 nights) — policy floors are applied separately. */
export function assertStayNightsBounds(nights: number): void {
  if (!Number.isInteger(nights) || nights < MIN_NIGHTS_TECHNICAL || nights > MAX_NIGHTS) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Stay must be between ${MIN_NIGHTS_TECHNICAL} and ${MAX_NIGHTS} nights.`
    );
  }
}

/** Full validation: technical bounds + effective policy minimum. */
export function validateStayNights(nights: number, effectiveMinNights: number): void {
  assertStayNightsBounds(nights);
  if (nights < effectiveMinNights) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Selected dates require a minimum stay of ${effectiveMinNights} nights.`
    );
  }
}
