import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { uploadStayMediaBuffer } from '@/lib/storage';
import {
  assertHostOwnsStay,
  attachMediaToStay,
  removeMediaFromStay,
} from '@/modules/host';

const roleSchema = z.enum(['hero', 'workspace', 'gallery', 'room']).default('gallery');

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole(['host', 'admin']);
    const { id: stayId } = await context.params;
    await assertHostOwnsStay(user, stayId);

    const formData = await req.formData();
    const roleRaw = formData.get('role');
    const roleParsed = roleSchema.safeParse(
      typeof roleRaw === 'string' && roleRaw ? roleRaw : 'gallery'
    );
    const role = roleParsed.success ? roleParsed.data : 'gallery';
    const roomIdRaw = formData.get('roomId');
    const roomId = typeof roomIdRaw === 'string' && roomIdRaw ? roomIdRaw : undefined;
    const attachRaw = formData.get('attach');
    const shouldAttach = attachRaw !== 'false';

    const fileEntries = [
      ...formData.getAll('files'),
      ...formData.getAll('file'),
    ].filter((entry): entry is File => entry instanceof File);

    if (fileEntries.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'Please choose at least one image file to upload.');
    }
    if (fileEntries.length > 8) {
      throw new AppError('VALIDATION_ERROR', 'Upload at most 8 photos per batch.');
    }

    const uploaded = [];
    for (let i = 0; i < fileEntries.length; i++) {
      const file = fileEntries[i]!;
      const arrayBuf = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);
      const res = await uploadStayMediaBuffer({
        stayId,
        buffer,
        originalName: file.name,
      });
      if (shouldAttach) {
        await attachMediaToStay(user, stayId, {
          url: res.url,
          role: i === 0 ? role : 'gallery',
          roomId: i === 0 ? roomId : undefined,
        });
      }
      uploaded.push(res);
    }

    return okJson({ uploaded }, 201);
  } catch (err) {
    return errJson(err);
  }
}

const deleteSchema = z.object({
  url: z.string().min(1).max(600),
});

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole(['host', 'admin']);
    const { id: stayId } = await context.params;
    const body = await req.json();
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Valid media URL required.');
    }
    const result = await removeMediaFromStay(user, stayId, parsed.data.url);
    return okJson(result);
  } catch (err) {
    return errJson(err);
  }
}
