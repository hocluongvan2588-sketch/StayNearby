-- Host Console V2 + Admin Shell Isolation + Real Operations Tables
-- Additive & backwards-compatible with BookingFlow (P_host + 12% online fee, 0% host commission)

-- 1. Extend stays with house rules, check-in/out windows & default min nights
ALTER TABLE stays
  ADD COLUMN IF NOT EXISTS house_rules JSONB NOT NULL DEFAULT '{"quietHours":"22:00 - 07:00","smokingAllowed":false,"partiesAllowed":false,"petsNote":"","extraGuestNote":""}'::jsonb,
  ADD COLUMN IF NOT EXISTS checkin_from TEXT NOT NULL DEFAULT '14:00',
  ADD COLUMN IF NOT EXISTS checkout_before TEXT NOT NULL DEFAULT '12:00',
  ADD COLUMN IF NOT EXISTS default_min_nights INTEGER NOT NULL DEFAULT 7;

-- 2. Extend room_night_locks for per-day pricing overrides & minimum stay nights
ALTER TABLE room_night_locks
  ADD COLUMN IF NOT EXISTS custom_nightly_vnd BIGINT,
  ADD COLUMN IF NOT EXISTS min_nights INTEGER,
  ADD COLUMN IF NOT EXISTS note TEXT NOT NULL DEFAULT '';

-- 3. Extend bookings for optional Host approval workflow (when is_instant_book = false) & internal notes
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS host_internal_note TEXT NOT NULL DEFAULT '';

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
      'PENDING_HOST_APPROVAL',
      'RESERVED_LOCKED',
      'CHECKED_IN_COMPLETED',
      'REFUNDED_WIFI_MISMATCH',
      'confirmed',
      'completed',
      'cancelled'
    ));
END $$;

-- 4. Notification read state
ALTER TABLE booking_notifications
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE;

-- 5. Listing creation drafts (Step-by-step Wizard auto-save)
CREATE TABLE IF NOT EXISTS stay_drafts (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_step INTEGER NOT NULL DEFAULT 1,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stay_drafts_user ON stay_drafts(user_id, updated_at DESC);

-- 6. Booking audit timeline
CREATE TABLE IF NOT EXISTS booking_events (
  id UUID PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_role TEXT NOT NULL CHECK (actor_role IN ('guest', 'host', 'admin', 'system')),
  event_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_booking_events_booking ON booking_events(booking_id, created_at ASC);

-- 7. Host-Guest Inbox (3-column messaging)
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY,
  stay_id UUID NOT NULL REFERENCES stays(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_message_preview TEXT NOT NULL DEFAULT '',
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  host_unread_count INTEGER NOT NULL DEFAULT 0,
  guest_unread_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (stay_id, guest_id)
);
CREATE INDEX IF NOT EXISTS idx_conversations_host ON conversations(host_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_guest ON conversations(guest_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('guest', 'host', 'admin')),
  body TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at ASC);

CREATE TABLE IF NOT EXISTS host_quick_replies (
  id UUID PRIMARY KEY,
  host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_quick_replies_host ON host_quick_replies(host_id, sort_order ASC);

-- 8. Guest Reviews & Host Replies
CREATE TABLE IF NOT EXISTS stay_reviews (
  id UUID PRIMARY KEY,
  stay_id UUID NOT NULL REFERENCES stays(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  guest_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating NUMERIC(2,1) NOT NULL CHECK (rating >= 1 AND rating <= 5),
  cleanliness_rating INTEGER NOT NULL DEFAULT 5 CHECK (cleanliness_rating BETWEEN 1 AND 5),
  communication_rating INTEGER NOT NULL DEFAULT 5 CHECK (communication_rating BETWEEN 1 AND 5),
  workspace_rating INTEGER NOT NULL DEFAULT 5 CHECK (workspace_rating BETWEEN 1 AND 5),
  location_rating INTEGER NOT NULL DEFAULT 5 CHECK (location_rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL,
  host_reply TEXT,
  host_replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stay_reviews_stay ON stay_reviews(stay_id, created_at DESC);

-- 9. Listing View Tracking (real Insights analytics)
CREATE TABLE IF NOT EXISTS stay_view_events (
  id UUID PRIMARY KEY,
  stay_id UUID NOT NULL REFERENCES stays(id) ON DELETE CASCADE,
  session_key TEXT NOT NULL,
  viewer_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stay_views_stay_date ON stay_view_events(stay_id, created_at DESC);

-- 10. Earnings Adjustments & Host Settings
CREATE TABLE IF NOT EXISTS booking_adjustments (
  id UUID PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  stay_id UUID NOT NULL REFERENCES stays(id) ON DELETE CASCADE,
  host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('refund', 'credit', 'damage_fee', 'extension', 'discount')),
  amount_vnd BIGINT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'applied' CHECK (status IN ('pending', 'applied', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_adjustments_host ON booking_adjustments(host_id, created_at DESC);

CREATE TABLE IF NOT EXISTS host_settings (
  host_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  contact_phone TEXT NOT NULL DEFAULT '',
  whatsapp_number TEXT NOT NULL DEFAULT '',
  zalo_handle TEXT NOT NULL DEFAULT '',
  payout_method TEXT NOT NULL DEFAULT 'direct_checkin_and_bank',
  bank_name TEXT NOT NULL DEFAULT '',
  bank_account_number TEXT NOT NULL DEFAULT '',
  bank_account_name TEXT NOT NULL DEFAULT '',
  notify_email BOOLEAN NOT NULL DEFAULT TRUE,
  notify_in_app BOOLEAN NOT NULL DEFAULT TRUE,
  auto_ical_sync BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
