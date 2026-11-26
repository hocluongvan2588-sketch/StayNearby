import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/session';
import { isValidUuid } from '@/lib/dates';
import { dbQuery } from '@/lib/db';
import { errJson, okJson } from '@/lib/http';

const schema = z.object({
  sessionKey: z.string().min(4).max(120),
  visitorId: z.string().max(120).optional(),
  // Client may never spoof server-verified 'booking_completed' events
  eventName: z.enum(['page_view', 'search', 'stay_view', 'checkout_start']),
  stayId: z.string().nullable().optional(),
  utmSource: z.string().max(80).optional(),
  utmMedium: z.string().max(80).optional(),
  utmCampaign: z.string().max(100).optional(),
  utmContent: z.string().max(100).optional(),
  utmTerm: z.string().max(100).optional(),
  referrer: z.string().max(240).optional(),
  landingPath: z.string().max(240).optional(),
  dedupeKey: z.string().max(180).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return okJson({ ok: false });

    const user = await getCurrentUser().catch(() => null);
    const d = parsed.data;
    const landingPath = (d.landingPath ?? '/').trim().slice(0, 240);
    const dedupeKey = (d.dedupeKey ?? '').trim().slice(0, 180);

    // Exclude internal/admin/host backoffice sessions from public funnel metrics
    let isInternal =
      user?.role === 'admin' ||
      landingPath.startsWith('/admin') ||
      landingPath.startsWith('/host');

    if (!isInternal && user) {
      const staffRes = await dbQuery<{ role_id: string }>(
        'SELECT role_id FROM admin_user_roles WHERE user_id = $1 LIMIT 1',
        [user.id]
      );
      if (staffRes.rows.length > 0) isInternal = true;
    }

    if (dedupeKey) {
      const existing = await dbQuery<{ id: string }>(
        'SELECT id FROM attribution_events WHERE dedupe_key = $1 LIMIT 1',
        [dedupeKey]
      );
      if (existing.rows.length > 0) {
        return okJson({ ok: true, deduplicated: true });
      }
    }

    await dbQuery(
      `INSERT INTO attribution_events (
        id, session_key, visitor_id, user_id, event_name, stay_id, booking_id,
        utm_source, utm_medium, utm_campaign, utm_content, utm_term,
        referrer, landing_path, dedupe_key, is_internal
      ) VALUES ($1,$2,$3,$4,$5,$6,NULL,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        crypto.randomUUID(),
        d.sessionKey.trim(),
        (d.visitorId ?? '').trim().slice(0, 120),
        user?.id ?? null,
        d.eventName,
        d.stayId && isValidUuid(d.stayId) ? d.stayId : null,
        (d.utmSource ?? '').trim().slice(0, 80),
        (d.utmMedium ?? '').trim().slice(0, 80),
        (d.utmCampaign ?? '').trim().slice(0, 100),
        (d.utmContent ?? '').trim().slice(0, 100),
        (d.utmTerm ?? '').trim().slice(0, 100),
        (d.referrer ?? '').trim().slice(0, 240),
        landingPath,
        dedupeKey,
        isInternal,
      ]
    );
    return okJson({ ok: true, isInternal });
  } catch (err) {
    return errJson(err);
  }
}
