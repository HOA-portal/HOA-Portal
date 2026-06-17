ALTER TABLE ccr_documents
  ADD COLUMN IF NOT EXISTS embedding_tokens integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ocr_tokens integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN ccr_documents.embedding_tokens IS 'Total tokens used for embedding generation (OpenAI text-embedding-3-small)';
COMMENT ON COLUMN ccr_documents.ocr_tokens IS 'Total tokens used for OCR (Claude Haiku output tokens)';
