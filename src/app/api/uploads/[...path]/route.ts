import { NextResponse } from 'next/server';
import { readLocalUploadFile } from '@/lib/storage';

export async function GET(
  _req: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await context.params;
  const result = await readLocalUploadFile(segments);
  if (!result) {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(result.buffer), {
    status: 200,
    headers: {
      'Content-Type': result.contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
