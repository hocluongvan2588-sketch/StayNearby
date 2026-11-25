-- Phase 5: Admin CRM profile segmentation & internal notes (strictly server/admin only)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS crm_stage TEXT NOT NULL DEFAULT 'new'
    CHECK (crm_stage IN ('new', 'active', 'vip', 'follow_up', 'archived')),
  ADD COLUMN IF NOT EXISTS crm_note TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS crm_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS crm_updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_crm_stage ON profiles(crm_stage, updated_at DESC);

-- Ensure internal CRM columns are never readable directly via Supabase anon/authenticated roles
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE SELECT (crm_stage, crm_note, crm_updated_at, crm_updated_by) ON profiles FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE SELECT (crm_stage, crm_note, crm_updated_at, crm_updated_by) ON profiles FROM authenticated;
  END IF;
END $$;
