import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { requireAdminPermission } from '@/modules/admin-rbac';
import {
  deleteCmsCategory,
  deleteCmsTag,
  listCmsCategories,
  listCmsTags,
  upsertCmsCategory,
  upsertCmsTag,
} from '@/modules/cms-vietnomad';

export async function GET() {
  try {
    await requireAdminPermission('content', 'view');
    const [categories, tags] = await Promise.all([listCmsCategories(), listCmsTags()]);
    return okJson({ categories, tags });
  } catch (err) {
    return errJson(err);
  }
}

const postSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('category'),
    id: z.string().uuid().optional(),
    slug: z.string().min(1).max(100),
    nameEn: z.string().min(1).max(120),
    nameVi: z.string().max(120).optional(),
    descriptionEn: z.string().max(500).optional(),
    descriptionVi: z.string().max(500).optional(),
    parentId: z.string().uuid().nullable().optional(),
    sortOrder: z.number().int().optional(),
    seoTitle: z.string().max(160).optional(),
    seoDescription: z.string().max(320).optional(),
    robotsIndex: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal('tag'),
    id: z.string().uuid().optional(),
    slug: z.string().min(1).max(80),
    nameEn: z.string().min(1).max(100),
    nameVi: z.string().max(100).optional(),
  }),
]);

export async function POST(req: NextRequest) {
  try {
    const parsed = postSchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid taxonomy payload.');
    }
    const actor = await requireAdminPermission('content', parsed.data.id ? 'edit' : 'create');
    if (parsed.data.kind === 'category') {
      return okJson(
        await upsertCmsCategory(actor, {
          ...parsed.data,
          nameVi: parsed.data.nameVi ?? parsed.data.nameEn,
        }),
        201
      );
    }
    return okJson(await upsertCmsTag(actor, parsed.data), 201);
  } catch (err) {
    return errJson(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const actor = await requireAdminPermission('content', 'delete');
    const kind = req.nextUrl.searchParams.get('kind');
    const id = req.nextUrl.searchParams.get('id') ?? '';
    if (kind === 'category') {
      return okJson(await deleteCmsCategory(actor, id));
    }
    if (kind === 'tag') {
      return okJson(await deleteCmsTag(actor, id));
    }
    throw new AppError('VALIDATION_ERROR', 'Unsupported taxonomy kind.');
  } catch (err) {
    return errJson(err);
  }
}
