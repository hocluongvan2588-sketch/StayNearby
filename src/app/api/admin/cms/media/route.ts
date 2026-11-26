import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { uploadCmsMediaBuffer } from '@/lib/storage';
import { requireAdminPermission } from '@/modules/admin-rbac';
import {
  createCmsMediaRecord,
  deleteCmsMediaRecord,
  listCmsMedia,
  updateCmsMediaMetadata,
} from '@/modules/cms-vietnomad';

export async function GET(req: NextRequest) {
  try {
    await requireAdminPermission('content', 'view');
    const folder = req.nextUrl.searchParams.get('folder') ?? undefined;
    const q = req.nextUrl.searchParams.get('q') ?? undefined;
    const media = await listCmsMedia({ folder, q });
    return okJson({ media });
  } catch (err) {
    return errJson(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireAdminPermission('content', 'create');
    const contentType = req.headers.get('content-type') ?? '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const files = formData.getAll('files').filter((f): f is File => f instanceof File);
      const single = formData.get('file');
      if (single instanceof File && files.length === 0) {
        files.push(single);
      }
      if (files.length === 0) {
        throw new AppError('VALIDATION_ERROR', 'No image file provided.');
      }

      const folder = String(formData.get('folder') ?? 'editorial');
      const altEn = String(formData.get('altEn') ?? '');
      const altVi = String(formData.get('altVi') ?? '');
      const credit = String(formData.get('credit') ?? '');
      const license = String(formData.get('license') ?? 'VietNomad Editorial');

      const created = [];
      for (const file of files) {
        const buf = Buffer.from(await file.arrayBuffer());
        const uploaded = await uploadCmsMediaBuffer({
          folder,
          buffer: buf,
          originalName: file.name,
        });
        const record = await createCmsMediaRecord(actor, {
          storageMode: uploaded.storageMode,
          objectPath: uploaded.objectPath,
          url: uploaded.url,
          filename: file.name || 'image',
          mimeType: uploaded.mimeType,
          sizeBytes: uploaded.sizeBytes,
          width: uploaded.width,
          height: uploaded.height,
          altEn: altEn || file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
          altVi,
          credit,
          license,
          folder,
        });
        created.push(record);
      }
      return okJson({ media: created, item: created[0] }, 201);
    }

    // Also allow registering an external URL cleanly
    const jsonSchema = z.object({
      url: z.string().min(1).max(600),
      filename: z.string().min(1).max(200),
      altEn: z.string().max(240).optional(),
      altVi: z.string().max(240).optional(),
      captionEn: z.string().max(300).optional(),
      credit: z.string().max(160).optional(),
      license: z.string().max(160).optional(),
      folder: z.string().max(60).optional(),
    });
    const parsed = jsonSchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid media asset payload.');
    }
    const item = await createCmsMediaRecord(actor, {
      storageMode: 'external',
      objectPath: '',
      url: parsed.data.url.trim(),
      filename: parsed.data.filename.trim(),
      mimeType: 'image/jpeg',
      sizeBytes: 0,
      altEn: parsed.data.altEn,
      altVi: parsed.data.altVi,
      captionEn: parsed.data.captionEn,
      credit: parsed.data.credit,
      license: parsed.data.license,
      folder: parsed.data.folder,
    });
    return okJson({ media: [item], item }, 201);
  } catch (err) {
    return errJson(err);
  }
}

const patchSchema = z.object({
  id: z.string().uuid(),
  altEn: z.string().max(240).optional(),
  altVi: z.string().max(240).optional(),
  captionEn: z.string().max(350).optional(),
  captionVi: z.string().max(350).optional(),
  credit: z.string().max(160).optional(),
  license: z.string().max(160).optional(),
  focalX: z.number().min(0).max(100).optional(),
  focalY: z.number().min(0).max(100).optional(),
  folder: z.string().max(60).optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const actor = await requireAdminPermission('content', 'edit');
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid media update.');
    return okJson(await updateCmsMediaMetadata(actor, parsed.data.id, parsed.data));
  } catch (err) {
    return errJson(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const actor = await requireAdminPermission('content', 'delete');
    const id = req.nextUrl.searchParams.get('id') ?? '';
    const force = req.nextUrl.searchParams.get('force') === '1';
    return okJson(await deleteCmsMediaRecord(actor, id, force));
  } catch (err) {
    return errJson(err);
  }
}
