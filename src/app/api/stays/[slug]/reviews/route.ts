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
    const eligibleRes = await dbQuery<{ id: string }>(
      `SELECT id FROM bookings
       WHERE stay_id = $1 AND guest_id = $2
         AND status IN ('RESERVED_LOCKED', 'CHECKED_IN_COMPLETED', 'confirmed', 'completed')
       ORDER BY created_at DESC LIMIT 1`,
      [stay.id, user.id]
    );
    const bookingId = parsed.data.bookingId ?? eligibleRes.rows[0]?.id ?? null;
    if (!bookingId && user.role !== 'admin') {
      throw new AppError(
        'FORBIDDEN',
        'Only guests with a confirmed or completed booking at this stay can submit a review.'
      );
    }

    const id = crypto.randomUUID();
    await dbQuery(
      `INSERT INTO stay_reviews (
        id, stay_id, booking_id, guest_id, rating,
        cleanliness_rating, communication_rating, workspace_rating, location_rating, comment
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
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
      ]
    );

    return okJson({ reviewId: id }, 201);
  } catch (err) {
    return errJson(err);
  }
}
