-- setup-production.sql
-- One-time configuration for Supabase Cloud production instances.
-- Run this in: Supabase Dashboard → SQL Editor (NOT as a migration).
--
-- Required for: pg_cron job in migration 010 to call the process-document Edge Function.
-- If not set, documents will stay in 'pending' state and be eventually marked 'failed'
-- by fail_stale_documents() after 10 minutes.
--
-- The fallback direct-processing route (/api/admin/documents/process) works WITHOUT
-- this configuration — so documents WILL be processed even if this is not set,
-- as long as the Next.js app is deployed.

-- Step 1: Replace the placeholders and run these two lines.
ALTER DATABASE postgres SET app.supabase_url = 'https://<your-project-ref>.supabase.co';
ALTER DATABASE postgres SET app.service_role_key = '<your-service-role-key>';

-- Step 2: Reload configuration (takes effect immediately without a restart).
SELECT pg_reload_conf();

-- Step 3: Verify the settings took effect.
SELECT
  current_setting('app.supabase_url')     AS supabase_url,
  left(current_setting('app.service_role_key'), 10) || '...' AS service_role_key_prefix;

-- ── Checklist before running ─────────────────────────────────────────────
-- [ ] pg_cron extension enabled: Dashboard → Database → Extensions → pg_cron
-- [ ] pg_net extension enabled:  Dashboard → Database → Extensions → pg_net
-- [ ] pgmq extension enabled:    Dashboard → Database → Extensions → pgmq
-- [ ] All migrations applied (001 through 013)
-- [ ] Edge Function deployed: supabase functions deploy process-document
-- [ ] Edge Function env vars set in Dashboard → Edge Functions → process-document → Secrets:
--       OPENAI_API_KEY
--       ANTHROPIC_API_KEY
--       SUPABASE_URL (auto-injected)
--       SUPABASE_SERVICE_ROLE_KEY (auto-injected)
