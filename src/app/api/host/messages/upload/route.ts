import { requireUser } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { uploadStayMediaBuffer } from '@/lib/storage';

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      throw new AppError('VALIDATION_ERROR', 'Please select an image to attach.');
    }
    const convIdRaw = formData.get('conversationId');
    const bucketFolder =
      typeof convIdRaw === 'string' && convIdRaw.trim()
        ? `msg-${convIdRaw.trim().slice(0, 24)}`
        : `msg-${user.id.slice(0, 12)}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadStayMediaBuffer({
      stayId: bucketFolder,
      buffer,
      originalName: file.name,
    });
    return okJson({ uploaded }, 201);
  } catch (err) {
    return errJson(err);
  }
}
