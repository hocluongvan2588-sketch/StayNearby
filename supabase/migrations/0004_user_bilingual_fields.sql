-- Add bilingual Vietnamese columns for User-facing discovery, stay details, and trips.
-- Columns on listings & listing_revisions are optional so the Host portal remains unchanged.

ALTER TABLE areas
  ADD COLUMN IF NOT EXISTS walkability_note_vi TEXT NOT NULL DEFAULT '';

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS published_title_vi TEXT,
  ADD COLUMN IF NOT EXISTS published_summary_vi TEXT,
  ADD COLUMN IF NOT EXISTS published_description_vi TEXT,
  ADD COLUMN IF NOT EXISTS published_house_rules_vi JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS published_workspace_notes_vi TEXT,
  ADD COLUMN IF NOT EXISTS published_checkin_conditions_vi TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS checkin_instructions_vi TEXT NOT NULL DEFAULT '';

ALTER TABLE listing_revisions
  ADD COLUMN IF NOT EXISTS title_vi TEXT,
  ADD COLUMN IF NOT EXISTS summary_vi TEXT,
  ADD COLUMN IF NOT EXISTS description_vi TEXT,
  ADD COLUMN IF NOT EXISTS house_rules_vi JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS workspace_notes_vi TEXT,
  ADD COLUMN IF NOT EXISTS checkin_conditions_vi TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS checkin_instructions_vi TEXT NOT NULL DEFAULT '';
