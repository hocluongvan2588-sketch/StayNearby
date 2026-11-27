import { AppError } from '@/lib/errors';

/**
 * Listing lifecycle — single source of truth for stay status transitions.
 *
 *   draft → pending_review → live   (host submits, admin moderates)
 *
 * Host Applications (`host_applications`) are a separate CRM/acquisition
 * pipeline: approving an application must NEVER create or publish a stay.
 * The stay is always created by the host (draft) and reviewed in place.
 */

/** Statuses from which the host may submit a draft for review. */
export function assertHostSubmitForReview(currentStatus: string): void {
  if (currentStatus === 'draft') return;
  throw new AppError(
    'VALIDATION_ERROR',
    currentStatus === 'pending_review'
      ? 'This listing is already pending review.'
      : 'Only draft listings can be submitted for review.'
  );
}

/** Statuses an admin moderation action may promote to `live` from. */
const CAN_GO_LIVE_FROM = new Set([
  'pending_review',
  'live',
  'limited',
  'paused',
  'rejected',
]);

/**
 * Admin moderation guard: a draft must go through the host's submit step
 * (draft → pending_review) before it can be published live.
 */
export function assertAdminStatusTransition(
  currentStatus: string,
  nextStatus: string
): void {
  if (currentStatus === nextStatus) return;
  if (nextStatus === 'live' && !CAN_GO_LIVE_FROM.has(currentStatus)) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Draft listings must be submitted for review by the host before going live.'
    );
  }
}
