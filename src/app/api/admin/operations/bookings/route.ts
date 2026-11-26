import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { requireAdminPermission } from '@/modules/admin-rbac';
import { listAdminBookings, updateBookingByAdmin } from '@/modules/admin-bos';

const patchSchema = z.object({
  bookingId: z.string().uuid(),
  bookingStatus: z
    .enum(['pending_payment', 'pending_approval', 'confirmed', 'cancelled', 'expired'])
    .optional(),
  stayStatus: z
    .enum(['upcoming', 'checked_in', 'in_house', 'checked_out', 'no_show'])
    .optional(),
  paymentStatus: z
    .enum(['unpaid', 'pending', 'paid', 'partially_refunded', 'refunded', 'failed'])
    .optional(),
  payoutStatus: z
    .enum([
      'not_applicable',
      'pending',
      'scheduled',
      'paid',
      'on_hold',
      'direct_at_checkin',
    ])
    .optional(),
  refundStatus: z
    .enum(['none', 'requested', 'approved', 'processing', 'completed', 'rejected'])
    .optional(),
  disputeFlag: z.boolean().optional(),
  adjustmentAmountVnd: z.number().int().optional(),
  reason: z.string().min(3).max(500),
});

export async function GET(req: NextRequest) {
  try {
    const actor = await requireAdminPermission('bookings', 'view');
    const bookings = await listAdminBookings(actor, {
      bookingStatus: req.nextUrl.searchParams.get('bookingStatus') ?? undefined,
      paymentStatus: req.nextUrl.searchParams.get('paymentStatus') ?? undefined,
      payoutStatus: req.nextUrl.searchParams.get('payoutStatus') ?? undefined,
      q: req.nextUrl.searchParams.get('q') ?? undefined,
    });
    return okJson({ bookings });
  } catch (err) {
    return errJson(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const actor = await requireAdminPermission('bookings', 'edit');
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid booking adjustment payload.');
    const { bookingId, ...rest } = parsed.data;
    const out = await updateBookingByAdmin(actor, bookingId, rest);
    return okJson(out);
  } catch (err) {
    return errJson(err);
  }
}
