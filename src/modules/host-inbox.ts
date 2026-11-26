import crypto from 'node:crypto';
import type { SessionUser } from '@/lib/auth/session';
import { getTodayIsoVietnam, isValidUuid } from '@/lib/dates';
import { dbQuery, dbTransaction, toNum } from '@/lib/db';
import { AppError } from '@/lib/errors';

function toIsoDate(val: unknown): string {
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val ?? '').slice(0, 10);
}

function toIsoTimestamp(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Date) return val.toISOString();
  return new Date(String(val)).toISOString();
}

export async function getHostInboxData(
  user: SessionUser,
  params?: { filter?: 'all' | 'unread' | 'in_house' | 'upcoming'; q?: string }
) {
  const today = getTodayIsoVietnam();
  const [convsRes, quickRepliesRes] = await Promise.all([
    dbQuery(
      `SELECT c.*,
              s.title_en AS stay_title_en, s.title_vi AS stay_title_vi, s.slug AS stay_slug, s.hero_image AS stay_image,
              u.full_name AS guest_name, u.email AS guest_email, u.nationality AS guest_nationality, u.phone AS guest_phone,
              b.booking_code, b.status AS booking_status, b.check_in, b.check_out, b.nights,
              b.guests_count, b.pay_at_checkin_vnd, b.wholesale_total_vnd, b.booking_fee_online_vnd
       FROM conversations c
       JOIN stays s ON s.id = c.stay_id
       JOIN users u ON u.id = c.guest_id
       LEFT JOIN bookings b ON b.id = c.booking_id
       WHERE c.host_id = $1
       ORDER BY c.last_message_at DESC`,
      [user.id]
    ),
    dbQuery(
      `SELECT * FROM host_quick_replies WHERE host_id = $1 ORDER BY sort_order ASC, created_at ASC`,
      [user.id]
    ),
  ]);

  const all = convsRes.rows.map((c) => {
    const checkIn = c.check_in ? toIsoDate(c.check_in) : null;
    const checkOut = c.check_out ? toIsoDate(c.check_out) : null;
    const payAtCheckinVnd =
      toNum(c.pay_at_checkin_vnd) > 0
        ? toNum(c.pay_at_checkin_vnd)
        : toNum(c.wholesale_total_vnd);
    return {
      id: String(c.id),
      stayId: String(c.stay_id),
      staySlug: String(c.stay_slug),
      stayTitleEn: String(c.stay_title_en),
      stayTitleVi: String(c.stay_title_vi),
      stayImage: String(c.stay_image),
      bookingId: c.booking_id ? String(c.booking_id) : null,
      bookingCode: c.booking_code ? String(c.booking_code) : null,
      bookingStatus: c.booking_status ? String(c.booking_status) : null,
      checkIn,
      checkOut,
      nights: c.nights ? toNum(c.nights) : null,
      guestsCount: c.guests_count ? toNum(c.guests_count) : null,
      payAtCheckinVnd,
      feeOnlineVnd: toNum(c.booking_fee_online_vnd),
      guestId: String(c.guest_id),
      guestName: String(c.guest_name),
      guestEmail: String(c.guest_email),
      guestNationality: String(c.guest_nationality),
      guestPhone: c.guest_phone ? String(c.guest_phone) : '',
      lastMessagePreview: String(c.last_message_preview ?? ''),
      lastMessageAt: toIsoTimestamp(c.last_message_at),
      unreadCount: toNum(c.host_unread_count),
    };
  });

  const filter = params?.filter ?? 'all';
  const q = (params?.q ?? '').trim().toLowerCase();

  const conversations = all.filter((c) => {
    if (filter === 'unread' && c.unreadCount <= 0) return false;
    if (filter === 'in_house') {
      if (!c.checkIn || !c.checkOut || c.checkIn > today || c.checkOut <= today) return false;
    }
    if (filter === 'upcoming') {
      if (!c.checkIn || c.checkIn <= today) return false;
    }
    if (q) {
      const hay = `${c.guestName} ${c.guestEmail} ${c.stayTitleEn} ${c.stayTitleVi} ${c.bookingCode ?? ''} ${c.lastMessagePreview}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return {
    totalUnread: all.reduce((s, c) => s + c.unreadCount, 0),
    conversations,
    quickReplies: quickRepliesRes.rows.map((qr) => ({
      id: String(qr.id),
      title: String(qr.title),
      body: String(qr.body),
      sortOrder: toNum(qr.sort_order),
    })),
  };
}

export async function getConversationMessages(
  user: SessionUser,
  conversationId: string
) {
  if (!isValidUuid(conversationId)) {
    throw new AppError('VALIDATION_ERROR', 'Invalid conversation ID.');
  }

  return dbTransaction(async (tx) => {
    const convRes = await tx.query<{ id: string; host_id: string; guest_id: string }>(
      `SELECT id, host_id, guest_id FROM conversations WHERE id = $1`,
      [conversationId]
    );
    const conv = convRes.rows[0];
    if (!conv) throw new AppError('NOT_FOUND', 'Conversation not found.');
    const isHost = conv.host_id === user.id || user.role === 'admin';
    const isGuest = conv.guest_id === user.id;
    if (!isHost && !isGuest) {
      throw new AppError('FORBIDDEN', 'You cannot access this conversation.');
    }

    if (isHost) {
      await tx.query(
        `UPDATE conversations SET host_unread_count = 0 WHERE id = $1`,
        [conversationId]
      );
      await tx.query(
        `UPDATE messages SET read_at = COALESCE(read_at, NOW())
         WHERE conversation_id = $1 AND sender_role = 'guest'`,
        [conversationId]
      );
    } else if (isGuest) {
      await tx.query(
        `UPDATE conversations SET guest_unread_count = 0 WHERE id = $1`,
        [conversationId]
      );
      await tx.query(
        `UPDATE messages SET read_at = COALESCE(read_at, NOW())
         WHERE conversation_id = $1 AND sender_role <> 'guest'`,
        [conversationId]
      );
    }

    const msgRes = await tx.query(
      `SELECT m.*, u.full_name AS sender_name
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at ASC`,
      [conversationId]
    );

    return msgRes.rows.map((m) => ({
      id: String(m.id),
      conversationId: String(m.conversation_id),
      senderId: String(m.sender_id),
      senderName: String(m.sender_name),
      senderRole: String(m.sender_role),
      body: String(m.body ?? ''),
      imageUrl: m.image_url ? String(m.image_url) : null,
      readAt: m.read_at ? toIsoTimestamp(m.read_at) : null,
      createdAt: toIsoTimestamp(m.created_at),
    }));
  });
}

export async function sendConversationMessage(
  user: SessionUser,
  conversationId: string,
  input: { body?: string; imageUrl?: string }
) {
  if (!isValidUuid(conversationId)) {
    throw new AppError('VALIDATION_ERROR', 'Invalid conversation ID.');
  }
  const body = (input.body ?? '').trim().slice(0, 4000);
  const imageUrl = input.imageUrl?.trim() || null;
  if (!body && !imageUrl) {
    throw new AppError('VALIDATION_ERROR', 'Message text or image is required.');
  }
  if (
    imageUrl &&
    !imageUrl.startsWith('https://') &&
    !imageUrl.startsWith('/api/uploads/') &&
    !imageUrl.startsWith('/images/')
  ) {
    throw new AppError('VALIDATION_ERROR', 'Invalid attachment image URL.');
  }

  return dbTransaction(async (tx) => {
    const convRes = await tx.query<{ id: string; host_id: string; guest_id: string }>(
      `SELECT id, host_id, guest_id FROM conversations WHERE id = $1 FOR UPDATE`,
      [conversationId]
    );
    const conv = convRes.rows[0];
    if (!conv) throw new AppError('NOT_FOUND', 'Conversation not found.');
    const isHost = conv.host_id === user.id || user.role === 'admin';
    const isGuest = conv.guest_id === user.id;
    if (!isHost && !isGuest) {
      throw new AppError('FORBIDDEN', 'You cannot message this conversation.');
    }

    const senderRole = isHost ? (user.role === 'admin' && conv.host_id !== user.id ? 'admin' : 'host') : 'guest';
    const id = crypto.randomUUID();

    await tx.query(
      `INSERT INTO messages (id, conversation_id, sender_id, sender_role, body, image_url)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, conversationId, user.id, senderRole, body, imageUrl]
    );

    const preview = body || '[Photo attachment]';
    if (senderRole === 'guest') {
      await tx.query(
        `UPDATE conversations
         SET last_message_preview = $1,
             last_message_at = NOW(),
             host_unread_count = host_unread_count + 1
         WHERE id = $2`,
        [preview.slice(0, 140), conversationId]
      );
    } else {
      await tx.query(
        `UPDATE conversations
         SET last_message_preview = $1,
             last_message_at = NOW(),
             guest_unread_count = guest_unread_count + 1,
             host_unread_count = 0
         WHERE id = $2`,
        [preview.slice(0, 140), conversationId]
      );
    }

    return {
      id,
      conversationId,
      senderId: user.id,
      senderName: user.fullName,
      senderRole,
      body,
      imageUrl,
      readAt: null,
      createdAt: new Date().toISOString(),
    };
  });
}

export async function ensureConversationForBooking(
  user: SessionUser,
  bookingId: string
) {
  if (!isValidUuid(bookingId)) throw new AppError('VALIDATION_ERROR', 'Invalid booking ID.');

  return dbTransaction(async (tx) => {
    const bRes = await tx.query<{
      id: string;
      stay_id: string;
      host_id: string;
      guest_id: string;
    }>(
      `SELECT b.id, b.stay_id, s.host_id, b.guest_id
       FROM bookings b
       JOIN stays s ON s.id = b.stay_id
       WHERE b.id = $1`,
      [bookingId]
    );
    const b = bRes.rows[0];
    if (!b) throw new AppError('NOT_FOUND', 'Booking not found.');
    if (b.host_id !== user.id && b.guest_id !== user.id && user.role !== 'admin') {
      throw new AppError('FORBIDDEN', 'You cannot access this booking thread.');
    }

    const existing = await tx.query<{ id: string }>(
      `SELECT id FROM conversations WHERE stay_id = $1 AND guest_id = $2`,
      [b.stay_id, b.guest_id]
    );
    if (existing.rows[0]) {
      await tx.query(
        `UPDATE conversations SET booking_id = COALESCE(booking_id, $1) WHERE id = $2`,
        [b.id, existing.rows[0].id]
      );
      return { conversationId: existing.rows[0].id };
    }

    const id = crypto.randomUUID();
    await tx.query(
      `INSERT INTO conversations (id, stay_id, booking_id, host_id, guest_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, b.stay_id, b.id, b.host_id, b.guest_id]
    );
    return { conversationId: id };
  });
}

export type HostInboxPayload = Awaited<ReturnType<typeof getHostInboxData>>;
export type InboxConversationItem = HostInboxPayload['conversations'][number];
export type InboxMessageItem = Awaited<ReturnType<typeof getConversationMessages>>[number];
export type HostQuickReplyItem = HostInboxPayload['quickReplies'][number];


export async function createHostQuickReply(
  user: SessionUser,
  input: { title: string; body: string }
) {
  const title = input.title.trim();
  const body = input.body.trim();
  if (title.length < 2 || body.length < 4) {
    throw new AppError('VALIDATION_ERROR', 'Quick reply title and message body are required.');
  }
  const id = crypto.randomUUID();
  await dbQuery(
    `INSERT INTO host_quick_replies (id, host_id, title, body, sort_order)
     VALUES ($1, $2, $3, $4, 10)`,
    [id, user.id, title.slice(0, 80), body.slice(0, 1500)]
  );
  return { id, title: title.slice(0, 80), body: body.slice(0, 1500) };
}

export async function deleteHostQuickReply(user: SessionUser, replyId: string) {
  if (!isValidUuid(replyId)) throw new AppError('VALIDATION_ERROR', 'Invalid quick reply ID.');
  await dbQuery(`DELETE FROM host_quick_replies WHERE id = $1 AND host_id = $2`, [
    replyId,
    user.id,
  ]);
  return { ok: true };
}
