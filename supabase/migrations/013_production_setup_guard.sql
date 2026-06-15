-- Migration 013: Production setup guard + idempotent RPC checks
--
-- This migration verifies that all critical components for the RAG pipeline are in place.
-- It is safe to re-run (all statements are idempotent).
--
-- AFTER running this migration, execute the following in the Supabase SQL Editor
-- (NOT as a migration — these are one-time instance-level settings):
--
--   ALTER DATABASE postgres SET app.supabase_url = 'https://<your-ref>.supabase.co';
--   ALTER DATABASE postgres SET app.service_role_key = '<your-service-role-key>';
--   SELECT pg_reload_conf();
--
-- These settings are required for the pg_cron job (migration 010) to call the
-- Edge Function. Without them, documents will never be drained from the queue
-- by the cron schedule. The fallback direct-processing route (/api/admin/documents/process)
-- works without this configuration.

-- ── Guard: pgmq_read must exist (migration 011) ──────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_name = 'pgmq_read'
  ) THEN
    RAISE EXCEPTION
      'pgmq_read function not found. Apply migration 011 before 013.';
  END IF;
END $$;

-- ── Guard: pgmq_delete must exist (migration 011) ────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_name = 'pgmq_delete'
  ) THEN
    RAISE EXCEPTION
      'pgmq_delete function not found. Apply migration 011 before 013.';
  END IF;
END $$;

-- ── Guard: last_queued_at column must exist (migration 012) ──────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ccr_documents'
      AND column_name = 'last_queued_at'
  ) THEN
    RAISE EXCEPTION
      'ccr_documents.last_queued_at column not found. Apply migration 012 before 013.';
  END IF;
END $$;

-- ── Guard: match_ccr_chunks_with_context must exist (migration 007) ───────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public'
      AND routine_name = 'match_ccr_chunks_with_context'
  ) THEN
    RAISE EXCEPTION
      'match_ccr_chunks_with_context not found. Apply migration 007 before 013.';
  END IF;
END $$;

-- ── Notify about manual configuration required ────────────────────────────
DO $$
DECLARE
  supabase_url text;
BEGIN
  BEGIN
    supabase_url := current_setting('app.supabase_url');
  EXCEPTION WHEN OTHERS THEN
    supabase_url := NULL;
  END;

  IF supabase_url IS NULL OR supabase_url = '' THEN
    RAISE NOTICE
      E'ACTION REQUIRED: app.supabase_url is not set.\n'
      'Run this in the Supabase SQL Editor (not as a migration):\n'
      '  ALTER DATABASE postgres SET app.supabase_url = ''https://<ref>.supabase.co'';\n'
      '  ALTER DATABASE postgres SET app.service_role_key = ''<service-role-key>'';\n'
      '  SELECT pg_reload_conf();\n'
      'Without this, the pg_cron queue drain will not fire.';
  ELSE
    RAISE NOTICE 'app.supabase_url is configured: %', supabase_url;
  END IF;
END $$;
