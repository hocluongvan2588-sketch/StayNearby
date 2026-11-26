import crypto from 'node:crypto';

function escapeXml(str: string): string {
  return str.replace(/[<>&'"]/g, '');
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ref = escapeXml((url.searchParams.get('ref') || 'VN000000').slice(0, 24));
  const amount = Number(url.searchParams.get('amount') || 0);
  const hash = crypto.createHash('sha256').update(`${ref}:${amount}`).digest();

  const size = 21;
  const cells: string[] = [];
  const isFinder = (r: number, c: number) =>
    (r < 7 && c < 7) || (r < 7 && c >= size - 7) || (r >= size - 7 && c < 7);

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (isFinder(r, c)) {
        const lr = r < 7 ? r : r - (size - 7);
        const lc = c < 7 ? c : c - (size - 7);
        const border = lr === 0 || lr === 6 || lc === 0 || lc === 6;
        const inner = lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4;
        if (border || inner) {
          cells.push(`<rect x="${22 + c * 8}" y="${22 + r * 8}" width="8" height="8" fill="#164E3F"/>`);
        }
      } else {
        const bitIndex = (r * size + c) % 256;
        const byte = hash[Math.floor(bitIndex / 8)];
        if ((byte >> (bitIndex % 8)) & 1) {
          cells.push(`<rect x="${22 + c * 8}" y="${22 + r * 8}" width="8" height="8" fill="#17221E"/>`);
        }
      }
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="212" height="242" viewBox="0 0 212 242">
  <rect width="212" height="242" rx="16" fill="#ffffff" stroke="#E5DFD3" stroke-width="2"/>
  ${cells.join('')}
  <text x="106" y="210" text-anchor="middle" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#164E3F">VIETQR SANDBOX</text>
  <text x="106" y="227" text-anchor="middle" font-family="monospace" font-size="11" fill="#53635D">${ref}</text>
</svg>`;

  return new Response(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
