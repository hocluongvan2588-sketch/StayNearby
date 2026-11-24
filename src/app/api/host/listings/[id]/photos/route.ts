import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { getClientIp, handleApiError } from '@/lib/http';
import { assertRateLimit } from '@/lib/rate-limit';
import { addHostListingPhoto } from '@/modules/host';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser();
    assertRateLimit({
      bucket: 'host_photo_upload',
      key: `${getClientIp(req)}:${user?.id || 'anon'}`,
      limit: 30,
      windowMs: 60_000,
    });
    const formData = await req.formData();

    const file = formData.get('file');
    if (!(file instanceof File)) {
      throw new AppError('VALIDATION_ERROR', 'Vui lòng chọn tệp ảnh hợp lệ để tải lên.');
    }

    const altTextRaw = formData.get('altTextEn');
    const altTextEn = typeof altTextRaw === 'string' ? altTextRaw : 'Stay interior photo';
    const setAsCover = formData.get('setAsCover') === 'true';

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const photo = await addHostListingPhoto(user, {
      listingId: id,
      mimeType: file.type,
      buffer,
      altTextEn,
      setAsCover,
    });

    return NextResponse.json({ ok: true, photo }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
