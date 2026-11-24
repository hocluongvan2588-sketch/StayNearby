-- StayNearby Row-Level Security & Write-Path Guards
-- Compatible with both Supabase (auth.uid(), anon, authenticated) and standard PostgreSQL.

-- Helper to resolve current actor UUID from Supabase JWT or server transaction setting.
CREATE OR REPLACE FUNCTION public.current_actor_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  setting_uid TEXT;
  supa_uid UUID;
BEGIN
  setting_uid := NULLIF(current_setting('app.current_user_id', true), '');
  IF setting_uid IS NOT NULL THEN
    RETURN setting_uid::UUID;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'auth' AND p.proname = 'uid'
  ) THEN
    EXECUTE 'SELECT auth.uid()' INTO supa_uid;
    RETURN supa_uid;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.actor_has_role(target_role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = public.current_actor_id()
      AND ur.role_code = target_role
  );
$$;

-- Enable RLS across all application tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE amenities ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_amenities ENABLE ROW LEVEL SECURITY;
ALTER TABLE nightly_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE occupancy_nights ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE local_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE local_guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE local_guide_stops ENABLE ROW LEVEL SECURITY;

-- Public read policies (catalog & reference tables)
DROP POLICY IF EXISTS roles_read_all ON roles;
CREATE POLICY roles_read_all ON roles FOR SELECT USING (true);

DROP POLICY IF EXISTS amenities_read_all ON amenities;
CREATE POLICY amenities_read_all ON amenities FOR SELECT USING (true);

DROP POLICY IF EXISTS areas_read_published ON areas;
CREATE POLICY areas_read_published ON areas
  FOR SELECT USING (is_published = TRUE OR public.actor_has_role('admin'));

DROP POLICY IF EXISTS listings_read_published_or_owner_admin ON listings;
CREATE POLICY listings_read_published_or_owner_admin ON listings
  FOR SELECT USING (
    status = 'published'
    OR host_id = public.current_actor_id()
    OR public.actor_has_role('admin')
  );

DROP POLICY IF EXISTS listing_photos_read_published_or_owner_admin ON listing_photos;
CREATE POLICY listing_photos_read_published_or_owner_admin ON listing_photos
  FOR SELECT USING (
    (
      is_draft = FALSE
      AND EXISTS (
        SELECT 1 FROM listings l
        WHERE l.id = listing_photos.listing_id AND l.status = 'published'
      )
    )
    OR EXISTS (
      SELECT 1 FROM listings l
      WHERE l.id = listing_photos.listing_id
        AND (l.host_id = public.current_actor_id() OR public.actor_has_role('admin'))
    )
  );

DROP POLICY IF EXISTS listing_amenities_read ON listing_amenities;
CREATE POLICY listing_amenities_read ON listing_amenities
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM listings l
      WHERE l.id = listing_amenities.listing_id
        AND (l.status = 'published' OR l.host_id = public.current_actor_id() OR public.actor_has_role('admin'))
    )
  );

DROP POLICY IF EXISTS nightly_rates_read ON nightly_rates;
CREATE POLICY nightly_rates_read ON nightly_rates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM listings l
      WHERE l.id = nightly_rates.listing_id
        AND (l.status = 'published' OR l.host_id = public.current_actor_id() OR public.actor_has_role('admin'))
    )
  );

-- Restricted read policies for profiles, revisions, and bookings
DROP POLICY IF EXISTS profiles_read_self_or_admin ON profiles;
CREATE POLICY profiles_read_self_or_admin ON profiles
  FOR SELECT USING (id = public.current_actor_id() OR public.actor_has_role('admin'));

DROP POLICY IF EXISTS user_roles_read_self_or_admin ON user_roles;
CREATE POLICY user_roles_read_self_or_admin ON user_roles
  FOR SELECT USING (user_id = public.current_actor_id() OR public.actor_has_role('admin'));

DROP POLICY IF EXISTS listing_revisions_read_owner_or_admin ON listing_revisions;
CREATE POLICY listing_revisions_read_owner_or_admin ON listing_revisions
  FOR SELECT USING (
    public.actor_has_role('admin')
    OR EXISTS (
      SELECT 1 FROM listings l
      WHERE l.id = listing_revisions.listing_id AND l.host_id = public.current_actor_id()
    )
  );

DROP POLICY IF EXISTS bookings_read_participant_or_admin ON bookings;
CREATE POLICY bookings_read_participant_or_admin ON bookings
  FOR SELECT USING (
    guest_id = public.current_actor_id()
    OR public.actor_has_role('admin')
    OR EXISTS (
      SELECT 1 FROM listings l
      WHERE l.id = bookings.listing_id AND l.host_id = public.current_actor_id()
    )
  );

DROP POLICY IF EXISTS occupancy_nights_read_availability ON occupancy_nights;
CREATE POLICY occupancy_nights_read_availability ON occupancy_nights
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM listings l
      WHERE l.id = occupancy_nights.listing_id
        AND (l.status = 'published' OR l.host_id = public.current_actor_id() OR public.actor_has_role('admin'))
    )
  );

DROP POLICY IF EXISTS booking_events_read_participant_or_admin ON booking_events;
CREATE POLICY booking_events_read_participant_or_admin ON booking_events
  FOR SELECT USING (
    public.actor_has_role('admin')
    OR EXISTS (
      SELECT 1 FROM bookings b
      JOIN listings l ON l.id = b.listing_id
      WHERE b.id = booking_events.booking_id
        AND (b.guest_id = public.current_actor_id() OR l.host_id = public.current_actor_id())
    )
  );

DROP POLICY IF EXISTS outbox_admin_only ON outbox;
CREATE POLICY outbox_admin_only ON outbox
  FOR SELECT USING (public.actor_has_role('admin'));

DROP POLICY IF EXISTS local_places_read_published ON local_places;
CREATE POLICY local_places_read_published ON local_places
  FOR SELECT USING (is_published = TRUE OR public.actor_has_role('admin'));

DROP POLICY IF EXISTS local_guides_read_published ON local_guides;
CREATE POLICY local_guides_read_published ON local_guides
  FOR SELECT USING (is_published = TRUE OR public.actor_has_role('admin'));

DROP POLICY IF EXISTS local_guide_stops_read_published ON local_guide_stops;
CREATE POLICY local_guide_stops_read_published ON local_guide_stops
  FOR SELECT USING (
    public.actor_has_role('admin')
    OR EXISTS (
      SELECT 1 FROM local_guides g
      WHERE g.id = local_guide_stops.guide_id AND g.is_published = TRUE
    )
  );

-- Restrict direct client writes and private column reads in Supabase (anon / authenticated)
-- so all booking/role writes must execute inside server-side business transactions,
-- and exact check-in details never leak through PostgREST.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon;
    REVOKE SELECT (exact_address, checkin_instructions_en, host_contact_phone) ON listings FROM anon;
    REVOKE SELECT (exact_address, checkin_instructions_en) ON listing_revisions FROM anon;
    REVOKE SELECT (phone, password_hash) ON profiles FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE INSERT, UPDATE, DELETE ON user_roles, listings, listing_revisions, listing_photos,
      nightly_rates, bookings, occupancy_nights, booking_events, outbox FROM authenticated;
    REVOKE SELECT (exact_address, checkin_instructions_en, host_contact_phone) ON listings FROM authenticated;
    REVOKE SELECT (exact_address, checkin_instructions_en) ON listing_revisions FROM authenticated;
    REVOKE SELECT (phone, password_hash) ON profiles FROM authenticated;
  END IF;
END $$;
