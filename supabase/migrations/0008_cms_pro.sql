-- 0008_cms_pro.sql
-- Enterprise Content & SEO CMS upgrade: Tiptap JSON docs, taxonomies, shared media,
-- revisions, internal link graph, URL redirects, multilingual translation groups,
-- GSC readiness, content-to-booking attribution, and Central AI Gateway interfaces.

-- 1. Categories & Tags
CREATE TABLE IF NOT EXISTS cms_categories (
  id UUID PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_vi TEXT NOT NULL,
  description_en TEXT NOT NULL DEFAULT '',
  description_vi TEXT NOT NULL DEFAULT '',
  parent_id UUID REFERENCES cms_categories(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  seo_title TEXT NOT NULL DEFAULT '',
  seo_description TEXT NOT NULL DEFAULT '',
  robots_index BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cms_categories_parent ON cms_categories(parent_id, sort_order);

CREATE TABLE IF NOT EXISTS cms_tags (
  id UUID PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_vi TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Shared CMS Media Library & Usage Tracking
CREATE TABLE IF NOT EXISTS cms_media (
  id UUID PRIMARY KEY,
  storage_mode TEXT NOT NULL DEFAULT 'local' CHECK (storage_mode IN ('supabase', 'local', 'external')),
  object_path TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  width INTEGER,
  height INTEGER,
  alt_en TEXT NOT NULL DEFAULT '',
  alt_vi TEXT NOT NULL DEFAULT '',
  caption_en TEXT NOT NULL DEFAULT '',
  caption_vi TEXT NOT NULL DEFAULT '',
  credit TEXT NOT NULL DEFAULT '',
  license TEXT NOT NULL DEFAULT 'VietNomad Editorial',
  focal_x NUMERIC(5,2) NOT NULL DEFAULT 50,
  focal_y NUMERIC(5,2) NOT NULL DEFAULT 50,
  folder TEXT NOT NULL DEFAULT 'editorial',
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cms_media_folder_created ON cms_media(folder, created_at DESC);

CREATE TABLE IF NOT EXISTS cms_media_usages (
  media_id UUID NOT NULL REFERENCES cms_media(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  field_name TEXT NOT NULL DEFAULT 'body',
  PRIMARY KEY (media_id, entity_type, entity_id, field_name)
);

-- 3. Upgrade cms_contents (backwards compatible & non-destructive)
ALTER TABLE cms_contents
  ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS translation_group_id UUID,
  ADD COLUMN IF NOT EXISTS parent_content_id UUID REFERENCES cms_contents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES cms_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS neighborhood_id UUID REFERENCES neighborhoods(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS excerpt_en TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS excerpt_vi TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS body_doc_en JSONB,
  ADD COLUMN IF NOT EXISTS body_doc_vi JSONB,
  ADD COLUMN IF NOT EXISTS published_doc_en JSONB,
  ADD COLUMN IF NOT EXISTS published_doc_vi JSONB,
  ADD COLUMN IF NOT EXISTS published_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS schema_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS featured_media_id UUID REFERENCES cms_media(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS featured_image_url TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS focus_keyword TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS secondary_keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS seo_score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS word_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reading_time_minutes INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS og_title TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS og_description TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS og_image_url TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS robots_follow BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS schema_type TEXT NOT NULL DEFAULT 'Article',
  ADD COLUMN IF NOT EXISTS breadcrumb_title TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS gsc_status TEXT NOT NULL DEFAULT 'not_connected',
  ADD COLUMN IF NOT EXISTS gsc_last_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gsc_note TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS has_unpublished_changes BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_autosaved_at TIMESTAMPTZ;

UPDATE cms_contents
SET translation_group_id = id
WHERE translation_group_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_cms_contents_translation_group ON cms_contents(translation_group_id, locale);
CREATE INDEX IF NOT EXISTS idx_cms_contents_category ON cms_contents(category_id, status);
CREATE INDEX IF NOT EXISTS idx_cms_contents_destination ON cms_contents(destination_id, status);
CREATE INDEX IF NOT EXISTS idx_cms_contents_scheduled ON cms_contents(status, scheduled_at) WHERE status = 'scheduled';

DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'cms_contents'::regclass
      AND contype = 'c'
      AND (
        pg_get_constraintdef(oid) LIKE '%content_type%'
        OR pg_get_constraintdef(oid) LIKE '%status%'
      )
  LOOP
    EXECUTE format('ALTER TABLE cms_contents DROP CONSTRAINT IF EXISTS %I', c.conname);
  END LOOP;

  ALTER TABLE cms_contents
    ADD CONSTRAINT cms_contents_content_type_check
    CHECK (content_type IN (
      'article',
      'landing_page',
      'destination_guide',
      'neighborhood_guide',
      'local_guide',
      'faq',
      'announcement',
      'hero_banner',
      'community_story'
    ));

  ALTER TABLE cms_contents
    ADD CONSTRAINT cms_contents_status_check
    CHECK (status IN ('draft', 'in_review', 'approved', 'scheduled', 'published', 'archived'));

  ALTER TABLE cms_contents
    ADD CONSTRAINT cms_contents_locale_check
    CHECK (locale IN ('en', 'vi'));

  ALTER TABLE cms_contents
    ADD CONSTRAINT cms_contents_gsc_status_check
    CHECK (gsc_status IN ('not_connected', 'pending_inspection', 'submitted', 'indexed', 'excluded', 'error'));
END $$;

CREATE TABLE IF NOT EXISTS cms_content_tags (
  content_id UUID NOT NULL REFERENCES cms_contents(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES cms_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (content_id, tag_id)
);

-- 4. Revision History
CREATE TABLE IF NOT EXISTS cms_content_revisions (
  id UUID PRIMARY KEY,
  content_id UUID NOT NULL REFERENCES cms_contents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  change_type TEXT NOT NULL DEFAULT 'save' CHECK (change_type IN ('autosave', 'save', 'submit_review', 'approve', 'publish', 'schedule', 'restore', 'archive')),
  summary TEXT NOT NULL DEFAULT '',
  doc_en JSONB,
  doc_vi JSONB,
  meta_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cms_revisions_content ON cms_content_revisions(content_id, version_number DESC);

-- 5. Internal Link Graph & Broken / Orphan Analysis
CREATE TABLE IF NOT EXISTS cms_internal_links (
  id UUID PRIMARY KEY,
  source_content_id UUID NOT NULL REFERENCES cms_contents(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('cms_content', 'stay', 'destination', 'neighborhood', 'place', 'local_partner', 'promotion', 'category', 'other_internal')),
  target_id TEXT NOT NULL DEFAULT '',
  target_path TEXT NOT NULL,
  anchor_text TEXT NOT NULL DEFAULT '',
  is_broken BOOLEAN NOT NULL DEFAULT FALSE,
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cms_internal_links_source ON cms_internal_links(source_content_id);
CREATE INDEX IF NOT EXISTS idx_cms_internal_links_target ON cms_internal_links(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_cms_internal_links_path ON cms_internal_links(target_path);

-- 6. URL Redirects (301/302)
CREATE TABLE IF NOT EXISTS cms_redirects (
  id UUID PRIMARY KEY,
  source_path TEXT NOT NULL UNIQUE,
  target_path TEXT NOT NULL,
  status_code INTEGER NOT NULL DEFAULT 301 CHECK (status_code IN (301, 302)),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  hit_count INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  auto_created_from_content_id UUID REFERENCES cms_contents(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cms_redirects_active ON cms_redirects(source_path) WHERE is_active = TRUE;

-- 7. CMS Settings & Central AI Gateway Config/Logs
CREATE TABLE IF NOT EXISTS cms_settings (
  key TEXT PRIMARY KEY,
  value_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_gateway_configs (
  key TEXT PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'openai',
  model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  monthly_budget_usd NUMERIC(10,2) NOT NULL DEFAULT 50,
  rate_limit_per_hour INTEGER NOT NULL DEFAULT 60,
  feature_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id UUID PRIMARY KEY,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  feature_key TEXT NOT NULL,
  content_id UUID REFERENCES cms_contents(id) ON DELETE SET NULL,
  model TEXT NOT NULL DEFAULT '',
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(10,6) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'blocked', 'unconfigured', 'error')),
  error_message TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created ON ai_usage_logs(created_at DESC);

-- 8. Content-to-Booking Funnel Attribution Events Upgrade
ALTER TABLE attribution_events
  ADD COLUMN IF NOT EXISTS content_id UUID REFERENCES cms_contents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS destination_slug TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_attr_events_content ON attribution_events(content_id, event_name, created_at DESC)
  WHERE content_id IS NOT NULL;

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
    CHECK (event_name IN ('page_view', 'article_view', 'destination_view', 'search', 'stay_view', 'checkout_start', 'booking_completed'));
END $$;

-- 9. Default CMS Categories & Settings Seeds (idempotent)
INSERT INTO cms_categories (id, slug, name_en, name_vi, description_en, description_vi, sort_order, seo_title, seo_description)
VALUES
  ('c1000000-0000-4000-8000-000000000001', 'living-guides', 'Living Guides', 'Cẩm nang sinh hoạt', 'Practical monthly living, internet, transport, and local routines in Vietnam.', 'Hướng dẫn sinh hoạt dài ngày, internet, di chuyển và đời sống địa phương.', 1, 'Vietnam Long-Stay Living Guides | VietNomad Stays', 'Practical neighborhood and city living guides across Vietnam.'),
  ('c1000000-0000-4000-8000-000000000002', 'city-guides', 'City Guides', 'Cẩm nang thành phố', 'In-depth seasonal and remote-work city overviews.', 'Tổng quan thành phố, mùa đẹp và nhịp sống làm việc từ xa.', 2, 'Vietnam City Guides | VietNomad Stays', 'Deep city guides for Da Nang, Hanoi, Ho Chi Minh City, Hoi An, and Da Lat.'),
  ('c1000000-0000-4000-8000-000000000003', 'neighborhood-guides', 'Neighborhood Guides', 'Cẩm nang khu vực', 'Micro-neighborhood walkthroughs like An Thuong, Tay Ho, and Thao Dien.', 'Khám phá từng khu phố như An Thượng, Tây Hồ, Thảo Điền.', 3, 'Vietnam Neighborhood Guides | VietNomad Stays', 'Walkability, dining, workspaces, and stay pockets by neighborhood.'),
  ('c1000000-0000-4000-8000-000000000004', 'local-guides', 'Local Guides', 'Địa điểm & Trải nghiệm', 'Curated cafes, coworking hubs, wellness, and local partner recommendations.', 'Tuyển chọn quán cà phê, coworking, gym và ưu đãi đối tác địa phương.', 4, 'Local Places & Workspace Guides | VietNomad Stays', 'Curated cafes, coworking spots, and neighborhood favorites.'),
  ('c1000000-0000-4000-8000-000000000005', 'guest-tips', 'Arrival & Booking Tips', 'Mẹo đặt phòng & Lưu trú', 'Check-in checklists, package pricing explainers, and guest policies.', 'Hướng dẫn nhận phòng, gói thuê theo tuần/tháng và chính sách lưu trú.', 5, 'Stay Booking & Arrival Guides | VietNomad Stays', 'Clear guides on BookingFlow pricing, check-in, and monthly stays.')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO cms_tags (id, slug, name_en, name_vi)
VALUES
  ('c2000000-0000-4000-8000-000000000001', 'monthly-stays', 'Monthly Stays', 'Thuê theo tháng'),
  ('c2000000-0000-4000-8000-000000000002', 'remote-work', 'Remote Work', 'Làm việc từ xa'),
  ('c2000000-0000-4000-8000-000000000003', 'family-living', 'Family Living', 'Gia đình'),
  ('c2000000-0000-4000-8000-000000000004', 'beach-life', 'Beach Life', 'Gần biển'),
  ('c2000000-0000-4000-8000-000000000005', 'coworking', 'Coworking', 'Coworking')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO cms_settings (key, value_json)
VALUES
  ('seo_defaults', '{"siteName":"VietNomad Stays","titleSeparator":"|","defaultRobotsIndex":true,"defaultRobotsFollow":true,"includeCategoriesInSitemap":false,"gscPropertyUrl":"","gscConnected":false}'::jsonb),
  ('editorial_workflow', '{"requireReviewBeforePublish":false,"autosaveIntervalMs":2500,"autoCreateRedirectOnSlugChange":true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO ai_gateway_configs (key, provider, model, is_enabled, monthly_budget_usd, rate_limit_per_hour, feature_flags)
VALUES
  ('default', 'openai', 'gpt-4o-mini', FALSE, 50.00, 60, '{"inlineRewrite":true,"seoSuggestions":true,"translateEnVi":true,"outlineBrief":true,"faqGenerator":true,"internalLinkSuggestions":true,"contentGapAnalysis":true}'::jsonb)
ON CONFLICT (key) DO NOTHING;
