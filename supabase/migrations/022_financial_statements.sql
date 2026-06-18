-- financial_statements: tracks uploaded monthly financial statement PDFs.
-- Admin uploads a PDF → system parses it with Claude → admin reviews →
-- one-click import creates financial_entries for that period.

CREATE TABLE financial_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hoa_id uuid NOT NULL REFERENCES hoas(id) ON DELETE CASCADE,
  filename text NOT NULL,
  storage_path text NOT NULL,
  year integer,
  month integer,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'review', 'imported', 'failed')),
  parsed_data jsonb,
  error_message text,
  uploaded_by uuid NOT NULL REFERENCES profiles(id),
  imported_period_id uuid REFERENCES financial_periods(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

ALTER TABLE financial_statements ENABLE ROW LEVEL SECURITY;

CREATE INDEX financial_statements_hoa_status_idx ON financial_statements(hoa_id, status);
CREATE INDEX financial_statements_hoa_period_idx ON financial_statements(hoa_id, year, month);

-- RLS: admins only — residents never access raw financial PDFs
CREATE POLICY "Admins can view financial statements"
  ON financial_statements FOR SELECT
  USING (hoa_id = my_hoa_id() AND my_role() = 'admin');

CREATE POLICY "Admins can insert financial statements"
  ON financial_statements FOR INSERT
  WITH CHECK (hoa_id = my_hoa_id() AND my_role() = 'admin');

CREATE POLICY "Admins can update financial statements"
  ON financial_statements FOR UPDATE
  USING (hoa_id = my_hoa_id() AND my_role() = 'admin')
  WITH CHECK (hoa_id = my_hoa_id() AND my_role() = 'admin');

CREATE POLICY "Admins can delete financial statements"
  ON financial_statements FOR DELETE
  USING (hoa_id = my_hoa_id() AND my_role() = 'admin');

-- Storage bucket for financial statement PDFs (private, admin-only).
-- The bucket is created here for local Supabase; for remote projects
-- the bucket must also exist in the Supabase dashboard.
INSERT INTO storage.buckets (id, name, public)
VALUES ('financial-statements', 'financial-statements', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins upload financial statement PDFs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'financial-statements' AND my_role() = 'admin');

CREATE POLICY "Admins read financial statement PDFs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'financial-statements' AND my_role() = 'admin');

CREATE POLICY "Admins delete financial statement PDFs"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'financial-statements' AND my_role() = 'admin');
