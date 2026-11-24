-- Phase 3: Operational Hardening, Outbox Retries & Job Run Audit Log

ALTER TABLE outbox
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS ops_job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  processed_count INTEGER NOT NULL DEFAULT 0,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ops_job_runs_started ON ops_job_runs(started_at DESC);

ALTER TABLE ops_job_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ops_job_runs_no_public_access ON ops_job_runs;
CREATE POLICY ops_job_runs_no_public_access
  ON ops_job_runs FOR ALL
  USING (FALSE)
  WITH CHECK (FALSE);
