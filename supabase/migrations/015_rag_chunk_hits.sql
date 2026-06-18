-- Track which specific chunks are returned for each RAG query.
-- Enables identifying hot/cold chunks and detecting low-quality retrievals.
CREATE TABLE rag_chunk_hits (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  hoa_id         uuid NOT NULL REFERENCES hoas(id) ON DELETE CASCADE,
  chunk_id       uuid NOT NULL REFERENCES ccr_chunks(id) ON DELETE CASCADE,
  query_log_id   uuid REFERENCES rag_query_logs(id) ON DELETE SET NULL,
  rank_position  integer NOT NULL,       -- 0-based position in final result set
  similarity     numeric(6,4),           -- RRF score
  created_at     timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX rag_chunk_hits_hoa_chunk_idx  ON rag_chunk_hits(hoa_id, chunk_id);
CREATE INDEX rag_chunk_hits_query_log_idx  ON rag_chunk_hits(query_log_id);

ALTER TABLE rag_chunk_hits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_read_chunk_hits" ON rag_chunk_hits
  FOR SELECT USING (hoa_id = my_hoa_id() AND my_role() = 'admin');
