import fs from 'fs';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { dbQuery } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { handleApiError } from '@/lib/http';
import { resolveSafeUploadPath } from '@/lib/storage/photos';

export const dynamic = 'force-dynamic';

const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: segments } = await context.params;
    if (!segments || segments.length === 0) {
      throw new AppError('NOT_FOUND', 'Media file not found.');
    }

    const storagePath = segments.join('/');
    const filePath = resolveSafeUploadPath(storagePath);

    // Check DB metadata: draft photos are restricted strictly to owning host or admin
    const photoRes = await dbQuery<{
      is_draft: boolean;
      host_id: string;
      mime_type: string;
    }>(
      `SELECT p.is_draft, l.host_id, p.mime_type
       FROM listing_photos p
       JOIN listings l ON l.id = p.listing_id
       WHERE p.storage_path = $1
       LIMIT 1`,
      [storagePath]
    );

    const record = photoRes.rows[0];
    if (!record) {
      throw new AppError('NOT_FOUND', 'Photo not found.');
    }

    if (record.is_draft) {
      const user = await getCurrentUser();
      const canAccess =
        user &&
        (user.roles.includes('admin') ||
          (user.roles.includes('host') && user.id === record.host_id));
      if (!canAccess) {
        throw new AppError('FORBIDDEN', 'Draft photo access denied.');
      }
    }

    if (!fs.existsSync(filePath)) {
      throw new AppError('NOT_FOUND', 'Image binary not found.');
    }

    const ext = storagePath.split('.').pop()?.toLowerCase() ?? 'jpg';
    const contentType = record.mime_type || EXT_TO_MIME[ext] || 'image/jpeg';
    const data = fs.readFileSync(filePath);

    return new NextResponse(new Uint8Array(data), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': record.is_draft
          ? 'private, no-store'
          : 'public, max-age=3600',
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
