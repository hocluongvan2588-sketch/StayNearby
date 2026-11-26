import crypto from 'node:crypto';
import { getConfig } from '@/lib/config';
import type { DbClient } from '@/lib/db';
import { toNum } from '@/lib/db';
import { formatVndExact } from '@/lib/i18n';

export function buildConciergeWhatsappUrl(params: {
  stayTitle?: string;
  checkIn?: string;
  nights?: number;
  bookingCode?: string;
  phoneOverride?: string;
  locale?: 'en' | 'vi';
}): string {
  const { conciergeWhatsapp } = getConfig();
  const digits = (params.phoneOverride || conciergeWhatsapp).replace(/[^0-9]/g, '');
  const isVi = params.locale === 'vi';

  const parts = isVi
    ? [
        'Xin chào đội ngũ hỗ trợ VietNomad.',
        params.stayTitle ? `Tôi cần tư vấn chỗ ở: ${params.stayTitle}.` : '',
        params.checkIn ? `Ngày nhận phòng dự kiến: ${params.checkIn}.` : '',
        params.nights ? `Thời gian ở: ${params.nights} đêm.` : '',
        params.bookingCode ? `Mã đặt phòng: ${params.bookingCode}.` : '',
        'Nhờ bạn xác nhận tình trạng phòng trống và hướng dẫn đặt giữ chỗ.',
      ]
    : [
        'Hi VietNomad Support,',
        params.stayTitle ? `I have a question about: ${params.stayTitle}.` : '',
        params.checkIn ? `Check-in: ${params.checkIn}.` : '',
        params.nights ? `Stay length: ${params.nights} nights.` : '',
        params.bookingCode ? `Booking Code: ${params.bookingCode}.` : '',
        'Could you confirm availability before I pay the 12% booking fee?',
      ];

  const text = encodeURIComponent(parts.filter(Boolean).join(' '));
  return `https://wa.me/${digits}?text=${text}`;
}

async function maybeSendResendEmail(to: string, subject: string, html: string): Promise<string> {
  const { resendApiKey, resendFromEmail } = getConfig();
  if (!resendApiKey || !to.includes('@')) return 'logged_in_db';

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: resendFromEmail, to: [to], subject, html }),
    });
    return res.ok ? 'sent_via_resend' : `resend_http_${res.status}`;
  } catch {
    return 'logged_fallback';
  }
}

async function maybeSendAdminWebhook(text: string): Promise<string> {
  const { adminAlertWebhookUrl } = getConfig();
  if (!adminAlertWebhookUrl) return 'logged_in_db';

  try {
    const res = await fetch(adminAlertWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    return res.ok ? 'sent_via_webhook' : `webhook_http_${res.status}`;
  } catch {
    return 'logged_fallback';
  }
}

export async function dispatchBookingLockedNotifications(
  tx: DbClient,
  bookingId: string
): Promise<void> {
  const res = await tx.query<{
    id: string;
    booking_code: string;
    check_in: string | Date;
    check_out: string | Date;
    nights: number;
    guests_count: number;
    booking_fee_online_vnd: string | number;
    pay_at_checkin_vnd: string | number;
    guest_total_vnd: string | number;
    stay_title: string;
    exact_address: string;
    checkin_instructions_en: string;
    wifi_download_mbps: number;
    wifi_upload_mbps: number;
    wifi_jitter_ms: number;
    verification_tier: string;
    speedtest_proof_url: string | null;
    host_whatsapp: string;
    room_name: string;
    guest_name: string;
    guest_email: string;
    host_name: string;
    host_email: string;
  }>(
    `SELECT b.id, b.booking_code, b.check_in, b.check_out, b.nights, b.guests_count,
            b.booking_fee_online_vnd, b.pay_at_checkin_vnd, b.guest_total_vnd,
            s.title_en AS stay_title, s.exact_address, s.checkin_instructions_en,
            s.wifi_download_mbps, s.wifi_upload_mbps, s.wifi_jitter_ms,
            s.verification_tier, s.speedtest_proof_url, s.host_whatsapp,
            r.name_en AS room_name,
            gu.full_name AS guest_name, gu.email AS guest_email,
            hu.full_name AS host_name, hu.email AS host_email
     FROM bookings b
     JOIN stays s ON s.id = b.stay_id
     JOIN stay_rooms r ON r.id = b.room_id
     JOIN users gu ON gu.id = b.guest_id
     JOIN users hu ON hu.id = s.host_id
     WHERE b.id = $1`,
    [bookingId]
  );

  const row = res.rows[0];
  if (!row) return;

  const checkIn =
    row.check_in instanceof Date
      ? row.check_in.toISOString().slice(0, 10)
      : String(row.check_in).slice(0, 10);
  const checkOut =
    row.check_out instanceof Date
      ? row.check_out.toISOString().slice(0, 10)
      : String(row.check_out).slice(0, 10);

  const feeOnlineVnd = toNum(row.booking_fee_online_vnd);
  const payAtCheckinVnd = toNum(row.pay_at_checkin_vnd);
  const totalVnd = toNum(row.guest_total_vnd);

  const hostWhatsappLink = buildConciergeWhatsappUrl({
    stayTitle: row.stay_title,
    checkIn,
    nights: toNum(row.nights),
    bookingCode: row.booking_code,
    phoneOverride: row.host_whatsapp,
  });

  const guestSubject = `[${row.booking_code}] Confirmed: ${row.stay_title} (Wi-Fi certificate included)`;
  const guestPayload = {
    bookingCode: row.booking_code,
    stayTitle: row.stay_title,
    roomName: row.room_name,
    checkIn,
    checkOut,
    nights: toNum(row.nights),
    paidOnline12PctVnd: feeOnlineVnd,
    dueAtCheckinHostVnd: payAtCheckinVnd,
    totalStayVnd: totalVnd,
    exactAddress: row.exact_address,
    checkinInstructions: row.checkin_instructions_en,
    hostName: row.host_name,
    hostWhatsapp: row.host_whatsapp,
    hostWhatsappLink,
    wifiCertificate: {
      downloadMbps: toNum(row.wifi_download_mbps),
      uploadMbps: toNum(row.wifi_upload_mbps),
      jitterMs: toNum(row.wifi_jitter_ms),
      verificationTier: row.verification_tier,
      speedtestProofUrl: row.speedtest_proof_url,
    },
    guaranteeNote:
      '100% booking fee refund guarantee if Wi-Fi or workspace at check-in falls below this certificate.',
  };

  const guestStatus = await maybeSendResendEmail(
    row.guest_email,
    guestSubject,
    `<h2>${guestSubject}</h2>
     <p>Paid online (12% booking fee): <strong>${formatVndExact(feeOnlineVnd)}</strong></p>
     <p>Due at check-in (pay directly to host): <strong>${formatVndExact(payAtCheckinVnd)}</strong></p>
     <p>Address: ${row.exact_address}</p>
     <p>Verified Wi-Fi: ${row.wifi_download_mbps} Mbps down / ${row.wifi_upload_mbps} Mbps up (${row.wifi_jitter_ms}ms latency)</p>`
  );

  const hostSubject = `[New Booking ${row.booking_code}] ${row.guest_name}, collect ${formatVndExact(payAtCheckinVnd)} at check-in`;
  const hostPayload = {
    bookingCode: row.booking_code,
    guestName: row.guest_name,
    guestsCount: toNum(row.guests_count),
    roomName: row.room_name,
    checkIn,
    checkOut,
    nights: toNum(row.nights),
    deposit12Locked: true,
    collectAtCheckinVnd: payAtCheckinVnd,
    pledgeNote:
      'Guest paid the 12% booking fee online. Dates are locked; collect 100% of rent directly at check-in.',
  };

  const hostStatus = await maybeSendResendEmail(
    row.host_email,
    hostSubject,
    `<h2>${hostSubject}</h2>
     <p>Guest: ${row.guest_name} (${checkIn} to ${checkOut}, ${row.nights} nights)</p>
     <p>12% booking fee settled online. Please hold the room and collect <strong>${formatVndExact(payAtCheckinVnd)}</strong> directly at check-in.</p>`
  );

  const adminSubject = `[Admin Alert] Booking ${row.booking_code} locked, message ${row.host_name} on Zalo within 30 minutes`;
  const adminPayload = {
    bookingCode: row.booking_code,
    stayTitle: row.stay_title,
    hostName: row.host_name,
    hostWhatsapp: row.host_whatsapp,
    confirmWithinMinutes: 30,
    actionRequired: `Message host ${row.host_name} via Zalo or WhatsApp (${row.host_whatsapp}) within 30 minutes to confirm check-in readiness.`,
  };
  const adminStatus = await maybeSendAdminWebhook(
    `${adminSubject} | Guest: ${row.guest_name} (${checkIn} to ${checkOut}) | Host: ${row.host_whatsapp}`
  );

  const records = [
    {
      role: 'guest',
      channel: 'email',
      contact: row.guest_email,
      subject: guestSubject,
      payload: guestPayload,
      status: guestStatus,
    },
    {
      role: 'host',
      channel: 'email',
      contact: row.host_email,
      subject: hostSubject,
      payload: hostPayload,
      status: hostStatus,
    },
    {
      role: 'admin',
      channel: 'webhook',
      contact: row.host_whatsapp,
      subject: adminSubject,
      payload: adminPayload,
      status: adminStatus,
    },
  ] as const;

  for (const rec of records) {
    await tx.query(
      `INSERT INTO booking_notifications (
        id, booking_id, recipient_role, channel, recipient_contact, subject, payload_json, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        crypto.randomUUID(),
        row.id,
        rec.role,
        rec.channel,
        rec.contact,
        rec.subject,
        JSON.stringify(rec.payload),
        rec.status,
      ]
    );
  }
}
