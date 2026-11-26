import crypto from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getConfig } from './config';
import { AppError } from './errors';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

export type AllowedImageMime = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif';

export interface UploadedMediaResult {
  url: string;
  objectPath: string;
  storageMode: 'supabase' | 'local';
  mimeType: AllowedImageMime;
  sizeBytes: number;
  width?: number;
  height?: number;
}

export function getMediaStorageStatus() {
  const cfg = getConfig();
  return {
    supabaseConfigured: Boolean(cfg.supabaseUrl && cfg.supabaseServiceRoleKey),
    bucket: cfg.supabaseStorageBucket,
  };
}

function detectImageType(buffer: Buffer): { mime: AllowedImageMime; ext: string } | null {
  if (buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mime: 'image/png', ext: 'png' };
  }
  // WebP: RIFF....WEBP
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { mime: 'image/webp', ext: 'webp' };
  }
  // AVIF: ....ftypavif
  if (
    buffer.subarray(4, 8).toString('ascii') === 'ftyp' &&
    buffer.subarray(8, 12).toString('ascii').toLowerCase().startsWith('avif')
  ) {
    return { mime: 'image/avif', ext: 'avif' };
  }

  return null;
}

function extractImageDimensions(
  buffer: Buffer,
  mime: AllowedImageMime
): { width?: number; height?: number } {
  try {
    if (mime === 'image/png' && buffer.length >= 24) {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      if (width > 0 && height > 0 && width < 20000 && height < 20000) {
        return { width, height };
      }
    }
    if (mime === 'image/jpeg') {
      let i = 2;
      while (i + 9 < buffer.length) {
        if (buffer[i] !== 0xff) {
          i += 1;
          continue;
        }
        const marker = buffer[i + 1];
        if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
          const height = buffer.readUInt16BE(i + 5);
          const width = buffer.readUInt16BE(i + 7);
          if (width > 0 && height > 0) return { width, height };
          break;
        }
        const segLen = buffer.readUInt16BE(i + 2);
        if (segLen < 2) break;
        i += 2 + segLen;
      }
    }
    if (mime === 'image/webp' && buffer.length >= 30) {
      const chunk = buffer.subarray(12, 16).toString('ascii');
      if (chunk === 'VP8X' && buffer.length >= 30) {
        const width = 1 + buffer.readUIntLE(24, 3);
        const height = 1 + buffer.readUIntLE(27, 3);
        return { width, height };
      }
    }
  } catch {
    return {};
  }
  return {};
}

function sanitizeSegment(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!cleaned || cleaned === '.' || cleaned === '..') {
    throw new AppError('VALIDATION_ERROR', 'Invalid media path segment.');
  }
  return cleaned;
}

async function ensureSupabaseBucketExists(
  supabaseUrl: string,
  serviceRoleKey: string,
  bucket: string
) {
  const headers = {
    Authorization: `Bearer ${serviceRoleKey}`,
    apikey: serviceRoleKey,
    'Content-Type': 'application/json',
  };

  const checkRes = await fetch(`${supabaseUrl}/storage/v1/bucket/${encodeURIComponent(bucket)}`, {
    method: 'GET',
    headers,
  });
  if (checkRes.ok) return;

  await fetch(`${supabaseUrl}/storage/v1/bucket`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      id: bucket,
      name: bucket,
      public: true,
      file_size_limit: MAX_UPLOAD_BYTES,
      allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp'],
    }),
  });
}

export async function uploadStayMediaBuffer(input: {
  stayId: string;
  buffer: Buffer;
  originalName?: string;
}): Promise<UploadedMediaResult> {
  if (input.buffer.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'Uploaded file is empty.');
  }
  if (input.buffer.length > MAX_UPLOAD_BYTES) {
    throw new AppError('VALIDATION_ERROR', 'Image exceeds the 10 MB maximum file size.');
  }

  const detected = detectImageType(input.buffer);
  if (!detected) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Only JPEG, PNG, and WebP images are supported.'
    );
  }

  const safeStayId = sanitizeSegment(input.stayId);
  const stamp = Date.now();
  const rand = crypto.randomBytes(6).toString('hex');
  const filename = `${stamp}-${rand}.${detected.ext}`;
  const objectPath = `stays/${safeStayId}/${filename}`;

  const cfg = getConfig();
  if (cfg.supabaseUrl && cfg.supabaseServiceRoleKey) {
    const uploadUrl = `${cfg.supabaseUrl}/storage/v1/object/${encodeURIComponent(cfg.supabaseStorageBucket)}/${objectPath}`;
    let res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.supabaseServiceRoleKey}`,
        apikey: cfg.supabaseServiceRoleKey,
        'Content-Type': detected.mime,
        'x-upsert': 'true',
      },
      body: new Uint8Array(input.buffer),
    });

    if (res.status === 404 || res.status === 400) {
      await ensureSupabaseBucketExists(
        cfg.supabaseUrl,
        cfg.supabaseServiceRoleKey,
        cfg.supabaseStorageBucket
      );
      res = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.supabaseServiceRoleKey}`,
          apikey: cfg.supabaseServiceRoleKey,
          'Content-Type': detected.mime,
          'x-upsert': 'true',
        },
        body: new Uint8Array(input.buffer),
      });
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new AppError(
        'PAYMENT_GATEWAY_ERROR',
        `Supabase Storage upload failed (${res.status}): ${errText.slice(0, 140)}`,
        502
      );
    }

    const publicUrl = `${cfg.supabaseUrl}/storage/v1/object/public/${encodeURIComponent(cfg.supabaseStorageBucket)}/${objectPath}`;
    return {
      url: publicUrl,
      objectPath,
      storageMode: 'supabase',
      mimeType: detected.mime,
      sizeBytes: input.buffer.length,
    };
  }

  // Local disk fallback served seamlessly at /api/uploads/stays/{stayId}/{file}
  const fullDir = path.join(cfg.localUploadsDir, 'stays', safeStayId);
  await mkdir(/*turbopackIgnore: true*/ fullDir, { recursive: true });
  const targetFile = path.join(fullDir, filename);
  await writeFile(/*turbopackIgnore: true*/ targetFile, input.buffer);

  return {
    url: `/api/uploads/${objectPath}`,
    objectPath,
    storageMode: 'local',
    mimeType: detected.mime,
    sizeBytes: input.buffer.length,
  };
}

export function normalizeSafeUploadSegments(segments: string[]): string | null {
  if (segments.length < 2 || segments.length > 5) return null;
  for (const seg of segments) {
    if (!seg || seg === '.' || seg === '..' || seg.includes('/') || seg.includes('\\')) {
      return null;
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(seg)) {
      return null;
    }
  }
  return path.join(...segments);
}

export async function readLocalUploadFile(segments: string[]): Promise<{
  buffer: Buffer;
  contentType: string;
} | null> {
  const rel = normalizeSafeUploadSegments(segments);
  if (!rel) return null;

  const cfg = getConfig();
  const base = path.resolve(cfg.localUploadsDir);
  const resolved = path.resolve(base, rel);
  if (!resolved.startsWith(base + path.sep)) return null;

  try {
    const buffer = await readFile(/*turbopackIgnore: true*/ resolved);
    const ext = path.extname(resolved).toLowerCase();
    const contentType =
      ext === '.png'
        ? 'image/png'
        : ext === '.webp'
          ? 'image/webp'
          : ext === '.avif'
            ? 'image/avif'
            : 'image/jpeg';
    return { buffer, contentType };
  } catch {
    return null;
  }
}

export async function uploadCmsMediaBuffer(input: {
  folder?: string;
  buffer: Buffer;
  originalName?: string;
}): Promise<UploadedMediaResult> {
  if (input.buffer.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'Uploaded file is empty.');
  }
  if (input.buffer.length > MAX_UPLOAD_BYTES) {
    throw new AppError('VALIDATION_ERROR', 'Image exceeds the 10 MB maximum file size.');
  }

  const detected = detectImageType(input.buffer);
  if (!detected) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Only JPEG, PNG, WebP, and AVIF images are supported.'
    );
  }

  const dims = extractImageDimensions(input.buffer, detected.mime);
  const safeFolder = sanitizeSegment(input.folder?.trim() || 'editorial');
  const stamp = Date.now();
  const rand = crypto.randomBytes(6).toString('hex');
  const filename = `${stamp}-${rand}.${detected.ext}`;
  const objectPath = `cms-media/${safeFolder}/${filename}`;

  const cfg = getConfig();
  if (cfg.supabaseUrl && cfg.supabaseServiceRoleKey) {
    const uploadUrl = `${cfg.supabaseUrl}/storage/v1/object/${encodeURIComponent(cfg.supabaseStorageBucket)}/${objectPath}`;
    let res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.supabaseServiceRoleKey}`,
        apikey: cfg.supabaseServiceRoleKey,
        'Content-Type': detected.mime,
        'x-upsert': 'true',
      },
      body: new Uint8Array(input.buffer),
    });

    if (res.status === 404 || res.status === 400) {
      await ensureSupabaseBucketExists(
        cfg.supabaseUrl,
        cfg.supabaseServiceRoleKey,
        cfg.supabaseStorageBucket
      );
      res = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.supabaseServiceRoleKey}`,
          apikey: cfg.supabaseServiceRoleKey,
          'Content-Type': detected.mime,
          'x-upsert': 'true',
        },
        body: new Uint8Array(input.buffer),
      });
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new AppError(
        'PAYMENT_GATEWAY_ERROR',
        `Supabase Storage upload failed (${res.status}): ${errText.slice(0, 140)}`,
        502
      );
    }

    const publicUrl = `${cfg.supabaseUrl}/storage/v1/object/public/${encodeURIComponent(cfg.supabaseStorageBucket)}/${objectPath}`;
    return {
      url: publicUrl,
      objectPath,
      storageMode: 'supabase',
      mimeType: detected.mime,
      sizeBytes: input.buffer.length,
      width: dims.width,
      height: dims.height,
    };
  }

  const fullDir = path.join(cfg.localUploadsDir, 'cms-media', safeFolder);
  await mkdir(/*turbopackIgnore: true*/ fullDir, { recursive: true });
  const targetFile = path.join(fullDir, filename);
  await writeFile(/*turbopackIgnore: true*/ targetFile, input.buffer);

  return {
    url: `/api/uploads/${objectPath}`,
    objectPath,
    storageMode: 'local',
    mimeType: detected.mime,
    sizeBytes: input.buffer.length,
    width: dims.width,
    height: dims.height,
  };
}

export async function deleteCmsUploadedMedia(objectPath: string): Promise<void> {
  if (!objectPath || !objectPath.startsWith('cms-media/')) return;
  const segments = objectPath.split('/');
  const safeRel = normalizeSafeUploadSegments(segments);
  if (!safeRel) return;

  const cfg = getConfig();
  const base = path.resolve(cfg.localUploadsDir);
  const resolved = path.resolve(base, safeRel);
  if (resolved.startsWith(base + path.sep)) {
    await rm(/*turbopackIgnore: true*/ resolved, { force: true }).catch(() => undefined);
  }

  if (cfg.supabaseUrl && cfg.supabaseServiceRoleKey) {
    await fetch(
      `${cfg.supabaseUrl}/storage/v1/object/${encodeURIComponent(cfg.supabaseStorageBucket)}/${objectPath}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${cfg.supabaseServiceRoleKey}`,
          apikey: cfg.supabaseServiceRoleKey,
        },
      }
    ).catch(() => undefined);
  }
}

export async function deleteStayUploadedMedia(stayId: string, mediaUrl: string): Promise<void> {
  const safeStayId = sanitizeSegment(stayId);
  const cfg = getConfig();
  const prefixLocal = `/api/uploads/stays/${safeStayId}/`;

  if (mediaUrl.startsWith(prefixLocal)) {
    const rel = mediaUrl.slice('/api/uploads/'.length);
    const segments = rel.split('/');
    const safeRel = normalizeSafeUploadSegments(segments);
    if (!safeRel) return;
    const base = path.resolve(cfg.localUploadsDir);
    const resolved = path.resolve(base, safeRel);
    if (resolved.startsWith(base + path.sep)) {
      await rm(/*turbopackIgnore: true*/ resolved, { force: true }).catch(() => undefined);
    }
    return;
  }

  if (cfg.supabaseUrl && cfg.supabaseServiceRoleKey) {
    const prefixSupa = `${cfg.supabaseUrl}/storage/v1/object/public/${encodeURIComponent(cfg.supabaseStorageBucket)}/stays/${safeStayId}/`;
    if (mediaUrl.startsWith(prefixSupa)) {
      const objectPath = mediaUrl.slice(
        `${cfg.supabaseUrl}/storage/v1/object/public/${encodeURIComponent(cfg.supabaseStorageBucket)}/`.length
      );
      await fetch(
        `${cfg.supabaseUrl}/storage/v1/object/${encodeURIComponent(cfg.supabaseStorageBucket)}/${objectPath}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${cfg.supabaseServiceRoleKey}`,
            apikey: cfg.supabaseServiceRoleKey,
          },
        }
      ).catch(() => undefined);
    }
  }
}
