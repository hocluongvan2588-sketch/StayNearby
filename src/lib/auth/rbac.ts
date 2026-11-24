import { AppError } from '../errors';
import type { RoleCode, SessionUser } from './session';

export function requireAuth(user: SessionUser | null): SessionUser {
  if (!user) {
    throw new AppError('UNAUTHORIZED', 'Authentication required.');
  }
  return user;
}

export function hasRole(user: SessionUser | null, role: RoleCode): boolean {
  if (!user) return false;
  return user.roles.includes(role);
}

export function requireRole(
  user: SessionUser | null,
  role: RoleCode | RoleCode[]
): SessionUser {
  const authed = requireAuth(user);
  const allowed = Array.isArray(role) ? role : [role];
  const matches = allowed.some((r) => authed.roles.includes(r));
  if (!matches) {
    throw new AppError(
      'FORBIDDEN',
      `Required role (${allowed.join(' or ')}) is missing.`
    );
  }
  return authed;
}

export function assertListingOwnership(
  user: SessionUser | null,
  listingHostId: string
): SessionUser {
  const authed = requireAuth(user);
  if (authed.roles.includes('admin')) return authed;
  if (authed.roles.includes('host') && authed.id === listingHostId) {
    return authed;
  }
  throw new AppError(
    'FORBIDDEN',
    'You do not have permission to manage this listing.'
  );
}

export function assertBookingParticipant(
  user: SessionUser | null,
  params: { guestId: string; hostId: string }
): SessionUser {
  const authed = requireAuth(user);
  if (authed.roles.includes('admin')) return authed;
  if (authed.id === params.guestId) return authed;
  if (authed.roles.includes('host') && authed.id === params.hostId) return authed;
  throw new AppError(
    'FORBIDDEN',
    'You do not have permission to access this booking.'
  );
}

/**
 * Exact check-in address and instructions are strictly protected.
 * Only exposed to:
 *  - Admin with permission
 *  - Owning host of the listing
 *  - Guest with a confirmed or completed booking for that listing
 */
export function canViewCheckinDetails(params: {
  user: SessionUser | null;
  listingHostId: string;
  bookingGuestId?: string;
  bookingStatus?: string;
}): boolean {
  const { user, listingHostId, bookingGuestId, bookingStatus } = params;
  if (!user) return false;
  if (user.roles.includes('admin')) return true;
  if (user.roles.includes('host') && user.id === listingHostId) return true;
  if (
    bookingGuestId &&
    user.id === bookingGuestId &&
    (bookingStatus === 'confirmed' || bookingStatus === 'completed')
  ) {
    return true;
  }
  return false;
}
