import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SessionUser } from '@/lib/auth/session';
import { closeDb, dbQuery, ensureDbReady } from '@/lib/db';
import { searchStays } from '@/modules/catalog';
import {
  createDraftStay,
  recordWifiSpeedTest,
  updateHostStayConfiguration,
  submitHostStayForReview,
} from '@/modules/host';
import { updateAdminStayVerification } from '@/modules/admin';
import { moderateListing } from '@/modules/admin-bos';
import { getAdminActorContext } from '@/modules/admin-rbac';

let tempDir: string;

async function fetchSessionUserByEmail(email: string): Promise<SessionUser> {
  const res = await dbQuery(
    `SELECT id, email, full_name, role, nationality, membership_tier, membership_expires_at,
            reward_credit_vnd, vat_tax_id, preferred_locale, preferred_currency, phone
     FROM users WHERE email = $1`,
    [email]
  );
  const u = res.rows[0]!;
  return {
    id: String(u.id),
    email: String(u.email),
    fullName: String(u.full_name),
    role: u.role as SessionUser['role'],
    nationality: String(u.nationality),
    membershipTier: u.membership_tier as SessionUser['membershipTier'],
    membershipExpiresAt: u.membership_expires_at ? String(u.membership_expires_at) : null,
    rewardCreditVnd: Number(u.reward_credit_vnd),
    vatTaxId: u.vat_tax_id ? String(u.vat_tax_id) : null,
    preferredLocale: u.preferred_locale === 'vi' ? 'vi' : 'en',
    preferredCurrency: 'USD',
    phone: u.phone ? String(u.phone) : null,
  };
}

interface WifiRow {
  [key: string]: unknown;
  wifi_has_service: boolean | null;
  wifi_download_mbps: number | null;
  wifi_upload_mbps: number | null;
  wifi_ping_ms: number | null;
  wifi_jitter_ms: number | null;
  wifi_tested_at: string | null;
  wifi_status: string;
  is_wifi_verified: boolean;
  verified_at: string | null;
}

async function getWifiRow(stayId: string): Promise<WifiRow> {
  const res = await dbQuery<WifiRow>(
    `SELECT wifi_has_service, wifi_download_mbps, wifi_upload_mbps, wifi_ping_ms,
            wifi_jitter_ms, wifi_tested_at, wifi_status, is_wifi_verified, verified_at
     FROM stays WHERE id = $1`,
    [stayId]
  );
  return res.rows[0]!;
}

async function countMeasurements(stayId: string): Promise<number> {
  const res = await dbQuery<{ n: string }>(
    'SELECT count(*) AS n FROM wifi_measurements WHERE stay_id = $1',
    [stayId]
  );
  return Number(res.rows[0]?.n ?? 0);
}

beforeAll(async () => {
  tempDir = mkdtempSync(join(tmpdir(), 'vietnomad-wifi-integrity-'));
  process.env.PGLITE_DATA_DIR = tempDir;
  delete process.env.DATABASE_URL;
  await ensureDbReady();
});

afterAll(async () => {
  await closeDb();
  rmSync(tempDir, { recursive: true, force: true });
});

describe('Wi-Fi data integrity (Phase A): NULL = chưa cập nhật, no defaults, status machine', () => {
  it('seed demo data is host_declared and never auto-verified', async () => {
    const res = await dbQuery<{ wifi_status: string; is_wifi_verified: boolean }>(
      `SELECT wifi_status, is_wifi_verified FROM stays WHERE status = 'live'`
    );
    expect(res.rows.length).toBeGreaterThan(0);
    expect(res.rows.every((r) => r.wifi_status === 'host_declared')).toBe(true);
    expect(res.rows.every((r) => r.is_wifi_verified === false)).toBe(true);
  });

  it('createDraftStay leaves every Wi-Fi field NULL (no100/75/4, no tested_at default)', async () => {
    const host = await fetchSessionUserByEmail('host@vietnomad.demo');
    const stay = await createDraftStay(host, { titleEn: 'Wifi Null Draft' });
    const row = await getWifiRow(stay.id);
    expect(row.wifi_has_service).toBeNull();
    expect(row.wifi_download_mbps).toBeNull();
    expect(row.wifi_upload_mbps).toBeNull();
    expect(row.wifi_ping_ms).toBeNull();
    expect(row.wifi_jitter_ms).toBeNull();
    expect(row.wifi_tested_at).toBeNull();
    expect(row.wifi_status).toBe('not_updated');
    expect(row.is_wifi_verified).toBe(false);
  });

  it('partial declaration via PATCH changes only the provided field (no upload formula)', async () => {
    const host = await fetchSessionUserByEmail('host@vietnomad.demo');
    const stay = await createDraftStay(host, { titleEn: 'Wifi Partial Draft' });

    await updateHostStayConfiguration(host, stay.id, { wifiDownloadMbps: 300 });
    const row = await getWifiRow(stay.id);
    expect(row.wifi_download_mbps).toBe(300);
    expect(row.wifi_upload_mbps).toBeNull(); // never derived (300 × 0.75 must NOT exist)
    expect(row.wifi_ping_ms).toBeNull();
    expect(row.wifi_status).toBe('host_declared');
    expect(row.wifi_tested_at).not.toBeNull();

    const measurements = await countMeasurements(stay.id);
    expect(measurements).toBe(1);
    const m = await dbQuery<{ source: string; download_mbps: number | null; upload_mbps: number | null }>(
      'SELECT source, download_mbps, upload_mbps FROM wifi_measurements WHERE stay_id = $1',
      [stay.id]
    );
    expect(m.rows[0]?.source).toBe('host_manual');
    expect(m.rows[0]?.download_mbps).toBe(300);
    expect(m.rows[0]?.upload_mbps).toBeNull();
  });

  it('full manual declaration records history and never touches stay verified_at', async () => {
    const host = await fetchSessionUserByEmail('host@vietnomad.demo');
    const stay = await createDraftStay(host, { titleEn: 'Wifi Full Draft' });
    const before = await getWifiRow(stay.id);
    expect(before.verified_at).not.toBeNull(); // set at draft creation, admin-owned

    const out = await recordWifiSpeedTest(host, stay.id, {
      downloadMbps: 400,
      uploadMbps: 250,
      pingMs: 14,
      jitterMs: 5,
      note: 'Declared from home router',
    });
    expect(out.status).toBe('host_declared');

    const row = await getWifiRow(stay.id);
    expect(row.wifi_download_mbps).toBe(400);
    expect(row.wifi_upload_mbps).toBe(250);
    expect(row.wifi_ping_ms).toBe(14);
    expect(row.wifi_jitter_ms).toBe(5);
    expect(row.wifi_tested_at).not.toBeNull();
    expect(row.is_wifi_verified).toBe(false);
    // host action must NOT touch verified_at
    expect(new Date(String(row.verified_at)).getTime()).toBe(
      new Date(String(before.verified_at)).getTime()
    );
    expect(await countMeasurements(stay.id)).toBe(1);
  });

  it('admin verifies; changing data afterwards -> reverify_pending, badge drops, history kept', async () => {
    const host = await fetchSessionUserByEmail('host@vietnomad.demo');
    const admin = await fetchSessionUserByEmail('admin@vietnomad.demo');
    const stay = await createDraftStay(host, { titleEn: 'Wifi Verify Flow' });
    await recordWifiSpeedTest(host, stay.id, {
      downloadMbps: 320,
      uploadMbps: 210,
      pingMs: 18,
      jitterMs: 6,
    });

    await updateAdminStayVerification(admin, stay.id, { isWifiVerified: true });
    let row = await getWifiRow(stay.id);
    expect(row.wifi_status).toBe('verified');
    expect(row.is_wifi_verified).toBe(true);
    const verifiedAt = row.verified_at;

    // Host changes speed after verification -> pending re-verification
    await recordWifiSpeedTest(host, stay.id, { downloadMbps: 500, uploadMbps: 300 });
    row = await getWifiRow(stay.id);
    expect(row.wifi_status).toBe('reverify_pending');
    expect(row.is_wifi_verified).toBe(false);
    expect(row.wifi_download_mbps).toBe(500);
    // history anchor untouched by host action
    expect(new Date(String(row.verified_at)).getTime()).toBe(
      new Date(String(verifiedAt)).getTime()
    );

    // History preserved: both declarations remain in wifi_measurements
    expect(await countMeasurements(stay.id)).toBe(2);
    const history = await dbQuery<{ download_mbps: number }>(
      'SELECT download_mbps FROM wifi_measurements WHERE stay_id = $1 ORDER BY tested_at ASC',
      [stay.id]
    );
    expect(history.rows.map((r) => r.download_mbps)).toEqual([320, 500]);
  });

  it('clearing every value returns the listing to not_updated', async () => {
    const host = await fetchSessionUserByEmail('host@vietnomad.demo');
    const stay = await createDraftStay(host, { titleEn: 'Wifi Clear Draft' });
    await recordWifiSpeedTest(host, stay.id, { downloadMbps: 100, uploadMbps: 80 });

    await updateHostStayConfiguration(host, stay.id, {
      wifiHasService: null,
      wifiDownloadMbps: null,
      wifiUploadMbps: null,
      wifiPingMs: null,
      wifiJitterMs: null,
    });
    const row = await getWifiRow(stay.id);
    expect(row.wifi_download_mbps).toBeNull();
    expect(row.wifi_upload_mbps).toBeNull();
    expect(row.wifi_status).toBe('not_updated');
    expect(row.wifi_tested_at).toBeNull();
  });

  it('search: minWifi excludes NULL and wifi_desc sorts NULL last', async () => {
    const host = await fetchSessionUserByEmail('host@vietnomad.demo');
    const admin = await fetchSessionUserByEmail('admin@vietnomad.demo');
    const actor = await getAdminActorContext(admin);

    const noWifi = await createDraftStay(host, { titleEn: 'Search No Wifi' });
    const withWifi = await createDraftStay(host, { titleEn: 'Search With Wifi' });
    await updateHostStayConfiguration(host, withWifi.id, { wifiDownloadMbps: 150 });
    await submitHostStayForReview(host, noWifi.id);
    await submitHostStayForReview(host, withWifi.id);
    await moderateListing(actor, noWifi.id, { status: 'live' });
    await moderateListing(actor, withWifi.id, { status: 'live' });

    const filtered = await searchStays({ minWifiMbps: 100 });
    expect(filtered.some((s) => s.id === noWifi.id)).toBe(false);
    expect(filtered.some((s) => s.id === withWifi.id)).toBe(true);
    expect(filtered.every((s) => s.wifiDownloadMbps !== null)).toBe(true);

    const sorted = await searchStays({ sort: 'wifi_desc' });
    const last = sorted[sorted.length - 1]!;
    expect(last.id).toBe(noWifi.id);
    expect(last.wifiDownloadMbps).toBeNull();
  });
});
