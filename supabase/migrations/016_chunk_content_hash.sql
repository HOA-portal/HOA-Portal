-- Add content_hash to ccr_chunks for deduplication.
-- Prevents identical chunks from being inserted multiple times when the same
-- PDF is re-uploaded (each re-upload creates a new ccr_documents row but
-- the chunks themselves are identical byte-for-byte).
ALTER TABLE ccr_chunks ADD COLUMN content_hash text;

-- Backfill existing rows so the NOT NULL constraint can be applied.
UPDATE ccr_chunks SET content_hash = md5(content);

ALTER TABLE ccr_chunks ALTER COLUMN content_hash SET NOT NULL;

-- Unique per document — same text can appear in different documents (boilerplate)
-- but must not be duplicated within the same processing run.
CREATE UNIQUE INDEX ccr_chunks_document_hash_idx ON ccr_chunks(document_id, content_hash);
