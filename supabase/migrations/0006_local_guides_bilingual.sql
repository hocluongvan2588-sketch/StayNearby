-- Phase 4: Bilingual Local Guides, Coworking Call/Booking Metadata & Directions

ALTER TABLE local_places
  ADD COLUMN IF NOT EXISTS name_vi TEXT,
  ADD COLUMN IF NOT EXISTS short_description_vi TEXT,
  ADD COLUMN IF NOT EXISTS coworking_notes_vi TEXT,
  ADD COLUMN IF NOT EXISTS directions_note_en TEXT,
  ADD COLUMN IF NOT EXISTS directions_note_vi TEXT,
  ADD COLUMN IF NOT EXISTS has_video_call_booths BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS booking_required BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE local_guides
  ADD COLUMN IF NOT EXISTS title_vi TEXT,
  ADD COLUMN IF NOT EXISTS summary_vi TEXT,
  ADD COLUMN IF NOT EXISTS directions_summary_en TEXT,
  ADD COLUMN IF NOT EXISTS directions_summary_vi TEXT;

ALTER TABLE local_guide_stops
  ADD COLUMN IF NOT EXISTS recommended_items_vi TEXT,
  ADD COLUMN IF NOT EXISTS local_notes_vi TEXT;
