-- Migration 012: Fix fail_stale_documents() to use last_queued_at instead of created_at
--
-- Root cause: fail_stale_documents() checked created_at < now() - 10min.
-- When admin clicked Retry, the retry endpoint reset status to 'pending' but
-- created_at was never updated (original upload timestamp). So fail_stale_documents()
-- would immediately mark the retried document as failed again on its next 5-min run.
--
-- Fix: add last_queued_at column, set it on upload and retry, use it in the stale check.

ALTER TABLE ccr_documents
  ADD COLUMN IF NOT EXISTS last_queued_at timestamptz;

-- Backfill: existing rows get created_at as their queued time.
-- Rows already in 'failed'/'completed' won't be re-checked (stale check only touches
-- 'pending'/'processing'), but we populate them anyway for completeness.
UPDATE ccr_documents
  SET last_queued_at = created_at
  WHERE last_queued_at IS NULL;

-- Replace fail_stale_documents to use last_queued_at.
-- A document can only time out 10 minutes AFTER it was last queued (not after creation).
CREATE OR REPLACE FUNCTION fail_stale_documents()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE ccr_documents
  SET
    status        = 'failed',
    error_message = 'Processing timed out — retry from admin panel',
    processed_at  = now()
  WHERE
    status IN ('pending', 'processing')
    AND last_queued_at IS NOT NULL
    AND last_queued_at < now() - INTERVAL '10 minutes';
$$;
