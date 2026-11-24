-- StayNearby Initial Schema (PostgreSQL 16+ / Supabase compatible)
-- All timestamps are stored in UTC (TIMESTAMPTZ).
-- All monetary amounts are stored as integer VND.
-- Stay intervals use half-open dates [check_in, check_out) in listing area timezone.

-- 1. Profiles & Roles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  preferred_locale TEXT NOT NULL DEFAULT 'en' CHECK (preferred_locale IN ('en', 'vi')),
  phone TEXT,
  password_hash TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roles (
  code TEXT PRIMARY KEY CHECK (code IN ('guest', 'host', 'admin')),
  label_en TEXT NOT NULL,
  label_vi TEXT NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_code TEXT NOT NULL REFERENCES roles(code) ON DELETE RESTRICT,
  granted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, role_code)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_role_code ON user_roles(role_code);

-- 2. Geographic Areas
CREATE TABLE IF NOT EXISTS areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_vi TEXT NOT NULL,
  city_en TEXT NOT NULL,
  city_vi TEXT NOT NULL,
  country_code CHAR(2) NOT NULL DEFAULT 'VN',
  timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  description_en TEXT NOT NULL DEFAULT '',
  description_vi TEXT NOT NULL DEFAULT '',
  hero_image_path TEXT,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_areas_published ON areas(is_published, city_en);

-- 3. Listings, Revisions, Photos & Amenities
CREATE TABLE IF NOT EXISTS listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  area_id UUID NOT NULL REFERENCES areas(id) ON DELETE RESTRICT,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_review', 'changes_requested', 'published', 'suspended')),
  property_type TEXT NOT NULL
    CHECK (property_type IN ('apartment', 'studio', 'villa', 'house', 'homestay')),
  max_guests INTEGER NOT NULL CHECK (max_guests >= 1 AND max_guests <= 20),
  bedrooms INTEGER NOT NULL DEFAULT 1 CHECK (bedrooms >= 0),
  beds INTEGER NOT NULL DEFAULT 1 CHECK (beds >= 1),
  bathrooms NUMERIC(3, 1) NOT NULL DEFAULT 1.0 CHECK (bathrooms >= 0.5),
  min_nights INTEGER NOT NULL DEFAULT 1 CHECK (min_nights >= 1),
  max_nights INTEGER NOT NULL DEFAULT 90 CHECK (max_nights >= min_nights),
  base_nightly_rate_vnd INTEGER NOT NULL CHECK (base_nightly_rate_vnd > 0),
  cleaning_fee_vnd INTEGER NOT NULL DEFAULT 0 CHECK (cleaning_fee_vnd >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'VND' CHECK (currency = 'VND'),
  cancellation_policy_version TEXT NOT NULL DEFAULT 'flexible_24h',
  payment_terms TEXT NOT NULL DEFAULT 'Pay the host directly',
  payment_terms_details_en TEXT NOT NULL DEFAULT 'Pay the host directly upon check-in or via bank transfer as agreed before arrival.',
  payment_terms_details_vi TEXT NOT NULL DEFAULT 'Thanh toán trực tiếp cho chủ nhà khi nhận phòng hoặc chuyển khoản theo thỏa thuận đã công bố.',

  -- Published public projection (null until first approval)
  published_title_en TEXT,
  published_summary_en TEXT,
  published_description_en TEXT,
  published_house_rules_en JSONB NOT NULL DEFAULT '[]'::jsonb,
  published_workspace_wifi_mbps INTEGER CHECK (published_workspace_wifi_mbps IS NULL OR published_workspace_wifi_mbps > 0),
  published_has_dedicated_desk BOOLEAN NOT NULL DEFAULT FALSE,
  published_workspace_notes_en TEXT,

  -- Private host/admin/confirmed-guest-only fields (never exposed to public catalog queries)
  exact_address TEXT NOT NULL DEFAULT '',
  checkin_instructions_en TEXT NOT NULL DEFAULT '',
  host_contact_phone TEXT,

  -- Moderation audit fields
  review_note TEXT,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,

  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_listings_public_search
  ON listings(status, area_id, max_guests, base_nightly_rate_vnd);
CREATE INDEX IF NOT EXISTS idx_listings_host ON listings(host_id, status);

CREATE TABLE IF NOT EXISTS listing_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL CHECK (revision_number >= 1),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected')),
  title_en TEXT NOT NULL,
  summary_en TEXT NOT NULL,
  description_en TEXT NOT NULL,
  house_rules_en JSONB NOT NULL DEFAULT '[]'::jsonb,
  workspace_wifi_mbps INTEGER CHECK (workspace_wifi_mbps IS NULL OR workspace_wifi_mbps > 0),
  has_dedicated_desk BOOLEAN NOT NULL DEFAULT FALSE,
  workspace_notes_en TEXT,
  exact_address TEXT NOT NULL,
  checkin_instructions_en TEXT NOT NULL DEFAULT '',
  rejection_reason TEXT,
  submitted_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (listing_id, revision_number)
);

CREATE INDEX IF NOT EXISTS idx_listing_revisions_listing ON listing_revisions(listing_id, status);

CREATE TABLE IF NOT EXISTS listing_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  revision_id UUID REFERENCES listing_revisions(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  public_url TEXT,
  alt_text_en TEXT NOT NULL,
  alt_text_vi TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_cover BOOLEAN NOT NULL DEFAULT FALSE,
  is_draft BOOLEAN NOT NULL DEFAULT FALSE,
  mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
  size_bytes INTEGER NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_listing_photos_listing ON listing_photos(listing_id, is_draft, sort_order);

CREATE TABLE IF NOT EXISTS amenities (
  code TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('workspace', 'essentials', 'kitchen', 'building', 'outdoor')),
  label_en TEXT NOT NULL,
  label_vi TEXT NOT NULL,
  icon_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS listing_amenities (
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  amenity_code TEXT NOT NULL REFERENCES amenities(code) ON DELETE RESTRICT,
  note_en TEXT,
  PRIMARY KEY (listing_id, amenity_code)
);

-- 4. Pricing Overrides & Bookings
CREATE TABLE IF NOT EXISTS nightly_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  night_date DATE NOT NULL,
  nightly_rate_vnd INTEGER NOT NULL CHECK (nightly_rate_vnd > 0),
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (listing_id, night_date)
);

CREATE INDEX IF NOT EXISTS idx_nightly_rates_lookup ON nightly_rates(listing_id, night_date);

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_code TEXT NOT NULL UNIQUE,
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE RESTRICT,
  guest_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  guests_count INTEGER NOT NULL CHECK (guests_count >= 1),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'declined', 'withdrawn', 'expired', 'cancelled', 'completed')),
  expires_at TIMESTAMPTZ NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_payload_hash TEXT NOT NULL,
  quote_hash TEXT NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'VND' CHECK (currency = 'VND'),
  nightly_breakdown JSONB NOT NULL,
  accommodation_subtotal_vnd INTEGER NOT NULL CHECK (accommodation_subtotal_vnd >= 0),
  cleaning_fee_vnd INTEGER NOT NULL DEFAULT 0 CHECK (cleaning_fee_vnd >= 0),
  total_vnd INTEGER NOT NULL CHECK (total_vnd > 0),
  payment_terms TEXT NOT NULL DEFAULT 'Pay the host directly',
  payment_terms_details_en TEXT NOT NULL,
  cancellation_policy_version TEXT NOT NULL,
  cancellation_policy_snapshot JSONB NOT NULL,
  host_timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  guest_note TEXT,
  host_response_note TEXT,
  cancellation_reason TEXT,
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (check_out > check_in),
  UNIQUE (guest_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_bookings_guest ON bookings(guest_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_listing ON bookings(listing_id, status, expires_at);

CREATE TABLE IF NOT EXISTS occupancy_nights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  night_date DATE NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('booking', 'host_block')),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  block_reason TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (listing_id, night_date),
  CHECK (
    (source_type = 'booking' AND booking_id IS NOT NULL)
    OR (source_type = 'host_block' AND booking_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_occupancy_nights_lookup ON occupancy_nights(listing_id, night_date);
CREATE INDEX IF NOT EXISTS idx_occupancy_nights_booking ON occupancy_nights(booking_id);

-- 5. Audit Trail & Notification Outbox
CREATE TABLE IF NOT EXISTS booking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_role TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_events_booking ON booking_events(booking_id, created_at ASC);

CREATE TABLE IF NOT EXISTS outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id UUID NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox(status, next_retry_at);

-- 6. Local Guides (Stage 4 foundation tables)
CREATE TABLE IF NOT EXISTS local_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  theme TEXT NOT NULL CHECK (theme IN ('food', 'culture', 'leisure')),
  short_description_en TEXT NOT NULL,
  image_path TEXT,
  estimated_cost_vnd INTEGER NOT NULL DEFAULT 0 CHECK (estimated_cost_vnd >= 0),
  budget_tier TEXT NOT NULL CHECK (budget_tier IN ('budget', 'moderate', 'splurge')),
  maps_url TEXT NOT NULL,
  google_place_id TEXT,
  partner_booking_url TEXT,
  source TEXT NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS local_guides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  title_en TEXT NOT NULL,
  summary_en TEXT NOT NULL,
  theme TEXT NOT NULL CHECK (theme IN ('food', 'culture', 'leisure')),
  duration_bucket TEXT NOT NULL CHECK (duration_bucket IN ('1_2_hours', 'half_day')),
  budget_tier TEXT NOT NULL CHECK (budget_tier IN ('budget', 'moderate', 'splurge')),
  estimated_total_vnd INTEGER NOT NULL DEFAULT 0 CHECK (estimated_total_vnd >= 0),
  cover_image_path TEXT,
  source TEXT NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS local_guide_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id UUID NOT NULL REFERENCES local_guides(id) ON DELETE CASCADE,
  place_id UUID NOT NULL REFERENCES local_places(id) ON DELETE RESTRICT,
  stop_order INTEGER NOT NULL CHECK (stop_order >= 1),
  recommended_items_en TEXT,
  local_notes_en TEXT,
  UNIQUE (guide_id, stop_order)
);
