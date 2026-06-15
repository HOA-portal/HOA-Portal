-- Migration 010: RAG pipeline reliability + performance improvements
-- Fixes: documents staying 'pending' forever (pg_cron was commented out)
-- Adds: stale document timeout, HNSW vector index, pg_cron drain schedule

-- ============================================================
-- Prerequisite guard: fail loudly if extensions unavailable
-- Enable pg_cron and pg_net in Supabase Dashboard →
-- Database → Extensions before running this migration.
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    RAISE EXCEPTION 'pg_cron extension is required. Enable it in Supabase Dashboard → Database → Extensions.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_net') THEN
    RAISE EXCEPTION 'pg_net extension is required. Enable it in Supabase Dashboard → Database → Extensions.';
  END IF;
END $$;

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ============================================================
-- pg_cron: reliable queue drain — triggers Edge Function every minute
-- After running this migration, set the connection config once:
--   For production:
--     ALTER DATABASE postgres SET app.supabase_url = 'https://<ref>.supabase.co';
--     ALTER DATABASE postgres SET app.service_role_key = '<service-role-key>';
--   For local dev:
--     ALTER DATABASE postgres SET app.supabase_url = 'http://127.0.0.1:54321';
--     ALTER DATABASE postgres SET app.service_role_key = '<local-service-role-key>';
-- ============================================================
-- Idempotent: unschedule first in case this migration is re-run
do $$ begin perform cron.unschedule('trigger-process-document'); exception when others then null; end $$;

select cron.schedule(
  'trigger-process-document',
  '* * * * *',
  $$
    select net.http_post(
      url     := current_setting('app.supabase_url') || '/functions/v1/process-document',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body    := '{}'::jsonb
    );
  $$
);

-- ============================================================
-- Stale document timeout
-- Marks any document stuck in pending/processing for > 10 minutes as failed.
-- Prevents documents from disappearing silently; admin sees clear error.
-- ============================================================
create or replace function fail_stale_documents()
returns void
language sql
security definer
set search_path = public
as $$
  update ccr_documents
  set
    status        = 'failed',
    error_message = 'Processing timed out — retry from admin panel',
    processed_at  = now()
  where
    status in ('pending', 'processing')
    and created_at < now() - interval '10 minutes';
$$;

-- Idempotent: unschedule first in case this migration is re-run
do $$ begin perform cron.unschedule('fail-stale-documents'); exception when others then null; end $$;

-- Schedule stale-document check every 5 minutes
select cron.schedule(
  'fail-stale-documents',
  '*/5 * * * *',
  $$ select fail_stale_documents(); $$
);

-- ============================================================
-- Upgrade vector index: IVFFlat → HNSW
-- HNSW has better recall (~99%+) and never needs manual rebuilding as data grows.
-- Note: CONCURRENTLY is not allowed inside a transaction; dropped here.
-- The table lock during index creation is brief on an empty/small table.
-- ============================================================
drop index if exists ccr_chunks_embedding_idx;

create index ccr_chunks_embedding_idx
  on ccr_chunks using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);
