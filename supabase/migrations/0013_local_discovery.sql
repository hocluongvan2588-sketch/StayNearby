-- 0013_local_discovery.sql
-- Local Discovery Phase 1: host place suggestions + moderation + data quality
-- + basic place interaction tracking. DEV ONLY until approved for production.
--
-- Scope (per approved plan docs/local-discovery-plan.md):
--   * place_suggestions         — host proposals with review workflow
--   * stay_nearby_places        — link provenance (curated vs host_suggested)
--   * places                    — website/maps/onsite/reviewer, honest defaults
--   * stays.google_maps_url     — optional host-pinned map link (lat/lng already exist)
--   * attribution_events        — place interaction events
-- NO commercial tables (referrals/commissions/wallets) — out of scope.

-- ---------------------------------------------------------------------------
-- 1) Host place suggestions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS place_suggestions (
  id UUID PRIMARY KEY,
  stay_id UUID NOT NULL REFERENCES stays(id) ON DELETE CASCADE,
  suggested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_id UUID REFERENCES places(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN (
    'restaurant', 'cafe', 'coworking', 'gym_yoga', 'entertainment',
    'attraction', 'transport', 'essential', 'event_venue', 'shopping', 'experience'
  )),
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  google_maps_url TEXT NOT NULL DEFAULT '',
  lat NUMERIC(9,6),
  lng NUMERIC(9,6),
  reason TEXT NOT NULL DEFAULT '',
  distance_label TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'needs_info', 'approved', 'rejected')),
  review_note TEXT NOT NULL DEFAULT '',
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_place_sug_stay
  ON place_suggestions(stay_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_place_sug_place
  ON place_suggestions(place_id) WHERE place_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_place_sug_status
  ON place_suggestions(status, created_at DESC);

-- ---------------------------------------------------------------------------
-- 2) Link provenance on stay <-> place
-- ---------------------------------------------------------------------------
ALTER TABLE stay_nearby_places
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'curated'
    CHECK (source IN ('curated', 'host_suggested')),
  ADD COLUMN IF NOT EXISTS suggested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS host_note TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_snp_place_source
  ON stay_nearby_places(place_id, source);

-- ---------------------------------------------------------------------------
-- 3) places: extra fields + honest defaults (no fake hours/price)
-- ---------------------------------------------------------------------------
ALTER TABLE places
  ADD COLUMN IF NOT EXISTS website TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS google_maps_url TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS external_place_id TEXT,
  ADD COLUMN IF NOT EXISTS is_onsite BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by TEXT NOT NULL DEFAULT 'admin';

-- New rows must not invent opening hours or price levels. Existing rows are
-- left untouched (admin can edit); data_source stays as-is per approval.
ALTER TABLE places ALTER COLUMN opening_hours SET DEFAULT '';
ALTER TABLE places ALTER COLUMN price_range SET DEFAULT '';

-- ---------------------------------------------------------------------------
-- 4) stays: optional host-pinned Google Maps link (lat/lng columns exist since 0009)
-- ---------------------------------------------------------------------------
ALTER TABLE stays
  ADD COLUMN IF NOT EXISTS google_maps_url TEXT NOT NULL DEFAULT '';

-- ---------------------------------------------------------------------------
-- 5) Interaction tracking (basic, reuses attribution_events)
-- ---------------------------------------------------------------------------
ALTER TABLE attribution_events
  ADD COLUMN IF NOT EXISTS place_id UUID REFERENCES places(id) ON DELETE SET NULL;

DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'attribution_events'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%event_name%'
  LOOP
    EXECUTE format('ALTER TABLE attribution_events DROP CONSTRAINT IF EXISTS %I', c.conname);
  END LOOP;

  ALTER TABLE attribution_events
    ADD CONSTRAINT attribution_events_event_name_check
    CHECK (event_name IN (
      'page_view', 'article_view', 'destination_view', 'search', 'stay_view',
      'checkout_start', 'booking_completed',
      'place_detail_view', 'place_map_click', 'place_website_click'
    ));
END $$;

CREATE INDEX IF NOT EXISTS idx_attr_events_place
  ON attribution_events(place_id, event_name, created_at DESC)
  WHERE place_id IS NOT NULL;
