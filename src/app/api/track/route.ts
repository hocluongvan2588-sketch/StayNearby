import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/session';
import { isValidUuid } from '@/lib/dates';
import { dbQuery } from '@/lib/db';
import { errJson, okJson } from '@/lib/http';

const schema = z.object({
  sessionKey: z.string().min(4).max(120),
  eventName: z.enum(['page_view', 'search', 'stay_view', 'checkout_start', 'booking_completed']),
  stayId: z.string().nullable().optional(),
  bookingId: z.string().nullable().optional(),
  utmSource: z.string().max(80).optional(),
  utmMedium: z.string().max(80).optional(),
  utmCampaign: z.string().max(100).optional(),
  landingPath: z.string().max(240).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return okJson({ ok: false });

    const user = await getCurrentUser().catch(() => null);
    const d = parsed.data;
    await dbQuery(
      `INSERT INTO attribution_events (
        id, session_key, user_id, event_name, stay_id, booking_id,
        utm_source, utm_medium, utm_campaign, landing_path
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        crypto.randomUUID(),
        d.sessionKey,
        user?.id ?? null,
        d.eventName,
        d.stayId && isValidUuid(d.stayId) ? d.stayId : null,
        d.bookingId && isValidUuid(d.bookingId) ? d.bookingId : null,
        d.utmSource ?? '',
        d.utmMedium ?? '',
        d.utmCampaign ?? '',
        d.landingPath ?? '/',
      ]
    );
    return okJson({ ok: true });
  } catch (err) {
    return errJson(err);
  }
}
