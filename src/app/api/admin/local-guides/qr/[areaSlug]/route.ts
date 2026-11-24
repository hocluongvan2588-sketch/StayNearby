import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/rbac';
import { getCurrentUser } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { handleApiError } from '@/lib/http';
import { generatePublicExploreQrSvg } from '@/lib/qr';
import { getExploreAreaDetail } from '@/modules/local-guides';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ areaSlug: string }> }
) {
  try {
    const user = await getCurrentUser();
    requireRole(user, 'admin');

    const { areaSlug } = await context.params;
    const area = await getExploreAreaDetail(areaSlug);
    if (!area) {
      throw new AppError('NOT_FOUND', 'Khu vực không tồn tại hoặc chưa được công bố.');
    }

    const mode = req.nextUrl.searchParams.get('mode') || 'path';
    let baseOrigin: string | undefined;
    if (mode === 'full') {
      const forwardedProto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
      const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
      const host = forwardedHost || req.headers.get('host');
      if (host) {
        const proto = forwardedProto || (host.startsWith('localhost') ? 'http' : 'https');
        baseOrigin = `${proto}://${host}`;
      }
    }

    const qr = await generatePublicExploreQrSvg(area.slug, baseOrigin);

    if (req.nextUrl.searchParams.get('format') === 'svg') {
      return new NextResponse(qr.svg, {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Content-Disposition': `attachment; filename="staynearby-explore-${area.slug}.svg"`,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      areaSlug: area.slug,
      areaNameVi: area.nameVi,
      targetPath: qr.targetPath,
      targetUrl: qr.targetUrl,
      svg: qr.svg,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
