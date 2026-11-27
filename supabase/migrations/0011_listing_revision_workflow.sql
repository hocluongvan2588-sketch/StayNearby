-- 0011: Listing Revision workflow (approve/reject columns on stay_revisions)
-- ============================================================================
-- STATUS: APPLIED to du_lich (Supabase) on 2026-11-27 via connector;
-- recorded in schema_migrations as 0011_listing_revision_workflow.sql.
-- (Do NOT re-run against du_lich.)
--
-- Context: 0010 created stay_revisions as an append-only history table with no
-- workflow columns. This migration adds the review lifecycle used by the
-- Listing Revision feature:
--   * `applied`  — historical rows captured outside the review flow
--                  (create / publish / unpublish / moderate)
--   * `pending`  — a live-listing edit (price/policy) awaiting admin approval
--                  (at most ONE per stay, enforced by partial unique index)
--   * `approved` — reviewed and applied to the live listing
--   * `rejected` — reviewed and discarded (also used for superseded pendings)

BEGIN;

ALTER TABLE stay_revisions
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'applied'
    CHECK (status IN ('applied', 'pending', 'approved', 'rejected'));

ALTER TABLE stay_revisions
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE stay_revisions
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

ALTER TABLE stay_revisions
  ADD COLUMN IF NOT EXISTS review_note TEXT;

-- At most one pending revision per stay (host edits supersede the previous one).
CREATE UNIQUE INDEX IF NOT EXISTS uq_stay_revisions_one_pending
  ON stay_revisions (stay_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_stay_revisions_status
  ON stay_revisions (status, created_at DESC)
  WHERE status = 'pending';

COMMENT ON COLUMN stay_revisions.status IS
  'Review lifecycle: applied (history) | pending (awaiting approval) | approved | rejected.';

COMMIT;
