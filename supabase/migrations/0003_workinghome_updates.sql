-- WorkingHome Specification Updates:
-- 1. Remove Wi-Fi speed measurement/ranking columns; Wi-Fi is modeled purely as an optional host-declared amenity.
-- 2. Add area vibe & walkability notes for 2-4 week remote stays.
-- 3. Add listing check-in conditions including late check-in availability.
-- 4. Extend local_places and local_guides for coworking & solo/group suitability (Phase 4).

ALTER TABLE areas
  ADD COLUMN IF NOT EXISTS vibe_summary_en TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS vibe_summary_vi TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS walkability_note_en TEXT NOT NULL DEFAULT '';

ALTER TABLE listings
  DROP COLUMN IF EXISTS published_workspace_wifi_mbps,
  ADD COLUMN IF NOT EXISTS published_checkin_conditions_en TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS published_late_checkin_available BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE listing_revisions
  DROP COLUMN IF EXISTS workspace_wifi_mbps,
  ADD COLUMN IF NOT EXISTS checkin_conditions_en TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS late_checkin_available BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE local_places
  DROP CONSTRAINT IF EXISTS local_places_theme_check,
  ADD CONSTRAINT local_places_theme_check
    CHECK (theme IN ('food', 'culture', 'leisure', 'coworking')),
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS suitable_solo BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS suitable_group BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS coworking_notes_en TEXT;

ALTER TABLE local_guides
  DROP CONSTRAINT IF EXISTS local_guides_theme_check,
  ADD CONSTRAINT local_guides_theme_check
    CHECK (theme IN ('food', 'culture', 'leisure', 'coworking')),
  ADD COLUMN IF NOT EXISTS suitable_solo BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS suitable_group BOOLEAN NOT NULL DEFAULT TRUE;
