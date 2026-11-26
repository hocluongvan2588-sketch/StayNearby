import { dbQuery, toNum } from '@/lib/db';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function GET(
  req: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const url = new URL(req.url);
  const view = url.searchParams.get('view') === 'tour' ? 'tour' : 'proof';

  const res = await dbQuery<{
    title_en: string;
    neighborhood_en: string;
    registration_code: string;
    wifi_download_mbps: number;
    wifi_upload_mbps: number;
    wifi_jitter_ms: number;
    wifi_tester_note: string;
    verification_tier: string;
    is_wifi_verified: boolean;
    is_work_ready: boolean;
    verified_at: string | Date;
    workspace_summary_en: string;
  }>(
    `SELECT title_en, neighborhood_en, registration_code,
            wifi_download_mbps, wifi_upload_mbps, wifi_jitter_ms,
            wifi_tester_note, verification_tier, is_wifi_verified, is_work_ready,
            verified_at, workspace_summary_en
     FROM stays WHERE slug = $1`,
    [slug]
  );

  const s = res.rows[0];
  if (!s) {
    return new Response('Stay not found', { status: 404 });
  }

  const down = toNum(s.wifi_download_mbps, 200);
  const up = toNum(s.wifi_upload_mbps, 150);
  const jitter = toNum(s.wifi_jitter_ms, 3);
  const isVerified = Boolean(s.is_wifi_verified);
  const tierLabel = isVerified
    ? s.verification_tier === 'VIETNOMAD_CERTIFIED'
      ? 'VIETNOMAD WI-FI VERIFIED (ON-SITE TESTED)'
      : 'HOST SPEEDTEST SUBMITTED'
    : 'HOST-REPORTED INTERNET & AMENITIES';
  const verifiedIso = new Date(String(s.verified_at ?? Date.now())).toISOString().slice(0, 10);

  const svg =
    view === 'tour'
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f3d32"/>
      <stop offset="100%" stop-color="#195c4c"/>
    </linearGradient>
  </defs>
  <rect width="960" height="540" rx="20" fill="url(#bg)"/>
  <rect x="36" y="36" width="888" height="468" rx="16" fill="#f7f3eb" fill-opacity="0.06" stroke="#c89d54" stroke-opacity="0.45"/>
  <text x="64" y="92" fill="#e6c486" font-family="system-ui, sans-serif" font-size="14" font-weight="700" letter-spacing="2">WORKSPACE CHECK AND DESK DETAILS</text>
  <text x="64" y="138" fill="#ffffff" font-family="Georgia, serif" font-size="34" font-weight="700">${escapeXml(String(s.title_en))}</text>
  <text x="64" y="170" fill="#cbe3db" font-family="system-ui, sans-serif" font-size="16">${escapeXml(String(s.neighborhood_en))}, Code ${escapeXml(String(s.registration_code))}</text>
  <rect x="64" y="210" width="832" height="120" rx="14" fill="#ffffff" fill-opacity="0.1"/>
  <text x="88" y="246" fill="#e6c486" font-family="system-ui, sans-serif" font-size="13" font-weight="700">DESK SETUP</text>
  <text x="88" y="282" fill="#ffffff" font-family="system-ui, sans-serif" font-size="18">${escapeXml(String(s.workspace_summary_en).slice(0, 86))}</text>
  <text x="88" y="310" fill="#cbe3db" font-family="system-ui, sans-serif" font-size="14">Wi-Fi: ${down} Mbps down, ${up} Mbps up, ${jitter}ms latency, checked ${verifiedIso}</text>
  <rect x="64" y="360" width="380" height="96" rx="12" fill="#134e3f" stroke="#5bb397" stroke-opacity="0.5"/>
  <text x="88" y="396" fill="#9de2c8" font-family="system-ui, sans-serif" font-size="13" font-weight="700">BOOKINGFLOW PAYMENT SPLIT</text>
  <text x="88" y="424" fill="#ffffff" font-family="system-ui, sans-serif" font-size="14">Pay 12% fee online, pay rent to host at check-in</text>
  <rect x="468" y="360" width="428" height="96" rx="12" fill="#c89d54" fill-opacity="0.18" stroke="#c89d54" stroke-opacity="0.6"/>
  <text x="492" y="396" fill="#f5deb3" font-family="system-ui, sans-serif" font-size="13" font-weight="700">BADGE STATUS</text>
  <text x="492" y="424" fill="#ffffff" font-family="system-ui, sans-serif" font-size="15" font-weight="700">${escapeXml(tierLabel)}</text>
</svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
  <defs>
    <linearGradient id="sp" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b1b26"/>
      <stop offset="100%" stop-color="#11343a"/>
    </linearGradient>
  </defs>
  <rect width="960" height="540" rx="20" fill="url(#sp)"/>
  <rect x="36" y="36" width="888" height="468" rx="16" fill="#ffffff" fill-opacity="0.04" stroke="#36d399" stroke-opacity="0.45"/>
  <text x="64" y="88" fill="#5ce1b3" font-family="system-ui, sans-serif" font-size="14" font-weight="700" letter-spacing="2">VIETNOMAD STAYS INTERNET PROFILE</text>
  <text x="64" y="132" fill="#ffffff" font-family="Georgia, serif" font-size="32" font-weight="700">${escapeXml(String(s.title_en))}</text>
  <text x="64" y="164" fill="#9fb9c4" font-family="system-ui, sans-serif" font-size="15">${escapeXml(tierLabel)}, Updated ${verifiedIso}</text>

  <rect x="64" y="200" width="260" height="146" rx="14" fill="#102b36" stroke="#36d399" stroke-opacity="0.5"/>
  <text x="88" y="236" fill="#82a7b4" font-family="system-ui, sans-serif" font-size="13" font-weight="700">DOWNLOAD SPEED</text>
  <text x="88" y="302" fill="#5ce1b3" font-family="system-ui, sans-serif" font-size="48" font-weight="800">${down}</text>
  <text x="206" y="302" fill="#cfe6ed" font-family="system-ui, sans-serif" font-size="18" font-weight="600">Mbps</text>

  <rect x="350" y="200" width="260" height="146" rx="14" fill="#102b36" stroke="#c89d54" stroke-opacity="0.5"/>
  <text x="374" y="236" fill="#82a7b4" font-family="system-ui, sans-serif" font-size="13" font-weight="700">UPLOAD SPEED</text>
  <text x="374" y="302" fill="#f5deb3" font-family="system-ui, sans-serif" font-size="48" font-weight="800">${up}</text>
  <text x="492" y="302" fill="#cfe6ed" font-family="system-ui, sans-serif" font-size="18" font-weight="600">Mbps</text>

  <rect x="636" y="200" width="260" height="146" rx="14" fill="#102b36" stroke="#60a5fa" stroke-opacity="0.5"/>
  <text x="660" y="236" fill="#82a7b4" font-family="system-ui, sans-serif" font-size="13" font-weight="700">LATENCY / JITTER</text>
  <text x="660" y="302" fill="#93c5fd" font-family="system-ui, sans-serif" font-size="48" font-weight="800">${jitter}</text>
  <text x="742" y="302" fill="#cfe6ed" font-family="system-ui, sans-serif" font-size="18" font-weight="600">ms</text>

  <text x="64" y="394" fill="#d5e5ea" font-family="system-ui, sans-serif" font-size="15">Note: ${escapeXml(String(s.wifi_tester_note))}</text>
  <text x="64" y="424" fill="#82a7b4" font-family="system-ui, sans-serif" font-size="14">Code: ${escapeXml(String(s.registration_code))}. ${isVerified ? 'Independently checked Wi-Fi profile.' : 'Self-declared by the host on VietNomad Stays.'}</text>
</svg>`;

  return new Response(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
