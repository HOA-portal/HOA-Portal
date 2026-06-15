-- Migration 011: Public RPC wrappers for pgmq read + delete
-- Root cause fix: Edge Function calls supabase.rpc('pgmq_read', ...) and
-- supabase.rpc('pgmq_delete', ...) but PostgREST only exposes public schema
-- functions. pgmq.read/delete live in the pgmq schema and were never wrapped.
-- Migration 005 created enqueue_document_processing (wraps pgmq.send) but
-- forgot the read/delete side. Result: queue never drains, docs stay 'pending'.

-- pgmq_read: wraps pgmq.read() — param names match the Edge Function call
-- (index.ts line 115-119: sleep_seconds, n)
create or replace function pgmq_read(
  queue_name    text,
  sleep_seconds int,
  n             int
)
returns setof pgmq.message_record
language sql
security definer
set search_path = public, pgmq
as $$
  select * from pgmq.read(queue_name, sleep_seconds, n);
$$;

-- pgmq_delete: wraps pgmq.delete() — acks a processed message
-- (index.ts line 224: queue_name, msg_id)
create or replace function pgmq_delete(
  queue_name text,
  msg_id     bigint
)
returns boolean
language sql
security definer
set search_path = public, pgmq
as $$
  select pgmq.delete(queue_name, msg_id);
$$;
