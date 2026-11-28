-- 0015 — Community events overhaul (user-approved plan B1, 2026-11-28).
--
-- Scope (approved): extend nomad_events for the event lifecycle (status,
-- category, language, start/end time, fee, organizer, source, registration
-- mode, bilingual content, destination link, submission metadata) + honest
-- attendance counters; add event_moderation_log for review history; seed the
-- central event taxonomy into platform_settings (no hardcoded lists in UI).
-- Visa = links-only page (separate code change). Marketplace extras section
-- hidden from Community (code change only; table untouched).
--
-- Idempotent: safe to re-run. Existing rows: status='published' (they are
-- currently live), attendance synced to real RSVP counts, fabricated capacity
-- cleared (NULL = no limit until an organizer supplies one).

-- ---------------------------------------------------------------------------
-- 1) nomad_events: lifecycle & content columns
-- ---------------------------------------------------------------------------
ALTER TABLE nomad_events ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published';
ALTER TABLE nomad_events ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE nomad_events ADD COLUMN IF NOT EXISTS language TEXT;
ALTER TABLE nomad_events ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ;
ALTER TABLE nomad_events ADD COLUMN IF NOT EXISTS end_at TIMESTAMPTZ;
ALTER TABLE nomad_events ADD COLUMN IF NOT EXISTS price_type TEXT NOT NULL DEFAULT 'free';
ALTER TABLE nomad_events ADD COLUMN IF NOT EXISTS price_amount NUMERIC(12, 2);
ALTER TABLE nomad_events ADD COLUMN IF NOT EXISTS price_currency TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE nomad_events ADD COLUMN IF NOT EXISTS organizer_name TEXT;
ALTER TABLE nomad_events ADD COLUMN IF NOT EXISTS organizer_contact TEXT; -- private, never rendered publicly
ALTER TABLE nomad_events ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'internal';
ALTER TABLE nomad_events ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE nomad_events ADD COLUMN IF NOT EXISTS source_note TEXT;
ALTER TABLE nomad_events ADD COLUMN IF NOT EXISTS source_updated_at TIMESTAMPTZ;
ALTER TABLE nomad_events ADD COLUMN IF NOT EXISTS registration_mode TEXT NOT NULL DEFAULT 'internal';
ALTER TABLE nomad_events ADD COLUMN IF NOT EXISTS description_en TEXT;
ALTER TABLE nomad_events ADD COLUMN IF NOT EXISTS description_vi TEXT;
ALTER TABLE nomad_events ADD COLUMN IF NOT EXISTS program_en TEXT;
ALTER TABLE nomad_events ADD COLUMN IF NOT EXISTS program_vi TEXT;
ALTER TABLE nomad_events ADD COLUMN IF NOT EXISTS conditions_en TEXT;
ALTER TABLE nomad_events ADD COLUMN IF NOT EXISTS conditions_vi TEXT;
ALTER TABLE nomad_events ADD COLUMN IF NOT EXISTS maps_url TEXT;
ALTER TABLE nomad_events ADD COLUMN IF NOT EXISTS destination_id UUID;
ALTER TABLE nomad_events ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE nomad_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE nomad_events ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE nomad_events ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
-- Public submission form metadata (contact stays private).
ALTER TABLE nomad_events ADD COLUMN IF NOT EXISTS submitter_name TEXT;
ALTER TABLE nomad_events ADD COLUMN IF NOT EXISTS submitter_email TEXT;
ALTER TABLE nomad_events ADD COLUMN IF NOT EXISTS rights_confirmed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE nomad_events ADD COLUMN IF NOT EXISTS submitter_ip_hash TEXT;

-- Recreate the status CHECK so re-applying this file widens the set
-- (e.g. adds 'rejected' on databases that ran an earlier copy).
ALTER TABLE nomad_events DROP CONSTRAINT IF EXISTS nomad_events_status_check;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'nomad_events_status_check') THEN
    ALTER TABLE nomad_events ADD CONSTRAINT nomad_events_status_check
      CHECK (status IN ('draft', 'pending', 'published', 'cancelled', 'postponed', 'ended', 'rejected'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'nomad_events_source_check') THEN
    ALTER TABLE nomad_events ADD CONSTRAINT nomad_events_source_check
      CHECK (source IN ('internal', 'partner', 'external'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'nomad_events_registration_mode_check') THEN
    ALTER TABLE nomad_events ADD CONSTRAINT nomad_events_registration_mode_check
      CHECK (registration_mode IN ('internal', 'external'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'nomad_events_price_type_check') THEN
    ALTER TABLE nomad_events ADD CONSTRAINT nomad_events_price_type_check
      CHECK (price_type IN ('free', 'paid'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2) Honest attendance: real RSVP counts only; capacity optional (no fake
--    DEFAULT 30 / seed numbers). NULL spots_total = no published limit.
-- ---------------------------------------------------------------------------
ALTER TABLE nomad_events ALTER COLUMN spots_total DROP DEFAULT;
ALTER TABLE nomad_events ALTER COLUMN spots_total DROP NOT NULL;
ALTER TABLE nomad_events ALTER COLUMN spots_taken SET DEFAULT 0;
-- Event images are optional (public submission form has no upload yet;
-- text-led cards render without one).
ALTER TABLE nomad_events ALTER COLUMN image_url DROP NOT NULL;

UPDATE nomad_events e
   SET spots_taken = (SELECT COUNT(*) FROM event_rsvps r WHERE r.event_id = e.id);

UPDATE nomad_events
   SET spots_total = NULL
 WHERE spots_total IS NOT NULL
   AND id IN (SELECT event_id FROM event_rsvps GROUP BY event_id HAVING COUNT(*) = 0)
   AND spots_taken = 0;

-- ---------------------------------------------------------------------------
-- 3) Backfill start_at from the legacy TEXT event_date ("YYYY-MM-DD, HH:MM AM")
-- ---------------------------------------------------------------------------
UPDATE nomad_events
   SET start_at = (
     SELECT CASE
       WHEN m[1] IS NOT NULL THEN make_timestamp(
         (substring(m[1], 1, 4))::int,
         (substring(m[1], 6, 2))::int,
         (substring(m[1], 9, 2))::int,
         CASE
           WHEN m[4] = 'PM' AND m[2]::int < 12 THEN m[2]::int + 12
           WHEN m[4] = 'AM' AND m[2]::int = 12 THEN 0
           ELSE m[2]::int
         END,
         m[3]::int,
         0
       )::timestamptz
     END
     FROM regexp_match(
       event_date,
       '^(\d{4}-\d{2}-\d{2}), (\d{1,2}):(\d{2}) (AM|PM)$'
     ) AS t(m)
   )
 WHERE start_at IS NULL
   AND event_date ~ '^\d{4}-\d{2}-\d{2}, \d{1,2}:\d{2} (AM|PM)$';

-- Link events to destinations by city name where an exact match exists.
UPDATE nomad_events e
   SET destination_id = d.id
  FROM destinations d
 WHERE e.destination_id IS NULL
   AND (d.name_en = e.city_en OR d.name_vi = e.city_vi);

UPDATE nomad_events SET published_at = COALESCE(published_at, created_at)
 WHERE status = 'published' AND published_at IS NULL;

-- ---------------------------------------------------------------------------
-- 4) Moderation history (source, update time, review trail)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_moderation_log (
  id UUID PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES nomad_events(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor_label TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nomad_events_status_start
  ON nomad_events (status, start_at);
CREATE INDEX IF NOT EXISTS idx_nomad_events_destination
  ON nomad_events (destination_id);
CREATE INDEX IF NOT EXISTS idx_nomad_events_category
  ON nomad_events (category);
CREATE INDEX IF NOT EXISTS idx_event_moderation_log_event
  ON event_moderation_log (event_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 5) Central event taxonomy (platform_settings.key = 'event_taxonomy').
--    UI reads this server-side; category/language filters never hardcode lists.
-- ---------------------------------------------------------------------------
INSERT INTO platform_settings (key, value_json)
VALUES (
  'event_taxonomy',
  '{
    "categories": [
      {"slug": "social",    "nameEn": "Social & Networking",  "nameVi": "Giao lưu và kết nối"},
      {"slug": "business",  "nameEn": "Business",             "nameVi": "Kinh doanh"},
      {"slug": "technology","nameEn": "Technology",           "nameVi": "Công nghệ"},
      {"slug": "food",      "nameEn": "Food & Drink",         "nameVi": "Ẩm thực"},
      {"slug": "sports",    "nameEn": "Sports",               "nameVi": "Thể thao"},
      {"slug": "wellness",  "nameEn": "Wellness",             "nameVi": "Sức khỏe"},
      {"slug": "culture",   "nameEn": "Culture",              "nameVi": "Văn hóa"},
      {"slug": "language",  "nameEn": "Language Exchange",    "nameVi": "Giao lưu ngôn ngữ"},
      {"slug": "outdoors",  "nameEn": "Outdoors",             "nameVi": "Hoạt động ngoài trời"},
      {"slug": "workshop",  "nameEn": "Workshop",             "nameVi": "Workshop"}
    ],
    "languages": [
      {"slug": "en",    "nameEn": "English",   "nameVi": "Tiếng Anh"},
      {"slug": "vi",    "nameEn": "Vietnamese","nameVi": "Tiếng Việt"},
      {"slug": "mixed", "nameEn": "Mixed",     "nameVi": "Đa ngôn ngữ"}
    ]
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;
