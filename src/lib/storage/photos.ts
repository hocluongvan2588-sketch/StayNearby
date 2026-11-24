import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getAppConfig } from '../config';
import { AppError } from '../errors';
import { assertListingOwnership } from '../auth/rbac';
import type { SessionUser } from '../auth/session';

export const ALLOWED_PHOTO_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export interface PhotoUploadValidationInput {
  actor: SessionUser | null;
  listingId: string;
  listingHostId: string;
  existingPhotoCount: number;
  mimeType: string;
  sizeBytes: number;
  isDraft: boolean;
}

export function validatePhotoUpload(input: PhotoUploadValidationInput): {
  storagePath: string;
  extension: string;
} {
  assertListingOwnership(input.actor, input.listingHostId);

  const config = getAppConfig();
  if (!ALLOWED_PHOTO_MIME_TYPES.has(input.mimeType)) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Unsupported image format. Only JPEG, PNG, and WebP are accepted.',
      { allowedMimeTypes: Array.from(ALLOWED_PHOTO_MIME_TYPES) }
    );
  }

  if (input.sizeBytes <= 0 || input.sizeBytes > config.maxPhotoSizeBytes) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Image size must be between 1 byte and ${Math.round(
        config.maxPhotoSizeBytes / (1024 * 1024)
      )} MB.`,
      { maxBytes: config.maxPhotoSizeBytes, actualBytes: input.sizeBytes }
    );
  }

  if (input.existingPhotoCount >= config.maxListingPhotos) {
    throw new AppError(
      'VALIDATION_ERROR',
      `A listing can have at most ${config.maxListingPhotos} photos.`,
      { maxPhotos: config.maxListingPhotos }
    );
  }

  const ext = MIME_TO_EXT[input.mimeType] || 'jpg';
  const folder = input.isDraft ? 'drafts' : 'published';
  const fileName = `${crypto.randomUUID()}.${ext}`;
  const storagePath = path.posix.join('listings', folder, input.listingId, fileName);

  return { storagePath, extension: ext };
}

/**
 * Inspects file magic bytes to guard against spoofed Content-Type headers.
 */
export function verifyImageBufferSignature(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 12) return false;
  if (mimeType === 'image/jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }
  if (mimeType === 'image/webp') {
    return (
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }
  return false;
}

export function getLocalUploadsRoot(): string {
  if (process.env.VERCEL === '1' || process.cwd() === '/var/task') {
    return '/tmp/staynearby-uploads';
  }
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), '.data', 'uploads');
}

export function resolveSafeUploadPath(storagePath: string): string {
  const uploadsRoot = getLocalUploadsRoot();
  const normalized = storagePath.replace(/^\/+/, '');
  const targetPath = path.resolve(uploadsRoot, normalized);
  if (!targetPath.startsWith(uploadsRoot + path.sep)) {
    throw new AppError('VALIDATION_ERROR', 'Invalid storage path.');
  }
  return targetPath;
}

/**
 * Saves a validated photo either to Supabase Storage (when service role configured)
 * or to local `.data/uploads/<storagePath>` served via access-controlled `/api/media/...`.
 */
export async function persistListingPhotoBinary(params: {
  storagePath: string;
  buffer: Buffer;
  mimeType: string;
}): Promise<{ publicUrl: string }> {
  const config = getAppConfig();

  if (config.supabase.isConfigured && config.supabase.serviceRoleKey) {
    const uploadEndpoint = `${config.supabase.url.replace(/\/$/, '')}/storage/v1/object/listing-photos/${params.storagePath}`;
    const res = await fetch(uploadEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.supabase.serviceRoleKey}`,
        apikey: config.supabase.serviceRoleKey,
        'Content-Type': params.mimeType,
        'x-upsert': 'true',
      },
      body: new Uint8Array(params.buffer),
    });

    if (!res.ok) {
      throw new AppError('INTERNAL_ERROR', 'Failed to upload image to storage.');
    }

    return {
      publicUrl: `${config.supabase.url.replace(/\/$/, '')}/storage/v1/object/public/listing-photos/${params.storagePath}`,
    };
  }

  const targetPath = resolveSafeUploadPath(params.storagePath);
  fs.mkdirSync(/*turbopackIgnore: true*/ path.dirname(targetPath), {
    recursive: true,
  });
  fs.writeFileSync(/*turbopackIgnore: true*/ targetPath, params.buffer);

  return {
    publicUrl: `/api/media/${params.storagePath}`,
  };
}

export async function removePersistedPhotoBinary(storagePath: string): Promise<void> {
  if (!storagePath) return;
  const config = getAppConfig();

  if (config.supabase.isConfigured && config.supabase.serviceRoleKey) {
    const endpoint = `${config.supabase.url.replace(/\/$/, '')}/storage/v1/object/listing-photos/${storagePath}`;
    await fetch(endpoint, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${config.supabase.serviceRoleKey}`,
        apikey: config.supabase.serviceRoleKey,
      },
    }).catch(() => {});
    return;
  }

  try {
    const targetPath = resolveSafeUploadPath(storagePath);
    if (fs.existsSync(/*turbopackIgnore: true*/ targetPath)) {
      fs.unlinkSync(/*turbopackIgnore: true*/ targetPath);
    }
  } catch {
    // Ignore non-local paths
  }
}
