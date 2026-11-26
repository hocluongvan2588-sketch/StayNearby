-- 0007_storefront_bos_sync.sql
-- Additive schema synchronization between Admin BOS, Host Console, and Public Storefront

-- 1. Promotions: public visibility, funding source (VietNomad vs Host), descriptions & user targeting
ALTER TABLE promotions
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS funding_source TEXT NOT NULL DEFAULT 'vietnomad',
  ADD COLUMN IF NOT EXISTS description_en TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS description_vi TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS eligible_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'promotions'::regclass AND conname = 'promotions_funding_source_check'
  ) THEN
    ALTER TABLE promotions
      ADD CONSTRAINT promotions_funding_source_check
      CHECK (funding_source IN ('vietnomad', 'host', 'shared'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_promotions_public_active
  ON promotions(is_active, is_public, valid_from, valid_to);

-- 2. Bookings: full promotion snapshot, discount, funding attribution, and concurrency-safe usage flag
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS promotion_id UUID REFERENCES promotions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS promotion_discount_vnd BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promotion_funding_source TEXT NOT NULL DEFAULT 'vietnomad',
  ADD COLUMN IF NOT EXISTS promotion_counted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS applied_vat_discount_rate NUMERIC(6,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS applied_premium_reward_rate NUMERIC(6,4) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_bookings_promo_id ON bookings(promotion_id) WHERE promotion_id IS NOT NULL;

-- 3. Host Leads: deduplication & direct link from public Host Application submissions
ALTER TABLE host_leads
  ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES host_applications(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_detail TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS utm_source TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_host_leads_email_lower ON host_leads(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_host_leads_phone ON host_leads(phone) WHERE phone <> '';
CREATE INDEX IF NOT EXISTS idx_host_leads_app ON host_leads(application_id) WHERE application_id IS NOT NULL;

-- 4. Attribution Events: visitor tracking, full UTM params, dedupe key, and internal traffic filtering
ALTER TABLE attribution_events
  ADD COLUMN IF NOT EXISTS visitor_id TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS utm_content TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS utm_term TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_internal BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_attr_events_dedupe ON attribution_events(dedupe_key, created_at DESC) WHERE dedupe_key <> '';
CREATE INDEX IF NOT EXISTS idx_attr_events_internal ON attribution_events(is_internal, event_name, created_at DESC);

-- 5. Support Tickets: detailed issue sub-category & attachment support for Guest Dashboard
ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS issue_sub_category TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_support_tickets_guest ON support_tickets(guest_id, created_at DESC) WHERE guest_id IS NOT NULL;

-- 6. CMS Contents: expand allowed types (FAQ, announcements, hero banners, community) & publish windows
ALTER TABLE cms_contents
  ADD COLUMN IF NOT EXISTS publish_start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS publish_end_at TIMESTAMPTZ;

DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'cms_contents'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%content_type%'
  LOOP
    EXECUTE format('ALTER TABLE cms_contents DROP CONSTRAINT IF EXISTS %I', c.conname);
  END LOOP;

  ALTER TABLE cms_contents
    ADD CONSTRAINT cms_contents_content_type_check
    CHECK (content_type IN ('article', 'landing_page', 'destination_guide', 'faq', 'announcement', 'hero_banner', 'community_story'));
END $$;
