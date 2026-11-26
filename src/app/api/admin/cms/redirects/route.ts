import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { requireAdminPermission } from '@/modules/admin-rbac';
import {
  deleteCmsRedirect,
  listCmsRedirects,
  upsertCmsRedirect,
} from '@/modules/cms-vietnomad';

export async function GET() {
  try {
    await requireAdminPermission('content', 'view');
    return okJson({ redirects: await listCmsRedirects() });
  } catch (err) {
    return errJson(err);
  }
}

const schema = z.object({
  id: z.string().uuid().optional(),
  sourcePath: z.string().min(1).max(300),
  targetPath: z.string().min(1).max(300),
  statusCode: z.union([z.literal(301), z.literal(302)]).optional(),
  isActive: z.boolean().optional(),
  note: z.string().max(300).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const actor = await requireAdminPermission('content', 'edit');
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid redirect rule.');
    return okJson(await upsertCmsRedirect(actor, parsed.data), 201);
  } catch (err) {
    return errJson(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const actor = await requireAdminPermission('content', 'delete');
    const id = req.nextUrl.searchParams.get('id') ?? '';
    return okJson(await deleteCmsRedirect(actor, id));
  } catch (err) {
    return errJson(err);
  }
}
