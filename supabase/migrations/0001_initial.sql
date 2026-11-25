CREATE TABLE IF NOT EXISTS schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('nomad', 'host', 'admin')),
  nationality TEXT NOT NULL DEFAULT 'International',
  preferred_locale TEXT NOT NULL DEFAULT 'en' CHECK (preferred_locale IN ('en', 'vi')),
  preferred_currency TEXT NOT NULL DEFAULT 'USD',
  membership_tier TEXT NOT NULL DEFAULT 'free' CHECK (membership_tier IN ('free', 'premium')),
  membership_expires_at TIMESTAMPTZ,
  reward_credit_vnd BIGINT NOT NULL DEFAULT 0,
  vat_tax_id TEXT,
  phone TEXT,
  crm_stage TEXT NOT NULL DEFAULT 'active' CHECK (crm_stage IN ('lead', 'active', 'vip', 'follow_up', 'paused')),
  crm_note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS destinations (
  id UUID PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_vi TEXT NOT NULL,
  region_en TEXT NOT NULL,
  region_vi TEXT NOT NULL,
  tagline_en TEXT NOT NULL,
  tagline_vi TEXT NOT NULL,
  climate_en TEXT NOT NULL,
  climate_vi TEXT NOT NULL,
  visa_summary_en TEXT NOT NULL,
  visa_summary_vi TEXT NOT NULL,
  visa_details_en TEXT NOT NULL,
  visa_details_vi TEXT NOT NULL,
  monthly_cost_usd INTEGER NOT NULL,
  avg_wifi_mbps INTEGER NOT NULL,
  hero_image TEXT NOT NULL,
  map_x NUMERIC(5,2) NOT NULL,
  map_y NUMERIC(5,2) NOT NULL,
  is_featured BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS lifestyles (
  id UUID PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_vi TEXT NOT NULL,
  description_en TEXT NOT NULL,
  description_vi TEXT NOT NULL,
  hero_image TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stays (
  id UUID PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  destination_id UUID NOT NULL REFERENCES destinations(id) ON DELETE RESTRICT,
  title_en TEXT NOT NULL,
  title_vi TEXT NOT NULL,
  subtitle_en TEXT NOT NULL,
  subtitle_vi TEXT NOT NULL,
  description_en TEXT NOT NULL,
  description_vi TEXT NOT NULL,
  neighborhood_en TEXT NOT NULL,
  neighborhood_vi TEXT NOT NULL,
  exact_address TEXT NOT NULL,
  checkin_instructions_en TEXT NOT NULL,
  checkin_instructions_vi TEXT NOT NULL,
  registration_code TEXT NOT NULL DEFAULT '',
  property_type TEXT NOT NULL CHECK (property_type IN ('apartment', 'coliving', 'boutique_hotel', 'villa', 'eco_lodge')),
  business_model TEXT NOT NULL DEFAULT 'booking_flow' CHECK (business_model IN ('booking_flow', 'stay_direct')),
  direct_booking_url TEXT,
  status TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('pending_review', 'live', 'limited', 'paused')),
  is_instant_book BOOLEAN NOT NULL DEFAULT TRUE,
  cancellation_policy TEXT NOT NULL DEFAULT 'flexible' CHECK (cancellation_policy IN ('flexible', 'moderate', 'strict')),
  wifi_download_mbps INTEGER NOT NULL DEFAULT 100,
  wifi_upload_mbps INTEGER NOT NULL DEFAULT 60,
  wifi_jitter_ms INTEGER NOT NULL DEFAULT 4,
  wifi_tested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  wifi_tester_note TEXT NOT NULL DEFAULT 'Verified on-site speed test',
  workspace_summary_en TEXT NOT NULL,
  workspace_summary_vi TEXT NOT NULL,
  workspace_photo_url TEXT NOT NULL,
  has_ergonomic_chair BOOLEAN NOT NULL DEFAULT TRUE,
  has_external_monitor BOOLEAN NOT NULL DEFAULT FALSE,
  has_call_booth BOOLEAN NOT NULL DEFAULT FALSE,
  kitchen_type TEXT NOT NULL DEFAULT 'full' CHECK (kitchen_type IN ('full', 'kitchenette', 'shared')),
  laundry_type TEXT NOT NULL DEFAULT 'in_unit' CHECK (laundry_type IN ('in_unit', 'building', 'service')),
  pet_friendly BOOLEAN NOT NULL DEFAULT FALSE,
  wheelchair_friendly BOOLEAN NOT NULL DEFAULT FALSE,
  google_rating NUMERIC(3,1) NOT NULL DEFAULT 4.8,
  google_review_count INTEGER NOT NULL DEFAULT 36,
  map_x NUMERIC(5,2) NOT NULL,
  map_y NUMERIC(5,2) NOT NULL,
  hero_image TEXT NOT NULL,
  gallery_images JSONB NOT NULL DEFAULT '[]'::jsonb,
  amenities JSONB NOT NULL DEFAULT '[]'::jsonb,
  nearby_coworking JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stay_lifestyles (
  stay_id UUID NOT NULL REFERENCES stays(id) ON DELETE CASCADE,
  lifestyle_id UUID NOT NULL REFERENCES lifestyles(id) ON DELETE CASCADE,
  PRIMARY KEY (stay_id, lifestyle_id)
);

CREATE TABLE IF NOT EXISTS stay_rooms (
  id UUID PRIMARY KEY,
  stay_id UUID NOT NULL REFERENCES stays(id) ON DELETE CASCADE,
  name_en TEXT NOT NULL,
  name_vi TEXT NOT NULL,
  description_en TEXT NOT NULL,
  description_vi TEXT NOT NULL,
  max_guests INTEGER NOT NULL DEFAULT 2,
  beds_count INTEGER NOT NULL DEFAULT 1,
  units_total INTEGER NOT NULL DEFAULT 1,
  room_image TEXT NOT NULL,
  room_features JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS stay_packages (
  id UUID PRIMARY KEY,
  stay_id UUID NOT NULL REFERENCES stays(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES stay_rooms(id) ON DELETE CASCADE,
  name_en TEXT NOT NULL,
  name_vi TEXT NOT NULL,
  description_en TEXT NOT NULL,
  description_vi TEXT NOT NULL,
  valid_from DATE NOT NULL,
  valid_to DATE NOT NULL,
  is_listed BOOLEAN NOT NULL DEFAULT TRUE,
  wholesale_7_vnd BIGINT NOT NULL,
  wholesale_14_vnd BIGINT NOT NULL,
  wholesale_21_vnd BIGINT NOT NULL,
  wholesale_30_vnd BIGINT NOT NULL,
  compare_30_vnd BIGINT,
  extra_night_vnd BIGINT NOT NULL,
  is_deal_featured BOOLEAN NOT NULL DEFAULT FALSE,
  deal_month_label TEXT NOT NULL DEFAULT 'Next Month'
);

CREATE TABLE IF NOT EXISTS room_night_locks (
  id UUID PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES stay_rooms(id) ON DELETE CASCADE,
  stay_date DATE NOT NULL,
  booked_units INTEGER NOT NULL DEFAULT 0,
  blocked_units INTEGER NOT NULL DEFAULT 0,
  UNIQUE (room_id, stay_date)
);

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY,
  booking_code TEXT NOT NULL UNIQUE,
  stay_id UUID NOT NULL REFERENCES stays(id) ON DELETE RESTRICT,
  room_id UUID NOT NULL REFERENCES stay_rooms(id) ON DELETE RESTRICT,
  package_id UUID NOT NULL REFERENCES stay_packages(id) ON DELETE RESTRICT,
  guest_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  business_model TEXT NOT NULL CHECK (business_model IN ('booking_flow', 'stay_direct')),
  status TEXT NOT NULL CHECK (status IN ('confirmed', 'completed', 'cancelled', 'direct_referral')),
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  nights INTEGER NOT NULL CHECK (nights >= 7),
  guests_count INTEGER NOT NULL DEFAULT 1,
  wholesale_total_vnd BIGINT NOT NULL,
  service_fee_vnd BIGINT NOT NULL DEFAULT 0,
  vat_discount_vnd BIGINT NOT NULL DEFAULT 0,
  reward_credit_used_vnd BIGINT NOT NULL DEFAULT 0,
  guest_total_vnd BIGINT NOT NULL,
  reward_credit_earned_vnd BIGINT NOT NULL DEFAULT 0,
  cancellation_policy TEXT NOT NULL,
  refund_amount_vnd BIGINT NOT NULL DEFAULT 0,
  credit_issued_vnd BIGINT NOT NULL DEFAULT 0,
  guest_note TEXT NOT NULL DEFAULT '',
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS host_applications (
  id UUID PRIMARY KEY,
  applicant_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  stay_name TEXT NOT NULL,
  destination_slug TEXT NOT NULL,
  property_type TEXT NOT NULL,
  business_model TEXT NOT NULL CHECK (business_model IN ('booking_flow', 'stay_direct')),
  application_fee_eur INTEGER NOT NULL DEFAULT 39,
  application_fee_paid BOOLEAN NOT NULL DEFAULT TRUE,
  measured_download_mbps INTEGER NOT NULL DEFAULT 100,
  has_kitchen BOOLEAN NOT NULL DEFAULT TRUE,
  has_laundry BOOLEAN NOT NULL DEFAULT TRUE,
  has_workspace BOOLEAN NOT NULL DEFAULT TRUE,
  direct_booking_url TEXT,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'approved', 'rejected')),
  review_note TEXT NOT NULL DEFAULT '',
  created_stay_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS host_wallets (
  host_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance_vnd BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staydirect_referrals (
  id UUID PRIMARY KEY,
  stay_id UUID NOT NULL REFERENCES stays(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES stay_packages(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nights INTEGER NOT NULL,
  retail_total_vnd BIGINT NOT NULL,
  referral_fee_vnd BIGINT NOT NULL,
  destination_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS saved_stays (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stay_id UUID NOT NULL REFERENCES stays(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, stay_id)
);

CREATE TABLE IF NOT EXISTS nomad_events (
  id UUID PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  city_en TEXT NOT NULL,
  city_vi TEXT NOT NULL,
  title_en TEXT NOT NULL,
  title_vi TEXT NOT NULL,
  event_date TEXT NOT NULL,
  venue_en TEXT NOT NULL,
  venue_vi TEXT NOT NULL,
  spots_total INTEGER NOT NULL DEFAULT 30,
  spots_taken INTEGER NOT NULL DEFAULT 14,
  image_url TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS event_rsvps (
  event_id UUID NOT NULL REFERENCES nomad_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, user_id)
);

CREATE TABLE IF NOT EXISTS marketplace_items (
  id UUID PRIMARY KEY,
  category TEXT NOT NULL,
  title_en TEXT NOT NULL,
  title_vi TEXT NOT NULL,
  partner_name TEXT NOT NULL,
  summary_en TEXT NOT NULL,
  summary_vi TEXT NOT NULL,
  price_label TEXT NOT NULL,
  member_perk_en TEXT NOT NULL,
  member_perk_vi TEXT NOT NULL,
  cta_url TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stays_dest ON stays(destination_id);
CREATE INDEX IF NOT EXISTS idx_stays_status ON stays(status);
CREATE INDEX IF NOT EXISTS idx_packages_stay ON stay_packages(stay_id);
CREATE INDEX IF NOT EXISTS idx_bookings_guest ON bookings(guest_id);
CREATE INDEX IF NOT EXISTS idx_bookings_stay ON bookings(stay_id);
