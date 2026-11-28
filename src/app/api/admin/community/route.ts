import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { requireAdminPermission } from '@/modules/admin-rbac';
import {
  createAdminCommunityEvent,
  getAdminCommunityEvent,
  listAdminCommunityEvents,
  listEventAttendees,
  listEventModerationLog,
  removeEventAttendee,
  transitionAdminCommunityEvent,
  updateAdminCommunityEvent,
  type AdminEventTab,
} from '@/modules/admin-bos/community';

const TABS: AdminEventTab[] = ['pending', 'published', 'draft', 'ended', 'rejected'];

export async function GET(req: NextRequest) {
  try {
    const scope = req.nextUrl.searchParams.get('scope') ?? 'list';

    if (scope === 'list') {
      await requireAdminPermission('content', 'view');
      const tab = (req.nextUrl.searchParams.get('tab') ?? 'pending') as AdminEventTab;
      if (!TABS.includes(tab)) throw new AppError('VALIDATION_ERROR', 'Unknown tab.');
      const events = await listAdminCommunityEvents({
        tab,
        q: req.nextUrl.searchParams.get('q') ?? undefined,
        destinationId: req.nextUrl.searchParams.get('destinationId') ?? undefined,
        source: req.nextUrl.searchParams.get('source') ?? undefined,
      });
      return okJson({ events });
    }

    if (scope === 'event') {
      await requireAdminPermission('content', 'view');
      const id = req.nextUrl.searchParams.get('eventId');
      if (!id) throw new AppError('VALIDATION_ERROR', 'eventId required.');
      return okJson({ event: await getAdminCommunityEvent(id) });
    }

    if (scope === 'attendees') {
      await requireAdminPermission('content', 'view');
      const id = req.nextUrl.searchParams.get('eventId');
      if (!id) throw new AppError('VALIDATION_ERROR', 'eventId required.');
      return okJson({ attendees: await listEventAttendees(id) });
    }

    if (scope === 'log') {
      await requireAdminPermission('content', 'view');
      const id = req.nextUrl.searchParams.get('eventId');
      if (!id) throw new AppError('VALIDATION_ERROR', 'eventId required.');
      return okJson({ log: await listEventModerationLog(id) });
    }

    throw new AppError('VALIDATION_ERROR', 'Unknown scope.');
  } catch (err) {
    return errJson(err);
  }
}

const createSchema = z.object({
  titleEn: z.string().trim().min(3).max(200),
  titleVi: z.string().trim().max(200).optional(),
  cityEn: z.string().trim().min(1).max(120),
  cityVi: z.string().trim().max(120).optional(),
  venueEn: z.string().trim().min(1).max(200),
  venueVi: z.string().trim().max(200).optional(),
  startAt: z.string().nullable().optional(),
  endAt: z.string().nullable().optional(),
  category: z.string().trim().max(64).nullable().optional(),
  language: z.string().trim().max(32).nullable().optional(),
  priceType: z.enum(['free', 'paid']).optional(),
  priceAmount: z.number().nullable().optional(),
  priceCurrency: z.string().length(3).optional(),
  organizerName: z.string().trim().max(160).nullable().optional(),
  organizerContact: z.string().trim().max(300).nullable().optional(),
  source: z.enum(['internal', 'partner', 'external']).optional(),
  sourceUrl: z.string().trim().max(500).nullable().optional(),
  sourceNote: z.string().trim().max(500).nullable().optional(),
  registrationMode: z.enum(['internal', 'external']).optional(),
  spotsTotal: z.number().int().positive().nullable().optional(),
  imageUrl: z.string().trim().max(500).nullable().optional(),
  destinationId: z.string().uuid().nullable().optional(),
  descriptionEn: z.string().trim().max(4000).nullable().optional(),
  descriptionVi: z.string().trim().max(4000).nullable().optional(),
  status: z.enum(['draft', 'published']).optional(),
});

const patchSchema = z.object({
  id: z.string().uuid(),
  action: z
    .enum([
      'approve',
      'reject',
      'need_more',
      'publish',
      'unpublish',
      'cancel',
      'postpone',
      'end',
      'restore_draft',
    ])
    .optional(),
  note: z.string().trim().max(1000).optional(),
  fields: createSchema.partial().optional(),
});

const removeAttendeeSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  try {
    const actor = await requireAdminPermission('content', 'create');
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid event payload.');
    const event = await createAdminCommunityEvent(
      parsed.data,
      actor.user.email,
      actor.user.id
    );
    return okJson({ event });
  } catch (err) {
    return errJson(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid payload.');
    const { id, action, note, fields } = parsed.data;

    if (action) {
      const needsApprove = ['approve', 'reject', 'need_more'].includes(action);
      const actor = await requireAdminPermission(
        'content',
        needsApprove ? 'approve' : 'edit'
      );
      const event = await transitionAdminCommunityEvent(
        id,
        action,
        actor.user.email,
        note
      );
      return okJson({ event });
    }

    if (fields && Object.keys(fields).length > 0) {
      const actor = await requireAdminPermission('content', 'edit');
      const event = await updateAdminCommunityEvent(id, fields, actor.user.email);
      return okJson({ event });
    }

    throw new AppError('VALIDATION_ERROR', 'Nothing to do.');
  } catch (err) {
    return errJson(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const actor = await requireAdminPermission('content', 'edit');
    const body = await req.json();
    const parsed = removeAttendeeSchema.safeParse(body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid payload.');
    await removeEventAttendee(parsed.data.id, parsed.data.userId, actor.user.email);
    return okJson({ removed: true });
  } catch (err) {
    return errJson(err);
  }
}
