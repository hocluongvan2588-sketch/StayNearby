import { NextResponse, type NextRequest } from 'next/server';
import { consumeRateLimit, matchRateLimitRule } from '@/lib/rate-limit';

/**
 * Per-request security layer (Next 16 "proxy", previously middleware):
 *
 * 1. Rate-limits mutating /api traffic (see src/lib/rate-limit.ts);
 *    webhooks/cron/health are exempt so server-to-server calls never throttle.
 * 2. Attaches a per-request Content-Security-Policy with a fresh nonce —
 *    set on the request headers so Next applies the nonce to its own inline
 *    scripts, and on the response headers so the browser enforces it.
 *
 * Static security headers (nosniff, frame options, HSTS, …) live in
 * next.config.ts `headers()`.
 */

function buildContentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    // Tailwind/style attributes: external stylesheets + inline style props.
    "style-src 'self' 'unsafe-inline'",
    // Uploaded stays media, data-URI placeholders, editor blob previews,
    // and external images allowed by the CMS renderer.
    "img-src 'self' data: blob: https:",
    "font-src 'self'",
    // All client fetches are same-origin (Stripe checkout is a redirect).
    "connect-src 'self'",
    // CMS rich-text video embeds (see parseSafeVideoEmbedUrl).
    "frame-src https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
}

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // — 1. Rate limit (non-GET mutations only) —
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const rule = matchRateLimitRule(pathname);
    if (rule) {
      const forwarded = request.headers.get('x-forwarded-for');
      const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
      const result = consumeRateLimit(`${ip}|${pathname}`, rule);
      if (!result.ok) {
        return NextResponse.json(
          {
            error: {
              code: 'RATE_LIMITED',
              message: 'Too many requests. Please try again later.',
            },
          },
          {
            status: 429,
            headers: {
              'Retry-After': String(result.retryAfterSec),
              'Content-Type': 'application/json; charset=utf-8',
            },
          }
        );
      }
    }
  }

  // — 2. CSP with per-request nonce —
  const csp = buildContentSecurityPolicy(crypto.randomUUID());
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('content-security-policy', csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  // Everything except build assets; static file headers still come from
  // next.config.ts, and CSP on asset responses is harmless.
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
};
