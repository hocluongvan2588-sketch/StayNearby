/**
 * Wi-Fi information lifecycle (Phase A — data integrity).
 *
 * wifi_status on stays is the single source of truth:
 *   not_updated      — nothing provided yet (all Wi-Fi fields NULL)
 *   host_declared    — host entered values manually (no platform measurement)
 *   platform_measured— recorded by the VietNomad speed-test tool (Phase B)
 *   reverify_pending — previously verified data changed; awaiting re-review
 *   verified         — VietNomad confirmed (never set by the host)
 */

export const WIFI_STATUSES = [
  'not_updated',
  'host_declared',
  'platform_measured',
  'reverify_pending',
  'verified',
] as const;

export type WifiStatus = (typeof WIFI_STATUSES)[number];

export function isWifiStatus(value: unknown): value is WifiStatus {
  return typeof value === 'string' && (WIFI_STATUSES as readonly string[]).includes(value);
}

export function normalizeWifiStatus(value: unknown): WifiStatus {
  return isWifiStatus(value) ? value : 'not_updated';
}

export interface WifiStatePatch {
  wifiHasService?: boolean | null;
  wifiDownloadMbps?: number | null;
  wifiUploadMbps?: number | null;
  wifiPingMs?: number | null;
  wifiJitterMs?: number | null;
}

export interface WifiNextState {
  hasService: boolean | null;
  downloadMbps: number | null;
  uploadMbps: number | null;
  pingMs: number | null;
  jitterMs: number | null;
  /** True when any provided field differs from the current row. */
  changed: boolean;
  /** True when at least one speed/has-service value is present. */
  hasAnyValue: boolean;
  /** True when any speed number changed (drives wifi_tested_at = now). */
  speedChanged: boolean;
  status: WifiStatus;
  /** True when a verified listing's data changed -> badge must drop. */
  verificationLost: boolean;
}

export function toNumOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Compute the next Wi-Fi state from a partial patch against the current row.
 * Rules (approved):
 *   - No formulas, no defaults: unprovided fields keep their current value.
 *   - Clearing every value -> not_updated.
 *   - Changing data while verified -> reverify_pending (badge drops).
 *   - Otherwise declaring values -> host_declared (manual path).
 */
export function computeWifiNext(
  current: {
    wifi_has_service?: boolean | null;
    wifi_download_mbps?: number | null;
    wifi_upload_mbps?: number | null;
    wifi_ping_ms?: number | null;
    wifi_jitter_ms?: number | null;
    wifi_status?: string | null;
    is_wifi_verified?: boolean | null;
  },
  patch: WifiStatePatch
): WifiNextState {
  const hasService =
    patch.wifiHasService !== undefined ? patch.wifiHasService : (current.wifi_has_service ?? null);
  const downloadMbps =
    patch.wifiDownloadMbps !== undefined
      ? patch.wifiDownloadMbps
      : toNumOrNull(current.wifi_download_mbps);
  const uploadMbps =
    patch.wifiUploadMbps !== undefined
      ? patch.wifiUploadMbps
      : toNumOrNull(current.wifi_upload_mbps);
  const pingMs = patch.wifiPingMs !== undefined ? patch.wifiPingMs : toNumOrNull(current.wifi_ping_ms);
  const jitterMs =
    patch.wifiJitterMs !== undefined ? patch.wifiJitterMs : toNumOrNull(current.wifi_jitter_ms);

  const cur = {
    hasService: current.wifi_has_service ?? null,
    downloadMbps: toNumOrNull(current.wifi_download_mbps),
    uploadMbps: toNumOrNull(current.wifi_upload_mbps),
    pingMs: toNumOrNull(current.wifi_ping_ms),
    jitterMs: toNumOrNull(current.wifi_jitter_ms),
  };

  const changed =
    hasService !== cur.hasService ||
    downloadMbps !== cur.downloadMbps ||
    uploadMbps !== cur.uploadMbps ||
    pingMs !== cur.pingMs ||
    jitterMs !== cur.jitterMs;

  const speedChanged =
    downloadMbps !== cur.downloadMbps ||
    uploadMbps !== cur.uploadMbps ||
    pingMs !== cur.pingMs ||
    jitterMs !== cur.jitterMs;

  const hasAnyValue =
    hasService !== null ||
    downloadMbps !== null ||
    uploadMbps !== null ||
    pingMs !== null ||
    jitterMs !== null;

  const prevStatus = normalizeWifiStatus(current.wifi_status);
  let status: WifiStatus = prevStatus;
  if (changed) {
    if (!hasAnyValue) status = 'not_updated';
    else if (prevStatus === 'verified') status = 'reverify_pending';
    else if (prevStatus === 'platform_measured' && !speedChanged) status = prevStatus;
    else status = 'host_declared';
  }

  const verificationLost =
    changed && (prevStatus === 'verified' || current.is_wifi_verified === true) && status !== 'verified';

  return {
    hasService,
    downloadMbps,
    uploadMbps,
    pingMs,
    jitterMs,
    changed,
    hasAnyValue,
    speedChanged,
    status,
    verificationLost,
  };
}

/** Status label for UI (guest detail + host editor). */
export function wifiStatusLabel(status: WifiStatus, isVi: boolean): string {
  switch (status) {
    case 'host_declared':
      return isVi ? 'Chủ nhà khai báo' : 'Host declared';
    case 'platform_measured':
      return isVi ? 'Đo trên nền tảng VietNomad' : 'Measured on VietNomad';
    case 'reverify_pending':
      return isVi ? 'Chờ xác minh lại' : 'Awaiting re-verification';
    case 'verified':
      return isVi ? 'Đã VietNomad xác minh' : 'Verified by VietNomad';
    case 'not_updated':
    default:
      return isVi ? 'Chưa cập nhật' : 'Not updated';
  }
}
