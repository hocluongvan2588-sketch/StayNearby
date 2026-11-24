import { describe, expect, it } from 'vitest';
import { buildPublicExploreQrUrl, generatePublicExploreQrSvg } from '@/lib/qr';

describe('Public Local Guide QR builder', () => {
  it('encodes only /explore/[areaSlug] with zero guestId or bookingId', async () => {
    expect(buildPublicExploreQrUrl('tay-ho')).toBe('/explore/tay-ho');
    expect(buildPublicExploreQrUrl('An-Thuong', 'https://staynearby.vn/stays?foo=bar')).toBe(
      'https://staynearby.vn/explore/an-thuong'
    );

    const qr = await generatePublicExploreQrSvg('tay-ho');
    expect(qr.targetPath).toBe('/explore/tay-ho');
    expect(qr.targetUrl).toBe('/explore/tay-ho');
    expect(qr.targetUrl).not.toMatch(/guestId|bookingId|\?|#/i);
    expect(qr.svg).toContain('<svg');
    expect(qr.svg).toContain('</svg>');
  });

  it('rejects malformed slugs or injection attempts', () => {
    expect(() => buildPublicExploreQrUrl('../admin')).toThrow(/invalid/i);
    expect(() => buildPublicExploreQrUrl('tay-ho?guestId=123')).toThrow(/invalid/i);
    expect(() => buildPublicExploreQrUrl('')).toThrow(/invalid/i);
  });
});
