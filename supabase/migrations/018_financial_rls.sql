-- Migration 018: RLS policies for financial tables
-- Residents: read-only for full transparency and audit.
-- Admins: full CRUD. Closed-period immutability enforced at API layer.

alter table financial_categories enable row level security;
alter table financial_periods    enable row level security;
alter table financial_entries    enable row level security;

-- ============================================================
-- financial_categories
-- ============================================================
create policy "HOA members read financial categories"
  on financial_categories for select
  using (hoa_id = my_hoa_id());

create policy "Admins manage financial categories"
  on financial_categories for all
  using (hoa_id = my_hoa_id() and my_role() = 'admin')
  with check (hoa_id = my_hoa_id() and my_role() = 'admin');

-- ============================================================
-- financial_periods
-- ============================================================
create policy "HOA members read financial periods"
  on financial_periods for select
  using (hoa_id = my_hoa_id());

create policy "Admins insert financial periods"
  on financial_periods for insert
  with check (hoa_id = my_hoa_id() and my_role() = 'admin');

create policy "Admins update financial periods"
  on financial_periods for update
  using (hoa_id = my_hoa_id() and my_role() = 'admin')
  with check (hoa_id = my_hoa_id() and my_role() = 'admin');

create policy "Admins delete open financial periods"
  on financial_periods for delete
  using (hoa_id = my_hoa_id() and my_role() = 'admin');

-- ============================================================
-- financial_entries
-- ============================================================
create policy "HOA members read financial entries"
  on financial_entries for select
  using (hoa_id = my_hoa_id());

create policy "Admins manage financial entries"
  on financial_entries for all
  using (hoa_id = my_hoa_id() and my_role() = 'admin')
  with check (hoa_id = my_hoa_id() and my_role() = 'admin');
