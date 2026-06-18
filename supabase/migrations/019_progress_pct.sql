-- Add progress_pct to ccr_documents for UI progress bar during PDF processing.
-- The Edge Function and fallback route update this at processing milestones.
ALTER TABLE ccr_documents
  ADD COLUMN IF NOT EXISTS progress_pct integer NOT NULL DEFAULT 0
  CHECK (progress_pct >= 0 AND progress_pct <= 100);
