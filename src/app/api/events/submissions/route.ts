import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { dbQuery, dbTransaction } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { consumeRateLimit, matchRateLimitRule } from '@/lib/rate-limit';

/**
 * Public event submission (Community spec §6). Anyone may submit — no host or
 * partner relationship required, no account required. Submissions land as
 * status='pending' and never publish themselves. Contact details stay private
 * (organizer_contact / submitter_* columns are never selected by public
 * reads). Anti-spam: honeypot field + IP rate limit + hashed IP stored.
 */

const MAX_TEXT = 2000;

const submissionSchema = z
  .object({
    title: z.string().trim().min(3).max(160),
    organizerName: z.string().trim().min(2).max(160),
    contactName: z.string().trim().min(2).max(120),
    contactEmail: z.string().trim().email().max(200),
    category: z.string().trim().min(1).max(64),
    destinationId: z.string().uuid(),
    venue: z.string().trim().min(2).max(200),
    mapsUrl: z
      .string()
      .trim()
      .max(500)
      .refine((v) => v === '' || /^https?:\/\//.test(v), 'mapsUrl must be a URL')
      .optional()
      .default(''),
    startAt: z.string().min(1),
    endAt: z.string().optional().default(''),
    language: z.string().trim().min(1).max(32),
    imageUrl: z
      .string()
      .trim()
      .max(500)
      .refine((v) => v === '' || /^https?:\/\//.test(v), 'imageUrl must be a URL')
      .optional()
      .default(''),
    description: z.string().trim().min(20).max(MAX_TEXT),
    priceType: z.enum(['free', 'paid']),
    priceAmount: z.coerce.number().positive().max(1_000_000).optional().nullable().default(null),
    priceCurrency: z.string().trim().length(3).optional().default('USD'),
    maxAttendees: z.coerce.number().int().positive().max(100_000).optional().nullable().default(null),
    sourceUrl: z
      .string()
      .trim()
      .max(500)
      .refine((v) => v === '' || /^https?:\/\//.test(v), 'sourceUrl must be a URL')
      .optional()
      .default(''),
    conditions: z.string().trim().max(MAX_TEXT).optional().default(''),
    rightsConfirmed: z.literal(true),
    /** honeypot — must stay empty */
    company: z.string().max(0).optional().default(''),
  })
  .refine((v) => v.priceType === 'free' || (v.priceAmount != null && v.priceAmount > 0), {
    message: 'Paid events need an amount.',
    path: ['priceAmount'],
  });

function slugifyBase(text: string): string {
  const base = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return base || 'event';
}

function clientIp(req: Request): string | null {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip');
}

export async function POST(req: Request) {
  try {
    const ip = clientIp(req);
    const rule = matchRateLimitRule('/api/events/submissions');
    if (rule && ip) {
      const verdict = consumeRateLimit(`events-submissions:${ip}`, rule);
      if (!verdict.ok) {
        return errJson(
          new AppError('VALIDATION_ERROR', 'Too many submissions. Try again later.', 429)
        );
      }
    }

    const body = await req.json();
    const parsed = submissionSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Please review the highlighted fields.');
    }
    const data = parsed.data;

    const destRes = await dbQuery<{ name_en: string; name_vi: string }>(
      'SELECT name_en, name_vi FROM destinations WHERE id = $1',
      [data.destinationId]
    );
    const dest = destRes.rows[0];
    if (!dest) throw new AppError('VALIDATION_ERROR', 'Unknown destination.');

    const startAt = new Date(data.startAt);
    if (Number.isNaN(startAt.getTime())) {
      throw new AppError('VALIDATION_ERROR', 'Invalid start time.');
    }
    let endAt: Date | null = null;
    if (data.endAt) {
      endAt = new Date(data.endAt);
      if (Number.isNaN(endAt.getTime()) || endAt <= startAt) {
        throw new AppError('VALIDATION_ERROR', 'Invalid end time.');
      }
    }

    const idBytes = randomBytes(16);
    idBytes[6] = (idBytes[6] & 0x0f) | 0x40;
    idBytes[8] = (idBytes[8] & 0x3f) | 0x80;
    const idHex = idBytes.toString('hex');
    const id = `${idHex.slice(0, 8)}-${idHex.slice(8, 12)}-${idHex.slice(12, 16)}-${idHex.slice(16, 20)}-${idHex.slice(20)}`;
    const slug = `${slugifyBase(data.title)}-${id.slice(0, 8)}`;
    const ipHash = ip
      ? createHash('sha256').update(`event-sub:${ip}`).digest('hex').slice(0, 32)
      : null;

    await dbTransaction(async (tx) => {
      await tx.query(
        `INSERT INTO nomad_events (
           id, slug, city_en, city_vi, title_en, title_vi, event_date,
           venue_en, venue_vi, spots_total, spots_taken, image_url,
           status, category, language, start_at, end_at,
           price_type, price_amount, price_currency,
           organizer_name, organizer_contact,
           source, source_url, registration_mode,
           description_en, description_vi, conditions_en, conditions_vi,
           maps_url, destination_id,
           submitter_name, submitter_email, rights_confirmed, submitter_ip_hash,
           created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $5, $6,
           $7, $7, $8, 0, NULLIF($9, ''),
           'pending', $10, $11, $12, $13,
           $14, $15, $16,
           $17, $18,
           'partner', NULLIF($19, ''), $20,
           $21, $21, NULLIF($22, ''), NULLIF($22, ''),
           NULLIF($23, ''), $24,
           $25, $26, TRUE, $27,
           NOW(), NOW()
         )`,
        [
          id,
          slug,
          dest.name_en,
          dest.name_vi,
          data.title,
          // legacy event_date stays a readable fallback for old readers
          `${startAt.toISOString().slice(0, 10)}, ${startAt
            .toISOString()
            .slice(11, 16)}`,
          data.venue,
          data.maxAttendees,
          data.imageUrl,
          data.category,
          data.language,
          startAt,
          endAt,
          data.priceType,
          data.priceType === 'paid' ? data.priceAmount : null,
          data.priceType === 'paid' ? data.priceCurrency : 'USD',
          data.organizerName,
          `${data.contactName} <${data.contactEmail}>`,
          data.sourceUrl,
          data.sourceUrl ? 'external' : 'internal',
          data.description,
          data.conditions,
          data.mapsUrl,
          data.destinationId,
          data.contactName,
          data.contactEmail,
          ipHash,
        ]
      );
      await tx.query(
        `INSERT INTO event_moderation_log (id, event_id, action, actor_label, note, created_at)
         VALUES ($1, $2, 'submitted', $3, $4, NOW())`,
        [randomBytes(16).toString('hex').replace(
          /^(.{8})(.{4})(.{4})(.{4})(.{12})$/,
          '$1-$2-$3-$4-$5'
        ), id, `Public submission (${data.contactName})`, 'Public form']
      );
    });

    return okJson({
      submitted: true,
      message:
        'Đã nhận sự kiện của bạn. VietNomad sẽ kiểm duyệt trước khi xuất bản.',
    });
  } catch (err) {
    return errJson(err);
  }
}
