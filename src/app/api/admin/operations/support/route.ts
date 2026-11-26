import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { requireAdminPermission } from '@/modules/admin-rbac';
import {
  createSupportTicket,
  listSupportTickets,
  updateSupportTicket,
} from '@/modules/admin-bos';

const createSchema = z.object({
  category: z.enum([
    'booking_issue',
    'payment_refund',
    'checkin_access',
    'listing_accuracy',
    'host_payout',
    'account',
    'other',
  ]),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  subject: z.string().min(4).max(200),
  description: z.string().min(4).max(2000),
  bookingId: z.string().nullable().optional(),
  stayId: z.string().nullable().optional(),
});

const patchSchema = z.object({
  ticketId: z.string().uuid(),
  status: z.enum(['open', 'in_progress', 'waiting_user', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  resolutionSummary: z.string().max(1500).optional(),
  messageBody: z.string().max(2000).optional(),
  isInternalNote: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const actor = await requireAdminPermission('support', 'view');
    const tickets = await listSupportTickets(actor, {
      status: req.nextUrl.searchParams.get('status') ?? undefined,
      priority: req.nextUrl.searchParams.get('priority') ?? undefined,
      q: req.nextUrl.searchParams.get('q') ?? undefined,
    });
    return okJson({ tickets });
  } catch (err) {
    return errJson(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireAdminPermission('support', 'create');
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid support ticket payload.');
    const out = await createSupportTicket(actor, parsed.data);
    return okJson(out, 201);
  } catch (err) {
    return errJson(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const actor = await requireAdminPermission('support', 'edit');
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid ticket update payload.');
    const { ticketId, ...rest } = parsed.data;
    const out = await updateSupportTicket(actor, ticketId, rest);
    return okJson(out);
  } catch (err) {
    return errJson(err);
  }
}
