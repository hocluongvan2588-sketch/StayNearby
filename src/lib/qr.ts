import QRCode from 'qrcode';
import { AppError } from '@/lib/errors';

const AREA_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function buildPublicExploreQrUrl(areaSlug: string, baseOrigin?: string): string {
  const cleanSlug = areaSlug.trim().toLowerCase();
  if (!AREA_SLUG_RE.test(cleanSlug)) {
    throw new AppError('VALIDATION_ERROR', 'Area slug is invalid for QR generation.');
  }
  const cleanPath = `/explore/${cleanSlug}`;
  if (!baseOrigin) {
    return cleanPath;
  }
  try {
    const parsed = new URL(baseOrigin);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return cleanPath;
    }
    return `${parsed.origin}${cleanPath}`;
  } catch {
    return cleanPath;
  }
}

export async function generatePublicExploreQrSvg(
  areaSlug: string,
  baseOrigin?: string
): Promise<{ targetUrl: string; targetPath: string; svg: string }> {
  const cleanSlug = areaSlug.trim().toLowerCase();
  const targetPath = `/explore/${cleanSlug}`;
  const targetUrl = buildPublicExploreQrUrl(cleanSlug, baseOrigin);

  const svg = await QRCode.toString(targetUrl, {
    type: 'svg',
    margin: 2,
    width: 240,
    color: {
      dark: '#14261E',
      light: '#FFFFFF',
    },
  });

  return { targetUrl, targetPath, svg };
}
