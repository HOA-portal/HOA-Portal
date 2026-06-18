-- Dead Letter Queue for documents that fail processing after POISON_PILL_LIMIT attempts.
-- Provides visibility into stuck documents and allows admin retry/purge.

CREATE TABLE ccr_dlq (
  id          bigserial PRIMARY KEY,
  hoa_id      uuid NOT NULL REFERENCES hoas(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES ccr_documents(id) ON DELETE CASCADE,
  msg_id      bigint NOT NULL,
  read_ct     integer NOT NULL,
  enqueued_at timestamptz NOT NULL,
  failed_at   timestamptz DEFAULT now() NOT NULL,
  last_error  text,
  raw_message jsonb NOT NULL,
  retried_at  timestamptz          -- NULL = never retried; set by the retry route
);

CREATE INDEX ccr_dlq_hoa_idx ON ccr_dlq(hoa_id);

ALTER TABLE ccr_dlq ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_read_dlq" ON ccr_dlq
  FOR SELECT USING (hoa_id = my_hoa_id() AND my_role() = 'admin');

-- SECURITY DEFINER so the Edge Function (service role) can insert without RLS bypass.
CREATE OR REPLACE FUNCTION dlq_insert(
  p_hoa_id      uuid,
  p_document_id uuid,
  p_msg_id      bigint,
  p_read_ct     integer,
  p_enqueued_at timestamptz,
  p_last_error  text,
  p_raw_message jsonb
) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO ccr_dlq(hoa_id, document_id, msg_id, read_ct, enqueued_at, last_error, raw_message)
  VALUES (p_hoa_id, p_document_id, p_msg_id, p_read_ct, p_enqueued_at, p_last_error, p_raw_message);
$$;
