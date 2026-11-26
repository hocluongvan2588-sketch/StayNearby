-- VietNomad Stays: Business Operating System (Admin BOS) Schema (P0 + P1 + P2)
-- Backwards-compatible & Single-Source-of-Truth extension over 0001..0005

-- 1. RBAC, Internal Team Profiles, Audit Logs & Saved Table Views
CREATE TABLE IF NOT EXISTS admin_roles (
  id UUID PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_role_permissions (
  role_id UUID NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  pii_access BOOLEAN NOT NULL DEFAULT FALSE,
  data_scope TEXT NOT NULL DEFAULT 'all' CHECK (data_scope IN ('all', 'assigned', 'department')),
  PRIMARY KEY (role_id, module_key)
);

CREATE TABLE IF NOT EXISTS admin_staff_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES admin_roles(id) ON DELETE RESTRICT,
  department TEXT NOT NULL DEFAULT 'Operations',
  title TEXT NOT NULL DEFAULT 'Operator',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  assigned_cities JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_email TEXT NOT NULL DEFAULT '',
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before_json JSONB,
  after_json JSONB,
  reason TEXT NOT NULL DEFAULT '',
  ip_address TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module_entity ON admin_audit_logs(module, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON admin_audit_logs(actor_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS admin_saved_views (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  name TEXT NOT NULL,
  filters_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  columns_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_saved_views_user_mod ON admin_saved_views(user_id, module_key);

-- Extend users for Customer 360 & Risk/Acquisition tracking
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS acquisition_source TEXT NOT NULL DEFAULT 'organic',
  ADD COLUMN IF NOT EXISTS assigned_staff_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS kyc_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS risk_flag TEXT NOT NULL DEFAULT 'none' CHECK (risk_flag IN ('none', 'watch', 'restricted'));

-- 2. Platform Settings & Historical FX Rates (no hardcoded policy rates)
CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value_json JSONB NOT NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fx_rate_history (
  id UUID PRIMARY KEY,
  currency_code TEXT NOT NULL,
  rate_to_vnd NUMERIC(14,4) NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fx_history_currency ON fx_rate_history(currency_code, effective_from DESC);

-- 3. Bookings 5-Axis Status & Financial Snapshots
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS booking_status TEXT NOT NULL DEFAULT 'confirmed'
    CHECK (booking_status IN ('pending_payment', 'pending_approval', 'confirmed', 'cancelled', 'expired')),
  ADD COLUMN IF NOT EXISTS stay_status TEXT NOT NULL DEFAULT 'upcoming'
    CHECK (stay_status IN ('upcoming', 'checked_in', 'in_house', 'checked_out', 'no_show')),
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'partially_refunded', 'refunded', 'failed')),
  ADD COLUMN IF NOT EXISTS payout_status TEXT NOT NULL DEFAULT 'direct_at_checkin'
    CHECK (payout_status IN ('not_applicable', 'pending', 'scheduled', 'paid', 'on_hold', 'direct_at_checkin')),
  ADD COLUMN IF NOT EXISTS refund_status TEXT NOT NULL DEFAULT 'none'
    CHECK (refund_status IN ('none', 'requested', 'approved', 'processing', 'completed', 'rejected')),
  ADD COLUMN IF NOT EXISTS applied_service_fee_rate NUMERIC(6,4) NOT NULL DEFAULT 0.1200,
  ADD COLUMN IF NOT EXISTS applied_host_commission_rate NUMERIC(6,4) NOT NULL DEFAULT 0.0000,
  ADD COLUMN IF NOT EXISTS applied_fx_rate_usd NUMERIC(12,2) NOT NULL DEFAULT 25400,
  ADD COLUMN IF NOT EXISTS currency_code TEXT NOT NULL DEFAULT 'VND',
  ADD COLUMN IF NOT EXISTS tax_amount_vnd BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processing_fee_vnd BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dispute_flag BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS promotion_code TEXT;

-- Backfill 5-axis statuses for pre-existing bookings
UPDATE bookings
SET
  booking_status = CASE
    WHEN status = 'PENDING_PAYMENT' THEN 'pending_payment'
    WHEN status = 'PENDING_HOST_APPROVAL' THEN 'pending_approval'
    WHEN status IN ('cancelled', 'REFUNDED_WIFI_MISMATCH') THEN 'cancelled'
    ELSE 'confirmed'
  END,
  stay_status = CASE
    WHEN status IN ('CHECKED_IN_COMPLETED', 'completed') THEN 'checked_out'
    ELSE 'upcoming'
  END,
  payment_status = CASE
    WHEN status = 'PENDING_PAYMENT' THEN 'pending'
    WHEN status = 'REFUNDED_WIFI_MISMATCH' THEN 'refunded'
    WHEN status = 'cancelled' AND refund_amount_vnd > 0 THEN 'refunded'
    WHEN status IN ('PENDING_HOST_APPROVAL', 'RESERVED_LOCKED', 'CHECKED_IN_COMPLETED', 'confirmed', 'completed') THEN 'paid'
    ELSE 'unpaid'
  END,
  payout_status = CASE
    WHEN status IN ('cancelled', 'REFUNDED_WIFI_MISMATCH') THEN 'not_applicable'
    WHEN status IN ('CHECKED_IN_COMPLETED', 'completed') THEN 'paid'
    ELSE 'direct_at_checkin'
  END,
  refund_status = CASE
    WHEN status = 'REFUNDED_WIFI_MISMATCH' OR refund_amount_vnd > 0 THEN 'completed'
    ELSE 'none'
  END;

CREATE INDEX IF NOT EXISTS idx_bookings_5status ON bookings(booking_status, stay_status, payment_status, created_at DESC);

-- 4. Financial Management: Ledger, Host Payouts, Refunds, Reconciliation, Invoices, Opex
CREATE TABLE IF NOT EXISTS ledger_entries (
  id UUID PRIMARY KEY,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('gmv', 'platform_revenue', 'host_payable', 'processing_fee', 'refund', 'adjustment', 'operating_expense')),
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  payment_transaction_id UUID REFERENCES payment_transactions(id) ON DELETE SET NULL,
  host_id UUID REFERENCES users(id) ON DELETE SET NULL,
  amount_vnd BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'VND',
  fx_rate_to_vnd NUMERIC(14,4) NOT NULL DEFAULT 1,
  description TEXT NOT NULL,
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ledger_type_date ON ledger_entries(entry_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_booking ON ledger_entries(booking_id);

CREATE TABLE IF NOT EXISTS host_payouts (
  id UUID PRIMARY KEY,
  host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  period_month TEXT NOT NULL,
  collection_mode TEXT NOT NULL DEFAULT 'direct_at_checkin' CHECK (collection_mode IN ('direct_at_checkin', 'platform_settlement')),
  gross_amount_vnd BIGINT NOT NULL,
  commission_vnd BIGINT NOT NULL DEFAULT 0,
  adjustment_vnd BIGINT NOT NULL DEFAULT 0,
  net_payable_vnd BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'paid', 'on_hold', 'direct_at_checkin', 'not_applicable')),
  payout_reference TEXT NOT NULL DEFAULT '',
  due_date DATE,
  paid_at TIMESTAMPTZ,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_host_payouts_host ON host_payouts(host_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS refund_requests (
  id UUID PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  payment_transaction_id UUID REFERENCES payment_transactions(id) ON DELETE SET NULL,
  requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  refund_type TEXT NOT NULL DEFAULT 'policy_cancellation' CHECK (refund_type IN ('cooling_off', 'policy_cancellation', 'wifi_mismatch', 'dispute_settlement', 'admin_goodwill')),
  amount_vnd BIGINT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'processing', 'completed', 'rejected')),
  evidence_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  decision_note TEXT NOT NULL DEFAULT '',
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_refund_requests_status ON refund_requests(status, created_at DESC);

CREATE TABLE IF NOT EXISTS reconciliation_records (
  id UUID PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'vietqr', 'bank_transfer', 'sandbox')),
  period_label TEXT NOT NULL,
  expected_vnd BIGINT NOT NULL,
  settled_vnd BIGINT NOT NULL,
  variance_vnd BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'matched', 'discrepancy', 'resolved')),
  note TEXT NOT NULL DEFAULT '',
  reconciled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reconciled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  invoice_type TEXT NOT NULL CHECK (invoice_type IN ('guest_service_fee', 'host_statement', 'refund_credit_note')),
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  subtotal_vnd BIGINT NOT NULL,
  tax_vnd BIGINT NOT NULL DEFAULT 0,
  total_vnd BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'VND',
  status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('draft', 'issued', 'void')),
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invoices_booking ON invoices(booking_id);

CREATE TABLE IF NOT EXISTS operating_expenses (
  id UUID PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('marketing', 'payroll', 'infrastructure', 'operations', 'partner_promo', 'other')),
  department TEXT NOT NULL DEFAULT 'General',
  description TEXT NOT NULL,
  amount_vnd BIGINT NOT NULL,
  incurred_date DATE NOT NULL,
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_opex_date ON operating_expenses(incurred_date DESC);

-- 5. Host Acquisition & CRM Activities
CREATE TABLE IF NOT EXISTS host_leads (
  id UUID PRIMARY KEY,
  linked_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'inbound_web',
  business_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  whatsapp_zalo TEXT NOT NULL DEFAULT '',
  destination_slug TEXT NOT NULL DEFAULT 'da-nang',
  property_type TEXT NOT NULL DEFAULT 'apartment',
  estimated_units INTEGER NOT NULL DEFAULT 1,
  stage TEXT NOT NULL DEFAULT 'new_lead' CHECK (stage IN (
    'new_lead', 'contacted', 'interested', 'onboarding', 'under_review', 'published', 'first_booking', 'active', 'lost', 'inactive'
  )),
  loss_reason TEXT NOT NULL DEFAULT '',
  assigned_staff_id UUID REFERENCES users(id) ON DELETE SET NULL,
  next_follow_up_at TIMESTAMPTZ,
  kyc_status TEXT NOT NULL DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'submitted', 'verified', 'rejected')),
  kyc_documents JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_host_leads_stage ON host_leads(stage, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_host_leads_email ON host_leads(LOWER(email));

CREATE TABLE IF NOT EXISTS crm_activities (
  id UUID PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('host_lead', 'host', 'guest', 'local_partner')),
  entity_id TEXT NOT NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('note', 'call', 'email', 'zalo', 'meeting', 'stage_change', 'system')),
  summary TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crm_activities_entity ON crm_activities(entity_type, entity_id, created_at DESC);

-- 6. Listings Full Lifecycle & Moderation Logs
ALTER TABLE stays
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS featured_rank INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS moderation_reason TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'stays'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE stays DROP CONSTRAINT IF EXISTS %I', c.conname);
  END LOOP;

  ALTER TABLE stays
    ADD CONSTRAINT stays_status_check
    CHECK (status IN ('draft', 'pending_review', 'live', 'limited', 'paused', 'rejected', 'suspended', 'archived'));
END $$;

CREATE TABLE IF NOT EXISTS listing_moderation_logs (
  id UUID PRIMARY KEY,
  stay_id UUID NOT NULL REFERENCES stays(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  changes_diff JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_listing_mod_logs_stay ON listing_moderation_logs(stay_id, created_at DESC);

-- 7. Customer Support & Trust & Safety
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY,
  ticket_code TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('booking_issue', 'payment_refund', 'checkin_access', 'listing_accuracy', 'host_payout', 'account', 'other')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_user', 'resolved', 'closed')),
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  stay_id UUID REFERENCES stays(id) ON DELETE SET NULL,
  host_id UUID REFERENCES users(id) ON DELETE SET NULL,
  guest_id UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_staff_id UUID REFERENCES users(id) ON DELETE SET NULL,
  sla_due_at TIMESTAMPTZ,
  subject TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  resolution_summary TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status, priority, created_at DESC);

CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id UUID PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
  is_internal_note BOOLEAN NOT NULL DEFAULT FALSE,
  body TEXT NOT NULL,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON support_ticket_messages(ticket_id, created_at ASC);

CREATE TABLE IF NOT EXISTS safety_reports (
  id UUID PRIMARY KEY,
  report_type TEXT NOT NULL CHECK (report_type IN ('misleading_listing', 'suspicious_account', 'safety_incident', 'dispute', 'policy_violation')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'action_taken', 'dismissed')),
  stay_id UUID REFERENCES stays(id) ON DELETE SET NULL,
  reported_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  reporter_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_staff_id UUID REFERENCES users(id) ON DELETE SET NULL,
  summary TEXT NOT NULL,
  evidence_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  action_taken TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_safety_reports_status ON safety_reports(status, severity, created_at DESC);

-- 8. Local Partners, Destinations Neighborhoods & Centralized Local Discovery (Single Source of Truth)
CREATE TABLE IF NOT EXISTS local_partners (
  id UUID PRIMARY KEY,
  business_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('restaurant', 'cafe', 'coworking', 'gym_yoga', 'transport', 'experience', 'essential')),
  destination_id UUID REFERENCES destinations(id) ON DELETE SET NULL,
  contact_name TEXT NOT NULL DEFAULT '',
  contact_email TEXT NOT NULL DEFAULT '',
  contact_phone TEXT NOT NULL DEFAULT '',
  assigned_staff_id UUID REFERENCES users(id) ON DELETE SET NULL,
  partnership_status TEXT NOT NULL DEFAULT 'prospect' CHECK (partnership_status IN ('prospect', 'in_discussion', 'active', 'paused', 'ended')),
  contract_ref TEXT NOT NULL DEFAULT '',
  perk_offer TEXT NOT NULL DEFAULT '',
  commission_terms TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_local_partners_dest ON local_partners(destination_id, partnership_status);

CREATE TABLE IF NOT EXISTS neighborhoods (
  id UUID PRIMARY KEY,
  destination_id UUID NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_vi TEXT NOT NULL,
  summary_en TEXT NOT NULL DEFAULT '',
  summary_vi TEXT NOT NULL DEFAULT '',
  guide_en TEXT NOT NULL DEFAULT '',
  guide_vi TEXT NOT NULL DEFAULT '',
  map_x NUMERIC(5,2) NOT NULL DEFAULT 50,
  map_y NUMERIC(5,2) NOT NULL DEFAULT 50,
  UNIQUE (destination_id, slug)
);

CREATE TABLE IF NOT EXISTS places (
  id UUID PRIMARY KEY,
  destination_id UUID NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
  neighborhood_id UUID REFERENCES neighborhoods(id) ON DELETE SET NULL,
  partner_id UUID REFERENCES local_partners(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN ('restaurant', 'cafe', 'coworking', 'gym_yoga', 'entertainment', 'attraction', 'transport', 'essential', 'event_venue')),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  lat NUMERIC(9,6),
  lng NUMERIC(9,6),
  image_url TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  description_vi TEXT NOT NULL DEFAULT '',
  price_range TEXT NOT NULL DEFAULT '$$',
  opening_hours TEXT NOT NULL DEFAULT '08:00 - 22:00',
  data_source TEXT NOT NULL DEFAULT 'curated_team',
  verification_status TEXT NOT NULL DEFAULT 'verified' CHECK (verification_status IN ('unverified', 'verified', 'outdated')),
  last_verified_at TIMESTAMPTZ DEFAULT NOW(),
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_places_dest_cat ON places(destination_id, category, verification_status);

CREATE TABLE IF NOT EXISTS stay_nearby_places (
  stay_id UUID NOT NULL REFERENCES stays(id) ON DELETE CASCADE,
  place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  distance_label TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (stay_id, place_id)
);

-- 9. Task Center (linked to CRM & operations entities)
CREATE TABLE IF NOT EXISTS admin_tasks (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'blocked', 'done')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assigned_staff_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  due_at TIMESTAMPTZ,
  entity_type TEXT NOT NULL DEFAULT 'general' CHECK (entity_type IN ('general', 'host_lead', 'host', 'guest', 'stay', 'booking', 'ticket', 'payout', 'refund')),
  entity_id TEXT NOT NULL DEFAULT '',
  auto_rule_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_tasks_assignee ON admin_tasks(assigned_staff_id, status, due_at);

CREATE TABLE IF NOT EXISTS admin_task_comments (
  id UUID PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES admin_tasks(id) ON DELETE CASCADE,
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Marketing, Content & SEO, Promotions & Attribution Funnel
CREATE TABLE IF NOT EXISTS cms_contents (
  id UUID PRIMARY KEY,
  content_type TEXT NOT NULL CHECK (content_type IN ('article', 'landing_page', 'destination_guide')),
  category TEXT NOT NULL DEFAULT 'living_guide',
  slug TEXT NOT NULL UNIQUE,
  title_en TEXT NOT NULL,
  title_vi TEXT NOT NULL,
  body_en TEXT NOT NULL DEFAULT '',
  body_vi TEXT NOT NULL DEFAULT '',
  destination_id UUID REFERENCES destinations(id) ON DELETE SET NULL,
  seo_title TEXT NOT NULL DEFAULT '',
  seo_description TEXT NOT NULL DEFAULT '',
  canonical_url TEXT NOT NULL DEFAULT '',
  redirect_to TEXT NOT NULL DEFAULT '',
  robots_index BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cms_contents_status ON cms_contents(content_type, status);

CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'organic',
  utm_source TEXT NOT NULL DEFAULT '',
  utm_medium TEXT NOT NULL DEFAULT '',
  utm_campaign TEXT NOT NULL UNIQUE,
  budget_vnd BIGINT NOT NULL DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promotions (
  id UUID PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed_vnd')),
  discount_value INTEGER NOT NULL,
  min_nights INTEGER NOT NULL DEFAULT 7,
  max_uses INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  campaign_id UUID REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
  valid_from DATE NOT NULL,
  valid_to DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attribution_events (
  id UUID PRIMARY KEY,
  session_key TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL CHECK (event_name IN ('page_view', 'search', 'stay_view', 'checkout_start', 'booking_completed')),
  stay_id UUID REFERENCES stays(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  utm_source TEXT NOT NULL DEFAULT '',
  utm_medium TEXT NOT NULL DEFAULT '',
  utm_campaign TEXT NOT NULL DEFAULT '',
  referrer TEXT NOT NULL DEFAULT '',
  landing_path TEXT NOT NULL DEFAULT '/',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_attr_events_funnel ON attribution_events(event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attr_events_campaign ON attribution_events(utm_campaign, created_at DESC);

-- 11. Executive Management Reports & Workflow Automation Rules
CREATE TABLE IF NOT EXISTS management_reports (
  id UUID PRIMARY KEY,
  department TEXT NOT NULL,
  period_label TEXT NOT NULL,
  submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  results_summary TEXT NOT NULL,
  target_comparison TEXT NOT NULL DEFAULT '',
  issues_raised TEXT NOT NULL DEFAULT '',
  root_cause_analysis TEXT NOT NULL DEFAULT '',
  proposed_actions TEXT NOT NULL DEFAULT '',
  next_plan TEXT NOT NULL DEFAULT '',
  approval_request TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'changes_requested', 'approved')),
  executive_comment TEXT NOT NULL DEFAULT '',
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mgmt_reports_status ON management_reports(status, created_at DESC);

CREATE TABLE IF NOT EXISTS automation_rules (
  id UUID PRIMARY KEY,
  rule_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  trigger_event TEXT NOT NULL,
  action_type TEXT NOT NULL DEFAULT 'create_task',
  action_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
