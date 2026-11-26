-- Guest Platform UX Redesign Schema Extensions (Additive & Optional)
-- Adds optional property dimensions, host profile fields, place ratings, and expanded local discovery categories.

-- 1. Optional property & room metadata (rendered only when populated)
ALTER TABLE stays
  ADD COLUMN IF NOT EXISTS is_entire_place BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS bedrooms INTEGER,
  ADD COLUMN IF NOT EXISTS bathrooms INTEGER,
  ADD COLUMN IF NOT EXISTS area_sqm INTEGER,
  ADD COLUMN IF NOT EXISTS host_bio_en TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS host_bio_vi TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS host_avatar_url TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS host_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS lat NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS lng NUMERIC(9,6);

ALTER TABLE stay_rooms
  ADD COLUMN IF NOT EXISTS bedrooms INTEGER,
  ADD COLUMN IF NOT EXISTS bathrooms INTEGER,
  ADD COLUMN IF NOT EXISTS area_sqm INTEGER;

-- 2. Host/User optional public profile metadata
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_url TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bio_en TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bio_vi TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS identity_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Expand places categories & optional verified ratings
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'places'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%category%'
  LOOP
    EXECUTE format('ALTER TABLE places DROP CONSTRAINT IF EXISTS %I', c.conname);
  END LOOP;

  ALTER TABLE places
    ADD CONSTRAINT places_category_check
    CHECK (category IN (
      'restaurant',
      'cafe',
      'coworking',
      'gym_yoga',
      'entertainment',
      'attraction',
      'transport',
      'essential',
      'event_venue',
      'shopping',
      'experience'
    ));
END $$;

ALTER TABLE places
  ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS review_count INTEGER;

-- 4. Update existing seeded places with authentic local photography where image_url is blank
UPDATE places SET image_url = '/images/places/cafe-roastery.jpg'
WHERE slug IN ('43-factory-coffee-roaster-da-nang', 'la-viet-coffee-da-lat') AND image_url = '';

UPDATE places SET image_url = '/images/places/local-dining.jpg'
WHERE slug = 'nha-bep-xua-an-thuong-da-nang' AND image_url = '';

UPDATE places SET image_url = '/images/places/market-essentials.jpg'
WHERE slug = 'moonmilk-organic-mart-an-thuong' AND image_url = '';

UPDATE places SET image_url = '/images/places/wellness-yoga.jpg'
WHERE slug = 'zenith-yoga-tay-ho-hanoi' AND image_url = '';

UPDATE places SET image_url = '/images/workspaces/vietnam-coworking-lounge.jpg'
WHERE slug IN ('enouvo-space-an-thuong-da-nang', 'the-hive-thao-dien-saigon') AND image_url = '';
