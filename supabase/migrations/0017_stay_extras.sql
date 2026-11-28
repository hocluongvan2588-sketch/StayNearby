--0017_stay_extras.sql — Stay Extras: host-provided additional services.
-- Additive only: no changes to pricing, payment, or booking fee logic.
-- Extras never enter the platform-fee inputs (fee is computed from stay
-- wholesale/service fee only, unchanged).

--1. Platform service catalog (managed + toggleable from Admin BOS).
CREATE TABLE IF NOT EXISTS service_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_vi TEXT NOT NULL,
  allowed_units TEXT[] NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO service_catalog (key, name_en, name_vi, allowed_units, sort_order) VALUES
  ('motorbike_rental', 'Motorbike rental', 'Thuê xe máy', ARRAY['day','week','month','quote'], 10),
  ('bike_rental', 'Bicycle rental', 'Thuê xe đạp', ARRAY['day','week','quote'], 20),
  ('airport_pickup', 'Airport pickup', 'Đón tại sân bay', ARRAY['trip','quote'], 30),
  ('airport_dropoff', 'Airport drop-off', 'Đưa ra sân bay', ARRAY['trip','quote'], 40),
  ('monitor_rental', 'Monitor rental', 'Thuê màn hình làm việc', ARRAY['day','week','month','quote'], 50),
  ('work_gear_rental', 'Other work equipment', 'Thuê thiết bị làm việc khác', ARRAY['day','week','month','quote'], 60),
  ('room_cleaning', 'Periodic room cleaning', 'Dọn phòng định kỳ', ARRAY['visit','quote'], 70),
  ('laundry', 'Laundry', 'Giặt là', ARRAY['visit','quote'], 80),
  ('coworking_pass', 'Coworking day pass', 'Vé sử dụng coworking', ARRAY['day','week','month','quote'], 90)
ON CONFLICT (key) DO NOTHING;

--2. Host-declared services on a stay (stay-level, like amenities).
CREATE TABLE IF NOT EXISTS stay_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stay_id UUID NOT NULL REFERENCES stays(id) ON DELETE CASCADE,
  catalog_id UUID NOT NULL REFERENCES service_catalog(id) ON DELETE RESTRICT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  price_vnd BIGINT,                      -- NULL = free / included when is_included
  price_unit TEXT NOT NULL DEFAULT 'quote'
    CHECK (price_unit IN ('day','week','month','trip','visit','quote')),
  is_included BOOLEAN NOT NULL DEFAULT FALSE, -- free or already included in room price
  description_en TEXT NOT NULL DEFAULT '',
  description_vi TEXT NOT NULL DEFAULT '',
  conditions_en TEXT NOT NULL DEFAULT '',
  conditions_vi TEXT NOT NULL DEFAULT '',
  deposit_vnd BIGINT,
  lead_time_hours INT,                   -- minimum advance notice, NULL = none
  provider_type TEXT NOT NULL DEFAULT 'host'
    CHECK (provider_type IN ('host','third_party')),
  change_cancel_en TEXT NOT NULL DEFAULT '',
  change_cancel_vi TEXT NOT NULL DEFAULT '',
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (stay_id, catalog_id)
);
CREATE INDEX IF NOT EXISTS idx_stay_services_stay ON stay_services(stay_id) WHERE enabled;

--3. Checkout selections stashed on the booking (a request-to-be, not a charge).
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS extras_selection JSONB;
-- Shape: [{ "serviceId": uuid, "quantity": int?, "desiredAt": iso?, "note": str? }]

--4. Service requests materialized when the booking becomes confirmed.
CREATE TABLE IF NOT EXISTS service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  stay_service_id UUID NOT NULL REFERENCES stay_services(id) ON DELETE RESTRICT,
  source TEXT NOT NULL DEFAULT 'checkout' CHECK (source IN ('checkout','post_booking')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','awaiting_guest','confirmed','preparing','completed','declined','cancelled')),
  -- Immutable snapshot of service data at request / quote time (§16).
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  guest_details JSONB NOT NULL DEFAULT '{}'::jsonb, -- flight no, dates, quantity…
  quantity INT NOT NULL DEFAULT 1,
  desired_at TIMESTAMPTZ,
  guest_note TEXT NOT NULL DEFAULT '',
  quote_price_vnd BIGINT,
  quote_note TEXT NOT NULL DEFAULT '',
  quote_version INT NOT NULL DEFAULT 0,
  quoted_at TIMESTAMPTZ,
  guest_responded_version INT,
  guest_responded_at TIMESTAMPTZ,
  host_note TEXT NOT NULL DEFAULT '',
  reminder_upcoming_sent BOOLEAN NOT NULL DEFAULT FALSE,
  reminder_final_sent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  declined_reason TEXT NOT NULL DEFAULT ''
);

-- Idempotency: at most ONE active request per (booking, service). Callback
-- re-delivery or repeated confirm calls cannot create duplicates. Re-requests
-- are allowed after cancelled/declined/completed (those are excluded).
CREATE UNIQUE INDEX IF NOT EXISTS uq_service_requests_active
  ON service_requests(booking_id, stay_service_id)
  WHERE status IN ('pending','awaiting_guest','confirmed','preparing');

CREATE INDEX IF NOT EXISTS idx_service_requests_booking ON service_requests(booking_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests(status, desired_at);
CREATE INDEX IF NOT EXISTS idx_service_requests_stay_service ON service_requests(stay_service_id);

--5. Status/quote history (same pattern as booking_events).
CREATE TABLE IF NOT EXISTS service_request_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_role TEXT NOT NULL DEFAULT 'system'
    CHECK (actor_role IN ('guest','host','admin','system')),
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_service_request_events_request
  ON service_request_events(request_id, created_at ASC);
