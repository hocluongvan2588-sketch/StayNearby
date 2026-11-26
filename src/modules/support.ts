import crypto from 'node:crypto';
import type { SessionUser } from '@/lib/auth/session';
import { isValidUuid } from '@/lib/dates';
import { dbQuery, dbTransaction } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { triggerAutomationTask } from '@/modules/admin-bos/shared';

export type GuestFriendlySupportCategory =
  | 'booking'
  | 'property_wifi'
  | 'payment'
  | 'general'
  | 'booking_issue'
  | 'payment_refund'
  | 'checkin_access'
  | 'listing_accuracy'
  | 'account'
  | 'other';

function mapToDbSupportCategory(input: GuestFriendlySupportCategory): {
  category:
    | 'booking_issue'
    | 'payment_refund'
    | 'checkin_access'
    | 'listing_accuracy'
    | 'account'
    | 'other';
  defaultSubCategory: string;
} {
  switch (input) {
    case 'property_wifi':
    case 'listing_accuracy':
      return { category: 'listing_accuracy', defaultSubCategory: 'wifi_or_property_issue' };
    case 'payment':
    case 'payment_refund':
      return { category: 'payment_refund', defaultSubCategory: 'payment_or_refund' };
    case 'checkin_access':
      return { category: 'checkin_access', defaultSubCategory: 'checkin_access' };
    case 'booking':
    case 'booking_issue':
      return { category: 'booking_issue', defaultSubCategory: 'booking_inquiry' };
    case 'account':
      return { category: 'account', defaultSubCategory: 'account_help' };
    case 'general':
    case 'other':
    default:
      return { category: 'other', defaultSubCategory: 'general_support' };
  }
}

export function sanitizeSupportAttachments(raw?: string[]): string[] {
  if (!Array.isArray(raw)) return [];
  const safe: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed || trimmed.length > 600) continue;
    if (
      trimmed.startsWith('https://') ||
      trimmed.startsWith('http://') ||
      trimmed.startsWith('/api/uploads/') ||
      trimmed.startsWith('/images/')
    ) {
      safe.push(trimmed);
    }
    if (safe.length >= 5) break;
  }
  return safe;
}

export async function listGuestSupportTickets(userId: string) {
  const ticketsRes = await dbQuery<{
    id: string;
    ticket_code: string;
    category: string;
    issue_sub_category: string | null;
    priority: string;
    status: string;
    booking_id: string | null;
    booking_code: string | null;
    stay_id: string | null;
    stay_title_en: string | null;
    stay_title_vi: string | null;
    subject: string;
    description: string;
    resolution_summary: string;
    attachments: unknown;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT t.*, b.booking_code, s.title_en AS stay_title_en, s.title_vi AS stay_title_vi
     FROM support_tickets t
     LEFT JOIN bookings b ON b.id = t.booking_id
     LEFT JOIN stays s ON s.id = t.stay_id
     WHERE t.guest_id = $1
     ORDER BY t.updated_at DESC, t.created_at DESC`,
    [userId]
  );

  const ticketIds = ticketsRes.rows.map((r) => String(r.id));
  const msgRes =
    ticketIds.length > 0
      ? await dbQuery<{
          id: string;
          ticket_id: string;
          sender_id: string | null;
          sender_name: string | null;
          sender_role: string | null;
          body: string;
          attachments: unknown;
          created_at: string;
        }>(
          `SELECT m.id, m.ticket_id, m.sender_id, m.body, m.attachments, m.created_at,
                  u.full_name AS sender_name, u.role AS sender_role
           FROM support_ticket_messages m
           LEFT JOIN users u ON u.id = m.sender_id
           WHERE m.ticket_id = ANY($1::uuid[]) AND m.is_internal_note = FALSE
           ORDER BY m.created_at ASC`,
          [ticketIds]
        )
      : { rows: [] };

  const messagesByTicket = new Map<
    string,
    Array<{
      id: string;
      senderId: string | null;
      senderName: string;
      senderRole: string;
      body: string;
      attachments: string[];
      createdAt: string;
    }>
  >();

  for (const m of msgRes.rows) {
    const tid = String(m.ticket_id);
    const list = messagesByTicket.get(tid) ?? [];
    let att: string[] = [];
    if (Array.isArray(m.attachments)) att = m.attachments.map(String);
    else if (typeof m.attachments === 'string') {
      try {
        const parsed = JSON.parse(m.attachments);
        if (Array.isArray(parsed)) att = parsed.map(String);
      } catch {
        att = [];
      }
    }
    list.push({
      id: String(m.id),
      senderId: m.sender_id ? String(m.sender_id) : null,
      senderName: m.sender_name ? String(m.sender_name) : 'VietNomad Support',
      senderRole: m.sender_role ? String(m.sender_role) : 'support',
      body: String(m.body),
      attachments: att,
      createdAt: new Date(String(m.created_at)).toISOString(),
    });
    messagesByTicket.set(tid, list);
  }

  return ticketsRes.rows.map((t) => {
    let att: string[] = [];
    if (Array.isArray(t.attachments)) att = t.attachments.map(String);
    else if (typeof t.attachments === 'string') {
      try {
        const parsed = JSON.parse(t.attachments);
        if (Array.isArray(parsed)) att = parsed.map(String);
      } catch {
        att = [];
      }
    }
    return {
      id: String(t.id),
      ticketCode: String(t.ticket_code),
      category: String(t.category),
      issueSubCategory: String(t.issue_sub_category ?? ''),
      priority: String(t.priority),
      status: String(t.status),
      bookingId: t.booking_id ? String(t.booking_id) : null,
      bookingCode: t.booking_code ? String(t.booking_code) : null,
      stayId: t.stay_id ? String(t.stay_id) : null,
      stayTitleEn: t.stay_title_en ? String(t.stay_title_en) : null,
      stayTitleVi: t.stay_title_vi ? String(t.stay_title_vi) : null,
      subject: String(t.subject),
      description: String(t.description ?? ''),
      resolutionSummary: String(t.resolution_summary ?? ''),
      attachments: att,
      messages: messagesByTicket.get(String(t.id)) ?? [],
      createdAt: new Date(String(t.created_at)).toISOString(),
      updatedAt: new Date(String(t.updated_at)).toISOString(),
    };
  });
}

export async function createGuestSupportTicket(
  user: SessionUser,
  input: {
    category: GuestFriendlySupportCategory;
    issueSubCategory?: string;
    bookingId?: string | null;
    stayId?: string | null;
    subject: string;
    description: string;
    attachments?: string[];
  }
) {
  const mapped = mapToDbSupportCategory(input.category);
  const subCat = (input.issueSubCategory?.trim() || mapped.defaultSubCategory).slice(0, 80);
  const subject = input.subject.trim();
  const description = input.description.trim();
  if (subject.length < 4 || description.length < 6) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Please enter a subject (min 4 chars) and description (min 6 chars).'
    );
  }

  const attachments = sanitizeSupportAttachments(input.attachments);
  const priority: 'low' | 'medium' | 'high' | 'urgent' =
    mapped.category === 'checkin_access' || subCat === 'wifi_speed_mismatch'
      ? 'high'
      : 'medium';
  const slaHours = priority === 'high' ? 6 : 24;

  const created = await dbTransaction(async (tx) => {
    let resolvedBookingId: string | null = null;
    let resolvedStayId: string | null = null;
    let resolvedHostId: string | null = null;

    if (input.bookingId) {
      if (!isValidUuid(input.bookingId)) {
        throw new AppError('VALIDATION_ERROR', 'Invalid booking reference.');
      }
      const bRes = await tx.query<{ id: string; guest_id: string; stay_id: string; host_id: string }>(
        `SELECT b.id, b.guest_id, b.stay_id, s.host_id
         FROM bookings b
         JOIN stays s ON s.id = b.stay_id
         WHERE b.id = $1`,
        [input.bookingId]
      );
      const bRow = bRes.rows[0];
      if (!bRow) throw new AppError('NOT_FOUND', 'Booking not found.');
      if (bRow.guest_id !== user.id && user.role !== 'admin') {
        throw new AppError('FORBIDDEN', 'You can only open support tickets for your own bookings.');
      }
      resolvedBookingId = bRow.id;
      resolvedStayId = bRow.stay_id;
      resolvedHostId = bRow.host_id;
    } else if (input.stayId && isValidUuid(input.stayId)) {
      const sRes = await tx.query<{ id: string; host_id: string }>(
        'SELECT id, host_id FROM stays WHERE id = $1',
        [input.stayId]
      );
      if (sRes.rows[0]) {
        resolvedStayId = sRes.rows[0].id;
        resolvedHostId = sRes.rows[0].host_id;
      }
    }

    const ticketId = crypto.randomUUID();
    const msgId = crypto.randomUUID();
    const ticketCode = `SUP-${new Date().getFullYear()}-${crypto
      .randomBytes(3)
      .toString('hex')
      .toUpperCase()}`;

    await tx.query(
      `INSERT INTO support_tickets (
        id, ticket_code, category, issue_sub_category, priority, status,
        booking_id, stay_id, host_id, guest_id, sla_due_at,
        subject, description, attachments
      ) VALUES (
        $1,$2,$3,$4,$5,'open',$6,$7,$8,$9, NOW() + ($10 || ' hours')::interval,
        $11,$12,$13::jsonb
      )`,
      [
        ticketId,
        ticketCode,
        mapped.category,
        subCat,
        priority,
        resolvedBookingId,
        resolvedStayId,
        resolvedHostId,
        user.id,
        String(slaHours),
        subject,
        description,
        JSON.stringify(attachments),
      ]
    );

    await tx.query(
      `INSERT INTO support_ticket_messages (
        id, ticket_id, sender_id, is_internal_note, body, attachments
      ) VALUES ($1,$2,$3,FALSE,$4,$5::jsonb)`,
      [msgId, ticketId, user.id, description, JSON.stringify(attachments)]
    );

    return { ticketId, ticketCode, priority, slaHours, category: mapped.category, issueSubCategory: subCat };
  });

  await triggerAutomationTask({
    ruleKey: 'auto_task_support_ticket',
    title: `Support ${created.ticketCode}: ${subject}`,
    description: `[${created.category}/${created.issueSubCategory}] ${description.slice(0, 300)}`,
    entityType: 'ticket',
    entityId: created.ticketId,
    createdBy: user.id,
    fallbackPriority: created.priority,
    fallbackDueHours: created.slaHours,
  });

  return {
    id: created.ticketId,
    ticketCode: created.ticketCode,
    status: 'open' as const,
    category: created.category,
    issueSubCategory: created.issueSubCategory,
  };
}

export async function replyToGuestSupportTicket(
  user: SessionUser,
  ticketId: string,
  input: {
    body: string;
    attachments?: string[];
  }
) {
  if (!isValidUuid(ticketId)) {
    throw new AppError('VALIDATION_ERROR', 'Invalid support ticket ID.');
  }
  const cleanBody = input.body.trim();
  if (cleanBody.length < 2 || cleanBody.length > 3000) {
    throw new AppError('VALIDATION_ERROR', 'Reply message must be between 2 and 3000 characters.');
  }
  const attachments = sanitizeSupportAttachments(input.attachments);

  return dbTransaction(async (tx) => {
    const tRes = await tx.query<{
      id: string;
      ticket_code: string;
      guest_id: string | null;
      status: string;
      assigned_staff_id: string | null;
    }>(
      'SELECT id, ticket_code, guest_id, status, assigned_staff_id FROM support_tickets WHERE id = $1 FOR UPDATE',
      [ticketId]
    );
    const ticket = tRes.rows[0];
    if (!ticket) throw new AppError('NOT_FOUND', 'Support ticket not found.');
    if (ticket.guest_id !== user.id && user.role !== 'admin') {
      throw new AppError('FORBIDDEN', 'You cannot reply to another member’s support ticket.');
    }
    if (ticket.status === 'closed') {
      throw new AppError('CONFLICT', 'This ticket is closed. Please open a new ticket.');
    }

    const msgId = crypto.randomUUID();
    await tx.query(
      `INSERT INTO support_ticket_messages (
        id, ticket_id, sender_id, is_internal_note, body, attachments
      ) VALUES ($1,$2,$3,FALSE,$4,$5::jsonb)`,
      [msgId, ticket.id, user.id, cleanBody, JSON.stringify(attachments)]
    );

    const nextStatus =
      ticket.status === 'waiting_user' || ticket.status === 'resolved' ? 'open' : ticket.status;

    await tx.query(
      `UPDATE support_tickets
       SET status = $1, updated_at = NOW()
       WHERE id = $2`,
      [nextStatus, ticket.id]
    );

    return {
      messageId: msgId,
      ticketId: ticket.id,
      ticketCode: ticket.ticket_code,
      status: nextStatus,
    };
  });
}
