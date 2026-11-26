import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { requireAdminPermission } from '@/modules/admin-rbac';
import {
  createTranslationSibling,
  getAdminCmsContentDetail,
  transitionCmsWorkflow,
  updateGscInspectionStatus,
} from '@/modules/cms-vietnomad';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminPermission('content', 'view');
    const { id } = await context.params;
    const detail = await getAdminCmsContentDetail(id);
    return okJson({ ...detail });
  } catch (err) {
    return errJson(err);
  }
}

const patchSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('workflow'),
    action: z.enum([
      'submit_review',
      'approve',
      'schedule',
      'publish',
      'unpublish_to_draft',
      'archive',
      'restore_revision',
    ]),
    scheduledAt: z.string().optional(),
    revisionId: z.string().uuid().optional(),
  }),
  z.object({
    kind: z.literal('create_translation'),
    targetLocale: z.enum(['en', 'vi']),
  }),
  z.object({
    kind: z.literal('gsc_status'),
    gscStatus: z.enum([
      'not_connected',
      'pending_inspection',
      'submitted',
      'indexed',
      'excluded',
      'error',
    ]),
    gscNote: z.string().max(300).optional(),
  }),
]);

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid CMS update action.');
    }

    const d = parsed.data;
    if (d.kind === 'create_translation') {
      const actor = await requireAdminPermission('content', 'create');
      return okJson(await createTranslationSibling(actor, id, d.targetLocale), 201);
    }

    if (d.kind === 'gsc_status') {
      const actor = await requireAdminPermission('content', 'edit');
      return okJson(await updateGscInspectionStatus(actor, id, d));
    }

    const requiredAction = ['approve', 'schedule', 'publish', 'unpublish_to_draft'].includes(
      d.action
    )
      ? 'approve'
      : d.action === 'archive'
        ? 'delete'
        : 'edit';
    const actor = await requireAdminPermission('content', requiredAction);
    return okJson(
      await transitionCmsWorkflow(actor, id, d.action, {
        scheduledAt: d.scheduledAt,
        revisionId: d.revisionId,
      })
    );
  } catch (err) {
    return errJson(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAdminPermission('content', 'delete');
    const { id } = await context.params;
    return okJson(await transitionCmsWorkflow(actor, id, 'archive'));
  } catch (err) {
    return errJson(err);
  }
}
