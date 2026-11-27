-- 0010: Listing Revision Management + Row Level Security baseline
-- ============================================================================
-- STATUS: DRAFT — created for review only. NOT applied to any environment
-- until explicitly approved. Apply only via `npm run db:migrate` after sign-off.
--
-- Context:
--   * The application talks to PostgreSQL through the server-side pool as
--     `postgres` (BYPASSRLS), so enabling RLS does not affect app queries.
--   * Supabase `service_role` also bypasses RLS; `anon` / `authenticated`
--     (PostgREST) receive no policies here → deny-by-default.
--   * PGlite test runs execute migrations as the table owner/superuser, which
--     also bypasses RLS.
--
-- Sections:
--   1. Listing Revision Management (stay_revisions schema foundation)
--   2. Row Level Security baseline on all public tables
-- ============================================================================

BEGIN;

-- ── 1. Listing Revision Management ──────────────────────────────────────────
-- Append-only revision history for listings (stays). This migration creates
-- the schema only; the capture/write path lands with the Listing Revision
-- feature in a follow-up phase.

CREATE TABLE IF NOT EXISTS stay_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stay_id UUID NOT NULL REFERENCES stays(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL
    CHECK (action IN ('create', 'update', 'publish', 'unpublish', 'moderate', 'restore')),
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  changed_fields TEXT[] NOT NULL DEFAULT '{}',
  change_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stay_revisions_stay_created
  ON stay_revisions (stay_id, created_at DESC);

COMMENT ON TABLE stay_revisions IS
  'Append-only revision history for listings (stays). Schema-only in 0010; capture wiring lands with the Listing Revision feature.';

-- ── 2. Row Level Security baseline ──────────────────────────────────────────
-- Enable RLS on every public table (deny-by-default for anon/authenticated).
-- No per-role policies are granted here on purpose: the app only queries via
-- the server-side pool (`postgres`, BYPASSRLS). Add explicit policies per
-- feature if/when PostgREST access is introduced.

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
  END LOOP;
END $$;

COMMIT;
