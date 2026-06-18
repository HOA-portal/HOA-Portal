-- Migration 017: Financial ledger — periods, entries, categories
-- Gives HOA admins a structured monthly ledger for income/expenses.
-- Residents get read-only access for audit and transparency.

-- ============================================================
-- financial_categories: customizable per HOA
-- ============================================================
create table financial_categories (
  id          uuid primary key default uuid_generate_v4(),
  hoa_id      uuid not null references hoas(id) on delete cascade,
  name        text not null,
  type        text not null check (type in ('income', 'expense')),
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create unique index financial_categories_hoa_name_idx
  on financial_categories (hoa_id, name);

create index financial_categories_hoa_type_idx
  on financial_categories (hoa_id, type, sort_order);

-- ============================================================
-- financial_periods: one per calendar month per HOA
-- ============================================================
create type financial_period_status as enum ('open', 'closed');

create table financial_periods (
  id             uuid primary key default uuid_generate_v4(),
  hoa_id         uuid not null references hoas(id) on delete cascade,
  year           integer not null check (year >= 2000 and year <= 2100),
  month          integer not null check (month >= 1 and month <= 12),
  status         financial_period_status not null default 'open',
  total_income   numeric(12,2) not null default 0,
  total_expenses numeric(12,2) not null default 0,
  notes          text,
  closed_by      uuid references profiles(id),
  closed_at      timestamptz,
  created_by     uuid not null references profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create unique index financial_periods_hoa_year_month_idx
  on financial_periods (hoa_id, year, month);

create index financial_periods_hoa_status_idx
  on financial_periods (hoa_id, status, year desc, month desc);

create trigger financial_periods_updated_at
  before update on financial_periods
  for each row execute procedure update_updated_at_column();

-- ============================================================
-- financial_entries: individual income/expense line items
-- ============================================================
create type financial_entry_type as enum ('income', 'expense');

create table financial_entries (
  id          uuid primary key default uuid_generate_v4(),
  hoa_id      uuid not null references hoas(id) on delete cascade,
  period_id   uuid not null references financial_periods(id) on delete cascade,
  category_id uuid not null references financial_categories(id),
  type        financial_entry_type not null,
  description text not null,
  amount      numeric(12,2) not null check (amount > 0),
  entry_date  date not null,
  vendor      text,
  receipt_url text,
  created_by  uuid not null references profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index financial_entries_period_idx
  on financial_entries (period_id);

create index financial_entries_hoa_date_idx
  on financial_entries (hoa_id, entry_date desc);

create trigger financial_entries_updated_at
  before update on financial_entries
  for each row execute procedure update_updated_at_column();

-- ============================================================
-- Trigger: keep period totals in sync automatically
-- Fires after any insert/update/delete on financial_entries,
-- recomputing total_income and total_expenses for that period.
-- ============================================================
create or replace function sync_period_totals()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_period_id uuid;
begin
  v_period_id := coalesce(NEW.period_id, OLD.period_id);

  update financial_periods
  set
    total_income = coalesce((
      select sum(amount)
      from financial_entries
      where period_id = v_period_id and type = 'income'
    ), 0),
    total_expenses = coalesce((
      select sum(amount)
      from financial_entries
      where period_id = v_period_id and type = 'expense'
    ), 0),
    updated_at = now()
  where id = v_period_id;

  return coalesce(NEW, OLD);
end;
$$;

create trigger financial_entries_sync_totals
  after insert or update or delete on financial_entries
  for each row execute procedure sync_period_totals();

-- ============================================================
-- seed_default_financial_categories: called once per HOA
-- on creation of the first financial period.
-- ============================================================
create or replace function seed_default_financial_categories(
  p_hoa_id   uuid,
  p_admin_id uuid
)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  insert into financial_categories (hoa_id, name, type, sort_order)
  values
    (p_hoa_id, 'Taxa de Condomínio',  'income',  0),
    (p_hoa_id, 'Multas e Juros',      'income',  1),
    (p_hoa_id, 'Outros (Receita)',    'income',  2),
    (p_hoa_id, 'Manutenção',          'expense', 0),
    (p_hoa_id, 'Segurança',           'expense', 1),
    (p_hoa_id, 'Limpeza',             'expense', 2),
    (p_hoa_id, 'Jardins',             'expense', 3),
    (p_hoa_id, 'Administrativo',      'expense', 4),
    (p_hoa_id, 'Utilities',           'expense', 5),
    (p_hoa_id, 'Fundo de Reserva',    'expense', 6),
    (p_hoa_id, 'Obras',               'expense', 7),
    (p_hoa_id, 'Outros',              'expense', 8)
  on conflict (hoa_id, name) do nothing;
end;
$$;
