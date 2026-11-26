import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { createGuestSupportTicket, listGuestSupportTickets } from '@/modules/support';

const createTicketSchema = z.object({
  category: z.enum([
    'booking',
    'property_wifi',
    'payment',
    'general',
    'booking_issue',
    'payment_refund',
    'checkin_access',
    'listing_accuracy',
    'account',
    'other',
  ]),
  issueSubCategory: z.string().max(80).optional(),
  bookingId: z.string().uuid().nullable().optional(),
  stayId: z.string().uuid().nullable().optional(),
  subject: z.string().min(4).max(200),
  description: z.string().min(6).max(3000),
  attachments: z.array(z.string().max(600)).max(5).optional(),
});

export async function GET() {
  try {
    const user = await requireUser();
    const tickets = await listGuestSupportTickets(user.id);
    return okJson({ tickets });
  } catch (err) {
    return errJson(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const raw = await req.json().catch(() => null);
    const parsed = createTicketSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Please complete category, subject (min 4 chars), and issue details (min 6 chars).'
      );
    }
    const created = await createGuestSupportTicket(user, parsed.data);
    return okJson({ ticket: created }, 201);
  } catch (err) {
    return errJson(err);
  }
}
