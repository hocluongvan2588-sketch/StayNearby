import { NextResponse } from 'next/server';
import { isAppError } from './errors';

export function okJson(data: Record<string, unknown>, status = 200) {
  return NextResponse.json({ ok: true, ...data }, { status });
}

export function errJson(err: unknown) {
  if (isAppError(err)) {
    return NextResponse.json(
      { ok: false, error: { code: err.code, message: err.message, details: err.details } },
      { status: err.status }
    );
  }
  console.error('[api_error]', err);
  return NextResponse.json(
    { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error.' } },
    { status: 500 }
  );
}
