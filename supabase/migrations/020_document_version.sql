-- Add version column to ccr_documents for document versioning.
-- Re-uploading a file with the same filename creates a new version instead of overwriting.
ALTER TABLE ccr_documents
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

-- Re-number any pre-existing duplicate filenames per HOA so each gets a unique
-- sequential version before the unique index is created.
-- Rows are ordered by created_at so the oldest upload keeps version=1.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY hoa_id, filename ORDER BY created_at) AS rn
  FROM ccr_documents
)
UPDATE ccr_documents d
SET version = r.rn
FROM ranked r
WHERE d.id = r.id;

-- Prevents duplicate versions and forces explicit handling of concurrent upload races.
CREATE UNIQUE INDEX IF NOT EXISTS ccr_documents_version_idx
  ON ccr_documents(hoa_id, filename, version);
