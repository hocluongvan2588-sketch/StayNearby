import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AppError, isAppError } from './errors';
import { logEvent } from './logger';

export function getClientIp(req: NextRequest): string {
  const cf = req.headers.get('cf-connecting-ip')?.trim();
  if (cf) return cf;

  const xClient = req.headers.get('x-client-ip')?.trim();
  if (xClient) return xClient;

  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }

  return req.headers.get('x-real-ip')?.trim() || 'local';
}

export async function readOptionalJsonBody(
  req: NextRequest
): Promise<unknown> {
  const rawText = await req.text();
  if (!rawText.trim()) return {};
  return JSON.parse(rawText);
}

export function handleApiError(err: unknown): NextResponse {
  if (isAppError(err)) {
    const headers: Record<string, string> = {};
    if (err.code === 'RATE_LIMITED') {
      const retrySec = Number(err.details?.retryAfterSec ?? 60);
      headers['Retry-After'] = String(
        Number.isFinite(retrySec) && retrySec > 0 ? Math.ceil(retrySec) : 60
      );
    }
    if (err.status >= 500) {
      logEvent('error', 'api.app_error', {
        code: err.code,
        message: err.message,
      });
    }
    return NextResponse.json(err.toJSON(), { status: err.status, headers });
  }

  if (err instanceof ZodError) {
    const appErr = new AppError('VALIDATION_ERROR', 'Invalid request parameters.', {
      issues: err.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    });
    return NextResponse.json(appErr.toJSON(), { status: appErr.status });
  }

  if (err instanceof SyntaxError) {
    const appErr = new AppError('VALIDATION_ERROR', 'Malformed JSON request body.');
    return NextResponse.json(appErr.toJSON(), { status: appErr.status });
  }

  logEvent('error', 'api.unhandled_error', {
    error: err instanceof Error ? { name: err.name, message: err.message } : String(err),
  });
  const internal = new AppError(
    'INTERNAL_ERROR',
    'An unexpected server error occurred.'
  );
  return NextResponse.json(internal.toJSON(), { status: 500 });
}
