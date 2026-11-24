import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { handleApiError } from '@/lib/http';
import { deleteHostListingPhoto, setHostCoverPhoto } from '@/modules/host';

export const dynamic = 'force-dynamic';

export async function PATCH(
  _req: NextRequest,
  context: { params: Promise<{ id: string; photoId: string }> }
) {
  try {
    const { id, photoId } = await context.params;
    const user = await getCurrentUser();
    await setHostCoverPhoto(user, id, photoId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string; photoId: string }> }
) {
  try {
    const { id, photoId } = await context.params;
    const user = await getCurrentUser();
    await deleteHostListingPhoto(user, id, photoId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
