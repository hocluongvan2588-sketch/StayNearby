-- Unify all bookings on BookingFlow (remove StayDirect & 1% wallets)
-- Convert mandatory Wi-Fi verification & Work-Ready rules into optional badges and self-declared attributes

-- 1. Migrate existing rows to BookingFlow
UPDATE stays
SET business_model = 'booking_flow'
WHERE business_model <> 'booking_flow';

UPDATE host_applications
SET business_model = 'booking_flow',
    application_fee_eur = 0
WHERE business_model <> 'booking_flow' OR application_fee_eur <> 0;

DELETE FROM bookings
WHERE status = 'direct_referral' OR business_model = 'stay_direct';

DROP TABLE IF EXISTS staydirect_referrals;
DROP TABLE IF EXISTS host_wallets;

-- 2. Update stays constraints & add optional attribute/badge columns
ALTER TABLE stays
  ADD COLUMN IF NOT EXISTS has_workspace BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS is_wifi_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_work_ready BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE stays DROP COLUMN IF EXISTS direct_booking_url;

ALTER TABLE stays DROP CONSTRAINT IF EXISTS stays_business_model_check;
ALTER TABLE stays
  ADD CONSTRAINT stays_business_model_check CHECK (business_model = 'booking_flow');

ALTER TABLE stays DROP CONSTRAINT IF EXISTS stays_kitchen_type_check;
ALTER TABLE stays
  ADD CONSTRAINT stays_kitchen_type_check
  CHECK (kitchen_type IN ('full', 'kitchenette', 'shared', 'none'));

ALTER TABLE stays DROP CONSTRAINT IF EXISTS stays_laundry_type_check;
ALTER TABLE stays
  ADD CONSTRAINT stays_laundry_type_check
  CHECK (laundry_type IN ('in_unit', 'building', 'service', 'none'));

ALTER TABLE stays DROP CONSTRAINT IF EXISTS stays_verification_tier_check;
ALTER TABLE stays
  ALTER COLUMN verification_tier SET DEFAULT 'SELF_DECLARED';
ALTER TABLE stays
  ADD CONSTRAINT stays_verification_tier_check
  CHECK (verification_tier IN ('SELF_DECLARED', 'HOST_VERIFIED', 'VIETNOMAD_CERTIFIED'));

-- Mark pre-existing certified stays as having optional Wi-Fi Verified & Work-Ready badges
UPDATE stays
SET is_wifi_verified = (verification_tier = 'VIETNOMAD_CERTIFIED'),
    is_work_ready = (verification_tier = 'VIETNOMAD_CERTIFIED' AND has_workspace = TRUE);

-- 3. Update bookings constraints (BookingFlow only, no direct_referral)
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_business_model_check;
ALTER TABLE bookings
  ADD CONSTRAINT bookings_business_model_check CHECK (business_model = 'booking_flow');

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings
  ADD CONSTRAINT bookings_status_check
  CHECK (status IN (
    'PENDING_PAYMENT',
    'RESERVED_LOCKED',
    'CHECKED_IN_COMPLETED',
    'REFUNDED_WIFI_MISMATCH',
    'confirmed',
    'completed',
    'cancelled'
  ));

-- 4. Update host_applications (remove €39 verification fee & StayDirect, allow optional amenities)
ALTER TABLE host_applications DROP COLUMN IF EXISTS direct_booking_url;
ALTER TABLE host_applications DROP CONSTRAINT IF EXISTS host_applications_business_model_check;
ALTER TABLE host_applications
  ADD CONSTRAINT host_applications_business_model_check CHECK (business_model = 'booking_flow');

ALTER TABLE host_applications
  ALTER COLUMN application_fee_eur SET DEFAULT 0,
  ALTER COLUMN measured_download_mbps SET DEFAULT 0,
  ALTER COLUMN has_kitchen SET DEFAULT FALSE,
  ALTER COLUMN has_laundry SET DEFAULT FALSE,
  ALTER COLUMN has_workspace SET DEFAULT FALSE;

ALTER TABLE host_applications
  ADD COLUMN IF NOT EXISTS has_ergonomic_chair BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_external_monitor BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS kitchen_type TEXT NOT NULL DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS laundry_type TEXT NOT NULL DEFAULT 'in_unit';
