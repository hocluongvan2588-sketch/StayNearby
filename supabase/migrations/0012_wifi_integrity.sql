-- Phase A — Wi-Fi data integrity (approved plan).
-- Environment: apply to development/staging FIRST. Production apply is a
-- separate, explicitly approved step — do not run this on prod yet.
--
-- Principles:
--   * NULL  = "chưa cập nhật" — no defaults, no assumed/formula values.
--   * Ping and Jitter are separate columns (wifi_jitter_ms no longer doubles).
--   * wifi_status is the lifecycle source of truth:
--       not_updated -> host_declared | platform_measured -> verified
--       (change after verified -> reverify_pending -> verified)
--   * wifi_measurements is append-only history (host manual, platform
--     measured, and later guest-measured runs during actual stays).

-- ── 1. stay Wi-Fi columns: nullable, no defaults ─────────────────────────────
ALTER TABLE stays
  ALTER COLUMN wifi_download_mbps DROP NOT NULL,
  ALTER COLUMN wifi_download_mbps DROP DEFAULT,
  ALTER COLUMN wifi_upload_mbps DROP NOT NULL,
  ALTER COLUMN wifi_upload_mbps DROP DEFAULT,
  ALTER COLUMN wifi_jitter_ms DROP NOT NULL,
  ALTER COLUMN wifi_jitter_ms DROP DEFAULT,
  ALTER COLUMN wifi_tested_at DROP NOT NULL,
  ALTER COLUMN wifi_tested_at DROP DEFAULT,
  ALTER COLUMN wifi_tester_note DROP NOT NULL,
  ALTER COLUMN wifi_tester_note DROP DEFAULT;

-- ── 2. Measurement history table (created before the stays FK) ───────────────
CREATE TABLE IF NOT EXISTS wifi_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stay_id uuid NOT NULL REFERENCES stays(id) ON DELETE CASCADE,
  booking_id uuid,
  actor_user_id uuid,
  actor_role text NOT NULL CHECK (actor_role IN ('host', 'guest', 'admin')),
  source text NOT NULL CHECK (source IN ('host_manual', 'platform_measured')),
  download_mbps integer CHECK (download_mbps IS NULL OR download_mbps >= 0),
  upload_mbps integer CHECK (upload_mbps IS NULL OR upload_mbps >= 0),
  ping_ms integer CHECK (ping_ms IS NULL OR ping_ms >= 0),
  jitter_ms integer CHECK (jitter_ms IS NULL OR jitter_ms >= 0),
  tested_at timestamptz NOT NULL DEFAULT now(),
  geo_accuracy_m integer,
  distance_to_stay_m integer,
  geo_check text CHECK (
    geo_check IS NULL OR geo_check IN ('near', 'review', 'out_of_range', 'insufficient')
  ),
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wifi_measurements_stay
  ON wifi_measurements (stay_id, tested_at DESC);

-- Deny-by-default RLS, same convention as 0010 (app queries via server pool).
ALTER TABLE wifi_measurements ENABLE ROW LEVEL SECURITY;

-- ── 3. stays: ping, has-service tri-state, lifecycle status, verified link ───
ALTER TABLE stays ADD COLUMN IF NOT EXISTS wifi_ping_ms integer;
ALTER TABLE stays ADD COLUMN IF NOT EXISTS wifi_has_service boolean;
ALTER TABLE stays ADD COLUMN IF NOT EXISTS wifi_status text
  NOT NULL DEFAULT 'not_updated'
  CONSTRAINT wifi_status_check CHECK (
    wifi_status IN ('not_updated', 'host_declared', 'platform_measured', 'reverify_pending', 'verified')
  );
ALTER TABLE stays ADD COLUMN IF NOT EXISTS wifi_verified_measurement_id uuid
  REFERENCES wifi_measurements(id);

-- ── 4. Backfill (idempotent) ─────────────────────────────────────────────────
-- 4a. Existing numeric data is treated as host-declared (never auto-verified).
UPDATE stays SET wifi_status = 'host_declared'
 WHERE wifi_download_mbps IS NOT NULL;

-- 4b. Demo/seed data is NOT real verification: nothing stays verified without
--     a platform measurement backing it. Values/notes/dates are preserved.
UPDATE stays
   SET is_wifi_verified = false,
       wifi_verified_measurement_id = NULL
 WHERE is_wifi_verified = true
    OR wifi_verified_measurement_id IS NOT NULL;

-- 4c. Auto-generated draft values (createDraftStay defaults on converted
--     drafts) -> NULL + not_updated. Only the known generated rows.
UPDATE stays
   SET wifi_download_mbps = NULL,
       wifi_upload_mbps = NULL,
       wifi_jitter_ms = NULL,
       wifi_ping_ms = NULL,
       wifi_tested_at = NULL,
       wifi_tester_note = NULL,
       wifi_has_service = NULL,
       wifi_status = 'not_updated'
 WHERE slug IN ('hgjgj-conv-001', 'jhhjkh-conv-001')
   AND wifi_download_mbps = 100
   AND wifi_upload_mbps = 75;
