import { requireRole } from '@/lib/auth/rbac';
import type { RoleCode, SessionUser } from '@/lib/auth/session';
import { dbQuery, withTransaction } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { logEvent } from '@/lib/logger';
import { assertUuid } from '@/lib/validation';

export type CrmStage = 'new' | 'active' | 'vip' | 'follow_up' | 'archived';

export const VALID_CRM_STAGES: readonly CrmStage[] = [
  'new',
  'active',
  'vip',
  'follow_up',
  'archived',
];

export interface AdminCrmContact {
  id: string;
  email: string;
  displayName: string;
  phone: string | null;
  preferredLocale: 'en' | 'vi';
  roles: RoleCode[];
  isDemo: boolean;
  crmStage: CrmStage;
  crmNote: string;
  crmUpdatedAt: string | null;
  createdAt: string;
  guestBookingsCount: number;
  guestConfirmedOrCompletedCount: number;
  guestPendingCount: number;
  guestTotalSpentVnd: number;
  lastBookingAt: string | null;
  lastStayTitle: string | null;
  hostListingsCount: number;
  hostPublishedListingsCount: number;
  hostBookingsCount: number;
  hostRevenueVnd: number;
}

export interface AdminCrmSummary {
  totalContacts: number;
  guestsCount: number;
  hostsCount: number;
  vipOrFollowUpCount: number;
  confirmedGmvVnd: number;
}

export interface AdminCrmDashboard {
  summary: AdminCrmSummary;
  contacts: AdminCrmContact[];
}

export interface AdminCrmFilters {
  q?: string;
  role?: 'all' | RoleCode;
  stage?: 'all' | CrmStage;
}

export async function getAdminCrmDashboard(
  actor: SessionUser | null,
  filters?: AdminCrmFilters
): Promise<AdminCrmDashboard> {
  requireRole(actor, 'admin');

  const res = await dbQuery<{
    id: string;
    email: string;
    display_name: string;
    phone: string | null;
    preferred_locale: 'en' | 'vi';
    roles_csv: string | null;
    is_demo: boolean;
    crm_stage: CrmStage;
    crm_note: string;
    crm_updated_at: string | null;
    created_at: string;
    guest_bookings_count: string;
    guest_confirmed_count: string;
    guest_pending_count: string;
    guest_total_spent_vnd: string;
    last_booking_at: string | null;
    last_stay_title: string | null;
    host_listings_count: string;
    host_published_count: string;
    host_bookings_count: string;
    host_revenue_vnd: string;
  }>(
    `SELECT
       p.id,
       p.email,
       p.display_name,
       p.phone,
       p.preferred_locale,
       (
         SELECT STRING_AGG(ur.role_code, ',' ORDER BY ur.role_code ASC)
         FROM user_roles ur
         WHERE ur.user_id = p.id
       ) AS roles_csv,
       p.is_demo,
       p.crm_stage,
       p.crm_note,
       p.crm_updated_at::text AS crm_updated_at,
       p.created_at::text AS created_at,
       (
         SELECT COUNT(*)::text
         FROM bookings b
         WHERE b.guest_id = p.id
       ) AS guest_bookings_count,
       (
         SELECT COUNT(*)::text
         FROM bookings b
         WHERE b.guest_id = p.id AND b.status IN ('confirmed', 'completed')
       ) AS guest_confirmed_count,
       (
         SELECT COUNT(*)::text
         FROM bookings b
         WHERE b.guest_id = p.id AND b.status = 'pending' AND b.expires_at > NOW()
       ) AS guest_pending_count,
       (
         SELECT COALESCE(SUM(b.total_vnd), 0)::text
         FROM bookings b
         WHERE b.guest_id = p.id AND b.status IN ('confirmed', 'completed')
       ) AS guest_total_spent_vnd,
       (
         SELECT MAX(b.created_at)::text
         FROM bookings b
         WHERE b.guest_id = p.id
       ) AS last_booking_at,
       (
         SELECT COALESCE(l.published_title_en, 'Chỗ ở WorkingHome')
         FROM bookings b
         JOIN listings l ON l.id = b.listing_id
         WHERE b.guest_id = p.id
         ORDER BY b.created_at DESC
         LIMIT 1
       ) AS last_stay_title,
       (
         SELECT COUNT(*)::text
         FROM listings l
         WHERE l.host_id = p.id
       ) AS host_listings_count,
       (
         SELECT COUNT(*)::text
         FROM listings l
         WHERE l.host_id = p.id AND l.status = 'published'
       ) AS host_published_count,
       (
         SELECT COUNT(*)::text
         FROM bookings b
         JOIN listings l ON l.id = b.listing_id
         WHERE l.host_id = p.id
       ) AS host_bookings_count,
       (
         SELECT COALESCE(SUM(b.total_vnd), 0)::text
         FROM bookings b
         JOIN listings l ON l.id = b.listing_id
         WHERE l.host_id = p.id AND b.status IN ('confirmed', 'completed')
       ) AS host_revenue_vnd
     FROM profiles p
     ORDER BY
       CASE p.crm_stage
         WHEN 'follow_up' THEN 0
         WHEN 'vip' THEN 1
         WHEN 'active' THEN 2
         WHEN 'new' THEN 3
         ELSE 4
       END,
       p.created_at DESC`
  );

  const allContacts: AdminCrmContact[] = res.rows.map((r) => {
    const roles = (r.roles_csv ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s): s is RoleCode =>
        s === 'guest' || s === 'host' || s === 'admin'
      );

    return {
      id: r.id,
      email: r.email,
      displayName: r.display_name,
      phone: r.phone,
      preferredLocale: r.preferred_locale,
      roles,
      isDemo: Boolean(r.is_demo),
      crmStage: r.crm_stage,
      crmNote: r.crm_note ?? '',
      crmUpdatedAt: r.crm_updated_at,
      createdAt: r.created_at,
      guestBookingsCount: Number(r.guest_bookings_count),
      guestConfirmedOrCompletedCount: Number(r.guest_confirmed_count),
      guestPendingCount: Number(r.guest_pending_count),
      guestTotalSpentVnd: Number(r.guest_total_spent_vnd),
      lastBookingAt: r.last_booking_at,
      lastStayTitle: r.last_stay_title,
      hostListingsCount: Number(r.host_listings_count),
      hostPublishedListingsCount: Number(r.host_published_count),
      hostBookingsCount: Number(r.host_bookings_count),
      hostRevenueVnd: Number(r.host_revenue_vnd),
    };
  });

  const summary: AdminCrmSummary = {
    totalContacts: allContacts.length,
    guestsCount: allContacts.filter((c) => c.roles.includes('guest')).length,
    hostsCount: allContacts.filter((c) => c.roles.includes('host')).length,
    vipOrFollowUpCount: allContacts.filter(
      (c) => c.crmStage === 'vip' || c.crmStage === 'follow_up'
    ).length,
    confirmedGmvVnd: allContacts.reduce(
      (sum, c) => sum + c.guestTotalSpentVnd,
      0
    ),
  };

  const q = filters?.q?.trim().toLowerCase() ?? '';
  const roleFilter = filters?.role ?? 'all';
  const stageFilter = filters?.stage ?? 'all';

  const filtered = allContacts.filter((c) => {
    if (roleFilter !== 'all' && !c.roles.includes(roleFilter)) {
      return false;
    }
    if (stageFilter !== 'all' && c.crmStage !== stageFilter) {
      return false;
    }
    if (q) {
      const hay = [
        c.displayName,
        c.email,
        c.phone ?? '',
        c.crmNote,
        c.lastStayTitle ?? '',
      ]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return {
    summary,
    contacts: filtered,
  };
}

export async function updateAdminCrmProfile(
  actor: SessionUser | null,
  profileId: string,
  input: { crmStage: CrmStage; crmNote: string }
): Promise<AdminCrmContact> {
  const admin = requireRole(actor, 'admin');
  const validProfileId = assertUuid(profileId, 'profile ID');

  if (!VALID_CRM_STAGES.includes(input.crmStage)) {
    throw new AppError('VALIDATION_ERROR', 'Invalid CRM stage.');
  }

  const cleanNote = input.crmNote.trim().slice(0, 2000);

  await withTransaction(
    async (tx) => {
      const existing = await tx.query<{ id: string }>(
        `SELECT id FROM profiles WHERE id = $1 FOR UPDATE`,
        [validProfileId]
      );
      if (!existing.rows[0]) {
        throw new AppError('NOT_FOUND', 'Không tìm thấy hồ sơ người dùng.');
      }

      await tx.query(
        `UPDATE profiles
         SET crm_stage = $2,
             crm_note = $3,
             crm_updated_at = NOW(),
             crm_updated_by = $4,
             updated_at = NOW()
         WHERE id = $1`,
        [validProfileId, input.crmStage, cleanNote, admin.id]
      );
    },
    { actorId: admin.id }
  );

  logEvent('info', 'admin.crm_profile_updated', {
    profileId: validProfileId,
    adminId: admin.id,
    crmStage: input.crmStage,
  });

  const dashboard = await getAdminCrmDashboard(admin);
  const updated = dashboard.contacts.find((c) => c.id === validProfileId);
  if (!updated) {
    throw new AppError('NOT_FOUND', 'Không tìm thấy hồ sơ sau khi cập nhật.');
  }
  return updated;
}
