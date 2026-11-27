import crypto from 'node:crypto';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { dbQuery } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';

export async function GET(
  _req: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const res = await dbQuery(
      `SELECT r.*, u.full_name AS guest_name
       FROM stay_reviews r
       JOIN stays s ON s.id = r.stay_id
       JOIN users u ON u.id = r.guest_id
       WHERE s.slug = $1
       ORDER BY r.created_at DESC`,
      [slug]
    );
    return okJson({ reviews: res.rows });
  } catch (err) {
    return errJson(err);
  }
}

const createSchema = z.object({
  bookingId: z.string().uuid().optional(),
  rating: z.number().min(1).max(5),
  cleanlinessRating: z.number().int().min(1).max(5).default(5),
  communicationRating: z.number().int().min(1).max(5).default(5),
  workspaceRating: z.number().int().min(1).max(5).default(5),
  locationRating: z.number().int().min(1).max(5).default(5),
  comment: z.string().min(4).max(2000),
  // Wi-Fi quality (Phase A): optional, completed stays only; absent = skipped.
  speed: z.number().int().min(1).max(5).optional(),
  stability: z.number().int().min(1).max(5).optional(),
  workFromHome: z.number().int().min(1).max(5).optional(),
  wifiComment: z.string().trim().max(1000).optional(),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const user = await requireUser();
    const { slug } = await context.params;
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Please enter a valid rating and review comment.');
    }

    const stayRes = await dbQuery<{ id: string }>(
      'SELECT id FROM stays WHERE slug = $1',
      [slug]
    );
    const stay = stayRes.rows[0];
    if (!stay) throw new AppError('NOT_FOUND', 'Stay not found.');

    // Verify guest has an eligible booking for this stay (checked-in/locked)
    const eligibleRes = await dbQuery<{ id: string; status: string }>(
      `SELECT id, status FROM bookings
       WHERE stay_id = $1 AND guest_id = $2
         AND status IN ('RESERVED_LOCKED', 'CHECKED_IN_COMPLETED', 'confirmed', 'completed')
       ORDER BY created_at DESC LIMIT 1`,
      [stay.id, user.id]
    );
    const bookingId = parsed.data.bookingId ?? eligibleRes.rows[0]?.id ?? null;
    let bookingStatus: string | null = eligibleRes.rows[0]?.status ?? null;
    if (bookingId && bookingId !== eligibleRes.rows[0]?.id) {
      const explicit = await dbQuery<{ status: string }>(
        `SELECT status FROM bookings WHERE id = $1 AND stay_id = $2 AND guest_id = $3`,
        [bookingId, stay.id, user.id]
      );
      bookingStatus = explicit.rows[0]?.status ?? null;
    }
    if (!bookingId && user.role !== 'admin') {
      throw new AppError(
        'FORBIDDEN',
        'Only guests with a confirmed or completed booking at this stay can submit a review.'
      );
    }
    if (bookingStatus === 'RESERVED_LOCKED') {
      throw new AppError(
        'VALIDATION_ERROR',
        'Please wait for the host to confirm your stay before reviewing it.',
        400
      );
    }
    if (bookingId && !['CHECKED_IN_COMPLETED', 'completed'].includes(String(bookingStatus))) {
      throw new AppError(
        'VALIDATION_ERROR',
        'You can review a stay after it has been completed.',
        400
      );
    }

    // Wi-Fi quality ratings: completed stays only (Phase A scope). Skipping
    // Wi-Fi (no criteria sent) stays available to every eligible reviewer.
    const wifiGiven =
      parsed.data.speed !== undefined ||
      parsed.data.stability !== undefined ||
      parsed.data.workFromHome !== undefined;
    if (wifiGiven && !['CHECKED_IN_COMPLETED', 'completed'].includes(String(bookingStatus))) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Wi-Fi ratings are only available after the stay has been completed.',
        400
      );
    }

    const id = crypto.randomUUID();
    await dbQuery(
      `INSERT INTO stay_reviews (
        id, stay_id, booking_id, guest_id, rating,
        cleanliness_rating, communication_rating, workspace_rating, location_rating, comment,
        wifi_speed_rating, wifi_stability_rating, wifi_work_rating, wifi_comment
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        id,
        stay.id,
        bookingId,
        user.id,
        Math.round(parsed.data.rating * 10) / 10,
        parsed.data.cleanlinessRating,
        parsed.data.communicationRating,
        parsed.data.workspaceRating,
        parsed.data.locationRating,
        parsed.data.comment.trim(),
        parsed.data.speed ?? null,
        parsed.data.stability ?? null,
        parsed.data.workFromHome ?? null,
        parsed.data.wifiComment?.trim() || null,
      ]
    );

    return okJson({ reviewId: id }, 201);
  } catch (err) {
    return errJson(err);
  }
}
