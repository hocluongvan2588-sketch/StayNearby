-- PRD: 12% Booking Fee Online, Pay-at-Check-in, Verification Tiers, Automated Notifications & iCal Sync

ALTER TABLE stays
  ADD COLUMN IF NOT EXISTS speedtest_proof_url TEXT,
  ADD COLUMN IF NOT EXISTS workspace_video_url TEXT,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_tier TEXT NOT NULL DEFAULT 'VIETNOMAD_CERTIFIED',
  ADD COLUMN IF NOT EXISTS host_whatsapp TEXT NOT NULL DEFAULT '+84901234567';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stays_verification_tier_check'
  ) THEN
    ALTER TABLE stays
      ADD CONSTRAINT stays_verification_tier_check
      CHECK (verification_tier IN ('HOST_VERIFIED', 'VIETNOMAD_CERTIFIED'));
  END IF;
END $$;

UPDATE stays
SET verified_at = COALESCE(verified_at, wifi_tested_at)
WHERE verified_at IS NULL;

ALTER TABLE stay_rooms
  ADD COLUMN IF NOT EXISTS ical_url TEXT,
  ADD COLUMN IF NOT EXISTS ical_last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ical_sync_status TEXT NOT NULL DEFAULT 'idle';

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS booking_fee_online_vnd BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pay_at_checkin_vnd BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mismatch_reason TEXT NOT NULL DEFAULT '';

DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'bookings'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE bookings DROP CONSTRAINT IF EXISTS %I', c.conname);
  END LOOP;

  ALTER TABLE bookings
    ADD CONSTRAINT bookings_status_check
    CHECK (status IN (
      'PENDING_PAYMENT',
      'RESERVED_LOCKED',
      'CHECKED_IN_COMPLETED',
      'REFUNDED_WIFI_MISMATCH',
      'confirmed',
      'completed',
      'cancelled',
      'direct_referral'
    ));
END $$;

UPDATE bookings
SET
  booking_fee_online_vnd = CASE
    WHEN booking_fee_online_vnd = 0 AND business_model = 'booking_flow'
      THEN GREATEST(0, guest_total_vnd - wholesale_total_vnd)
    ELSE booking_fee_online_vnd
  END,
  pay_at_checkin_vnd = CASE
    WHEN pay_at_checkin_vnd = 0 THEN wholesale_total_vnd
    ELSE pay_at_checkin_vnd
  END,
  status = CASE
    WHEN status = 'confirmed' THEN 'RESERVED_LOCKED'
    WHEN status = 'completed' THEN 'CHECKED_IN_COMPLETED'
    ELSE status
  END
WHERE booking_fee_online_vnd = 0 OR pay_at_checkin_vnd = 0 OR status IN ('confirmed', 'completed');

CREATE TABLE IF NOT EXISTS booking_notifications (
  id UUID PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  recipient_role TEXT NOT NULL CHECK (recipient_role IN ('guest', 'host', 'admin')),
  channel TEXT NOT NULL CHECK (channel IN ('email', 'webhook', 'whatsapp')),
  recipient_contact TEXT NOT NULL,
  subject TEXT NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'sent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_booking ON booking_notifications(booking_id);
CREATE INDEX IF NOT EXISTS idx_rooms_ical ON stay_rooms(ical_url);
